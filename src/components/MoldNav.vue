<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../store/index'
import type { PanelId } from '../data/molds'

const store = useStore()
type Group = 'front' | 'back' | 'left' | 'right'

const groups: { id: Group; label: string }[] = [
  { id: 'front', label: 'Frontal' },
  { id: 'back', label: 'Espalda' },
  { id: 'left', label: 'Manga izq.' },
  { id: 'right', label: 'Manga der.' },
]
const slots = [
  { id: 'front', label: 'Frente' },
  { id: 'back', label: 'Atrás' },
  { id: 'side', label: 'Lateral' },
] as const

const active = computed(() => store.design.activePanel)
const group = computed<Group>(() => (active.value === 'front' || active.value === 'back' ? active.value : (active.value.split('-')[0] as Group)))
const isSleeve = computed(() => group.value === 'left' || group.value === 'right')
const lastSlot = ref<Record<string, string>>({ left: 'front', right: 'front' })

const countOf = (g: Group) => store.design.placedImages.filter(i => i.panel === g || i.panel.startsWith(g + '-')).length
const countSlot = (id: string) => store.design.placedImages.filter(i => i.panel === id).length

function pick(g: Group) {
  store.setActivePanel((g === 'front' || g === 'back' ? g : `${g}-${lastSlot.value[g]}`) as PanelId)
}
function pickSlot(s: string) {
  lastSlot.value[group.value] = s
  store.setActivePanel(`${group.value}-${s}` as PanelId)
}
</script>

<template>
  <nav class="mold-nav" aria-label="Zona de estampado">
    <div class="row-1" role="tablist" aria-label="Parte del polo">
      <button v-for="g in groups" :key="g.id" role="tab" class="pill" :class="{ on: group === g.id }"
              :aria-selected="group === g.id" @click="pick(g.id)">
        {{ g.label }}<i v-if="countOf(g.id)" class="dot" aria-hidden="true">{{ countOf(g.id) }}</i>
        <span v-if="countOf(g.id)" class="sr">, {{ countOf(g.id) }} imagen(es)</span>
      </button>
    </div>
    <div v-if="isSleeve" class="row-2" role="tablist" aria-label="Posición en la manga">
      <span class="lbl">Posición</span>
      <button v-for="s in slots" :key="s.id" role="tab" class="pill sm" :class="{ on: active === `${group}-${s.id}` }"
              :aria-selected="active === `${group}-${s.id}`" @click="pickSlot(s.id)">
        {{ s.label }}<i v-if="countSlot(`${group}-${s.id}`)" class="dot" aria-hidden="true">{{ countSlot(`${group}-${s.id}`) }}</i>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.mold-nav { display: flex; flex-direction: column; gap: 6px; }
.row-1, .row-2 { display: flex; gap: 6px; align-items: center; overflow-x: auto; scrollbar-width: none; }
.row-1::-webkit-scrollbar, .row-2::-webkit-scrollbar { display: none; }
.lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--txt3); margin-right: 2px; flex-shrink: 0; }
.pill {
  flex: 1 0 auto; min-height: 40px; padding: 0 14px; border: 1px solid var(--bd); background: var(--bg2); color: var(--txt2);
  border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: background .18s, color .18s, border-color .18s;
}
.pill.sm { flex: 0 0 auto; min-height: 34px; padding: 0 14px; font-size: 12.5px; }
.pill:hover { color: var(--txt); border-color: var(--bd2); }
.pill.on { background: var(--txt); border-color: var(--txt); color: #0d0d0d; }
.pill:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.dot { font-style: normal; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; font-size: 11px; line-height: 18px; text-align: center; background: var(--pr); color: #fff; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (min-width: 961px) { .pill { flex: 0 0 auto; } }
@media (prefers-reduced-motion: reduce) { .pill { transition: none; } }
</style>
