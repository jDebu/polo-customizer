<template>
  <div class="container orders-pad">

    <!-- Header -->
    <div class="row mb-24">
      <div>
        <h2>Pedidos</h2>
        <p class="mu">{{ filteredOrders.length }} pedido(s)</p>
      </div>
      <div class="spacer" />
      <select v-model="filterStatus" class="filter-select">
        <option value="">Todos los estados</option>
        <option value="pending_validation">⏳ Por validar</option>
        <option value="confirmed">✅ Confirmados</option>
        <option value="in_production">🖨 En producción</option>
        <option value="shipped">🚚 Enviados</option>
        <option value="delivered">📦 Entregados</option>
        <option value="rejected">❌ Rechazados</option>
      </select>
      <button class="btn btn-ghost" @click="loadOrders">↻ Actualizar</button>
      <router-link to="/admin" class="btn btn-ghost">← Dashboard</router-link>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredOrders.length === 0" class="card empty-state">
      <p class="mu text-center">No hay pedidos{{ filterStatus ? ' con ese estado' : ' aún' }}.</p>
    </div>

    <!-- Orders table -->
    <div v-else class="orders-list">
      <div v-for="o in filteredOrders" :key="o.orderId" class="order-card card mb-16">

        <!-- Order header -->
        <div class="o-header">
          <div class="o-id">{{ o.orderId }}</div>
          <div class="mu" style="font-size:12px">{{ formatDate(o.createdAt) }}</div>
          <div class="spacer" />
          <span :class="badgeClass(o.status)">{{ statusLabel(o.status) }}</span>
          <span class="o-total">S/ {{ calcTotal(o) }}</span>
        </div>

        <!-- Order body -->
        <div class="o-body">
          <div class="o-customer">
            <p class="bold">{{ o.delivery?.recipientName ?? '—' }}</p>
            <p class="mu">DNI: {{ o.delivery?.dni }} · 📱 {{ o.delivery?.phone }}</p>
            <p class="mu mt-4">{{ o.delivery?.address }}</p>
            <p class="mu">{{ o.delivery?.province }}, {{ o.delivery?.department }}</p>
          </div>
          <div class="o-polo">
            <p class="mu">👕 Polo</p>
            <p class="bold">{{ sleeveLabel(o) }} · {{ o.item?.quantity }} polo{{ o.item?.quantity === 1 ? '' : 's' }}</p>
            <template v-if="o.lines?.length">
              <p v-for="l in o.lines" :key="l.id" class="mu">
                <span :style="{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: l.color, border: '1px solid #666', marginRight: '6px' }" />
                {{ l.quantity }} × {{ l.size }}
              </p>
            </template>
            <template v-else>
              <p class="mu">Talla {{ o.item?.size }} · Color: {{ o.design?.poloColor }}</p>
            </template>
            <p class="mu">Pago: {{ o.payment?.method?.toUpperCase() }}</p>
          </div>
          <div class="o-voucher">
            <p class="mu">🧾 Comprobante</p>
            <template v-if="o.payment?.voucherUrl">
              <a :href="o.payment.voucherUrl" target="_blank" rel="noopener" class="btn btn-ghost btn-sm mt-8">
                Ver voucher ↗
              </a>
            </template>
            <p v-else class="mu">No subido</p>
          </div>
        </div>

        <!-- Admin actions -->
        <div class="o-actions">
          <template v-if="o.status === 'pending_validation'">
            <button class="btn btn-accent btn-sm" @click="validatePayment(o, 'confirmed')">
              ✅ Confirmar pago
            </button>
            <button class="btn btn-ghost btn-sm" style="color:var(--err)" @click="validatePayment(o, 'rejected')">
              ❌ Rechazar
            </button>
          </template>

          <template v-if="o.status === 'confirmed'">
            <button class="btn btn-ghost btn-sm" @click="advance(o, 'in_production')">
              🖨 Pasar a producción
            </button>
          </template>

          <template v-if="o.status === 'in_production'">
            <div class="delivery-date-row">
              <input type="date" v-model="estimatedMap[o.orderId]" />
              <button class="btn btn-ghost btn-sm" @click="advance(o, 'shipped')">
                🚚 Marcar como enviado
              </button>
            </div>
          </template>

          <template v-if="o.status === 'shipped'">
            <button class="btn btn-ghost btn-sm" @click="advance(o, 'delivered')">
              📦 Marcar entregado
            </button>
          </template>

          <div class="spacer" />

          <div class="admin-notes-row">
            <input
              v-model="notesMap[o.orderId]"
              placeholder="Notas internas..."
              class="notes-input"
            />
            <button class="btn btn-ghost btn-sm" @click="saveNotes(o)">Guardar</button>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { Order, OrderStatus } from '../../store/types'
import { getOrders, updateOrderStatus } from '../../lib/sheets'
import { notifyStatusChange } from '../../lib/telegram'

const route = useRoute()
const orders = ref<Order[]>([])
const loading = ref(false)
const filterStatus = ref((route.query.filter as string) ?? '')
const estimatedMap = ref<Record<string, string>>({})
const notesMap = ref<Record<string, string>>({})

const filteredOrders = computed(() =>
  filterStatus.value
    ? orders.value.filter(o => o.status === filterStatus.value)
    : orders.value
)

onMounted(loadOrders)

async function loadOrders() {
  loading.value = true
  orders.value = await getOrders()
  loading.value = false
}

async function validatePayment(o: Order, newStatus: 'confirmed' | 'rejected') {
  o.status = newStatus
  o.statusUpdatedAt = new Date().toISOString()
  await updateOrderStatus(o.orderId, newStatus, notesMap.value[o.orderId] ?? '')
  await notifyStatusChange(o.orderId, newStatus, o.delivery?.phone ?? '')
}

async function advance(o: Order, newStatus: OrderStatus) {
  o.status = newStatus
  o.statusUpdatedAt = new Date().toISOString()
  const est = estimatedMap.value[o.orderId] ?? ''
  await updateOrderStatus(o.orderId, newStatus, notesMap.value[o.orderId] ?? '', est)
  await notifyStatusChange(o.orderId, newStatus, o.delivery?.phone ?? '')
}

async function saveNotes(o: Order) {
  o.adminNotes = notesMap.value[o.orderId] ?? ''
  await updateOrderStatus(o.orderId, o.status, o.adminNotes)
}

function calcTotal(o: Order) {
  return (o.item?.pricePerUnit ?? 0) * (o.item?.quantity ?? 1) + (o.delivery?.rate ?? 0)
}

function sleeveLabel(o: Order) {
  return o.design?.sleeveType === 'short' ? 'Manga corta' : 'Manga larga'
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function badgeClass(status: string) {
  const map: Record<string, string> = {
    pending_validation: 'badge badge-warn',
    confirmed: 'badge badge-ok',
    in_production: 'badge badge-ok',
    shipped: 'badge badge-neu',
    delivered: 'badge badge-ok',
    rejected: 'badge badge-err',
  }
  return map[status] ?? 'badge badge-neu'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending_validation: '⏳ Validando',
    confirmed: '✅ Confirmado',
    in_production: '🖨 Producción',
    shipped: '🚚 Enviado',
    delivered: '📦 Entregado',
    rejected: '❌ Rechazado',
  }
  return map[status] ?? status
}
</script>

<style scoped>
.orders-pad { padding: 32px 24px; }
.mb-16 { margin-bottom: 16px; }
.mb-24 { margin-bottom: 24px; }
.filter-select { padding: 8px 12px; background: var(--bg3); border: 1px solid var(--bd); border-radius: var(--radius); color: var(--txt); font-size: 14px; }
.loading-state { display: flex; justify-content: center; padding: 60px; }
.empty-state { padding: 40px; }

/* Order card */
.order-card { padding: 0; overflow: hidden; }
.o-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px; border-bottom: 1px solid var(--bd);
  background: var(--bg3);
}
.o-id { font-family: monospace; font-size: 13px; font-weight: 600; color: var(--pr); }
.o-total { font-size: 16px; font-weight: 700; }

.o-body { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; }
.o-customer, .o-polo, .o-voucher { padding: 16px 20px; }
.o-polo { border-left: 1px solid var(--bd); border-right: 1px solid var(--bd); }
.mt-4 { margin-top: 4px; }
.mt-8 { margin-top: 8px; }

.o-actions {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 12px 20px; border-top: 1px solid var(--bd);
  background: rgba(255,255,255,0.02);
}
.delivery-date-row { display: flex; gap: 8px; align-items: center; }
.delivery-date-row input[type="date"] { padding: 6px 10px; background: var(--bg3); border: 1px solid var(--bd); border-radius: var(--radius); color: var(--txt); font-size: 13px; }
.admin-notes-row { display: flex; gap: 6px; align-items: center; min-width: 280px; }
.notes-input { flex: 1; padding: 6px 10px; background: var(--bg3); border: 1px solid var(--bd); border-radius: var(--radius); color: var(--txt); font-size: 13px; }

@media (max-width: 800px) {
  .o-body { grid-template-columns: 1fr; }
  .o-polo { border-left: none; border-right: none; border-top: 1px solid var(--bd); border-bottom: 1px solid var(--bd); }
}
</style>
