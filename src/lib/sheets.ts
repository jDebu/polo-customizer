import type { Order } from '../store/types'

const SHEETS_URL = import.meta.env.VITE_SHEETS_URL ?? ''

export async function createOrder(order: Order): Promise<void> {
  if (!SHEETS_URL) {
    console.warn('[sheets] No VITE_SHEETS_URL — order not persisted:', order.orderId)
    return
  }
  const payload = flattenOrder(order)
  const res = await fetch(`${SHEETS_URL}?action=createOrder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Sheets write failed (${res.status}): ${text}`)
  }
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
    headers: { 'Content-Type': 'application/json' },
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
    designUrl: order.design.userImageSrc?.slice(0, 200) ?? order.design.popularDesignId ?? '',
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
