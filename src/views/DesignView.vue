<template>
  <div class="design-view">

    <!-- TOP bar -->
    <header class="dv-head">
      <router-link to="/" class="dv-back">← Inicio</router-link>
      <h2 class="dv-title">Personaliza tu polo</h2>
      <button class="btn btn-primary dv-proceed" :disabled="!canProceed" @click="tryProceed">
        Continuar →
      </button>
    </header>

    <div class="dv-body">

      <!-- LEFT: 2D Mold Editor (main design area) -->
      <div class="editor-pane">
        <MoldEditor @request-upload="fileInput?.click()" @drop-file="processDroppedFile" />
      </div>

      <!-- RIGHT: 3D Preview + sidebar -->
      <div class="right-pane">
        <div class="viewer-pane">
          <PoloViewer3D ref="viewer" />
        </div>

        <!-- SIDEBAR: controls -->
        <aside class="sidebar">
          <div class="sb-scroll">

            <!-- Upload -->
            <section class="sb-section">
              <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="handleFileChange" />
              <button class="btn btn-primary btn-full sb-upload"
                      :disabled="store.design.placedImages.length >= 6"
                      @click="fileInput?.click()">
                <Icon name="upload" /> Subir imagen al molde activo
              </button>
              <p v-if="uploadError" class="sb-err">{{ uploadError }}</p>
            </section>

            <!-- Active image controls -->
            <section v-if="activeImg" class="sb-section">
              <p class="sb-label">Imagen activa</p>
              <div class="sb-row">
                <label class="sb-label">Ancho</label>
                <input type="range" :min="1" :max="mold.limit.w" step="0.5"
                       :value="activeImg.state.width"
                       @input="onWidthSlider" />
                <span class="sb-val">{{ n1(activeImg.state.width * store.factor) }} cm</span>
              </div>
              <div class="sb-row mt-6">
                <button class="btn btn-ghost btn-sm" @click="store.updatePlacedImageState(activeImg.id, { flipH: !activeImg.state.flipH })"><Icon name="flip" /> Voltear</button>
                <button class="btn btn-ghost btn-sm" @click="store.updatePlacedImageState(activeImg.id, { rotation: activeImg.state.rotation - 90 })"><Icon name="rotate" /> -90°</button>
                <button class="btn btn-ghost btn-sm" @click="store.centerImage(activeImg.id)"><Icon name="center" /> Centrar</button>
                <button class="btn btn-ghost btn-sm" @click="store.removeImage(activeImg.id)"><Icon name="trash" /></button>
              </div>

              <p class="sb-label mt-10">Formato</p>
              <div class="fmt-row">
                <button v-for="f in mold.formats" :key="f.id" class="fmt-btn"
                        :class="{ on: activeFormatId === f.id }"
                        @click="store.fitFormat(activeImg.id, f.id)">
                  {{ f.label }}
                </button>
              </div>

              <p class="sb-label mt-10">Mover a molde</p>
              <div class="mold-row">
                <button v-for="m in bodyMolds" :key="m.id" class="mold-btn"
                        :class="{ on: activeImg.panel === m.id }"
                        @click="store.moveImageToPanel(activeImg.id, m.id)">
                  {{ m.label }}
                </button>
              </div>
            </section>

            <!-- Layout presets -->
            <section v-if="panelImages.length > 1 && layouts.length > 0" class="sb-section">
              <p class="sb-label">Distribución ({{ panelImages.length }} imgs)</p>
              <div class="fmt-row">
                <button v-for="lp in layouts" :key="lp.id" class="fmt-btn"
                        @click="store.applyLayout(store.design.activePanel, lp.id)">
                  <Icon name="layout" :size="12" /> {{ lp.label }}
                </button>
              </div>
            </section>

            <!-- Images grid -->
            <section v-if="store.design.placedImages.length > 0" class="sb-section">
              <p class="sb-label">Imágenes <span class="sb-cnt">({{ store.design.placedImages.length }}/6)</span></p>
              <div class="imgs-row">
                <div v-for="img in store.design.placedImages" :key="img.id" class="icard"
                     :class="{ sel: store.design.activeImageId === img.id }"
                     @click="store.setActiveImage(img.id); store.setActivePanel(img.panel)">
                  <img :src="img.src" class="icard-thumb" />
                  <span class="icard-lbl">{{ MOLD_BY_ID[img.panel]?.short ?? img.panel }}</span>
                  <button class="icard-rm" @click.stop="store.removeImage(img.id)">✕</button>
                </div>
              </div>
            </section>

            <!-- Color -->
            <section class="sb-section">
              <p class="sb-label">Color del polo</p>
              <div class="swatches">
                <button v-for="c in POLO_COLORS" :key="c.value" class="swatch"
                        :class="{ on: store.design.poloColor === c.value }"
                        :style="{ background: c.value }" :title="c.label"
                        @click="store.setPoloColor(c.value)">
                  <span v-if="store.design.poloColor === c.value" class="sw-ck">✓</span>
                </button>
              </div>
            </section>

            <!-- Sleeve + Size -->
            <section class="sb-section">
              <p class="sb-label">Manga</p>
              <div class="toggle-g">
                <button :class="{ on: store.design.sleeveType === 'short' }" @click="store.setSleeveType('short')">Corta</button>
                <button :class="{ on: store.design.sleeveType === 'long' }" @click="store.setSleeveType('long')">Larga</button>
              </div>
              <p class="sb-label mt-10">Talla de referencia</p>
              <div class="toggle-g">
                <button v-for="s in SIZE_IDS" :key="s" :class="{ on: store.sizeId === s }" @click="store.setSize(s)">{{ s }}</button>
              </div>
            </section>
            <!-- TODO: ocultar por ahora hasta implementar una seccion de polos con likes -->
            <!-- Popular designs -->
            <!-- <section class="sb-section">
              <p class="sb-label">Diseños populares</p>
              <div class="pops">
                <button v-for="d in store.popularDesigns.slice(0, 6)" :key="d.id" class="pop"
                        :class="{ on: store.design.popularDesignId === d.id }"
                        :title="d.name"
                        @click="store.setPopularDesign(d.id, d.designUrl)">
                  <img :src="d.thumbnailUrl" :alt="d.name" @error="onThumbErr" />
                </button>
              </div>
            </section> -->

          </div><!-- /sb-scroll -->
        </aside>
      </div><!-- /right-pane -->
    </div><!-- /dv-body -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PoloViewer3D from '../components/PoloViewer3D.vue'
import MoldEditor from '../components/MoldEditor.vue'
import Icon from '../components/Icon.vue'
import { useStore } from '../store/index'
import { POLO_COLORS } from '../data/catalog'
import { MOLD_BY_ID, MOLDS, LAYOUTS, SIZE_IDS } from '../data/molds'

const store = useStore()
const router = useRouter()

const viewer = ref<InstanceType<typeof PoloViewer3D> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadError = ref('')

const n1 = (v: number) => (Math.round(v * 10) / 10).toString()

const bodyMolds = MOLDS.filter(m => m.group === 'body')
const mold = computed(() => MOLD_BY_ID[store.design.activePanel])
const panelImages = computed(() => store.design.placedImages.filter(i => i.panel === store.design.activePanel))
const layouts = computed(() => LAYOUTS[panelImages.value.length] ?? [])
const activeImg = computed(() => store.design.placedImages.find(i => i.id === store.design.activeImageId))

const activeFormatId = computed(() => {
  const img = activeImg.value
  if (!img) return null
  const s = img.state
  return mold.value.formats.find(f =>
    Math.abs(f.cx - (s.x + s.width / 2)) < 0.5 && Math.abs(f.cy - (s.y + s.height / 2)) < 0.5
  )?.id ?? null
})

const canProceed = computed(() => store.design.placedImages.length > 0 || !!store.design.popularDesignId)

function handleFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) processFile(f)
  if (fileInput.value) fileInput.value.value = ''
}

function processDroppedFile(file: File) { processFile(file) }

async function processFile(file: File) {
  uploadError.value = ''
  if (!file.type.startsWith('image/')) { uploadError.value = 'Debe ser una imagen (JPG, PNG, WebP).'; return }
  if (file.size > 5 * 1024 * 1024) { uploadError.value = 'Máx. 5 MB.'; return }
  const reader = new FileReader()
  reader.onload = () => { void store.addImageToPanel(reader.result as string, file) }
  reader.readAsDataURL(file)
}

function onWidthSlider(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (activeImg.value) store.setImageWidth(activeImg.value.id, v)
}

function onThumbErr(e: Event) { (e.target as HTMLImageElement).style.background = '#333' }

async function tryProceed() {
  if (!canProceed.value) return
  try { const c = await viewer.value?.captureViews() ?? []; store.setRenderCaptures(c) } catch {}
  router.push('/order')
}
</script>

<style scoped>
.design-view { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.dv-head { display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-bottom: 1px solid var(--bd); background: var(--bg2); flex-shrink: 0; }
.dv-back { font-size: 13px; color: var(--txt2); flex-shrink: 0; }
.dv-back:hover { color: var(--txt); }
.dv-title { flex: 1; font-size: 15px; font-weight: 700; text-align: center; }
.dv-proceed { height: 36px; padding: 0 18px; font-size: 14px; }

.dv-body { display: grid; grid-template-columns: 1fr 480px; flex: 1; min-height: 0; overflow: hidden; }

.editor-pane { min-height: 0; overflow: hidden; border-right: 1px solid var(--bd); }

.right-pane { display: grid; grid-template-rows: 1fr auto; min-height: 0; overflow: hidden; }
.viewer-pane { min-height: 0; overflow: hidden; }

.sidebar { background: var(--bg); border-top: 1px solid var(--bd); overflow-y: auto; max-height: 42vh; }
.sb-scroll { padding: 14px; display: flex; flex-direction: column; gap: 0; }
.sb-section { padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--bd); }
.sb-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.sb-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--txt2); margin-bottom: 7px; }
.sb-cnt { font-weight: 400; }
.sb-err { font-size: 12px; color: var(--err); margin-top: 5px; }
.sb-upload { height: 36px; font-size: 13px; justify-content: center; gap: 7px; }
.sb-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sb-val { font-size: 12px; color: var(--txt); font-variant-numeric: tabular-nums; white-space: nowrap; }
.mt-6 { margin-top: 6px; }
.mt-10 { margin-top: 10px; }
input[type="range"] { flex: 1; accent-color: var(--pr); min-width: 60px; }

.fmt-row { display: flex; flex-wrap: wrap; gap: 4px; }
.fmt-btn { padding: 4px 8px; border: 1px solid var(--bd); background: transparent; color: var(--txt2); border-radius: 6px; font-size: 11px; cursor: pointer; transition: all .15s; display: inline-flex; align-items: center; gap: 4px; }
.fmt-btn:hover { border-color: var(--bd2); color: var(--txt); }
.fmt-btn.on { border-color: var(--ac-dark); color: var(--ac); }
.mold-row { display: flex; gap: 4px; flex-wrap: wrap; }
.mold-btn { padding: 4px 10px; border: 1px solid var(--bd); background: transparent; color: var(--txt2); border-radius: 6px; font-size: 11px; cursor: pointer; transition: all .15s; }
.mold-btn:hover { color: var(--txt); border-color: var(--bd2); }
.mold-btn.on { border-color: var(--pr); color: var(--pr); }

.imgs-row { display: flex; flex-wrap: wrap; gap: 6px; }
.icard { position: relative; width: 52px; border: 2px solid transparent; border-radius: 6px; overflow: hidden; cursor: pointer; transition: border-color .15s; }
.icard.sel { border-color: var(--pr); }
.icard-thumb { width: 52px; height: 52px; object-fit: cover; display: block; }
.icard-lbl { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,.65); color: #fff; font-size: 9px; text-align: center; padding: 1px 0; }
.icard-rm { position: absolute; top: 2px; right: 2px; width: 15px; height: 15px; border-radius: 50%; background: rgba(232,64,64,.9); color: #fff; border: none; font-size: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .15s; }
.icard:hover .icard-rm { opacity: 1; }

.swatches { display: flex; gap: 8px; flex-wrap: wrap; }
.swatch { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; transition: transform .15s, border-color .15s; }
.swatch.on { border-color: var(--pr); transform: scale(1.18); }
.sw-ck { font-size: 13px; color: rgba(255,255,255,.9); text-shadow: 0 1px 2px rgba(0,0,0,.6); }

.toggle-g { display: flex; gap: 3px; flex-wrap: wrap; }
.toggle-g button { flex: 1; min-width: 36px; padding: 5px 8px; border: 1px solid var(--bd); background: transparent; color: var(--txt2); border-radius: 6px; font-size: 12px; cursor: pointer; transition: all .15s; }
.toggle-g button:hover { color: var(--txt); border-color: var(--bd2); }
.toggle-g button.on { background: var(--pr); border-color: var(--pr); color: #fff; }

.pops { display: flex; gap: 6px; flex-wrap: wrap; }
.pop { width: 46px; height: 46px; border-radius: 6px; border: 2px solid transparent; overflow: hidden; padding: 0; cursor: pointer; transition: border-color .15s, transform .15s; }
.pop.on { border-color: var(--pr); transform: scale(1.1); }
.pop img { width: 100%; height: 100%; object-fit: cover; }

@media (max-width: 900px) {
  .dv-body { grid-template-columns: 1fr; }
  .editor-pane { height: 55vw; }
  .right-pane { grid-template-rows: 50vw auto; }
}
</style>
