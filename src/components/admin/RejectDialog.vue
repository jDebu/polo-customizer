<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{ open: boolean; id: string }>()
const emit = defineEmits<{ (e: 'confirm', reason: string): void; (e: 'cancel'): void }>()
const REASONS = ['Monto incorrecto', 'Comprobante ilegible', 'No veo el pago en la cuenta', 'Comprobante repetido']
const reason = ref('')
const box = ref<HTMLElement | null>(null)
watch(() => props.open, async v => { if (v) { reason.value = ''; await nextTick(); box.value?.focus() } })
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('cancel') }
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="bd" @click.self="emit('cancel')" @keydown="onKey">
      <div ref="box" class="dlg" tabindex="-1" role="alertdialog" aria-modal="true" aria-labelledby="rj-t">
        <h2 id="rj-t">Rechazar pago</h2>
        <p class="d">Pedido <b>{{ id.slice(-9) }}</b>. Anota el motivo para saber qué responderle al cliente.</p>
        <div class="chips" role="group" aria-label="Motivos frecuentes">
          <button v-for="r in REASONS" :key="r" class="chip" :class="{ on: reason === r }" :aria-pressed="reason === r" @click="reason = r">{{ r }}</button>
        </div>
        <label for="rj-n">Detalle (opcional)</label>
        <textarea id="rj-n" v-model="reason" rows="2" maxlength="200" placeholder="Ej.: el voucher dice S/ 40 y el pedido es S/ 68" />
        <div class="btns">
          <button class="btn btn-ghost" @click="emit('cancel')">Cancelar</button>
          <button class="btn btn-primary" @click="emit('confirm', reason.trim())">Rechazar pedido</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.bd { position: fixed; inset: 0; z-index: 600; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,.7); }
.dlg { width: 100%; max-width: 460px; background: var(--bg2); border: 1px solid var(--bd2); border-radius: 18px 18px 0 0; padding: 20px 18px calc(18px + env(safe-area-inset-bottom, 0px)); outline: none; }
h2 { font-size: 18px; margin-bottom: 4px; }
.d { font-size: 13px; color: var(--txt2); margin-bottom: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.chip { min-height: 40px; padding: 0 12px; border: 1px solid var(--bd2); background: transparent; color: var(--txt2); border-radius: 999px; font-size: 13px; }
.chip.on { border-color: var(--pr); color: var(--txt); background: rgba(232,64,64,.12); }
.chip:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
textarea { resize: vertical; min-height: 64px; }
.btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
.btns .btn { min-height: 48px; }
@media (min-width: 600px) { .bd { align-items: center; } .dlg { border-radius: 18px; } }
</style>
