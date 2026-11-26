<script setup lang="ts">
import { STATUS_META, type Status } from '../../lib/orderModel'
defineProps<{ status: Status }>()
</script>
<template>
  <span class="sb" :class="STATUS_META[status].tone"><i aria-hidden="true" />{{ STATUS_META[status].label }}</span>
</template>
<style scoped>
.sb { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; border: 1px solid transparent; }
.sb i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.warn { color: #ffb340; background: rgba(255,179,64,.1); border-color: rgba(255,179,64,.3); }
.ok { color: #3ddc84; background: rgba(61,220,132,.1); border-color: rgba(61,220,132,.3); }
.info { color: #6cb4ff; background: rgba(108,180,255,.1); border-color: rgba(108,180,255,.3); }
.err { color: #ff7a7a; background: rgba(255,122,122,.1); border-color: rgba(255,122,122,.3); }
.neu { color: var(--txt2); background: var(--bg3); border-color: var(--bd2); }
</style>
