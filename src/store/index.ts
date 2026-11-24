import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  DesignConfig, OrderItem, DeliveryInfo, PaymentInfo,
  Order, PopularDesign, InteractionMode, ImageState, PanelId,
} from './types'
import { uploadOrderAssets } from '../lib/storage'
import { limaPeriod } from '../lib/drive'
import { createOrder } from '../lib/sheets'
import { notifyNewOrder } from '../lib/telegram'
import { POPULAR_DESIGNS, DELIVERY_RATES } from '../data/catalog'
import {
  MOLD_BY_ID, LAYOUTS, SAFE_MARGIN, containBox, fitInside, layoutCells, sizeFactor,
  type SizeId,
} from '../data/molds'

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

  // ── Admin state ────────────────────────────────────
  const isAdmin = ref(false)
  const adminOrders = ref<Order[]>([])

  // ── Computed ───────────────────────────────────────
  const subtotal = computed(() => orderItem.value.pricePerUnit * orderItem.value.quantity)
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
  function setSize(size: SizeId) { orderItem.value.size = size }

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

  function setActivePanel(panel: PanelId) { design.value.activePanel = panel }
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
  function adminLogin(pin: string): boolean {
    const correctPin = import.meta.env.VITE_ADMIN_PIN ?? '1234'
    if (pin === correctPin) {
      isAdmin.value = true
      localStorage.setItem('admin_exp', String(Date.now() + 8 * 3600 * 1000))
      return true
    }
    return false
  }

  function restoreAdminSession() {
    const exp = Number(localStorage.getItem('admin_exp') ?? '0')
    if (exp > Date.now()) isAdmin.value = true
  }

  function adminLogout() {
    isAdmin.value = false
    localStorage.removeItem('admin_exp')
  }

  // ── Checkout ───────────────────────────────────────
  function generateOrderId(): string {
    return 'PP-' + Date.now().toString(36).toUpperCase() + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase()
  }

  async function submitOrder(): Promise<string> {
    submitting.value = true
    submitError.value = null
    try {
      const id = generateOrderId()
      const k = factor.value, r1 = (v: number) => Math.round(v * 10) / 10
      const designs = design.value.placedImages.map((i, n) => ({ src: i.src, label: i.panel, n }))

      // Voucher, diseños y renders → carpeta del pedido en Drive (o ImgBB si Drive no está configurado)
      const assets = await uploadOrderAssets(id, {
        period: limaPeriod(),
        voucher: payment.value.voucherFile,
        designs,
        renders: renderCaptures.value,
        meta: (u) => ({
          pedido: id, creado: limaDateTime(), talla: orderItem.value.size, cantidad: orderItem.value.quantity,
          color: design.value.poloColor, manga: design.value.sleeveType, total: total.value,
          cliente: { nombre: delivery.value.recipientName, telefono: delivery.value.phone },
          pago: { metodo: payment.value.method, voucher: u.voucherUrl },
          // Medidas reales (cm) de la talla pedida, desde la esquina sup. izq. del límite del molde
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
        createdAt: limaDateTime(),
        design: design.value,
        item: orderItem.value,
        delivery: delivery.value,
        payment: { ...payment.value, voucherUrl },
        status: 'pending_validation',
        statusUpdatedAt: limaDateTime(),
        estimatedDelivery: null,
        adminNotes: '',
        designImageUrls,
        renderUrls,
        folderUrl: assets.folderUrl,
      }

      await createOrder(order)
      await notifyNewOrder(order)

      currentOrderId.value = id
      return id
    } catch (e) {
      submitError.value = e instanceof Error ? e.message : 'Error al enviar el pedido'
      throw e
    } finally {
      submitting.value = false
    }
  }

  function resetOrder() {
    currentOrderId.value = null
    submitError.value = null
    payment.value = { method: 'yape', voucherFile: null, voucherUrl: null }
  }

  return {
    design, interactionMode, orderItem, delivery, payment,
    currentOrderId, submitting, submitError,
    isAdmin, adminOrders,
    subtotal, total, popularDesigns, deliveryRates,
    sizeId, factor, setSize,
    setPoloColor, setSleeveType, setPopularDesign, setInteractionMode,
    addImageToPanel, removeImage, setActivePanel, setActiveImage,
    updatePlacedImageState, setImageWidth, centerImage, fitFormat, applyLayout, moveImageToPanel,
    setRenderCaptures, setDepartment,
    adminLogin, restoreAdminSession, adminLogout,
    submitOrder, resetOrder,
  }
})
