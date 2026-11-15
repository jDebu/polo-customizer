import type { Order } from '../store/types'

const TOKEN = import.meta.env.VITE_TELEGRAM_TOKEN ?? ''
const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID ?? ''

export async function notifyNewOrder(order: Order): Promise<void> {
  if (!TOKEN || !CHAT_ID) {
    console.warn('[telegram] No token/chat_id — skipping notification for', order.orderId)
    return
  }
  const total = order.item.pricePerUnit * order.item.quantity + order.delivery.rate
  const text = [
    `🛒 *NUEVO PEDIDO ${order.orderId}*`,
    ``,
    `👕 Polo: ${colorName(order.design.poloColor)} · ${order.design.sleeveType === 'short' ? 'manga corta' : 'manga larga'} · talla ${order.item.size} × ${order.item.quantity}`,
    `💳 Pago: ${order.payment.method.toUpperCase()} · S/ ${total}`,
    `👤 Cliente: ${order.delivery.recipientName} (DNI: ${order.delivery.dni})`,
    `📍 Envío: ${order.delivery.department}, ${order.delivery.province}`,
    `📱 Tel: ${order.delivery.phone}`,
    order.payment.voucherUrl ? `🧾 Voucher: ${order.payment.voucherUrl}` : `⚠️ Sin voucher`,
    ``,
    `✅ _Validar en el panel de admin_`,
  ].join('\n')

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  })
}

export async function notifyStatusChange(
  orderId: string,
  status: string,
  phone: string,
): Promise<void> {
  if (!TOKEN || !CHAT_ID) return
  const statusLabels: Record<string, string> = {
    confirmed: '✅ Pago confirmado — en espera de producción',
    in_production: '🖨 En producción',
    shipped: '🚚 Enviado con Olva Courier',
    delivered: '📦 Entregado',
    rejected: '❌ Pago rechazado — contactar cliente',
  }
  const text = `📦 *Pedido ${orderId}*\nEstado: ${statusLabels[status] ?? status}`
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
  })
}

function colorName(hex: string): string {
  const map: Record<string, string> = {
    '#ffffff': 'Blanco', '#111111': 'Negro', '#1a2a4a': 'Azul marino',
    '#cc2222': 'Rojo', '#1a5c2a': 'Verde', '#f0c020': 'Amarillo',
    '#888888': 'Gris', '#7a1a2a': 'Granate',
  }
  return map[hex.toLowerCase()] ?? hex
}
