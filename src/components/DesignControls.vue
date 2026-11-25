<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../store/index'
import Icon from './Icon.vue'
import { POLO_COLORS } from '../data/catalog'
import { LAYOUTS, MOLDS, MOLD_BY_ID, SIZE_IDS, SIZE_TABLE, layoutCells, type PanelId } from '../data/molds'

const emit = defineEmits<{ (e: 'upload'): void }>()
const props = defineProps<{ uploadError?: string }>()

const store = useStore()
const tab = ref<'img' | 'fmt' | 'polo'>('img')
const open = ref(true) // mobile: permite ocultar el panel para ver el molde más grande
const TABS = [
  { id: 'img', label: 'Imagen', icon: 'photo' },
  { id: 'fmt', label: 'Formato', icon: 'layout' },
  { id: 'polo', label: 'Polo', icon: 'palette' },
] as const

const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',')
const mold = computed(() => MOLD_BY_ID[store.design.activePanel])
const panelImages = computed(() => store.design.placedImages.filter(i => i.panel === store.design.activePanel))
const active = computed(() => store.design.placedImages.find(i => i.id === store.design.activeImageId) ?? null)
const total = computed(() => store.design.placedImages.length)
const layouts = computed(() => (panelImages.value.length >= 2 ? LAYOUTS[panelImages.value.length] ?? [] : []))
const cells = (rows: number[]) => layoutCells(rows, { x: 1, y: 1, w: 32, h: 44 }, 2.5)

const widthCm = computed(() => (active.value ? active.value.state.width * store.factor : 0))
const maxWidthRef = computed(() => {
  if (!active.value) return 1
  return Math.min(mold.value.limit.w, mold.value.limit.h / (active.value.natH / active.value.natW))
})
function step(dCm: number) {
  if (active.value) store.setImageWidth(active.value.id, active.value.state.width + dCm / store.factor)
}
function onSlider(e: Event) {
  if (active.value) store.setImageWidth(active.value.id, Number((e.target as HTMLInputElement).value))
}
function select(img: { id: string; panel: PanelId }) {
  store.setActivePanel(img.panel)
  store.setActiveImage(img.id)
  tab.value = 'img'
}
const activeFormat = computed(() => {
  const i = active.value
  if (!i) return null
  const s = i.state
  return mold.value.formats.find(f => Math.abs(f.cx - (s.x + s.width / 2)) < 0.5 && Math.abs(f.cy - (s.y + s.height / 2)) < 0.5)?.id ?? null
})
const colorName = computed(() => POLO_COLORS.find(c => c.value === store.design.poloColor)?.label ?? '')
</script>

<template>
  <div class="ctl" :class="{ shut: !open }">
    <div class="tabs" role="tablist" aria-label="Controles del diseño">
      <button v-for="t in TABS" :key="t.id" :id="`tab-${t.id}`" role="tab" class="tab" :class="{ on: tab === t.id }"
              :aria-selected="tab === t.id" :aria-controls="`panel-${t.id}`" @click="tab = t.id">
        <Icon :name="t.icon" :size="18" /> {{ t.label }}
      </button>
      <button class="fold" :aria-expanded="open" :aria-label="open ? 'Ocultar controles' : 'Mostrar controles'" @click="open = !open">
        <Icon name="chevron-down" :size="20" :class="{ flip: !open }" />
      </button>
    </div>

    <div v-show="open" class="body">
      <!-- IMAGEN -->
      <div v-show="tab === 'img'" id="panel-img" role="tabpanel" aria-labelledby="tab-img" class="pn">
        <button v-if="!total" class="btn btn-primary btn-sm full" @click="emit('upload')">
          <Icon name="upload" :size="16" /> Subir imagen
        </button>
        <p v-if="props.uploadError" class="err" role="alert">{{ props.uploadError }}</p>

        <template v-if="active">
          <div class="sizer">
            <div class="sz-head"><span>Ancho</span><b>{{ n1(widthCm) }} cm</b></div>
            <div class="sz-row">
              <button class="rnd" aria-label="Reducir 0,5 cm" @click="step(-0.5)"><Icon name="minus" :size="18" /></button>
              <input type="range" :min="1" :max="maxWidthRef" step="0.25" :value="active.state.width"
                     aria-label="Ancho de la imagen en el polo" @input="onSlider" />
              <button class="rnd" aria-label="Aumentar 0,5 cm" @click="step(0.5)"><Icon name="plus" :size="18" /></button>
            </div>
          </div>
          <div class="acts">
            <button class="act" @click="store.updatePlacedImageState(active.id, { flipH: !active.state.flipH })"><Icon name="flip" :size="18" />Voltear</button>
            <button class="act" @click="store.updatePlacedImageState(active.id, { rotation: active.state.rotation - 90 })"><Icon name="rotate" :size="18" />Girar</button>
            <button class="act" @click="store.centerImage(active.id)"><Icon name="center" :size="18" />Centrar</button>
            <button class="act danger" @click="store.removeImage(active.id)"><Icon name="trash" :size="18" />Quitar</button>
          </div>
        </template>
        <p v-else-if="total" class="hint">Toca una imagen en el molde o en la lista para editarla.</p>
        <p v-else class="hint">Sube una imagen PNG, JPG o WebP (máx. 5 MB). Entrará completa en el formato recomendado de «{{ mold.label }}».</p>

        <div v-if="total" class="thumbs" role="list" aria-label="Imágenes del diseño">
          <button v-for="img in store.design.placedImages" :key="img.id" role="listitem" class="thumb" :class="{ cur: img.id === store.design.activeImageId }"
                  :aria-label="`Imagen en ${MOLD_BY_ID[img.panel].label}`" @click="select(img)">
            <img :src="img.src" alt="" />
            <span>{{ MOLD_BY_ID[img.panel].short }}</span>
          </button>
          <button v-if="total < 6" class="thumb add" aria-label="Subir otra imagen" @click="emit('upload')"><Icon name="plus" :size="22" /><span>{{ total }}/6</span></button>
        </div>
      </div>

      <!-- FORMATO -->
      <div v-show="tab === 'fmt'" id="panel-fmt" role="tabpanel" aria-labelledby="tab-fmt" class="pn">
        <template v-if="active">
          <p class="lab">Formato de «{{ mold.label }}»</p>
          <div class="chips">
            <button v-for="f in mold.formats" :key="f.id" class="chip" :class="{ on: activeFormat === f.id }" @click="store.fitFormat(active.id, f.id)">
              {{ f.label.replace(/ \d+ × \d+$/, '') }}
              <b>{{ n1(f.w * store.factor) }} × {{ n1(f.h * store.factor) }} cm</b>
            </button>
          </div>
          <p class="lab">Mover a otra zona</p>
          <label class="sr" for="move-sel">Mover imagen a</label>
          <select id="move-sel" class="sel" :value="active.panel" @change="store.moveImageToPanel(active.id, ($event.target as HTMLSelectElement).value as PanelId)">
            <option v-for="m in MOLDS" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
        </template>
        <p v-else class="hint">Selecciona una imagen para cambiar su formato o moverla a otra zona.</p>

        <p class="lab">Ajustar a moldes</p>
        <div v-if="layouts.length" class="lay">
          <button v-for="p in layouts" :key="p.id" class="ly" @click="store.applyLayout(store.design.activePanel, p.id)">
            <svg viewBox="0 0 34 46" aria-hidden="true">
              <rect x="0.5" y="0.5" width="33" height="45" class="lb" />
              <rect v-for="(c, i) in cells(p.rows)" :key="i" :x="c.x" :y="c.y" :width="c.w" :height="c.h" rx="1.5" class="lc" />
            </svg>
            <span>{{ p.label }}</span>
          </button>
        </div>
        <p v-else class="hint">Con 2 a 6 imágenes en la misma zona puedes repartirlas en fila, triángulo, cuadrícula… con tamaños iguales y dentro de los límites.</p>
      </div>

      <!-- POLO -->
      <div v-show="tab === 'polo'" id="panel-polo" role="tabpanel" aria-labelledby="tab-polo" class="pn">
        <p class="lab">Color de la vista previa <b>· {{ colorName }}</b></p>
        <div class="sw">
          <button v-for="c in POLO_COLORS" :key="c.value" class="swatch" :class="{ on: store.design.poloColor === c.value }"
                  :style="{ background: c.value }" :aria-label="c.label" :aria-pressed="store.design.poloColor === c.value"
                  @click="store.setPoloColor(c.value)"><Icon v-if="store.design.poloColor === c.value" name="check" :size="16" class="ck" /></button>
        </div>
        <p class="lab">Manga</p>
        <div class="seg">
          <button :class="{ on: store.design.sleeveType === 'short' }" @click="store.setSleeveType('short')">Corta</button>
          <button :class="{ on: store.design.sleeveType === 'long' }" @click="store.setSleeveType('long')">Larga</button>
        </div>
        <p class="lab">Talla para ver el molde <b>· pecho {{ SIZE_TABLE[store.sizeId].chest }} cm</b></p>
        <div class="seg six">
          <button v-for="s in SIZE_IDS" :key="s" :class="{ on: store.sizeId === s }" @click="store.setSize(s)">{{ s }}</button>
        </div>
        <p class="hint info"><Icon name="info" :size="15" /> Esto es solo para la vista previa. En el siguiente paso eliges todas las tallas, colores y cantidades del pedido; el diseño se escala solo.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ctl { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg2); border: 1px solid var(--bd); border-radius: var(--radius-lg); overflow: hidden; }
.tabs { display: grid; grid-template-columns: repeat(3, 1fr) 0; border-bottom: 1px solid var(--bd); flex-shrink: 0; }
.tab { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; background: transparent; color: var(--txt2); font-size: 14px; font-weight: 600; border-bottom: 2px solid transparent; transition: color .18s, border-color .18s; }
.tab:hover { color: var(--txt); }
.tab.on { color: var(--txt); border-bottom-color: var(--pr); }
.tab:focus-visible { outline: 2px solid var(--ac); outline-offset: -2px; }
.body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.pn { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.full { width: 100%; min-height: 44px; }
.cnt { margin-left: 4px; font-size: 12px; opacity: .75; font-variant-numeric: tabular-nums; }
.hint { font-size: 13px; line-height: 1.5; color: var(--txt2); }
.hint.info { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; background: var(--bg3); border-radius: var(--radius); }
.hint.info :deep(svg) { flex-shrink: 0; margin-top: 2px; color: var(--ac); }
.err { color: var(--err); font-size: 13px; }
.lab { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--txt3); margin-top: 2px; }
.lab b { color: var(--txt2); font-weight: 600; text-transform: none; letter-spacing: 0; }

.sz-head { display: flex; justify-content: space-between; font-size: 13px; color: var(--txt2); margin-bottom: 4px; }
.sz-head b { color: var(--txt); font-variant-numeric: tabular-nums; }
.sz-row { display: flex; align-items: center; gap: 10px; }
.rnd { width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid var(--bd2); background: var(--bg3); color: var(--txt); display: inline-flex; align-items: center; justify-content: center; }
.rnd:hover { border-color: #666; }
.rnd:focus-visible, .act:focus-visible, .thumb:focus-visible, .chip:focus-visible, .ly:focus-visible, .swatch:focus-visible, .seg button:focus-visible, .sel:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
input[type=range] { flex: 1; min-width: 0; height: 44px; padding: 0; background: transparent; border: none; accent-color: var(--pr); }

.acts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.act { min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 1px solid var(--bd); background: var(--bg3); color: var(--txt); border-radius: var(--radius); font-size: 12px; font-weight: 600; transition: border-color .18s; }
.act:hover { border-color: #666; }
.act.danger { color: #ff8a8a; }

.thumbs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
.thumb { position: relative; display: block; flex: 0 0 auto; width: 60px; height: 60px; padding: 0; border: 2px solid transparent; border-radius: 8px; overflow: hidden; background: #222; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb span { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.72); color: #fff; font-size: 10px; padding: 1px 0; }
.thumb.cur { border-color: var(--pr); }

.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px; min-height: 48px; padding: 6px 12px; border: 1px solid var(--bd); background: transparent; color: var(--txt2); border-radius: 10px; font-size: 12px; text-align: left; }
.chip b { color: var(--txt); font-size: 13px; font-variant-numeric: tabular-nums; }
.chip:hover { border-color: #666; }
.chip.on { border-color: var(--ac-dark); background: rgba(34,255,122,.06); }
.sel { width: 100%; min-height: 44px; }

.lay { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
.ly { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 6px; border: 1px solid var(--bd); background: transparent; color: var(--txt2); border-radius: var(--radius); font-size: 11.5px; text-align: center; }
.ly:hover { border-color: var(--ac-dark); color: var(--txt); }
.ly svg { width: 36px; height: 48px; }
.lb { fill: none; stroke: var(--bd2); stroke-width: 1; stroke-dasharray: 3 2; }
.lc { fill: var(--ac-dark); opacity: .9; }

.sw { display: flex; flex-wrap: wrap; gap: 10px; }
.swatch { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--bd2); display: inline-flex; align-items: center; justify-content: center; transition: transform .15s, border-color .15s; }
.swatch.on { border-color: var(--pr); transform: scale(1.1); }
.ck { color: #fff; mix-blend-mode: difference; }
.seg { display: flex; gap: 4px; }
.seg button { flex: 1; min-height: 44px; border: 1px solid var(--bd); background: transparent; color: var(--txt2); border-radius: var(--radius); font-size: 14px; font-weight: 600; }
.seg button.on { background: var(--pr); border-color: var(--pr); color: #fff; }
.seg.six button { font-size: 13px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.fold { display: none; }
.thumb.add { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: transparent; border: 1px dashed var(--bd2); color: var(--txt2); }
.thumb.add span { position: static; background: none; color: var(--txt3); font-size: 11px; }
@media (max-width: 960px) {
  .tabs { grid-template-columns: repeat(3, 1fr) 48px; }
  .fold { display: inline-flex; align-items: center; justify-content: center; border: none; border-left: 1px solid var(--bd); background: transparent; color: var(--txt2); }
  .fold:focus-visible { outline: 2px solid var(--ac); outline-offset: -2px; }
  .fold :deep(svg) { transition: transform .2s; }
  .fold :deep(svg.flip) { transform: rotate(180deg); }
  .tab { min-height: 44px; }
  .pn { padding: 10px 12px; gap: 10px; }
  .act { min-height: 50px; }
}
@media (prefers-reduced-motion: reduce) { .swatch, .tab, .act, .fold :deep(svg) { transition: none; } }
</style>
