import type { Order } from '../store/types'

const SHEETS_URL = import.meta.env.VITE_SHEETS_URL ?? ''

export async function createOrder(order: Order): Promise<void> {
  if (!SHEETS_URL) {
    console.warn('[sheets] No VITE_SHEETS_URL — order not persisted:', order.orderId)
    return
  }
  const payload = flattenOrder(order)
  await fetch(`${SHEETS_URL}?action=createOrder`, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  notes = '',
  estimatedDelivery = '',
): Promise<void> {
  if (!SHEETS_URL) return
  await fetch(`${SHEETS_URL}?action=updateStatus`, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ orderId, status, notes, estimatedDelivery }),
  })
}

export async function getOrders(params: {
  status?: string
  from?: string
  to?: string
} = {}): Promise<Order[]> {
  if (!SHEETS_URL) return []
  const qs = new URLSearchParams({ action: 'getOrders', ...params }).toString()
  const res = await fetch(`${SHEETS_URL}?${qs}`)
  if (!res.ok) return []
  return res.json()
}

function flattenOrder(order: Order) {
  const renders = order.renderUrls ?? []
  const designUrls = order.designImageUrls?.length
    ? order.designImageUrls.join(' | ')
    : (order.design.popularDesignId ?? '')
  return {
    orderId: order.orderId,
    createdAt: order.createdAt,
    customerName: order.delivery.recipientName,
    dni: order.delivery.dni,
    phone: order.delivery.phone,
    poloColor: order.design.poloColor,
    sleeveType: order.design.sleeveType,
    size: order.item.size,
    quantity: order.item.quantity,
    pricePerUnit: order.item.pricePerUnit,
    designUrls,
    renderFront: renders[0] ?? '',
    renderBack: renders[1] ?? '',
    renderRight: renders[2] ?? '',
    renderLeft: renders[3] ?? '',
    deliveryDept: order.delivery.department,
    deliveryProv: order.delivery.province,
    deliveryDist: order.delivery.district,
    deliveryAddress: order.delivery.address,
    deliveryRef: order.delivery.reference,
    deliveryRate: order.delivery.rate,
    subtotal: order.item.pricePerUnit * order.item.quantity,
    total: order.item.pricePerUnit * order.item.quantity + order.delivery.rate,
    paymentMethod: order.payment.method,
    voucherUrl: order.payment.voucherUrl ?? '',
    status: order.status,
  }
}
