<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../store/index'
import MiniPolo from './MiniPolo.vue'
import { POLO_COLORS, DELIVERY_RATES } from '../data/catalog'

const props = withDefaults(defineProps<{ delivery?: boolean }>(), { delivery: true })
const store = useStore()

const hasBack = computed(() => store.design.placedImages.some(i => i.panel === 'back'))
const hasFront = computed(() => store.design.placedImages.some(i => i.panel === 'front'))
const both = computed(() => hasBack.value && hasFront.value)
const pick = ref<'front' | 'back' | null>(null)
const view = computed<'front' | 'back'>(() => pick.value ?? (hasFront.value || !hasBack.value ? 'front' : 'back'))

const name = (hex: string) => POLO_COLORS.find(c => c.value.toLowerCase() === hex.toLowerCase())?.label ?? hex
const tier = computed(() => DELIVERY_RATES.find(r => r.departments.includes(store.delivery.department))?.tier ?? '')
const grand = computed(() => (store.delivery.department ? store.total : store.subtotal))
</script>

<template>
  <section class="sum card" aria-labelledby="sum-h">
    <div class="top">
      <h3 id="sum-h" class="section-label">Vista previa del pedido</h3>
      <div v-if="both" class="seg" role="group" aria-label="Cara del polo">
        <button :class="{ on: view === 'front' }" :aria-pressed="view === 'front'" @click="pick = 'front'">Frente</button>
        <button :class="{ on: view === 'back' }" :aria-pressed="view === 'back'" @click="pick = 'back'">Espalda</button>
      </div>
    </div>

    <ul class="grid">
      <li v-for="l in store.lines" :key="l.id" class="cell">
        <div class="tile"><MiniPolo :size="l.size" :color="l.color" :view="view" :label="`${l.quantity} polo(s) talla ${l.size} ${name(l.color)}`" /><span class="badge">×{{ l.quantity }}</span></div>
        <p class="cap"><b>{{ l.size }}</b> · {{ name(l.color) }}</p>
      </li>
    </ul>

    <div class="lines">
      <div v-for="l in store.lines" :key="`p${l.id}`" class="row">
        <span>{{ l.quantity }} × {{ l.size }} <i class="dot" :style="{ background: l.color }" />{{ name(l.color) }}</span>
        <span>S/ {{ l.quantity * store.orderItem.pricePerUnit }}</span>
      </div>
      <div v-if="props.delivery" class="row" :class="{ mu: !store.delivery.department }">
        <span>{{ store.delivery.department ? `Envío — ${tier}` : 'Envío (elige departamento)' }}</span>
        <span>{{ store.delivery.department ? `S/ ${store.delivery.rate}` : '—' }}</span>
      </div>
      <div class="row total"><span>Total <small>· {{ store.totalPieces }} polo{{ store.totalPieces === 1 ? '' : 's' }}</small></span><span class="red">S/ {{ grand }}</span></div>
    </div>
    <p v-if="props.delivery && store.delivery.department" class="ship">Envío por <b>Olva Courier</b> · 2–5 días hábiles</p>
  </section>
</template>

<style scoped>
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.top .section-label { margin: 6px 0 0; }
.seg { display: inline-flex; border: 1px solid var(--bd2); border-radius: 999px; padding: 2px; flex-shrink: 0; }
.seg button { min-height: 32px; padding: 0 12px; border: none; border-radius: 999px; background: transparent; color: var(--txt2); font-size: 12.5px; font-weight: 600; }
.seg button.on { background: var(--txt); color: #0d0d0d; }
.seg button:focus-visible { outline: 2px solid var(--ac); outline-offset: 1px; }
.grid { list-style: none; margin: 0 0 14px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px; }
.tile { position: relative; aspect-ratio: 92 / 96; border-radius: 10px; background: linear-gradient(160deg, #e6e8ed, #cdd1d9); padding: 4px; }
.tile :deep(svg) { width: 100%; height: 100%; display: block; }
.badge { position: absolute; top: 4px; right: 4px; min-width: 26px; padding: 1px 6px; border-radius: 999px; background: #111; color: #fff; font-size: 12px; font-weight: 700; text-align: center; }
.cap { font-size: 12px; color: var(--txt2); margin-top: 4px; text-align: center; }
.cap b { color: var(--txt); }
.lines .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 0; font-size: 14px; border-bottom: 1px solid var(--bd); }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 6px 0 8px; border: 1px solid var(--bd2); vertical-align: -1px; }
.row.total { font-size: 17px; font-weight: 700; border-bottom: none; padding-top: 12px; }
.row.total small { font-size: 12px; font-weight: 500; color: var(--txt2); }
.ship { margin-top: 10px; padding: 10px 12px; background: var(--bg3); border-radius: var(--radius); font-size: 13px; color: var(--txt2); }
</style>
