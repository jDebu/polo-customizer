<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../store/index'
import {
  MOLDS, MOLD_BY_ID, SIZE_TABLE, SAFE_MARGIN, bodyOutline, effectiveDpi, neckPath, qualityOf, sleeveOutline,
  type PanelId,
} from '../data/molds'
import Icon from './Icon.vue'

const emit = defineEmits<{ (e: 'request-upload'): void; (e: 'drop-file', f: File): void }>()

const store = useStore()
const svg = ref<SVGSVGElement | null>(null)
const zoomZone = ref(false)
const snap = ref(true)
const dragging = ref(false)

const mold = computed(() => MOLD_BY_ID[store.design.activePanel])
const f = computed(() => store.factor)
const tbl = computed(() => SIZE_TABLE[store.sizeId])
const isBody = computed(() => mold.value.group === 'body')
const images = computed(() => store.design.placedImages.filter(i => i.panel === mold.value.id))
const active = computed(() => images.value.find(i => i.id === store.design.activeImageId) ?? null)

/* ── Geometría en cm FÍSICOS de la talla elegida ─────────── */
const lim = computed(() => {
  const l = mold.value.limit, k = f.value
  return { x: (-l.w * k) / 2, y: l.top * k, w: l.w * k, h: l.h * k }
})
const rec = computed(() => {
  const r = mold.value.recommended
  return { x: r.cx - r.w / 2, y: r.cy - r.h / 2, w: r.w, h: r.h }
})

const view = computed(() => {
  const k = f.value, t = tbl.value
  if (zoomZone.value) {
    const m = isBody.value ? 7 : 4
    return { x: lim.value.x - m, y: lim.value.y - m - 1.5, w: lim.value.w + 2 * m, h: lim.value.h + 2 * m + 1.5 }
  }
  if (isBody.value) {
    const half = Math.max(t.chest / 2, t.shoulder / 2 + 9 * k) + 4
    return { x: -half, y: -7, w: 2 * half, h: t.length + 11 }
  }
  return { x: -(9 * k + 6), y: -5, w: 2 * (9 * k + 6), h: 24 * k + 10 }
})
const vb = computed(() => `${view.value.x} ${view.value.y} ${view.value.w} ${view.value.h}`)

const outline = computed(() =>
  isBody.value ? bodyOutline(store.sizeId, mold.value.id === 'front' ? 'front' : 'back') : sleeveOutline(store.sizeId))
const neck = computed(() => (isBody.value ? neckPath(store.sizeId, mold.value.id === 'front' ? 'front' : 'back') : ''))

const light = computed(() => {
  const h = store.design.poloColor
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
})
const ink = computed(() => (light.value ? '#000' : '#fff'))

function gridPath(step: number, only5?: boolean) {
  const v = view.value, d: string[] = []
  for (let x = Math.ceil(v.x / step) * step; x <= v.x + v.w; x += step) {
    if (only5 === false && x % 5 === 0) continue
    d.push(`M ${x} ${v.y} V ${v.y + v.h}`)
  }
  for (let y = Math.ceil(v.y / step) * step; y <= v.y + v.h; y += step) {
    if (only5 === false && y % 5 === 0) continue
    d.push(`M ${v.x} ${y} H ${v.x + v.w}`)
  }
  return d.join(' ')
}
const minorGrid = computed(() => gridPath(1, false))
const majorGrid = computed(() => gridPath(5))

const rulerX = computed(() => {
  const out: { x: number; label: number }[] = []
  for (let c = 0; c <= lim.value.w; c += 5) out.push({ x: lim.value.x + c, label: c })
  return out
})
const rulerY = computed(() => {
  const out: { y: number; label: number }[] = []
  for (let c = 0; c <= lim.value.h; c += 5) out.push({ y: lim.value.y + c, label: c })
  return out
})
const fs = computed(() => view.value.w / 46)
const hs = computed(() => view.value.w / 70)

/* ── Imagen: transformaciones ───────────────────────────── */
function imgTransform(i: (typeof images.value)[number]) {
  const s = i.state
  return `translate(${s.x + s.width / 2} ${s.y + s.height / 2}) rotate(${s.rotation}) scale(${s.flipH ? -1 : 1} 1)`
}

function refPoint(e: PointerEvent): [number, number] {
  const el = svg.value!, pt = el.createSVGPoint()
  pt.x = e.clientX; pt.y = e.clientY
  const p = pt.matrixTransform(el.getScreenCTM()!.inverse())
  return [(p.x - lim.value.x) / f.value, (p.y - lim.value.y) / f.value]
}
const snapV = (v: number) => (snap.value ? Math.round(v * 2) / 2 : v)

type Drag =
  | { kind: 'move'; id: string; ox: number; oy: number; sx: number; sy: number }
  | { kind: 'scale'; id: string; d0: number; w0: number }
  | { kind: 'rotate'; id: string }
let drag: Drag | null = null

function startMove(e: PointerEvent, id: string) {
  const img = images.value.find(i => i.id === id)
  if (!img) return
  store.setActiveImage(id)
  const [px, py] = refPoint(e)
  drag = { kind: 'move', id, ox: px, oy: py, sx: img.state.x, sy: img.state.y }
  dragging.value = true
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
}
function startScale(e: PointerEvent) {
  const img = active.value
  if (!img) return
  const [px, py] = refPoint(e)
  const cx = img.state.x + img.state.width / 2, cy = img.state.y + img.state.height / 2
  drag = { kind: 'scale', id: img.id, d0: Math.hypot(px - cx, py - cy) || 1, w0: img.state.width }
  dragging.value = true
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
}
function startRotate(e: PointerEvent) {
  const img = active.value
  if (!img) return
  drag = { kind: 'rotate', id: img.id }
  dragging.value = true
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!drag) return
  const [px, py] = refPoint(e)
  const img = store.design.placedImages.find(i => i.id === drag!.id)
  if (!img) return
  if (drag.kind === 'move') {
    store.updatePlacedImageState(drag.id, { x: snapV(drag.sx + px - drag.ox), y: snapV(drag.sy + py - drag.oy) })
  } else if (drag.kind === 'scale') {
    const cx = img.state.x + img.state.width / 2, cy = img.state.y + img.state.height / 2
    store.setImageWidth(drag.id, drag.w0 * (Math.hypot(px - cx, py - cy) / drag.d0))
  } else {
    const cx = img.state.x + img.state.width / 2, cy = img.state.y + img.state.height / 2
    let a = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90
    const r = Math.round(a / 15) * 15
    if (Math.abs(a - r) < 4) a = r
    store.updatePlacedImageState(drag.id, { rotation: Math.round(a * 10) / 10 })
  }
}
function onUp() { drag = null; dragging.value = false }

function onKey(e: KeyboardEvent) {
  const img = active.value
  if (!img) return
  const step = e.shiftKey ? 2 : 0.5
  const move = (dx: number, dy: number) => { e.preventDefault(); store.updatePlacedImageState(img.id, { x: img.state.x + dx, y: img.state.y + dy }) }
  if (e.key === 'ArrowLeft') move(-step, 0)
  else if (e.key === 'ArrowRight') move(step, 0)
  else if (e.key === 'ArrowUp') move(0, -step)
  else if (e.key === 'ArrowDown') move(0, step)
  else if (e.key === '+' || e.key === '=') { e.preventDefault(); store.setImageWidth(img.id, img.state.width + step) }
  else if (e.key === '-') { e.preventDefault(); store.setImageWidth(img.id, img.state.width - step) }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); store.removeImage(img.id) }
}

/* ── Medidas visibles ───────────────────────────────────── */
const n1 = (v: number) => (Math.round(v * 10) / 10).toString()
const readout = computed(() => {
  const i = active.value
  if (!i) return null
  const k = f.value, s = i.state
  const wcm = s.width * k, hcm = s.height * k
  const dpi = effectiveDpi(i.natW, wcm)
  const margin = Math.min(s.x, s.y, mold.value.limit.w - s.x - s.width, mold.value.limit.h - s.y - s.height) * k
  return {
    w: n1(wcm), h: n1(hcm), dpi: Math.round(dpi), q: qualityOf(dpi),
    tight: s.rotation % 90 === 0 && margin < SAFE_MARGIN * k - 0.01,
    x: n1(s.x * k), y: n1(s.y * k),
  }
})

/* ── Navegación de moldes ───────────────────────────────── */
const count = (id: PanelId) => store.design.placedImages.filter(i => i.panel === id).length
const body = MOLDS.filter(m => m.group === 'body')
const sleeves = (side: 'left' | 'right') => MOLDS.filter(m => m.side === side)

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file) emit('drop-file', file)
}
</script>

<template>
  <section class="mold-editor" aria-label="Editor de moldes 2D">
    <header class="me-head">
      <div class="tabs" role="tablist" aria-label="Molde de estampado">
        <div class="tab-group">
          <span class="tg-label">Cuerpo</span>
          <button v-for="m in body" :key="m.id" role="tab" class="tab" :aria-selected="mold.id === m.id"
                  :class="{ on: mold.id === m.id }" @click="store.setActivePanel(m.id)">
            {{ m.short }}<i v-if="count(m.id)" class="dot">{{ count(m.id) }}</i>
          </button>
        </div>
        <div v-for="side in (['left', 'right'] as const)" :key="side" class="tab-group">
          <span class="tg-label">{{ side === 'left' ? 'Manga izq.' : 'Manga der.' }}</span>
          <button v-for="m in sleeves(side)" :key="m.id" role="tab" class="tab" :aria-selected="mold.id === m.id"
                  :class="{ on: mold.id === m.id }" @click="store.setActivePanel(m.id)">
            {{ m.short }}<i v-if="count(m.id)" class="dot">{{ count(m.id) }}</i>
          </button>
        </div>
      </div>
      <div class="me-tools">
        <button class="tool" :class="{ on: zoomZone }" :aria-pressed="zoomZone" @click="zoomZone = !zoomZone">
          <Icon name="ruler" :size="15" /> {{ zoomZone ? 'Ver todo' : 'Ver zona' }}
        </button>
        <button class="tool" :class="{ on: snap }" :aria-pressed="snap" title="Alinear a pasos de 0,5 cm" @click="snap = !snap">
          <Icon name="grid" :size="15" /> Imán
        </button>
      </div>
    </header>

    <div class="me-stage" :class="{ dragging }" @dragover.prevent @drop.prevent="onDrop">
      <svg ref="svg" :viewBox="vb" preserveAspectRatio="xMidYMid meet" tabindex="0" role="application"
           :aria-label="`${mold.label}, talla ${store.sizeId}. Flechas mueven la imagen, más y menos cambian el tamaño.`"
           @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @keydown="onKey"
           @pointerdown.self="store.setActiveImage(null)">
        <defs>
          <clipPath id="sil"><path :d="outline" /></clipPath>
          <clipPath id="lim"><rect :x="lim.x" :y="lim.y" :width="lim.w" :height="lim.h" /></clipPath>
        </defs>

        <!-- Prenda y cuadrícula en cm físicos -->
        <path :d="outline" :fill="store.design.poloColor" class="sil" />
        <g clip-path="url(#sil)" :stroke="ink" fill="none" pointer-events="none">
          <path :d="minorGrid" stroke-width="0.04" opacity="0.13" />
          <path :d="majorGrid" stroke-width="0.07" opacity="0.28" />
          <path v-if="isBody" :d="`M 0 ${view.y} V ${view.y + view.h}`" stroke-width="0.07" opacity="0.4" stroke-dasharray="0.8 0.6" />
        </g>
        <path v-if="isBody" :d="neck" fill="none" :stroke="ink" :stroke-width="3 * f" opacity="0.1" pointer-events="none" />

        <!-- Zonas: recomendada, límite duro, margen de seguridad -->
        <g :transform="`translate(${lim.x} ${lim.y}) scale(${f})`" pointer-events="none">
          <rect :x="rec.x" :y="rec.y" :width="rec.w" :height="rec.h" class="rec" />
          <text :x="rec.x + 0.6" :y="rec.y + 1.5" class="zlabel" :font-size="fs / f">
            Recomendado {{ n1(rec.w * f) }} × {{ n1(rec.h * f) }} cm
          </text>
          <rect :x="SAFE_MARGIN" :y="SAFE_MARGIN" :width="mold.limit.w - 2 * SAFE_MARGIN" :height="mold.limit.h - 2 * SAFE_MARGIN" class="safe" />
          <rect x="0" y="0" :width="mold.limit.w" :height="mold.limit.h" class="limit" />
        </g>

        <!-- Reglas (cm físicos desde la esquina del límite) -->
        <g class="ruler" pointer-events="none" :font-size="fs">
          <template v-for="t in rulerX" :key="`x${t.label}`">
            <path :d="`M ${t.x} ${lim.y - fs * 0.7} V ${lim.y}`" />
            <text :x="t.x" :y="lim.y - fs * 0.95" text-anchor="middle">{{ t.label }}</text>
          </template>
          <template v-for="t in rulerY" :key="`y${t.label}`">
            <path :d="`M ${lim.x - fs * 0.7} ${t.y} H ${lim.x}`" />
            <text :x="lim.x - fs * 0.95" :y="t.y + fs * 0.35" text-anchor="end">{{ t.label }}</text>
          </template>
          <text :x="lim.x + lim.w" :y="lim.y + lim.h + fs * 1.5" text-anchor="end" class="zlabel">
            Zona máx. {{ n1(lim.w) }} × {{ n1(lim.h) }} cm
          </text>
        </g>

        <!-- Imágenes (cm ref relativos al límite) -->
        <g :transform="`translate(${lim.x} ${lim.y}) scale(${f})`">
          <g v-for="i in images" :key="i.id" :transform="imgTransform(i)" class="img"
             :class="{ sel: i.id === store.design.activeImageId }"
             @pointerdown.stop.prevent="startMove($event, i.id)">
            <image :href="i.src" :x="-i.state.width / 2" :y="-i.state.height / 2"
                   :width="i.state.width" :height="i.state.height" preserveAspectRatio="none" />
            <rect :x="-i.state.width / 2" :y="-i.state.height / 2"
                  :width="i.state.width" :height="i.state.height" class="frame" />
          </g>

          <g v-if="active" :transform="imgTransform(active)" class="handles">
            <line :x1="0" :y1="-active.state.height / 2" :x2="0" :y2="-active.state.height / 2 - (hs * 4) / f" class="stem" />
            <circle :cx="0" :cy="-active.state.height / 2 - (hs * 4) / f" :r="(hs * 1.5) / f" class="rot"
                    @pointerdown.stop.prevent="startRotate" />
            <rect v-for="c in [[-1, -1], [1, -1], [-1, 1], [1, 1]]" :key="c.join()" class="h"
                  :x="(c[0] * active.state.width) / 2 - (hs * 1.4) / f"
                  :y="(c[1] * active.state.height) / 2 - (hs * 1.4) / f"
                  :width="(hs * 2.8) / f" :height="(hs * 2.8) / f"
                  @pointerdown.stop.prevent="startScale" />
          </g>
        </g>
      </svg>

      <div v-if="images.length === 0" class="empty">
        <p class="empty-t">{{ mold.label }} sin diseño</p>
        <p class="empty-d">Arrastra una imagen aquí o súbela. Entrará en el formato recomendado.</p>
        <button class="btn btn-primary btn-sm" @click="emit('request-upload')">
          <Icon name="upload" :size="15" /> Subir imagen
        </button>
      </div>
    </div>

    <footer class="me-foot" aria-live="polite">
      <template v-if="readout">
        <span class="m"><b>{{ readout.w }} × {{ readout.h }} cm</b> impresos</span>
        <span class="m">desde el borde: {{ readout.x }} cm izq. · {{ readout.y }} cm arriba</span>
        <span class="q" :class="readout.q.id">
          <Icon :name="readout.q.id === 'ideal' || readout.q.id === 'good' ? 'check' : 'alert'" :size="14" />
          {{ readout.dpi }} DPI · {{ readout.q.label }}
        </span>
        <span v-if="readout.tight" class="q low">
          <Icon name="alert" :size="14" /> Dentro del margen de seguridad (1 cm)
        </span>
      </template>
      <span v-else class="m">
        Talla {{ store.sizeId }} · pecho {{ tbl.chest }} cm · largo {{ tbl.length }} cm · hombro {{ tbl.shoulder }} cm.
        Selecciona una imagen para ver su medida real.
      </span>
    </footer>
  </section>
</template>

<style scoped>
.mold-editor { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg2); border: 1px solid var(--bd); border-radius: var(--radius-lg); overflow: hidden; }

.me-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--bd); flex-wrap: wrap; }
.tabs { display: flex; gap: 10px; flex-wrap: wrap; }
.tab-group { display: flex; align-items: center; gap: 4px; }
.tg-label { font-size: 11px; color: var(--txt2); margin-right: 4px; text-transform: uppercase; letter-spacing: .06em; }
.tab { position: relative; padding: 5px 10px; border: 1px solid var(--bd); background: transparent; color: var(--txt2); border-radius: 6px; font-size: 12px; font-weight: 600; transition: all .18s; }
.tab:hover { color: var(--txt); border-color: var(--bd2); }
.tab.on { background: var(--ac-dark); border-color: var(--ac-dark); color: #07140c; }
.tab:focus-visible, .tool:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.dot { font-style: normal; margin-left: 5px; padding: 0 4px; border-radius: 8px; font-size: 10px; background: rgba(255,255,255,.14); }
.tab.on .dot { background: rgba(0,0,0,.2); }
.me-tools { display: flex; gap: 6px; }
.tool { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border: 1px solid var(--bd); background: transparent; color: var(--txt2); border-radius: 6px; font-size: 12px; font-weight: 600; transition: all .18s; }
.tool:hover { color: var(--txt); border-color: var(--bd2); }
.tool.on { color: var(--ac); border-color: var(--ac-dark); }

.me-stage { position: relative; flex: 1; min-height: 0; background: #151515; }
.me-stage.dragging svg { cursor: grabbing; }
svg { width: 100%; height: 100%; display: block; outline: none; touch-action: none; }
svg:focus-visible { box-shadow: inset 0 0 0 2px var(--ac); }
.sil { stroke: #777; stroke-width: .18; }

.rec { fill: rgba(34,255,122,.07); stroke: none; }
.limit { fill: none; stroke: var(--ac); stroke-width: .22; stroke-dasharray: .9 .6; }
.safe { fill: none; stroke: var(--warn); stroke-width: .1; stroke-dasharray: .3 .5; opacity: .75; }
.zlabel { fill: var(--ac); opacity: .85; font-weight: 600; font-family: var(--font); }
.ruler path { stroke: #8a8a8a; stroke-width: .1; }
.ruler text { fill: #9a9a9a; font-family: var(--font); font-variant-numeric: tabular-nums; }

.img { cursor: grab; }
.img .frame { fill: none; stroke: transparent; stroke-width: .2; }
.img:hover .frame { stroke: rgba(255,255,255,.45); }
.img.sel .frame { stroke: var(--pr); stroke-width: .25; }
.handles .stem { stroke: var(--pr); stroke-width: .18; }
.handles .rot { fill: var(--pr); stroke: #fff; stroke-width: .15; cursor: grab; }
.handles .h { fill: #fff; stroke: var(--pr); stroke-width: .18; cursor: nwse-resize; }

.empty { position: absolute; left: 50%; bottom: 12%; transform: translateX(-50%); width: min(300px, 80%); text-align: center; background: rgba(13,13,13,.9); border: 1px solid var(--bd2); border-radius: var(--radius-lg); padding: 14px; }
.empty-t { color: var(--txt); font-weight: 600; font-size: 14px; }
.empty-d { font-size: 12px; margin: 4px 0 10px; color: var(--txt2); }

.me-foot { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; padding: 9px 14px; border-top: 1px solid var(--bd); font-size: 12px; min-height: 40px; }
.me-foot .m { color: var(--txt2); }
.me-foot .m b { color: var(--txt); font-variant-numeric: tabular-nums; }
.q { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.q.ideal, .q.good { color: var(--ok); }
.q.low { color: var(--warn); }
.q.bad { color: var(--err); }
</style>
