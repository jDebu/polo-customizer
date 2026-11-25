<template>
  <div class="dv" :class="`mv-${mobileView}`">
    <header class="dv-head">
      <router-link to="/" class="dv-back" aria-label="Volver al inicio"><Icon name="arrow-left" :size="20" /><span class="dv-back-t">Inicio</span></router-link>
      <h1 class="dv-title">Personaliza tu polo</h1>
      <p class="dv-step"><b>Paso 1</b> de 4 · Diseño</p>
    </header>

    <div class="dv-body">
      <div class="a-nav"><MoldNav /></div>

      <div class="a-edit"><MoldEditor @request-upload="fileInput?.click()" @drop-file="processFile" /></div>
      <div class="a-3d"><PoloViewer3D ref="viewer" /></div>

      <!-- Solo mobile: alterna 2D / 3D en el mismo espacio -->
      <div class="a-switch" role="tablist" aria-label="Tipo de vista">
        <button role="tab" :aria-selected="mobileView === '2d'" :class="{ on: mobileView === '2d' }" @click="mobileView = '2d'"><Icon name="grid" :size="16" /> Molde 2D</button>
        <button role="tab" :aria-selected="mobileView === '3d'" :class="{ on: mobileView === '3d' }" @click="mobileView = '3d'"><Icon name="box" :size="16" /> Vista 3D</button>
      </div>

      <div class="a-ctl">
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="handleFileChange" />
        <DesignControls :upload-error="uploadError" @upload="fileInput?.click()" />
      </div>
    </div>

    <!-- Barra de acción siempre visible: aquí no se pierde el botón al terminar -->
    <footer class="dv-foot">
      <div class="foot-info" aria-live="polite">
        <p class="fi-main">
          <template v-if="canProceed">{{ imgCount }} imagen{{ imgCount === 1 ? '' : 'es' }} en el diseño</template>
          <template v-else>Sube una imagen para continuar</template>
        </p>
        <p class="fi-sub">Talla {{ store.sizeId }} · {{ colorLabel }} · {{ store.design.sleeveType === 'short' ? 'manga corta' : 'manga larga' }}</p>
      </div>
      <button class="btn btn-primary cta" :disabled="!canProceed || proceeding" @click="tryProceed">
        <span v-if="proceeding" class="spin" aria-hidden="true" />
        {{ proceeding ? 'Preparando…' : 'Continuar' }}
        <Icon v-if="!proceeding" name="arrow-right" :size="18" />
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PoloViewer3D from '../components/PoloViewer3D.vue'
import MoldEditor from '../components/MoldEditor.vue'
import MoldNav from '../components/MoldNav.vue'
import DesignControls from '../components/DesignControls.vue'
import Icon from '../components/Icon.vue'
import { useStore } from '../store/index'
import { POLO_COLORS } from '../data/catalog'

const store = useStore()
const router = useRouter()

const viewer = ref<InstanceType<typeof PoloViewer3D> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadError = ref('')
const mobileView = ref<'2d' | '3d'>('2d')
const proceeding = ref(false)

const imgCount = computed(() => store.design.placedImages.length)
const canProceed = computed(() => imgCount.value > 0 || !!store.design.popularDesignId)
const colorLabel = computed(() => POLO_COLORS.find(c => c.value === store.design.poloColor)?.label ?? '')

let errTimer = 0
function fail(msg: string) {
  uploadError.value = msg
  clearTimeout(errTimer)
  errTimer = window.setTimeout(() => (uploadError.value = ''), 6000)
}

function handleFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) processFile(f)
  if (fileInput.value) fileInput.value.value = ''
}

function processFile(file: File) {
  uploadError.value = ''
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return fail('Usa una imagen PNG, JPG o WebP.')
  if (file.size > 5 * 1024 * 1024) return fail('La imagen pesa más de 5 MB. Comprímela e inténtalo otra vez.')
  if (store.design.placedImages.length >= 6) return fail('Máximo 6 imágenes por diseño.')
  const reader = new FileReader()
  reader.onload = () => { void store.addImageToPanel(reader.result as string, file) }
  reader.readAsDataURL(file)
}

async function tryProceed() {
  if (!canProceed.value || proceeding.value) return
  proceeding.value = true
  try {
    store.setRenderCaptures((await viewer.value?.captureViews()) ?? [])
  } catch (e) {
    console.warn('[design] captureViews', e)
  }
  proceeding.value = false
  router.push('/order')
}
</script>

<style scoped>
.dv { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; background: var(--bg); }

.dv-head { display: flex; align-items: center; gap: 12px; padding: 8px 16px; min-height: 52px; border-bottom: 1px solid var(--bd); background: var(--bg2); flex-shrink: 0; }
.dv-back { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; min-width: 40px; color: var(--txt2); font-size: 14px; }
.dv-back:hover { color: var(--txt); }
.dv-title { flex: 1; font-size: 16px; font-weight: 700; text-align: left; }
.dv-step { font-size: 13px; color: var(--txt2); white-space: nowrap; }
.dv-step b { color: var(--txt); }

/* ── Desktop ─────────────────────────────────── */
.dv-body {
  flex: 1; min-height: 0; display: grid; gap: 12px; padding: 12px 16px;
  grid-template-columns: minmax(0, 1fr) 420px;
  grid-template-rows: auto minmax(0, 1fr) clamp(250px, 36vh, 360px);
  grid-template-areas: 'nav three' 'edit three' 'edit ctl';
}
.a-nav { grid-area: nav; }
.a-edit { grid-area: edit; min-height: 0; min-width: 0; }
.a-3d { grid-area: three; min-height: 0; min-width: 0; }
.a-ctl { grid-area: ctl; min-height: 0; }
.a-switch { display: none; }

/* ── Barra de acción ─────────────────────────── */
.dv-foot {
  flex-shrink: 0; display: flex; align-items: center; gap: 16px; justify-content: space-between;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--bd); background: var(--bg2);
}
.foot-info { min-width: 0; }
.fi-main { font-size: 14px; font-weight: 700; color: var(--txt); line-height: 1.3; }
.fi-sub { font-size: 12px; color: var(--txt2); line-height: 1.3; }
.cta { min-height: 52px; padding: 0 28px; font-size: 16px; flex-shrink: 0; }
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: spin .7s linear infinite; }

/* ── Mobile ─────────────────────────────────── */
@media (max-width: 960px) {
  .dv-head { padding: 4px 8px; min-height: 48px; gap: 6px; }
  .dv-back-t { display: none; }
  .dv-title { font-size: 15px; }
  .dv-step { font-size: 12px; }
  .dv-body {
    gap: 8px; padding: 8px 10px; grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas: 'nav' 'stage' 'ctl';
  }
  .a-edit, .a-3d { grid-area: stage; }
  .a-ctl { max-height: 40dvh; min-height: 0; display: flex; flex-direction: column; }
  .a-ctl > :deep(.ctl) { flex: 1; }
  .a-switch {
    grid-area: stage; z-index: 4; display: flex; align-self: start; justify-self: start; margin: 8px;
    background: rgba(13,13,13,.88); border: 1px solid var(--bd2); border-radius: 999px; padding: 3px; backdrop-filter: blur(6px);
  }
  .a-switch button { min-height: 36px; padding: 0 12px; border: none; border-radius: 999px; background: transparent; color: var(--txt2); font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .a-switch button.on { background: var(--txt); color: #0d0d0d; }
  .a-switch button:focus-visible { outline: 2px solid var(--ac); outline-offset: 1px; }
  .mv-2d .a-3d, .mv-3d .a-edit { display: none; }
  .dv-foot { padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px)); gap: 12px; }
  .fi-sub { display: none; }
  .cta { padding: 0 24px; min-width: 150px; }
}
@media (max-height: 700px) and (max-width: 960px) { .a-ctl { max-height: 34dvh; } }
@media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2s; } }
</style>
