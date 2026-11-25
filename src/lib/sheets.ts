import type { Order } from '../store/types'
import { POLO_COLORS } from '../data/catalog'

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

/** "L Negro ×3 | M Azul ×1": cabe en las columnas size/poloColor que ya tiene tu hoja. */
function variantText(order: Order) {
  const L = order.lines
  if (!L?.length) return { size: order.item.size, color: order.design.poloColor, qty: order.item.quantity }
  const name = (hex: string) => POLO_COLORS.find(c => c.value.toLowerCase() === hex.toLowerCase())?.label ?? hex
  return {
    size: L.map(l => `${l.size} ${name(l.color)} ×${l.quantity}`).join(' | '),
    color: [...new Set(L.map(l => name(l.color)))].join(', '),
    qty: L.reduce((n, l) => n + l.quantity, 0),
  }
}

function flattenOrder(order: Order) {
  const v = variantText(order)
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
    poloColor: v.color,
    sleeveType: order.design.sleeveType,
    size: v.size,
    quantity: v.qty,
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
    subtotal: order.item.pricePerUnit * v.qty,
    total: order.item.pricePerUnit * v.qty + order.delivery.rate,
    paymentMethod: order.payment.method,
    voucherUrl: order.payment.voucherUrl ?? '',
    folderUrl: order.folderUrl ?? '',
    status: order.status,
  }
}
