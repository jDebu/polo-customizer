<script setup lang="ts">
/**
 * Vista previa 2D de una variante del pedido: mismo polo, mismas medidas en cm que el molde,
 * pero con el color y la talla de esa línea. Las tallas grandes se dibujan más grandes.
 */
import { computed } from 'vue'
import { useStore } from '../store/index'
import { MOLD_BY_ID, SIZE_TABLE, bodyOutline, neckPath, sizeFactor, type SizeId } from '../data/molds'

const props = withDefaults(defineProps<{ size: SizeId; color: string; view?: 'front' | 'back'; label?: string }>(), { view: 'front' })
const store = useStore()

const f = computed(() => sizeFactor(props.size))
const mold = computed(() => MOLD_BY_ID[props.view === 'front' ? 'front' : 'back'])
const outline = computed(() => bodyOutline(props.size, props.view))
const neck = computed(() => neckPath(props.size, props.view))
const images = computed(() => store.design.placedImages.filter(i => i.panel === mold.value.id))
const origin = computed(() => `translate(${(-mold.value.limit.w * f.value) / 2} ${mold.value.limit.top * f.value}) scale(${f.value})`)

const dark = computed(() => {
  const h = props.color
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 90
})
const tbl = computed(() => SIZE_TABLE[props.size])
function tf(i: (typeof images.value)[number]) {
  const s = i.state
  return `translate(${s.x + s.width / 2} ${s.y + s.height / 2}) rotate(${s.rotation}) scale(${s.flipH ? -1 : 1} 1)`
}
</script>

<template>
  <svg viewBox="-46 -7 92 96" role="img" :aria-label="label ?? `Polo talla ${size}, ${view === 'front' ? 'frente' : 'espalda'}`">
    <path :d="outline" :fill="color" :stroke="dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.28)'" stroke-width="0.7" stroke-linejoin="round" />
    <path :d="neck" fill="none" :stroke="dark ? '#fff' : '#000'" :stroke-width="3 * f" opacity="0.10" />
    <g :transform="origin">
      <g v-for="i in images" :key="i.id" :transform="tf(i)">
        <image :href="i.src" :x="-i.state.width / 2" :y="-i.state.height / 2" :width="i.state.width" :height="i.state.height" preserveAspectRatio="none" />
      </g>
    </g>
    <title>{{ label ?? `Talla ${size} · pecho ${tbl.chest} cm` }}</title>
  </svg>
</template>
