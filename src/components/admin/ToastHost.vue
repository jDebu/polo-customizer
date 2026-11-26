<script setup lang="ts">
import { useAdmin } from '../../store/admin'
import Icon from '../Icon.vue'
const admin = useAdmin()
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="t in admin.toasts" :key="t.id" class="toast" :class="t.tone">
      <Icon :name="t.tone === 'ok' ? 'check' : 'alert'" :size="18" />
      <span class="tx">{{ t.text }}</span>
      <button v-if="t.undo" class="undo" @click="t.undo(); admin.dismiss(t.id)"><Icon name="undo" :size="15" /> Deshacer</button>
      <button class="x" aria-label="Cerrar aviso" @click="admin.dismiss(t.id)"><Icon name="x" :size="16" /></button>
    </div>
  </div>
</template>

<style scoped>
.toasts { position: fixed; z-index: 400; left: 12px; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
.toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: 460px; width: 100%; padding: 10px 10px 10px 14px; background: #202020; border: 1px solid rgba(61,220,132,.45); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.5); font-size: 14px; animation: rise .22s ease; }
.toast.err { border-color: rgba(255,122,122,.5); }
.toast.ok :deep(svg:first-child) { color: var(--ok); }
.toast.err :deep(svg:first-child) { color: var(--err); }
.tx { flex: 1; line-height: 1.35; }
.undo { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; padding: 0 10px; border: 1px solid var(--bd2); border-radius: 8px; background: transparent; color: var(--txt); font-size: 13px; font-weight: 600; }
.x { width: 36px; height: 36px; border: none; background: transparent; color: var(--txt2); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
.undo:focus-visible, .x:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
@keyframes rise { from { transform: translateY(8px); opacity: 0; } }
@media (min-width: 961px) { .toasts { bottom: 24px; left: 260px; } }
@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
</style>
