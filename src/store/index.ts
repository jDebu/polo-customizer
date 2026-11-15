import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  DesignConfig, OrderItem, DeliveryInfo, PaymentInfo,
  Order, PopularDesign, InteractionMode, ImageState,
} from './types'
import { uploadVoucher } from '../lib/imgbb'
import { createOrder } from '../lib/sheets'
import { notifyNewOrder } from '../lib/telegram'
import { POPULAR_DESIGNS, DELIVERY_RATES } from '../data/catalog'

const DEFAULT_IMAGE_STATE = (): ImageState => ({
  x: 312, y: 300, width: 400, height: 400, rotation: 0, flipH: false,
})

export const useStore = defineStore('polo', () => {
  // ── Design state ───────────────────────────────────
  const design = ref<DesignConfig>({
    poloColor: '#ffffff',
    sleeveType: 'short',
    userImageSrc: null,
    userImageFile: null,
    frontImageState: DEFAULT_IMAGE_STATE(),
    backImageState: null,
    popularDesignId: null,
  })

  const interactionMode = ref<InteractionMode>('transform')

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
  const subtotal = computed(() =>
    orderItem.value.pricePerUnit * orderItem.value.quantity
  )
  const total = computed(() => subtotal.value + delivery.value.rate)

  const popularDesigns = computed<PopularDesign[]>(() => POPULAR_DESIGNS)

  const deliveryRates = computed(() => DELIVERY_RATES)

  // ── Design actions ─────────────────────────────────
  function setPoloColor(color: string) {
    design.value.poloColor = color
  }

  function setSleeveType(type: 'short' | 'long') {
    design.value.sleeveType = type
    if (type === 'short') design.value.backImageState = null
    else if (!design.value.backImageState)
      design.value.backImageState = DEFAULT_IMAGE_STATE()
  }

  function setUserImage(src: string, file: File) {
    design.value.userImageSrc = src
    design.value.userImageFile = file
    design.value.popularDesignId = null
    design.value.frontImageState = DEFAULT_IMAGE_STATE()
  }

  function setPopularDesign(id: string, src: string) {
    design.value.userImageSrc = src
    design.value.userImageFile = null
    design.value.popularDesignId = id
    design.value.frontImageState = DEFAULT_IMAGE_STATE()
  }

  function updateFrontImageState(state: Partial<ImageState>) {
    design.value.frontImageState = { ...design.value.frontImageState, ...state }
  }

  function updateBackImageState(state: Partial<ImageState>) {
    if (design.value.backImageState)
      design.value.backImageState = { ...design.value.backImageState, ...state }
  }

  function resetImagePosition() {
    design.value.frontImageState = DEFAULT_IMAGE_STATE()
    if (design.value.backImageState)
      design.value.backImageState = DEFAULT_IMAGE_STATE()
  }

  function setInteractionMode(mode: InteractionMode) {
    interactionMode.value = mode
  }

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

      let voucherUrl = ''
      if (payment.value.voucherFile) {
        voucherUrl = await uploadVoucher(payment.value.voucherFile)
      }

      const order: Order = {
        orderId: id,
        createdAt: new Date().toISOString(),
        design: design.value,
        item: orderItem.value,
        delivery: delivery.value,
        payment: { ...payment.value, voucherUrl },
        status: 'pending_validation',
        statusUpdatedAt: new Date().toISOString(),
        estimatedDelivery: null,
        adminNotes: '',
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
    setPoloColor, setSleeveType, setUserImage, setPopularDesign,
    updateFrontImageState, updateBackImageState, resetImagePosition,
    setInteractionMode, setDepartment,
    adminLogin, restoreAdminSession, adminLogout,
    submitOrder, resetOrder,
  }
})
