<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '../Icon.vue'
import { previewUrl } from '../../lib/orderModel'

const props = defineProps<{ url: string }>()
const emit = defineEmits<{ (e: 'open'): void }>()
const failed = ref(false)
watch(() => props.url, () => (failed.value = false))
const src = computed(() => previewUrl(props.url, 640))
</script>

<template>
  <button v-if="url && !failed" class="vt" type="button" aria-label="Ver comprobante de pago ampliado" @click="emit('open')">
    <img :src="src" alt="Comprobante de pago" loading="lazy" referrerpolicy="no-referrer" @error="failed = true" />
    <span class="zoom"><Icon name="eye" :size="16" /> Ampliar</span>
  </button>
  <a v-else-if="url" class="vt miss" :href="url" target="_blank" rel="noopener">
    <Icon name="external" :size="20" /><span>No se pudo mostrar la imagen. Abrir original</span>
  </a>
  <div v-else class="vt none"><Icon name="alert" :size="22" /><span>Sin comprobante</span></div>
</template>

<style scoped>
.vt { position: relative; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 6px; width: 100%; height: 100%; min-height: 96px; padding: 0; border: 1px solid var(--bd2); border-radius: 10px; background: #151515; overflow: hidden; color: var(--txt2); font-size: 12px; text-align: center; line-height: 1.3; cursor: zoom-in; }
.vt img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
.vt:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.zoom { position: absolute; left: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; background: rgba(0,0,0,.72); color: #fff; font-size: 11px; font-weight: 600; }
.miss { cursor: pointer; padding: 8px; color: var(--ac); }
.none { cursor: default; border-style: dashed; color: var(--warn); }
</style>
