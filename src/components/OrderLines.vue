<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../store/index'
import MiniPolo from './MiniPolo.vue'
import Icon from './Icon.vue'
import { POLO_COLORS } from '../data/catalog'
import { SIZE_IDS, SIZE_TABLE, MOLD_BY_ID, sizeFactor, type SizeId } from '../data/molds'

const store = useStore()
const full = ref(false)
const guideOpen = ref(false)

const hasBack = computed(() => store.design.placedImages.some(i => i.panel === 'back'))
const hasFront = computed(() => store.design.placedImages.some(i => i.panel === 'front'))
const view = computed<'front' | 'back'>(() => (hasFront.value || !hasBack.value ? 'front' : 'back'))

const colorName = (hex: string) => POLO_COLORS.find(c => c.value.toLowerCase() === hex.toLowerCase())?.label ?? hex
const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',')

/** Medida real del estampado principal en la talla de esa línea. */
function printNote(size: SizeId) {
  const k = sizeFactor(size)
  const out = store.design.placedImages
    .filter(i => i.panel === 'front' || i.panel === 'back')
    .slice(0, 2)
    .map(i => `${MOLD_BY_ID[i.panel].short} ${n1(i.state.width * k)} × ${n1(i.state.height * k)} cm`)
  return out.join(' · ')
}
/** Índice (1-based) de una variante anterior idéntica en talla y color; 0 si no hay. */
const dupOf = (i: number) => {
  const l = store.lines[i]
  return store.lines.findIndex((o, j) => j < i && o.size === l.size && o.color.toLowerCase() === l.color.toLowerCase()) + 1
}
const price = (q: number) => q * store.orderItem.pricePerUnit
const onQty = (id: string, q: number) => store.updateLine(id, { quantity: q })

function add() {
  full.value = !store.addLine()
}
</script>

<template>
  <section class="lines card" aria-labelledby="lines-h">
    <div class="head">
      <div>
        <h3 id="lines-h" class="section-label">Tu pedido</h3>
        <p class="sub">Mismo diseño en varias tallas y colores. Cada línea es una combinación.</p>
      </div>
    </div>

    <ul class="list">
      <li v-for="(l, idx) in store.lines" :key="l.id" class="line">
        <div class="l-head">
          <div class="tile" aria-hidden="true"><MiniPolo :size="l.size" :color="l.color" :view="view" /></div>
          <div class="l-meta">
            <div class="l-top">
              <p class="l-title">Variante {{ idx + 1 }}</p>
              <button v-if="store.lines.length > 1" class="del" :aria-label="`Quitar variante ${idx + 1}`" @click="store.removeLine(l.id)"><Icon name="trash" :size="18" /></button>
            </div>
            <p class="l-sum">{{ l.size }} · {{ colorName(l.color) }}</p>
            <div class="l-bot">
              <div class="qty" role="group" :aria-label="`Cantidad de la variante ${idx + 1}`">
                <button :disabled="l.quantity <= 1" aria-label="Una menos" @click="onQty(l.id, l.quantity - 1)"><Icon name="minus" :size="18" /></button>
                <output aria-live="polite">{{ l.quantity }}</output>
                <button :disabled="l.quantity >= store.MAX_PER_LINE" aria-label="Una más" @click="onQty(l.id, l.quantity + 1)"><Icon name="plus" :size="18" /></button>
              </div>
              <p class="amt">S/ {{ price(l.quantity) }}</p>
            </div>
          </div>
        </div>

        <div class="l-pick">
          <fieldset class="grp">
            <legend>Talla</legend>
            <div class="sizes">
              <button v-for="s in SIZE_IDS" :key="s" class="size" :class="{ on: l.size === s }" :aria-pressed="l.size === s"
                      @click="store.updateLine(l.id, { size: s })">{{ s }}</button>
            </div>
          </fieldset>
          <fieldset class="grp">
            <legend>Color</legend>
            <div class="sw">
              <button v-for="c in POLO_COLORS" :key="c.value" class="swatch" :class="{ on: l.color.toLowerCase() === c.value.toLowerCase() }"
                      :style="{ background: c.value }" :aria-label="c.label" :aria-pressed="l.color.toLowerCase() === c.value.toLowerCase()"
                      @click="store.updateLine(l.id, { color: c.value })">
                <Icon v-if="l.color.toLowerCase() === c.value.toLowerCase()" name="check" :size="15" class="ck" />
              </button>
            </div>
          </fieldset>
          <p v-if="dupOf(idx)" class="dup" role="status"><Icon name="info" :size="15" /> Igual que la variante {{ dupOf(idx) }}: se sumarán las cantidades al continuar.</p>
          <p class="note">Pecho {{ SIZE_TABLE[l.size].chest }} cm · largo {{ SIZE_TABLE[l.size].length }} cm<template v-if="printNote(l.size)"> · {{ printNote(l.size) }}</template></p>
        </div>
      </li>
    </ul>

    <button class="add" :disabled="store.lines.length >= store.MAX_LINES" @click="add">
      <Icon name="plus" :size="18" /> Agregar otra talla o color
    </button>
    <p v-if="full" class="warn" role="alert">Máximo {{ store.MAX_LINES }} variantes por pedido.</p>

    <div class="foot">
      <p><b>{{ store.totalPieces }}</b> polo{{ store.totalPieces === 1 ? '' : 's' }} · S/ {{ store.orderItem.pricePerUnit }} c/u</p>
      <button class="guide" :aria-expanded="guideOpen" @click="guideOpen = !guideOpen">{{ guideOpen ? 'Ocultar guía de tallas' : 'Guía de tallas' }}</button>
    </div>
    <table v-show="guideOpen" class="tbl">
      <thead><tr><th>Talla</th><th>Pecho (½)</th><th>Largo</th><th>Hombro</th></tr></thead>
      <tbody><tr v-for="s in SIZE_IDS" :key="s"><td>{{ s }}</td><td>{{ SIZE_TABLE[s].chest }} cm</td><td>{{ SIZE_TABLE[s].length }} cm</td><td>{{ SIZE_TABLE[s].shoulder }} cm</td></tr></tbody>
    </table>
  </section>
</template>

<style scoped>
.head .section-label { margin-bottom: 4px; }
.sub { font-size: 13px; color: var(--txt2); margin: 0 0 14px; }
.dup { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; color: var(--warn); line-height: 1.4; }
.dup :deep(svg) { flex-shrink: 0; margin-top: 1px; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.line { display: flex; flex-direction: column; gap: 12px; padding: 14px; background: var(--bg3); border: 1px solid var(--bd); border-radius: var(--radius-lg); }
.l-head { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 14px; align-items: center; }
.tile { aspect-ratio: 92 / 96; border-radius: 10px; background: linear-gradient(160deg, #e6e8ed, #cdd1d9); padding: 4px; }
.tile :deep(svg) { width: 100%; height: 100%; display: block; }
.l-meta { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.l-pick { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; border-top: 1px solid var(--bd); }
.l-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.l-sum { font-size: 13px; color: var(--txt2); margin-top: -4px; }
.l-title { font-weight: 700; font-size: 14px; }
.del { width: 40px; height: 40px; border: none; border-radius: 10px; background: transparent; color: #ff8a8a; display: inline-flex; align-items: center; justify-content: center; margin: -6px -6px -6px 0; }
.del:hover { background: rgba(255,138,138,.1); }
.grp { border: 0; padding: 0; margin: 0; min-width: 0; }
.grp legend { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--txt3); padding: 0; margin-bottom: 6px; }
.sizes { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
.size { min-height: 44px; border: 1px solid var(--bd2); background: transparent; color: var(--txt); border-radius: 10px; font-size: 14px; font-weight: 600; transition: background .15s, border-color .15s; }
.size:hover { border-color: #666; }
.size.on { background: var(--pr); border-color: var(--pr); color: #fff; }
.sw { display: flex; flex-wrap: wrap; gap: 8px; }
.swatch { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--bd2); display: inline-flex; align-items: center; justify-content: center; transition: transform .15s, border-color .15s; }
.swatch.on { border-color: var(--pr); transform: scale(1.1); }
.ck { color: #fff; mix-blend-mode: difference; }
.l-bot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.qty { display: inline-flex; align-items: center; border: 1px solid var(--bd2); border-radius: 12px; overflow: hidden; }
.qty button { width: 48px; height: 44px; border: none; background: var(--bg2); color: var(--txt); display: inline-flex; align-items: center; justify-content: center; }
.qty button:disabled { opacity: .3; }
.qty output { min-width: 44px; text-align: center; font-weight: 700; font-size: 16px; font-variant-numeric: tabular-nums; }
.amt { font-weight: 700; font-size: 16px; font-variant-numeric: tabular-nums; }
.note { font-size: 12px; color: var(--txt3); line-height: 1.45; }
.add { margin-top: 12px; width: 100%; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px dashed var(--bd2); background: transparent; color: var(--txt); border-radius: var(--radius-lg); font-size: 14px; font-weight: 600; }
.add:hover:not(:disabled) { border-color: var(--ac-dark); color: var(--ac); }
.add:disabled { opacity: .45; }
.warn { color: var(--warn); font-size: 13px; margin-top: 8px; }
.foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 14px; color: var(--txt2); }
.foot b { color: var(--txt); }
.guide { border: none; background: transparent; color: var(--ac); font-size: 13px; text-decoration: underline; min-height: 40px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
.tbl th, .tbl td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--bd); }
.tbl th { color: var(--txt2); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
button:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
@media (max-width: 420px) { .l-head { grid-template-columns: 72px minmax(0, 1fr); gap: 12px; } .line { padding: 12px; } .qty button { width: 44px; } }
@media (prefers-reduced-motion: reduce) { .size, .swatch { transition: none; } }
</style>
