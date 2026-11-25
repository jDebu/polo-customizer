<template>
  <div class="container dash-pad">

    <!-- Header -->
    <div class="row mb-24">
      <div>
        <h2>Panel de administración</h2>
        <p class="mu">PoloPrint — ventas y pedidos</p>
      </div>
      <div class="spacer" />
      <router-link to="/admin/orders" class="btn btn-primary">
        Ver pedidos
      </router-link>
      <button class="btn btn-ghost" @click="store.adminLogout(); $router.push('/admin/login')">
        Cerrar sesión
      </button>
    </div>

    <!-- KPI cards -->
    <div class="kpi-grid mb-32">
      <div class="card kpi-card">
        <p class="kpi-label">Ventas hoy</p>
        <p class="kpi-value">S/ {{ kpi.today }}</p>
        <p class="mu">{{ kpi.todayCount }} pedido(s)</p>
      </div>
      <div class="card kpi-card">
        <p class="kpi-label">Esta semana</p>
        <p class="kpi-value">S/ {{ kpi.week }}</p>
        <p class="mu">{{ kpi.weekCount }} pedido(s)</p>
      </div>
      <div class="card kpi-card">
        <p class="kpi-label">Este mes</p>
        <p class="kpi-value">S/ {{ kpi.month }}</p>
        <p class="mu">{{ kpi.monthCount }} pedido(s)</p>
      </div>
      <div class="card kpi-card pending-card">
        <p class="kpi-label">Por validar</p>
        <p class="kpi-value warn">{{ kpi.pendingCount }}</p>
        <router-link to="/admin/orders?filter=pending_validation" class="mu">Ver pendientes →</router-link>
      </div>
    </div>

    <!-- Charts row -->
    <div class="charts-row mb-32">

      <!-- Bar chart: orders per day (last 14 d) -->
      <div class="card chart-card">
        <h3 class="chart-title">Pedidos últimos 14 días</h3>
        <div class="bar-chart">
          <div
            v-for="(d, i) in barData"
            :key="i"
            class="bar-col"
            :title="`${d.label}: ${d.count} pedido(s) · S/${d.total}`"
          >
            <div class="bar" :style="{ height: `${barHeight(d.count)}%` }" />
            <span class="bar-label">{{ d.label }}</span>
          </div>
        </div>
      </div>

      <!-- Donut: Yape vs Plin -->
      <div class="card chart-card chart-sm">
        <h3 class="chart-title">Método de pago</h3>
        <div class="donut-wrap">
          <svg viewBox="0 0 100 100" class="donut-svg">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#333" stroke-width="12" />
            <circle
              cx="50" cy="50" r="38" fill="none"
              stroke="#e84040" stroke-width="12"
              stroke-dasharray="{{ yapePct * 2.388 }} 238.8"
              stroke-dashoffset="59.7"
            />
            <circle
              cx="50" cy="50" r="38" fill="none"
              stroke="#7c3aed" stroke-width="12"
              :stroke-dasharray="`${plinPct * 2.388} 238.8`"
              :stroke-dashoffset="`${-(yapePct * 2.388 - 59.7)}`"
            />
          </svg>
          <div class="donut-center">
            <p class="bold" style="font-size:1.1rem">{{ kpi.todayCount + kpi.weekCount }}</p>
            <p class="mu" style="font-size:11px">total</p>
          </div>
        </div>
        <div class="donut-legend">
          <div class="legend-item">
            <span class="dot" style="background:#e84040" />
            <span>Yape</span>
            <span class="spacer" />
            <span class="bold">{{ yapePct }}%</span>
          </div>
          <div class="legend-item">
            <span class="dot" style="background:#7c3aed" />
            <span>Plin</span>
            <span class="spacer" />
            <span class="bold">{{ plinPct }}%</span>
          </div>
        </div>
      </div>

      <!-- Top colors -->
      <div class="card chart-card chart-sm">
        <h3 class="chart-title">Colores más pedidos</h3>
        <div class="color-rank">
          <div v-for="(c, i) in topColors" :key="c.color" class="color-rank-item">
            <span class="rank-num">{{ i + 1 }}</span>
            <span class="color-dot" :style="{ background: c.color }" />
            <span>{{ c.name }}</span>
            <span class="spacer" />
            <span class="mu">{{ c.count }} uds</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent orders preview -->
    <div class="card">
      <div class="row mb-16">
        <h3>Pedidos recientes</h3>
        <span class="spacer" />
        <router-link to="/admin/orders" class="mu">Ver todos →</router-link>
      </div>
      <div v-if="recentOrders.length === 0" class="empty-state">
        <p class="mu">No hay pedidos aún. Los pedidos aparecerán aquí cuando los clientes compren.</p>
      </div>
      <div v-else class="orders-preview">
        <div v-for="o in recentOrders" :key="o.orderId" class="order-row">
          <div class="order-id-sm">{{ o.orderId }}</div>
          <div>{{ o.delivery?.recipientName ?? '—' }}</div>
          <div class="mu">{{ o.design?.sleeveType === 'short' ? 'Corta' : 'Larga' }} · {{ o.lines?.length ? o.lines.map((l: any) => `${l.quantity}×${l.size}`).join(' ') : 'T' + o.item?.size }}</div>
          <div>S/ {{ (o.item?.pricePerUnit ?? 0) * (o.item?.quantity ?? 1) + (o.delivery?.rate ?? 0) }}</div>
          <div>
            <span :class="statusBadgeClass(o.status)">{{ statusLabel(o.status) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Demo notice -->
    <div class="card mt-24" style="border-color: rgba(245,166,35,.3); background: rgba(245,166,35,.05)">
      <p class="mu">⚠️ <strong>Modo demostración</strong> — Los datos de ventas son simulados. Conecta Google Sheets configurando <code>VITE_SHEETS_URL</code> en <code>.env.local</code> para ver pedidos reales.</p>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../../store/index'
import type { Order } from '../../store/types'
import { getOrders } from '../../lib/sheets'
import { POLO_COLORS } from '../../data/catalog'

const store = useStore()
const recentOrders = ref<Order[]>([])

onMounted(async () => {
  const orders = await getOrders({ from: thirtyDaysAgo() })
  recentOrders.value = orders.slice(0, 5)
})

function thirtyDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString()
}

// Demo KPI data
const kpi = ref({
  today: 135, todayCount: 3,
  week: 585, weekCount: 13,
  month: 2250, monthCount: 50,
  pendingCount: 2,
})

// Bar chart: last 14 days (simulated)
const barData = computed(() => {
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    days.push({
      label: d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
      count: Math.floor(Math.random() * 5),
      total: Math.floor(Math.random() * 300),
    })
  }
  return days
})

const maxCount = computed(() => Math.max(...barData.value.map(d => d.count), 1))
function barHeight(count: number) {
  return Math.max(4, (count / maxCount.value) * 100)
}

// Payment split (simulated)
const yapePct = ref(62)
const plinPct = computed(() => 100 - yapePct.value)

// Top colors (simulated)
const topColors = computed(() => [
  { color: '#111111', name: 'Negro', count: 22 },
  { color: '#ffffff', name: 'Blanco', count: 18 },
  { color: '#1a2a4a', name: 'Azul marino', count: 7 },
  { color: '#cc2222', name: 'Rojo', count: 3 },
])

function statusBadgeClass(status: string) {
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
.dash-pad { padding: 32px 24px; }
.mb-24 { margin-bottom: 24px; }
.mb-32 { margin-bottom: 32px; }

/* KPI */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kpi-card { text-align: center; }
.kpi-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--txt2); margin-bottom: 8px; }
.kpi-value { font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; }
.kpi-value.warn { color: var(--warn); }
.pending-card { border-color: rgba(245,166,35,.4); background: rgba(245,166,35,.05); }

/* Charts */
.charts-row { display: grid; grid-template-columns: 1fr 240px 240px; gap: 16px; }
.chart-card {}
.chart-title { font-size: 13px; font-weight: 600; margin-bottom: 16px; color: var(--txt2); }

/* Bar chart */
.bar-chart { display: flex; gap: 4px; align-items: flex-end; height: 120px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.bar { width: 100%; background: var(--pr); border-radius: 3px 3px 0 0; min-height: 4px; transition: height 0.3s; }
.bar-label { font-size: 9px; color: var(--txt3); writing-mode: vertical-rl; transform: rotate(180deg); }

/* Donut */
.donut-wrap { position: relative; width: 120px; margin: 0 auto 16px; }
.donut-svg { width: 100%; transform: rotate(-90deg); }
.donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.donut-legend { display: flex; flex-direction: column; gap: 8px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* Color rank */
.color-rank { display: flex; flex-direction: column; gap: 10px; }
.color-rank-item { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.rank-num { font-size: 11px; color: var(--txt3); width: 14px; }
.color-dot { width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(255,255,255,.15); flex-shrink: 0; }

/* Orders table preview */
.orders-preview { display: flex; flex-direction: column; gap: 0; }
.order-row {
  display: grid; grid-template-columns: 160px 1fr 100px 80px 140px;
  gap: 12px; align-items: center; padding: 10px 0;
  border-bottom: 1px solid var(--bd); font-size: 13px;
}
.order-row:last-child { border-bottom: none; }
.order-id-sm { font-family: monospace; font-size: 12px; color: var(--txt2); }
.empty-state { text-align: center; padding: 32px 0; }

@media (max-width: 1100px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-row { grid-template-columns: 1fr; }
}
</style>
