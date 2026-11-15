<template>
  <div class="design-view">
    <div class="design-layout">

      <!-- LEFT: 3D Polo Viewer -->
      <div class="viewer-panel">
        <PoloViewer3D />
      </div>

      <!-- RIGHT: Controls -->
      <aside class="controls-panel">
        <div class="controls-scroll">

          <!-- Sleeve type -->
          <section class="ctrl-section">
            <h3 class="ctrl-title">Tipo de manga</h3>
            <div class="toggle-group">
              <button
                :class="{ active: store.design.sleeveType === 'short' }"
                @click="store.setSleeveType('short')"
              >Manga corta</button>
              <button
                :class="{ active: store.design.sleeveType === 'long' }"
                @click="store.setSleeveType('long')"
              >Manga larga</button>
            </div>
          </section>

          <!-- Polo color -->
          <section class="ctrl-section">
            <h3 class="ctrl-title">Color del polo</h3>
            <div class="color-swatches">
              <button
                v-for="c in POLO_COLORS"
                :key="c.value"
                class="swatch"
                :class="{ selected: store.design.poloColor === c.value }"
                :style="{ background: c.value }"
                :title="c.label"
                @click="store.setPoloColor(c.value)"
              >
                <span v-if="store.design.poloColor === c.value" class="swatch-check">✓</span>
              </button>
            </div>
            <p class="mu mt-4">{{ currentColorName }}</p>
          </section>

          <!-- Upload design -->
          <section class="ctrl-section">
            <h3 class="ctrl-title">Tu imagen</h3>
            <div
              class="upload-zone"
              :class="{ 'has-image': !!store.design.userImageSrc, dragging }"
              @dragover.prevent="dragging = true"
              @dragleave="dragging = false"
              @drop.prevent="handleDrop"
              @click="triggerFileInput"
            >
              <input
                type="file" ref="fileInput" accept="image/*"
                style="display:none" @change="handleFileChange"
              />
              <template v-if="store.design.userImageSrc">
                <img :src="store.design.userImageSrc" class="upload-preview" />
                <p class="mu mt-4">{{ uploadedFileName }}</p>
                <div v-if="resolutionWarning" class="resolution-warn">
                  ⚠️ {{ resolutionWarning }}
                </div>
                <button class="btn btn-ghost btn-sm mt-8" @click.stop="clearImage">Cambiar imagen</button>
              </template>
              <template v-else>
                <div class="upload-icon">📁</div>
                <p class="bold">Arrastra o haz clic para subir</p>
                <p class="mu">JPG, PNG, WebP · máx 5 MB · recomendado ≥ 1200 px</p>
              </template>
            </div>
            <p v-if="uploadError" class="err mt-4">{{ uploadError }}</p>
          </section>

          <!-- Popular designs quick-pick -->
          <section class="ctrl-section">
            <h3 class="ctrl-title">Diseños populares</h3>
            <div class="popular-row">
              <button
                v-for="d in store.popularDesigns.slice(0, 6)"
                :key="d.id"
                class="pop-thumb"
                :class="{ selected: store.design.popularDesignId === d.id }"
                :title="d.name"
                @click="store.setPopularDesign(d.id, d.designUrl)"
              >
                <img :src="d.thumbnailUrl" :alt="d.name" @error="onThumbError" />
              </button>
            </div>
          </section>

          <!-- Image controls (transform mode only) -->
          <section class="ctrl-section" v-if="store.design.userImageSrc">
            <h3 class="ctrl-title">Ajustar imagen</h3>
            <div class="img-controls">
              <label class="ctrl-label">Tamaño (px)</label>
              <input
                type="range" min="80" max="900"
                :value="store.design.frontImageState.width"
                @input="onSizeSlider"
              />
              <div class="row mt-8" style="gap:8px">
                <button class="btn btn-ghost btn-sm" @click="store.updateFrontImageState({ flipH: !store.design.frontImageState.flipH })">
                  ↔ Voltear
                </button>
                <button class="btn btn-ghost btn-sm" @click="store.updateFrontImageState({ rotation: store.design.frontImageState.rotation - 90 })">
                  ↺ -90°
                </button>
                <button class="btn btn-ghost btn-sm" @click="store.resetImagePosition()">
                  Centrar
                </button>
              </div>
            </div>

            <!-- Long sleeve: second image -->
            <template v-if="store.design.sleeveType === 'long'">
              <div class="sleeve-upload-hint">
                <p class="mu">Manga larga — puedes agregar una imagen para las mangas:</p>
                <button class="btn btn-ghost btn-sm" @click="triggerSleeveInput">
                  + Imagen para mangas
                </button>
                <input type="file" ref="sleeveInput" accept="image/*" style="display:none" @change="handleSleeveFile" />
              </div>
            </template>
          </section>

          <!-- Print size info -->
          <section class="ctrl-section">
            <div class="card card-sm print-info">
              <p class="mu">📐 Área de estampado: <strong>30 × 30 cm</strong> en el pecho</p>
              <p class="mu mt-4">Tu diseño se imprimirá a la escala que ves en el visor.</p>
            </div>
          </section>

          <!-- Next CTA -->
          <div class="ctrl-cta">
            <router-link
              to="/order"
              class="btn btn-primary btn-full btn-lg"
              :class="{ 'btn-disabled': !canProceed }"
              @click.prevent="tryProceed"
            >
              Continuar: datos de envío →
            </router-link>
            <p v-if="!canProceed" class="mu text-center mt-4">
              Sube tu diseño o selecciona uno popular para continuar
            </p>
          </div>

        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PoloViewer3D from '../components/PoloViewer3D.vue'
import { useStore } from '../store/index'
import { POLO_COLORS } from '../data/catalog'

const store = useStore()
const router = useRouter()

const fileInput = ref<HTMLInputElement | null>(null)
const sleeveInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const uploadError = ref('')
const uploadedFileName = ref('')
const resolutionWarning = ref('')

const currentColorName = computed(() =>
  POLO_COLORS.find(c => c.value === store.design.poloColor)?.label ?? ''
)

const canProceed = computed(() =>
  !!(store.design.userImageSrc || store.design.popularDesignId)
)

function triggerFileInput() {
  if (!store.design.userImageSrc) fileInput.value?.click()
}

function triggerSleeveInput() {
  sleeveInput.value?.click()
}

function handleFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) processFile(f)
}

function handleDrop(e: DragEvent) {
  dragging.value = false
  const f = e.dataTransfer?.files[0]
  if (f) processFile(f)
}

function handleSleeveFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    const src = reader.result as string
    // For sleeve image we reuse backImageState
    store.setSleeveType('long')
    // Store sleeve src separately — in a real impl extend the store
    console.log('Sleeve image set:', src.slice(0, 60))
  }
  reader.readAsDataURL(f)
}

async function processFile(file: File) {
  uploadError.value = ''
  resolutionWarning.value = ''
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'El archivo debe ser una imagen (JPG, PNG, WebP).'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    uploadError.value = 'La imagen no debe superar 5 MB.'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const src = reader.result as string
    // Check resolution
    const img = new Image()
    img.onload = () => {
      if (Math.min(img.width, img.height) < 900) {
        resolutionWarning.value = `Resolución baja (${img.width}×${img.height}px). Puede salir borroso en el polo.`
      }
      store.setUserImage(src, file)
      uploadedFileName.value = file.name
    }
    img.src = src
  }
  reader.readAsDataURL(file)
}

function clearImage() {
  store.design.userImageSrc = null
  store.design.userImageFile = null
  uploadedFileName.value = ''
  resolutionWarning.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

function onSizeSlider(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  store.updateFrontImageState({ width: v, height: v })
}

function onThumbError(e: Event) {
  (e.target as HTMLImageElement).style.background = '#333'
}

function tryProceed() {
  if (!canProceed.value) return
  router.push('/order')
}
</script>

<style scoped>
.design-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.design-layout {
  display: grid; grid-template-columns: 1fr 400px;
  flex: 1; min-height: 0;
}

/* LEFT panel */
.viewer-panel {
  position: relative; height: calc(100vh - 128px);
  background: #111;
}

/* RIGHT panel */
.controls-panel {
  border-left: 1px solid var(--bd);
  background: var(--bg);
  overflow-y: auto; display: flex; flex-direction: column;
}
.controls-scroll { padding: 24px; display: flex; flex-direction: column; gap: 0; }

.ctrl-section {
  padding-bottom: 20px; margin-bottom: 20px;
  border-bottom: 1px solid var(--bd);
}
.ctrl-section:last-child { border-bottom: none; }
.ctrl-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--txt2); margin-bottom: 12px; }

/* Toggle */
.toggle-group { display: flex; gap: 4px; }
.toggle-group button {
  flex: 1; padding: 8px; border: 1px solid var(--bd);
  background: transparent; border-radius: var(--radius);
  color: var(--txt2); font-size: 14px; font-weight: 500;
  transition: all 0.2s; cursor: pointer;
}
.toggle-group button.active {
  background: var(--pr); border-color: var(--pr); color: #fff;
}

/* Colors */
.color-swatches { display: flex; gap: 10px; flex-wrap: wrap; }
.swatch {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px solid transparent; position: relative;
  transition: transform 0.15s, border-color 0.15s;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.swatch.selected { border-color: var(--pr); transform: scale(1.15); }
.swatch-check { font-size: 14px; color: rgba(255,255,255,0.9); text-shadow: 0 1px 2px rgba(0,0,0,0.6); }

/* Upload zone */
.upload-zone {
  border: 2px dashed var(--bd); border-radius: var(--radius-lg);
  padding: 24px; text-align: center; cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.upload-zone:hover, .upload-zone.dragging {
  border-color: var(--pr); background: rgba(232,64,64,0.05);
}
.upload-zone.has-image { cursor: default; }
.upload-icon { font-size: 36px; margin-bottom: 8px; }
.upload-preview {
  max-width: 100%; max-height: 120px; object-fit: contain;
  border-radius: 6px; margin: 0 auto;
}
.resolution-warn {
  font-size: 12px; color: var(--warn); margin-top: 6px;
}

/* Popular row */
.popular-row { display: flex; gap: 8px; flex-wrap: wrap; }
.pop-thumb {
  width: 52px; height: 52px; border-radius: 6px; overflow: hidden;
  border: 2px solid transparent; cursor: pointer; padding: 0;
  transition: border-color 0.15s, transform 0.15s;
}
.pop-thumb.selected { border-color: var(--pr); transform: scale(1.08); }
.pop-thumb img { width: 100%; height: 100%; object-fit: cover; }

/* Image controls */
.img-controls { display: flex; flex-direction: column; gap: 8px; }
.ctrl-label { font-size: 12px; color: var(--txt2); }
input[type="range"] { width: 100%; accent-color: var(--pr); }
.sleeve-upload-hint { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--bd); }

/* Print info */
.print-info { background: rgba(34,255,122,0.05); border-color: rgba(34,255,122,0.2); }

/* CTA */
.ctrl-cta { padding-top: 4px; }
.btn-disabled { opacity: 0.5; cursor: not-allowed; }

/* Responsive */
@media (max-width: 900px) {
  .design-layout { grid-template-columns: 1fr; }
  .viewer-panel { height: 60vw; min-height: 300px; }
  .controls-panel { max-height: none; }
}
</style>
