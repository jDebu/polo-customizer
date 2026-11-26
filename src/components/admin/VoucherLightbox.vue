<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '../Icon.vue'
import { previewUrl } from '../../lib/orderModel'

const props = defineProps<{ open: boolean; url: string; amount: string; method: string; name: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const box = ref<HTMLElement | null>(null)
const zoomed = ref(false)
const failed = ref(false)

const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
watch(() => props.open, async (v) => {
  zoomed.value = false; failed.value = false
  document.body.style.overflow = v ? 'hidden' : ''
  if (v) { window.addEventListener('keydown', onKey); await nextTick(); box.value?.focus() } else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="lb" @click.self="emit('close')">
      <div ref="box" class="panel" tabindex="-1" role="dialog" aria-modal="true" aria-label="Comprobante de pago">
        <header class="bar">
          <div class="chk">
            <span class="lbl">Verifica que el comprobante diga</span>
            <b>{{ amount }}</b>
            <span class="pm">{{ method || 'pago' }}</span>
            <span class="nm">de {{ name }}</span>
          </div>
          <button class="cl" aria-label="Cerrar" @click="emit('close')"><Icon name="x" :size="22" /></button>
        </header>
        <div class="stage" :class="{ z: zoomed }">
          <img v-if="url && !failed" :src="previewUrl(url, 1600)" alt="Comprobante de pago ampliado" referrerpolicy="no-referrer"
               :title="zoomed ? 'Toca para ajustar a la pantalla' : 'Toca para ver al 100 %'" @click="zoomed = !zoomed" @error="failed = true" />
          <p v-else class="miss">No se pudo cargar la imagen.<br />Abre el archivo original para verlo.</p>
        </div>
        <footer class="ft">
          <a v-if="url" class="btn btn-ghost btn-sm" :href="url" target="_blank" rel="noopener"><Icon name="external" :size="16" /> Abrir original</a>
          <div class="acts"><slot name="actions" /></div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lb { position: fixed; inset: 0; z-index: 500; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.86); padding: 0; }
.panel { display: flex; flex-direction: column; width: 100%; height: 100%; max-width: 880px; background: #121212; outline: none; }
.bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 8px 10px 16px; border-bottom: 1px solid var(--bd); }
.chk { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; min-width: 0; }
.lbl { font-size: 12px; color: var(--txt2); width: 100%; }
.chk b { font-size: 26px; font-weight: 800; color: var(--ac); font-variant-numeric: tabular-nums; line-height: 1.1; }
.pm { text-transform: uppercase; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--bg3); border: 1px solid var(--bd2); }
.nm { font-size: 13px; color: var(--txt2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.cl { width: 48px; height: 48px; border: none; border-radius: 12px; background: transparent; color: var(--txt); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cl:hover { background: var(--bg3); }
.cl:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.stage { flex: 1; min-height: 0; overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: 12px; overscroll-behavior: contain; }
.stage img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; cursor: zoom-in; margin: auto; }
.stage.z img { max-width: none; max-height: none; width: auto; cursor: zoom-out; margin: 0; }
.miss { margin: auto; color: var(--txt2); text-align: center; line-height: 1.6; }
.ft { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--bd); background: #161616; }
.acts { display: flex; gap: 8px; flex: 1; justify-content: flex-end; flex-wrap: wrap; }
@media (min-width: 961px) { .lb { padding: 24px; } .panel { height: min(100%, 860px); border-radius: 16px; overflow: hidden; border: 1px solid var(--bd2); } }
</style>
