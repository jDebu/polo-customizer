/**
 * Moldes de estampado y proporciones del polo.
 *
 * Todo el sistema trabaja en CENTÍMETROS REALES, no en píxeles.
 * Las posiciones/tamaños de las imágenes se guardan en "cm de referencia" (talla M)
 * y se escalan con el factor de talla: así el diseño se mantiene proporcional
 * en XS…XXL y lo único que cambia son los cm físicos y los píxeles recomendados.
 */

export type SizeId = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'

/** Tabla de tallas (cm): ancho de pecho = mitad de la circunferencia (plano). */
export const SIZE_TABLE: Record<SizeId, { chest: number; length: number; shoulder: number }> = {
  XS:  { chest: 46, length: 66, shoulder: 40 },
  S:   { chest: 49, length: 69, shoulder: 42 },
  M:   { chest: 52, length: 72, shoulder: 44 },
  L:   { chest: 55, length: 75, shoulder: 46 },
  XL:  { chest: 58, length: 78, shoulder: 48 },
  XXL: { chest: 61, length: 81, shoulder: 50 },
}
export const SIZE_IDS = Object.keys(SIZE_TABLE) as SizeId[]

/** Factor de escala respecto a la talla M (por ancho de pecho). */
export const sizeFactor = (s: SizeId) => SIZE_TABLE[s].chest / SIZE_TABLE.M.chest

/* ── Moldes ─────────────────────────────────────────────── */
export type PanelId =
  | 'front' | 'back'
  | 'left-front' | 'left-back' | 'left-side'
  | 'right-front' | 'right-back' | 'right-side'

export interface Format {
  id: string
  label: string
  w: number; h: number          // cm de referencia (talla M)
  cx: number; cy: number        // centro dentro del límite (cm, origen = esquina sup. izq. del límite)
}

export interface Mold {
  id: PanelId
  label: string
  short: string
  group: 'body' | 'sleeve'
  side?: 'left' | 'right'
  slot?: 'front' | 'back' | 'side'
  /** Límite duro de estampado (cm ref). `top` = cm bajo la línea del hombro (cuerpo) o bajo la costura de la sisa (manga). */
  limit: { w: number; h: number; top: number }
  recommended: Format
  formats: Format[]
}

const SAFE = 1
export const SAFE_MARGIN = SAFE

const fmt = (id: string, label: string, w: number, h: number, cx: number, cy: number): Format => ({ id, label, w, h, cx, cy })

const FRONT: Mold = {
  id: 'front', label: 'Frontal', short: 'Frontal', group: 'body',
  limit: { w: 36, h: 48, top: 14 },
  recommended: fmt('f-20x20', 'Centrado 20 × 20', 20, 20, 18, 14),
  formats: [
    fmt('f-20x20', 'Centrado 20 × 20', 20, 20, 18, 14),
    fmt('f-20x30', 'Vertical 20 × 30', 20, 30, 18, 19),
    fmt('f-30x20', 'Horizontal 30 × 20', 30, 20, 18, 14),
    fmt('f-30x30', 'Grande 30 × 30', 30, 30, 18, 19),
    fmt('f-10x10', 'Pecho 10 × 10', 10, 10, 27, 8),
  ],
}
const BACK: Mold = {
  id: 'back', label: 'Espalda', short: 'Espalda', group: 'body',
  limit: { w: 36, h: 48, top: 10 },
  recommended: fmt('b-20x30', 'Espalda 20 × 30', 20, 30, 18, 17),
  formats: [
    fmt('b-20x30', 'Espalda 20 × 30', 20, 30, 18, 17),
    fmt('b-30x40', 'Grande 30 × 40', 30, 40, 18, 22),
    fmt('b-30x20', 'Horizontal 30 × 20', 30, 20, 18, 12),
    fmt('b-10x5', 'Nuca 10 × 5', 10, 5, 18, 4),
  ],
}

function sleeve(side: 'left' | 'right', slot: 'front' | 'back' | 'side'): Mold {
  const slotLabel = { front: 'Frente', back: 'Atrás', side: 'Lateral' }[slot]
  const sideLabel = side === 'left' ? 'Manga izq.' : 'Manga der.'
  return {
    id: `${side}-${slot}` as PanelId, label: `${sideLabel} · ${slotLabel}`, short: slotLabel,
    group: 'sleeve', side, slot,
    limit: { w: 10, h: 14, top: 3 },
    recommended: fmt('s-8x10', 'Estándar 8 × 10', 8, 10, 5, 7),
    formats: [
      fmt('s-8x10', 'Estándar 8 × 10', 8, 10, 5, 7),
      fmt('s-8x12', 'Alto 8 × 12', 8, 12, 5, 7),
      fmt('s-6x6', 'Mini 6 × 6', 6, 6, 5, 5),
    ],
  }
}

export const MOLDS: Mold[] = [
  FRONT, BACK,
  sleeve('left', 'front'), sleeve('left', 'back'), sleeve('left', 'side'),
  sleeve('right', 'front'), sleeve('right', 'back'), sleeve('right', 'side'),
]
export const MOLD_BY_ID = Object.fromEntries(MOLDS.map(m => [m.id, m])) as Record<PanelId, Mold>

/* ── Píxeles ↔ cm ───────────────────────────────────────── */
export const cmToPx = (cm: number, dpi: number) => Math.round((cm / 2.54) * dpi)
export const effectiveDpi = (px: number, cm: number) => (cm > 0 ? px / (cm / 2.54) : 0)

export type Quality = 'ideal' | 'good' | 'low' | 'bad'
export function qualityOf(dpi: number): { id: Quality; label: string } {
  if (dpi >= 300) return { id: 'ideal', label: 'Calidad ideal' }
  if (dpi >= 150) return { id: 'good', label: 'Buena calidad' }
  if (dpi >= 100) return { id: 'low', label: 'Baja: puede verse pixelada' }
  return { id: 'bad', label: 'Muy baja: sube una imagen mayor' }
}

/* ── Geometría de imagen dentro del límite ──────────────── */
export interface Box { x: number; y: number; width: number; height: number; rotation: number }

/** Mitad del bounding box rotado. */
export function halfExtents(w: number, h: number, rotDeg: number): [number, number] {
  const r = (rotDeg * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r))
  return [(w * c + h * s) / 2, (w * s + h * c) / 2]
}

/** Reduce y desplaza la imagen para que su bounding box rotado quede dentro del límite. */
export function fitInside<T extends Box>(b: T, lim: { w: number; h: number }): T {
  let { width, height } = b
  let [ex, ey] = halfExtents(width, height, b.rotation)
  const k = Math.min(1, lim.w / (2 * ex), lim.h / (2 * ey))
  if (k < 1) { width *= k; height *= k; [ex, ey] = halfExtents(width, height, b.rotation) }
  const cx = Math.min(lim.w - ex, Math.max(ex, b.x + b.width / 2))
  const cy = Math.min(lim.h - ey, Math.max(ey, b.y + b.height / 2))
  return { ...b, width, height, x: cx - width / 2, y: cy - height / 2 }
}

/** Mayor caja con la proporción `aspect` (alto/ancho) que cabe en (w × h). */
export function containBox(aspect: number, w: number, h: number): [number, number] {
  return aspect <= h / w ? [w, w * aspect] : [h / aspect, h]
}

/* ── Distribuciones ("Ajustar a moldes") ────────────────── */
export interface LayoutPreset { id: string; label: string; rows: number[] }

export const LAYOUTS: Record<number, LayoutPreset[]> = {
  1: [{ id: 'c1', label: 'Centrado', rows: [1] }],
  2: [
    { id: 'r2', label: 'Lado a lado', rows: [2] },
    { id: 'c2', label: 'Apiladas', rows: [1, 1] },
  ],
  3: [
    { id: 't3', label: 'Triángulo', rows: [1, 2] },
    { id: 't3i', label: 'Triángulo inv.', rows: [2, 1] },
    { id: 'r3', label: 'En fila', rows: [3] },
    { id: 'c3', label: 'En columna', rows: [1, 1, 1] },
  ],
  4: [
    { id: 'g22', label: 'Cuadrícula 2×2', rows: [2, 2] },
    { id: 'r4', label: 'En fila', rows: [4] },
  ],
  5: [
    { id: 'd5', label: 'Dado 2·1·2', rows: [2, 1, 2] },
    { id: 'p5', label: 'Pirámide', rows: [1, 2, 2] },
  ],
  6: [
    { id: 'g32', label: 'Cuadrícula 3×2', rows: [3, 3] },
    { id: 'g23', label: 'Cuadrícula 2×3', rows: [2, 2, 2] },
    { id: 'p6', label: 'Pirámide', rows: [1, 2, 3] },
  ],
}

/** Celdas cuadradas e iguales, centradas en el área. */
export function layoutCells(rows: number[], area: { x: number; y: number; w: number; h: number }, gap = 1.5) {
  const cols = Math.max(...rows)
  const s = Math.min((area.w - gap * (cols - 1)) / cols, (area.h - gap * (rows.length - 1)) / rows.length)
  const blockH = rows.length * s + gap * (rows.length - 1)
  const y0 = area.y + (area.h - blockH) / 2
  const cells: { x: number; y: number; w: number; h: number }[] = []
  rows.forEach((n, r) => {
    const rowW = n * s + gap * (n - 1)
    const x0 = area.x + (area.w - rowW) / 2
    for (let i = 0; i < n; i++) cells.push({ x: x0 + i * (s + gap), y: y0 + r * (s + gap), w: s, h: s })
  })
  return cells
}

/* ── Siluetas SVG (cm físicos, origen = línea del hombro) ── */
export function bodyOutline(size: SizeId, view: 'front' | 'back') {
  const t = SIZE_TABLE[size], f = sizeFactor(size)
  const c = t.chest / 2, sh = t.shoulder / 2, L = t.length
  const nw = 10 * f, drop = (view === 'front' ? 11.5 : 3) * f
  const k = 0.55
  return [
    `M ${-nw} 0`,
    `C ${-nw} ${drop * 0.72} ${-nw * k} ${drop} 0 ${drop}`,
    `C ${nw * k} ${drop} ${nw} ${drop * 0.72} ${nw} 0`,
    `L ${sh} ${2.6 * f}`, `L ${sh + 9 * f} ${9 * f}`, `L ${c} ${21 * f}`,
    `L ${c} ${L - 2}`, `Q ${c} ${L} ${c - 2} ${L}`, `L ${-c + 2} ${L}`, `Q ${-c} ${L} ${-c} ${L - 2}`,
    `L ${-c} ${21 * f}`, `L ${-sh - 9 * f} ${9 * f}`, `L ${-sh} ${2.6 * f}`, 'Z',
  ].join(' ')
}

export function sleeveOutline(size: SizeId) {
  const f = sizeFactor(size), w = 9 * f, wb = 8 * f, h = 24 * f
  return `M ${-w} 0 L ${w} 0 L ${wb} ${h} L ${-wb} ${h} Z`
}

export function neckPath(size: SizeId, view: 'front' | 'back') {
  const f = sizeFactor(size), nw = 10 * f, drop = (view === 'front' ? 11.5 : 3) * f, k = 0.55
  return `M ${-nw} 0 C ${-nw} ${drop * 0.72} ${-nw * k} ${drop} 0 ${drop} C ${nw * k} ${drop} ${nw} ${drop * 0.72} ${nw} 0`
}
