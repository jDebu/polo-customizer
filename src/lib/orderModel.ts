import { POLO_COLORS } from '../data/catalog'

export const STATUSES = ['pending_validation', 'confirmed', 'in_production', 'shipped', 'delivered', 'rejected'] as const
export type Status = (typeof STATUSES)[number]
export type Tone = 'warn' | 'ok' | 'info' | 'err' | 'neu'

export const STATUS_META: Record<Status, { label: string; plural: string; tone: Tone }> = {
  pending_validation: { label: 'Por validar', plural: 'Por validar', tone: 'warn' },
  confirmed: { label: 'Pago confirmado', plural: 'Confirmados', tone: 'ok' },
  in_production: { label: 'En producción', plural: 'En producción', tone: 'info' },
  shipped: { label: 'Enviado', plural: 'Enviados', tone: 'info' },
  delivered: { label: 'Entregado', plural: 'Entregados', tone: 'neu' },
  rejected: { label: 'Rechazado', plural: 'Rechazados', tone: 'err' },
}
/** Paso siguiente del flujo y cómo se llama la acción. */
export const NEXT: Partial<Record<Status, { to: Status; label: string }>> = {
  pending_validation: { to: 'confirmed', label: 'Confirmar pago' },
  confirmed: { to: 'in_production', label: 'Pasar a producción' },
  in_production: { to: 'shipped', label: 'Marcar enviado' },
  shipped: { to: 'delivered', label: 'Marcar entregado' },
}
/** Estados en los que el dinero ya está validado: cuentan como venta. */
export const PAID: Status[] = ['confirmed', 'in_production', 'shipped', 'delivered']

export interface AdminLine { size: string; hex: string; colorName: string; qty: number }
export interface AdminOrder {
  id: string
  createdAt: Date | null
  updatedAt: Date | null
  status: Status
  estimatedDelivery: string
  notes: string
  name: string; dni: string; phone: string
  dept: string; prov: string; dist: string; address: string; reference: string
  shipping: number
  lines: AdminLine[]
  pieces: number
  unitPrice: number
  subtotal: number
  total: number
  sleeve: string
  payment: string
  voucherUrl: string
  folderUrl: string
  designUrls: string[]
  renders: string[]
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const pick = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) { const v = row[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return v }
  return ''
}

/** ISO, o el formato antiguo «11/25/2026, 01:58:23 AM» (hora de Lima, UTC−5). */
export function parseDate(v: unknown): Date | null {
  const s = str(v)
  if (!s) return null
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(s)
  if (m) {
    let h = Number(m[4]); const pm = /pm/i.test(m[7] ?? '')
    if (m[7]) h = (h % 12) + (pm ? 12 : 0)
    return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), h + 5, Number(m[5]), Number(m[6] ?? 0)))
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s)
export function colorNameOf(hexOrName: string): string {
  const c = POLO_COLORS.find(x => x.value.toLowerCase() === hexOrName.toLowerCase())
  return c ? c.label : hexOrName
}
export function colorHexOf(hexOrName: string): string {
  if (isHex(hexOrName)) return hexOrName
  return POLO_COLORS.find(x => x.label.toLowerCase() === hexOrName.toLowerCase())?.value ?? '#888888'
}

function parseLines(row: Record<string, unknown>): AdminLine[] {
  const raw = str(row.variants)
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw) as { size: string; color: string; quantity: number }[]
      const out = arr.map(l => ({ size: str(l.size), hex: colorHexOf(str(l.color)), colorName: colorNameOf(str(l.color)), qty: Math.max(1, num(l.quantity)) }))
      if (out.length) return out
    } catch { /* cae al texto */ }
  }
  const size = str(row.size)
  if (size.includes('×')) {
    const out: AdminLine[] = []
    for (const part of size.split('|')) {
      const m = /^\s*(XXL|XL|XS|S|M|L)\s+(.+?)\s*×\s*(\d+)\s*$/i.exec(part)
      if (m) out.push({ size: m[1].toUpperCase(), hex: colorHexOf(m[2]), colorName: colorNameOf(m[2]), qty: Number(m[3]) })
    }
    if (out.length) return out
  }
  const color = str(row.poloColor)
  return [{ size: size || '—', hex: colorHexOf(color), colorName: colorNameOf(color) || '—', qty: Math.max(1, num(row.quantity)) }]
}

export function normalizeRow(row: Record<string, unknown>): AdminOrder {
  const lines = parseLines(row)
  const pieces = lines.reduce((n, l) => n + l.qty, 0)
  const unitPrice = num(row.pricePerUnit)
  const shipping = num(pick(row, 'deliveryRate'))
  const subtotal = num(row.subtotal) || unitPrice * pieces
  const total = num(row.total) || subtotal + shipping
  const split = (v: unknown) => str(v).split(/\s*\|\s*/).filter(u => /^https?:\/\//.test(u))
  const rawStatus = str(row.status)
  return {
    id: str(row.orderId),
    createdAt: parseDate(row.createdAt),
    updatedAt: parseDate(pick(row, 'statusUpdatedAt', 'updatedAt')),
    status: (STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as Status) : 'pending_validation',
    estimatedDelivery: str(pick(row, 'estimatedDelivery', 'entregaEstimada')),
    notes: str(pick(row, 'notes', 'adminNotes', 'notas')),
    name: str(row.customerName), dni: str(row.dni), phone: str(row.phone),
    dept: str(row.deliveryDept), prov: str(row.deliveryProv), dist: str(row.deliveryDist),
    address: str(row.deliveryAddress), reference: str(row.deliveryRef),
    shipping, lines, pieces, unitPrice, subtotal, total,
    sleeve: str(row.sleeveType),
    payment: str(row.paymentMethod).toLowerCase(),
    voucherUrl: str(row.voucherUrl),
    folderUrl: str(row.folderUrl),
    designUrls: split(row.designUrls),
    renders: ['renderFront', 'renderBack', 'renderRight', 'renderLeft'].map(k => str(row[k])).filter(u => /^https?:\/\//.test(u)),
  }
}

/* ── Utilidades de presentación ─────────────────────────── */
const TZ = 'America/Lima'
export const limaDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export function timeAgo(d: Date | null, now = new Date()): string {
  if (!d) return '—'
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000))
  if (s < 60) return 'hace un momento'
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`
  const dd = Math.floor(h / 24); if (dd < 7) return `hace ${dd} d`
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', timeZone: TZ })
}
export const fmtDateTime = (d: Date | null) =>
  d ? d.toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—'
export const money = (n: number) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`

/** Drive no deja incrustar el enlace de vista; su miniatura sí (si el archivo es visible por enlace). */
export function previewUrl(url: string, width = 1200): string {
  const m = /drive\.google\.com\/file\/d\/([^/?#]+)/.exec(url) ?? /drive\.google\.com\/open\?id=([^&#]+)/.exec(url)
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${width}` : url
}
export const waLink = (phone: string, text = '') => {
  const d = phone.replace(/\D/g, '')
  const n = d.length === 9 ? `51${d}` : d
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
export const telLink = (phone: string) => `tel:+${phone.replace(/\D/g, '').replace(/^(\d{9})$/, '51$1')}`
