import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  DesignConfig, OrderItem, DeliveryInfo, PaymentInfo,
  Order, OrderLine, PopularDesign, InteractionMode, ImageState, PanelId,
} from './types'
import { uploadOrderAssets } from '../lib/storage'
import { limaPeriod } from '../lib/drive'
import { createOrder } from '../lib/sheets'
import { adminAuth, backendConfigured } from '../lib/adminApi'
import { useCatalog } from './catalog'
import { notifyNewOrder } from '../lib/telegram'
import { POPULAR_DESIGNS, POLO_COLORS, DELIVERY_RATES } from '../data/catalog'
import {
  MOLD_BY_ID, LAYOUTS, SAFE_MARGIN, SIZE_IDS, containBox, fitInside, layoutCells, sizeFactor,
  type SizeId,
} from '../data/molds'

/** Fecha ISO (UTC): no ambigua y Sheets/Apps Script la interpretan igual en cualquier región. */
const nowISO = () => new Date().toISOString()

function limaDateTime(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  })
}

/** Mide la imagen original (px). Si no carga, asume 1024×1024 para no bloquear el flujo. */
function measure(src: string): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const el = new Image()
    el.onload = () => resolve({ w: el.naturalWidth || 1024, h: el.naturalHeight || 1024 })
    el.onerror = () => resolve({ w: 1024, h: 1024 })
    el.src = src
  })
}

/** Estado inicial: imagen entra completa en el formato recomendado del molde. */
function initialState(panel: PanelId, aspect: number, index: number): ImageState {
  const mold = MOLD_BY_ID[panel], f = mold.recommended
  const [w, h] = containBox(aspect, f.w, f.h)
  const off = index * 1.5
  return fitInside(
    { x: f.cx - w / 2 + off, y: f.cy - h / 2 + off, width: w, height: h, rotation: 0, flipH: false },
    mold.limit,
  )
}

function makeId() {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

export const useStore = defineStore('polo', () => {
  // ── Design state ───────────────────────────────────
  const design = ref<DesignConfig>({
    poloColor: '#ffffff',
    sleeveType: 'short',
    popularDesignId: null,
    placedImages: [],
    activePanel: 'front',
    activeImageId: null,
  })

  const interactionMode = ref<InteractionMode>('transform')
  const renderCaptures = ref<string[]>([])

  // ── Order state ────────────────────────────────────
  const orderItem = ref<OrderItem>({
    size: 'M',
    quantity: 1,
    pricePerUnit: 45,
  })

  /** Variantes del pedido (talla · color · cantidad). La estampa es la misma para todas. */
  const lines = ref<OrderLine[]>([])
  const linesTouched = ref(false)
  const MAX_LINES = 10, MAX_PER_LINE = 50

  const delivery = ref<DeliveryInfo>({
    recipientName: '', dni: '', phone: '',
    department: '', province: '', district: '',
    address: '', reference: '', rate: 15,
  })

  const payment = ref<PaymentInfo>({
    method: 'yape', voucherFile: null, voucherUrl: null,
  })

  const currentOrderId = ref<string | null>(null)
  const submitting = ref(false)
  const submitError = ref<string | null>(null)
  /** Progreso real del envío: se usa para el overlay de carga. */
  const submitProgress = ref<{ phase: 'idle' | 'upload' | 'register' | 'notify' | 'done'; done: number; total: number }>({
    phase: 'idle', done: 0, total: 0,
  })
  let pendingOrderId: string | null = null // se reutiliza al reintentar para no dejar carpetas huérfanas

  // ── Admin state ────────────────────────────────────
  const isAdmin = ref(false)
  const adminToken = ref('')
  const adminOrders = ref<Order[]>([])

  // ── Computed ───────────────────────────────────────
  const totalPieces = computed(() => lines.value.reduce((n, l) => n + l.quantity, 0))
  const subtotal = computed(() => orderItem.value.pricePerUnit * totalPieces.value)
  const total = computed(() => subtotal.value + delivery.value.rate)
  const popularDesigns = computed<PopularDesign[]>(() => POPULAR_DESIGNS)
  const deliveryRates = computed(() => DELIVERY_RATES)

  // Talla y factor de escala (talla M = 1.0)
  const sizeId = computed(() => orderItem.value.size as SizeId)
  const factor = computed(() => sizeFactor(sizeId.value))

  // ── Design actions ─────────────────────────────────
  function setPoloColor(color: string) { design.value.poloColor = color }
  function setSleeveType(type: 'short' | 'long') { design.value.sleeveType = type }
  function setInteractionMode(mode: InteractionMode) { interactionMode.value = mode }
  function setSize(size: SizeId) {
    orderItem.value.size = size
    if (!linesTouched.value && lines.value.length === 1) lines.value[0].size = size
  }

  // ── Variantes del pedido ───────────────────────────
  const lineId = () => `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
  const sameVariant = (a: OrderLine, b: OrderLine) => a.size === b.size && a.color === b.color

  /** Garantiza al menos una línea. Mientras el cliente no la toque, sigue la talla y el color del diseño. */
  function ensureLines() {
    if (lines.value.length === 0) {
      lines.value = [{ id: lineId(), size: sizeId.value, color: design.value.poloColor, quantity: 1 }]
    } else if (!linesTouched.value && lines.value.length === 1) {
      lines.value[0].size = sizeId.value
      lines.value[0].color = design.value.poloColor
    }
    orderItem.value.quantity = totalPieces.value
  }

  /** Une líneas idénticas (misma talla y color) sumando cantidades. */
  function mergeLines() {
    const out: OrderLine[] = []
    for (const l of lines.value) {
      const hit = out.find(o => sameVariant(o, l))
      if (hit) hit.quantity = Math.min(MAX_PER_LINE, hit.quantity + l.quantity)
      else out.push(l)
    }
    lines.value = out
    orderItem.value.quantity = totalPieces.value
  }

  function addLine(): boolean {
    if (lines.value.length >= MAX_LINES) return false
    linesTouched.value = true
    const cat = useCatalog()
    const last = lines.value[lines.value.length - 1]
    const lastColor = last?.color ?? design.value.poloColor
    // primera combinación libre y disponible, empezando por el color de la última variante
    const colorsOrder = [lastColor, ...cat.colors.map(c => c.value).filter(h => h.toLowerCase() !== lastColor.toLowerCase())]
    for (const hex of colorsOrder) {
      for (const s of cat.sizes) {
        if (lines.value.some(l => l.size === s && l.color.toLowerCase() === hex.toLowerCase()) || !cat.isAvailable(hex, s)) continue
        lines.value.push({ id: lineId(), size: s as SizeId, color: hex, quantity: 1 })
        orderItem.value.quantity = totalPieces.value
        return true
      }
    }
    lines.value.push({ id: lineId(), size: 'M', color: lastColor, quantity: 1 })
    orderItem.value.quantity = totalPieces.value
    return true
  }

  function updateLine(id: string, patch: Partial<Pick<OrderLine, 'size' | 'color' | 'quantity'>>) {
    const l = lines.value.find(x => x.id === id)
    if (!l) return
    linesTouched.value = true
    if (patch.size) l.size = patch.size
    if (patch.color) l.color = patch.color
    if (patch.quantity !== undefined) l.quantity = Math.max(1, Math.min(MAX_PER_LINE, Math.round(patch.quantity)))
    // No se fusionan aquí: la línea que el cliente está editando no debe desaparecer. Se unen al continuar.
    orderItem.value.quantity = totalPieces.value
  }

  function removeLine(id: string) {
    if (lines.value.length <= 1) return
    linesTouched.value = true
    lines.value = lines.value.filter(l => l.id !== id)
    orderItem.value.quantity = totalPieces.value
  }

  async function addImageToPanel(src: string, file: File | null, panel?: PanelId): Promise<string> {
    if (design.value.placedImages.length >= 6) return ''
    const target = panel ?? design.value.activePanel
    const { w, h } = await measure(src)
    if (design.value.placedImages.length >= 6) return ''
    const id = makeId()
    const index = design.value.placedImages.filter(i => i.panel === target).length
    design.value.placedImages.push({
      id, src, file, panel: target, natW: w, natH: h,
      state: initialState(target, h / w, index),
    })
    design.value.activeImageId = id
    return id
  }

  function removeImage(id: string) {
    design.value.placedImages = design.value.placedImages.filter(i => i.id !== id)
    if (design.value.activeImageId === id) design.value.activeImageId = null
  }

  function setActivePanel(panel: PanelId) {
    design.value.activePanel = panel
    // La imagen activa siempre pertenece a la zona activa: si no, los controles editarían algo que no se ve
    const cur = design.value.placedImages.find(i => i.id === design.value.activeImageId)
    if (!cur || cur.panel !== panel) design.value.activeImageId = design.value.placedImages.find(i => i.panel === panel)?.id ?? null
  }
  function setActiveImage(id: string | null) { design.value.activeImageId = id }

  /** Aplica el cambio y mantiene la imagen dentro del límite del molde (cm). */
  function updatePlacedImageState(id: string, state: Partial<ImageState>) {
    const img = design.value.placedImages.find(i => i.id === id)
    if (!img) return
    img.state = fitInside({ ...img.state, ...state }, MOLD_BY_ID[img.panel].limit)
  }

  /** Cambia el ancho (cm ref) conservando proporción y centro. */
  function setImageWidth(id: string, widthRef: number) {
    const img = design.value.placedImages.find(i => i.id === id)
    if (!img) return
    const s = img.state, aspect = img.natH / img.natW
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2
    const w = Math.max(1, widthRef), h = w * aspect
    updatePlacedImageState(id, { width: w, height: h, x: cx - w / 2, y: cy - h / 2 })
  }

  function centerImage(id: string) {
    const img = design.value.placedImages.find(i => i.id === id)
    if (!img) return
    const lim = MOLD_BY_ID[img.panel].limit
    updatePlacedImageState(id, { x: (lim.w - img.state.width) / 2, y: (lim.h - img.state.height) / 2 })
  }

  /** Ajusta la imagen a un formato del molde (ej. 20×30) sin deformarla. */
  function fitFormat(id: string, formatId: string) {
    const img = design.value.placedImages.find(i => i.id === id)
    if (!img) return
    const f = MOLD_BY_ID[img.panel].formats.find(x => x.id === formatId)
    if (!f) return
    const [w, h] = containBox(img.natH / img.natW, f.w, f.h)
    updatePlacedImageState(id, { width: w, height: h, x: f.cx - w / 2, y: f.cy - h / 2, rotation: 0 })
  }

  /** "Ajustar a moldes": reparte las imágenes del molde activo en celdas iguales. */
  function applyLayout(panel: PanelId, presetId: string) {
    const imgs = design.value.placedImages.filter(i => i.panel === panel)
    const preset = LAYOUTS[imgs.length]?.find(p => p.id === presetId)
    if (!preset) return
    const lim = MOLD_BY_ID[panel].limit
    const cells = layoutCells(preset.rows, { x: SAFE_MARGIN, y: SAFE_MARGIN, w: lim.w - 2 * SAFE_MARGIN, h: lim.h - 2 * SAFE_MARGIN })
    imgs.forEach((img, i) => {
      const c = cells[i]
      const [w, h] = containBox(img.natH / img.natW, c.w, c.h)
      updatePlacedImageState(img.id, { width: w, height: h, x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, rotation: 0 })
    })
  }

  function moveImageToPanel(id: string, panel: PanelId) {
    const img = design.value.placedImages.find(i => i.id === id)
    if (!img) return
    const index = design.value.placedImages.filter(i => i.panel === panel).length
    img.panel = panel
    img.state = initialState(panel, img.natH / img.natW, index)
    design.value.activePanel = panel
  }

  async function setPopularDesign(did: string, src: string) {
    const { w, h } = await measure(src)
    design.value.placedImages = design.value.placedImages.filter(i => !i.id.startsWith('pop-'))
    const id = `pop-${did}`
    design.value.placedImages.unshift({
      id, src, file: null, panel: 'front', natW: w, natH: h,
      state: initialState('front', h / w, 0),
    })
    design.value.popularDesignId = did
    design.value.activeImageId = id
    design.value.activePanel = 'front'
  }

  function setRenderCaptures(captures: string[]) { renderCaptures.value = captures }

  // ── Delivery actions ───────────────────────────────
  function setDepartment(dept: string) {
    delivery.value.department = dept
    const tier = DELIVERY_RATES.find(r => r.departments.includes(dept))
    delivery.value.rate = tier ? tier.rate : 25
  }

  // ── Admin actions ──────────────────────────────────
  /** Valida el PIN contra el servidor (Apps Script). Sin backend configurado solo sirve en demo local. */
  async function adminLogin(pin: string): Promise<boolean> {
    let ok = false
    if (backendConfigured) {
      ok = await adminAuth(pin)
    } else {
      ok = pin === (import.meta.env.VITE_ADMIN_PIN ?? '1234')
    }
    if (ok) {
      isAdmin.value = true
      adminToken.value = pin
      localStorage.setItem('admin_exp', String(Date.now() + 8 * 3600 * 1000))
      localStorage.setItem('admin_tok', pin)
    }
    return ok
  }

  function restoreAdminSession() {
    const exp = Number(localStorage.getItem('admin_exp') ?? '0')
    if (exp > Date.now()) {
      isAdmin.value = true
      adminToken.value = localStorage.getItem('admin_tok') ?? ''
    }
  }

  function adminLogout() {
    isAdmin.value = false
    adminToken.value = ''
    localStorage.removeItem('admin_exp')
    localStorage.removeItem('admin_tok')
  }

  function setPrice(n: number) { if (n > 0) orderItem.value.pricePerUnit = n }

  // ── Checkout ───────────────────────────────────────
  function generateOrderId(): string {
    return 'PP-' + Date.now().toString(36).toUpperCase() + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase()
  }

  async function submitOrder(): Promise<string> {
    if (submitting.value) return currentOrderId.value ?? ''
    submitting.value = true
    submitError.value = null
    submitProgress.value = { phase: 'upload', done: 0, total: 0 }
    try {
      ensureLines()
      const id = (pendingOrderId ??= generateOrderId())
      const k = factor.value, r1 = (v: number) => Math.round(v * 10) / 10
      const designs = design.value.placedImages.map((i, n) => ({ src: i.src, label: i.panel, n }))
      const pieces = totalPieces.value
      const colorName = (hex: string) => POLO_COLORS.find(c => c.value.toLowerCase() === hex.toLowerCase())?.label ?? hex
      const variantes = lines.value.map(l => ({ talla: l.size, color: colorName(l.color), hex: l.color, cantidad: l.quantity }))

      // Voucher, diseños y renders → carpeta del pedido en Drive (o ImgBB si Drive no está configurado)
      const assets = await uploadOrderAssets(id, {
        period: limaPeriod(),
        voucher: payment.value.voucherFile,
        designs,
        renders: renderCaptures.value,
        onProgress: (done, total) => { submitProgress.value = { phase: 'upload', done, total } },
        meta: (u) => ({
          pedido: id, creado: limaDateTime(), variantes, piezas: pieces,
          tallaReferencia: orderItem.value.size, manga: design.value.sleeveType, total: total.value,
          cliente: { nombre: delivery.value.recipientName, telefono: delivery.value.phone },
          pago: { metodo: payment.value.method, voucher: u.voucherUrl },
          // Medidas reales (cm) en la talla de referencia, desde la esquina sup. izq. del límite del molde.
          // Para otra talla se multiplican por (pecho de esa talla / 52).
          estampados: design.value.placedImages.map((i, n) => ({
            molde: i.panel, archivo: u.designUrls[n] || i.src,
            ancho_cm: r1(i.state.width * k), alto_cm: r1(i.state.height * k),
            x_cm: r1(i.state.x * k), y_cm: r1(i.state.y * k), rotacion: i.state.rotation, espejo: i.state.flipH,
          })),
          renders: u.renderUrls,
          subidasFallidas: u.failed,
        }),
      })
      const { voucherUrl, designUrls: designImageUrls, renderUrls } = assets

      const order: Order = {
        orderId: id,
        createdAt: nowISO(),
        design: design.value,
        item: { ...orderItem.value, size: lines.value[0].size, quantity: pieces },
        lines: lines.value.map(l => ({ ...l })),
        delivery: delivery.value,
        payment: { ...payment.value, voucherUrl },
        status: 'pending_validation',
        statusUpdatedAt: nowISO(),
        estimatedDelivery: null,
        adminNotes: '',
        designImageUrls,
        renderUrls,
        folderUrl: assets.folderUrl,
      }

      submitProgress.value = { phase: 'register', done: 0, total: 0 }
      await createOrder(order)

      // El aviso por Telegram no debe tumbar una venta ya registrada
      submitProgress.value = { phase: 'notify', done: 0, total: 0 }
      await notifyNewOrder(order).catch(e => console.warn('[telegram]', e))

      submitProgress.value = { phase: 'done', done: 0, total: 0 }
      currentOrderId.value = id
      pendingOrderId = null
      return id
    } catch (e) {
      const raw = e instanceof Error ? e.message : ''
      // Los errores de red del navegador no le dicen nada al cliente
      submitError.value = !raw || /fetch|network|load failed|timeout/i.test(raw)
        ? 'No pudimos conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.'
        : raw
      submitProgress.value = { phase: 'idle', done: 0, total: 0 }
      throw e
    } finally {
      submitting.value = false
    }
  }

  function resetOrder() {
    currentOrderId.value = null
    pendingOrderId = null
    submitError.value = null
    lines.value = []
    linesTouched.value = false
    payment.value = { method: 'yape', voucherFile: null, voucherUrl: null }
  }

  return {
    design, interactionMode, orderItem, lines, delivery, payment,
    currentOrderId, submitting, submitError, submitProgress,
    isAdmin, adminToken, adminOrders, setPrice,
    subtotal, total, totalPieces, popularDesigns, deliveryRates,
    ensureLines, addLine, updateLine, removeLine, mergeLines, MAX_LINES, MAX_PER_LINE,
    sizeId, factor, setSize,
    setPoloColor, setSleeveType, setPopularDesign, setInteractionMode,
    addImageToPanel, removeImage, setActivePanel, setActiveImage,
    updatePlacedImageState, setImageWidth, centerImage, fitFormat, applyLayout, moveImageToPanel,
    setRenderCaptures, setDepartment,
    adminLogin, restoreAdminSession, adminLogout,
    submitOrder, resetOrder,
  }
})
