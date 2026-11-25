<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useStore } from '../store/index'
import Icon from './Icon.vue'

const props = defineProps<{ open: boolean; error: string | null }>()
const emit = defineEmits<{ (e: 'retry'): void; (e: 'close'): void }>()
const store = useStore()
const box = ref<HTMLElement | null>(null)
const slow = ref(false)
let timer = 0

const STEPS = [
  { id: 'upload', label: 'Subiendo comprobante y diseño' },
  { id: 'register', label: 'Registrando tu pedido' },
  { id: 'notify', label: 'Avisando al equipo' },
] as const
const order = ['upload', 'register', 'notify', 'done']
const phase = computed(() => store.submitProgress.phase)
const idx = computed(() => Math.max(0, order.indexOf(phase.value)))

// Barra real: 0–80 % archivos subidos, 80–92 % registro, 92–100 % aviso
const pct = computed(() => {
  const { done, total } = store.submitProgress
  if (phase.value === 'upload') return total ? Math.round((done / total) * 78) + 2 : 4
  if (phase.value === 'register') return 84
  if (phase.value === 'notify') return 94
  return phase.value === 'done' ? 100 : 0
})
const detail = computed(() => {
  const { done, total } = store.submitProgress
  return phase.value === 'upload' && total ? `${done} de ${total} archivos` : ''
})

watch(() => props.open, async (v) => {
  clearTimeout(timer); slow.value = false
  if (v) {
    timer = window.setTimeout(() => (slow.value = true), 15000)
    await nextTick(); box.value?.focus()
  }
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ov" role="presentation">
      <div ref="box" class="box" tabindex="-1" role="alertdialog" aria-modal="true" aria-labelledby="ov-t" aria-describedby="ov-d">
        <template v-if="!error">
          <div class="ring" aria-hidden="true"><span class="spin" /></div>
          <h2 id="ov-t">Enviando tu pedido</h2>
          <p id="ov-d" class="d">No cierres ni recargues esta página. Puede tardar un momento.</p>

          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="pct" aria-label="Progreso del envío">
            <i :style="{ width: pct + '%' }" />
          </div>
          <p class="pc" aria-live="polite">{{ pct }} % <span v-if="detail">· {{ detail }}</span></p>

          <ol class="phases">
            <li v-for="(s, i) in STEPS" :key="s.id" :class="{ done: i < idx || phase === 'done', now: i === idx && phase !== 'done' }">
              <span class="ic"><Icon v-if="i < idx || phase === 'done'" name="check" :size="14" /><b v-else-if="i === idx" class="pulse" /></span>
              {{ s.label }}
            </li>
          </ol>
          <p v-if="slow" class="slow" role="status">La conexión está lenta, pero sigue en curso. Mantén esta pantalla abierta.</p>
        </template>

        <template v-else>
          <div class="ring bad" aria-hidden="true"><Icon name="alert" :size="26" /></div>
          <h2 id="ov-t">No se pudo enviar</h2>
          <p id="ov-d" class="d">{{ error }}</p>
          <p class="d">Tu diseño y tus datos siguen guardados. Puedes reintentar sin perder nada.</p>
          <div class="btns">
            <button class="btn btn-primary btn-full" @click="emit('retry')">Reintentar</button>
            <button class="btn btn-ghost btn-full" @click="emit('close')">Volver</button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ov { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(8,8,8,.82); backdrop-filter: blur(6px); }
.box { width: min(420px, 100%); background: var(--bg2); border: 1px solid var(--bd2); border-radius: 20px; padding: 28px 24px 24px; text-align: center; outline: none; box-shadow: 0 24px 60px rgba(0,0,0,.5); }
.ring { width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.ring.bad { background: rgba(255,90,90,.12); color: var(--err); }
.spin { width: 44px; height: 44px; border-radius: 50%; border: 4px solid var(--bd2); border-top-color: var(--pr); animation: spin .8s linear infinite; }
h2 { font-size: 20px; margin-bottom: 6px; }
.d { font-size: 14px; color: var(--txt2); line-height: 1.5; margin-bottom: 8px; }
.bar { height: 8px; background: var(--bg3); border-radius: 999px; overflow: hidden; margin-top: 16px; }
.bar i { display: block; height: 100%; background: var(--pr); border-radius: 999px; transition: width .35s ease; }
.pc { font-size: 13px; color: var(--txt2); margin: 8px 0 14px; font-variant-numeric: tabular-nums; }
.phases { list-style: none; padding: 0; margin: 0; text-align: left; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.phases li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--txt3); width: 100%; border: 0; padding: 0; margin: 0; text-align: left; }
.phases li.now { color: var(--txt); font-weight: 600; }
.phases li.done { color: var(--txt2); }
.ic { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--bd2); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.done .ic { background: var(--ok); border-color: var(--ok); color: #05210f; }
.pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--pr); animation: pulse 1s ease-in-out infinite; }
.slow { margin-top: 14px; padding: 10px 12px; background: var(--bg3); border-radius: var(--radius); font-size: 13px; color: var(--txt2); }
.btns { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
@keyframes pulse { 50% { transform: scale(1.5); opacity: .5; } }
@media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } .pulse { animation: none; } .bar i { transition: none; } }
</style>
