<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../Icon.vue'
import { NEXT, type AdminOrder } from '../../lib/orderModel'

const props = defineProps<{ order: AdminOrder; busy?: boolean; compact?: boolean }>()
const emit = defineEmits<{ (e: 'advance'): void; (e: 'reject'): void; (e: 'reopen'): void }>()
const next = computed(() => NEXT[props.order.status])
const icon = computed(() => ({ pending_validation: 'check', confirmed: 'box', in_production: 'truck', shipped: 'check' } as Record<string, string>)[props.order.status] ?? 'check')
</script>

<template>
  <div class="sa" :class="{ compact }">
    <template v-if="next">
      <button class="btn btn-primary" :class="compact ? 'btn-sm' : ''" :disabled="busy" @click="emit('advance')">
        <Icon :name="icon" :size="18" /> {{ next.label }}
      </button>
      <button v-if="order.status === 'pending_validation'" class="btn btn-ghost rej" :class="compact ? 'btn-sm' : ''" :disabled="busy" @click="emit('reject')">
        <Icon name="ban" :size="16" /> Rechazar
      </button>
    </template>
    <button v-else-if="order.status === 'rejected'" class="btn btn-ghost" :class="compact ? 'btn-sm' : ''" :disabled="busy" @click="emit('reopen')">
      <Icon name="undo" :size="16" /> Volver a validar
    </button>
    <p v-else class="done"><Icon name="check" :size="16" /> Pedido completado</p>
  </div>
</template>

<style scoped>
.sa { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sa .btn { min-height: 44px; gap: 8px; }
.compact .btn { min-height: 40px; }
.rej { color: #ff8a8a; }
.done { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--txt2); }
.btn:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
</style>
