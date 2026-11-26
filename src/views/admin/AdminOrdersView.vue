<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdmin, type Range } from '../../store/admin'
import { backendConfigured } from '../../lib/adminApi'
import { NEXT, STATUSES, STATUS_META, money, timeAgo, type AdminOrder, type Status } from '../../lib/orderModel'
import Icon from '../../components/Icon.vue'
import OrderCard from '../../components/admin/OrderCard.vue'
import OrderDrawer from '../../components/admin/OrderDrawer.vue'
import VoucherLightbox from '../../components/admin/VoucherLightbox.vue'
import RejectDialog from '../../components/admin/RejectDialog.vue'
import StatusActions from '../../components/admin/StatusActions.vue'

const admin = useAdmin()
const route = useRoute()
const router = useRouter()

const openId = ref<string | null>(null)
const voucherId = ref<string | null>(null)
const rejectId = ref<string | null>(null)
const byId = (id: string | null) => admin.orders.find(o => o.id === id) ?? null
const opened = computed(() => byId(openId.value))
const voucherOrder = computed(() => byId(voucherId.value))

/** Enlaces desde el resumen: /admin/orders?status=pending_validation  ó  ?open=PP-… */
function applyQuery() {
  const s = String(route.query.status ?? '')
  if ((STATUSES as readonly string[]).includes(s)) { admin.filters.status = s as Status; admin.filters.range = 'all' }
  if (route.query.open) openId.value = String(route.query.open)
  if (route.query.status || route.query.open) router.replace({ path: '/admin/orders' })
}
onMounted(applyQuery)
watch(() => route.query, applyQuery)

const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Hoy' }, { id: '7d', label: 'Últimos 7 días' }, { id: '30d', label: 'Últimos 30 días' }, { id: 'all', label: 'Todo' },
]
const filtersActive = computed(() => !!(admin.filters.status || admin.filters.q || admin.filters.pay || admin.filters.range !== '30d'))
function clear() { Object.assign(admin.filters, { status: '', q: '', pay: '', range: '30d' }) }
const totalBase = computed(() => admin.base.length)

const DONE: Partial<Record<Status, string>> = {
  confirmed: 'Pago confirmado', in_production: 'Pasado a producción', shipped: 'Marcado como enviado', delivered: 'Entregado',
}
function advance(o: AdminOrder) {
  const n = NEXT[o.status]
  if (!n) return
  const extra = n.to === 'shipped' && o.estimatedDelivery ? { estimatedDelivery: o.estimatedDelivery } : {}
  void admin.setStatus(o, n.to, extra, DONE[n.to])
  voucherId.value = null
}
function reject(o: AdminOrder) { rejectId.value = o.id }
function confirmReject(reason: string) {
  const o = byId(rejectId.value)
  rejectId.value = null
  if (!o) return
  const note = reason ? `Rechazado: ${reason}${o.notes ? ` · ${o.notes}` : ''}` : o.notes
  void admin.setStatus(o, 'rejected', { notes: note }, 'Pedido rechazado')
  voucherId.value = null
}
const reopen = (o: AdminOrder) => admin.setStatus(o, 'pending_validation', {}, 'Pedido reabierto')
</script>

<template>
  <div class="ov">
    <header class="ph">
      <div>
        <h2>Pedidos</h2>
        <p class="sub">{{ totalBase }} pedido{{ totalBase === 1 ? '' : 's' }} en el periodo · {{ admin.loadedAt ? `actualizado ${timeAgo(admin.loadedAt)}` : '' }}</p>
      </div>
      <button class="btn btn-ghost btn-sm refresh" :disabled="admin.loading" @click="admin.load()"><Icon name="reset" :size="16" /> Actualizar</button>
    </header>

    <!-- Filtros -->
    <section class="fb" aria-label="Filtros">
      <div class="search">
        <Icon name="search" :size="18" />
        <input v-model="admin.filters.q" type="search" inputmode="search" placeholder="Buscar por nombre, DNI, teléfono o número" aria-label="Buscar pedidos" />
      </div>
      <div class="chips" role="group" aria-label="Estado del pedido">
        <button class="chip" :class="{ on: !admin.filters.status }" :aria-pressed="!admin.filters.status" @click="admin.filters.status = ''">Todos <b>{{ totalBase }}</b></button>
        <button v-for="s in STATUSES" :key="s" class="chip" :class="[{ on: admin.filters.status === s }, STATUS_META[s].tone]"
                :aria-pressed="admin.filters.status === s" @click="admin.filters.status = admin.filters.status === s ? '' : s">
          {{ STATUS_META[s].plural }} <b>{{ admin.counts[s] }}</b>
        </button>
      </div>
      <div class="sel-row">
        <label class="sel"><span class="sr">Periodo</span>
          <select v-model="admin.filters.range"><option v-for="r in RANGES" :key="r.id" :value="r.id">{{ r.label }}</option></select></label>
        <label class="sel"><span class="sr">Método de pago</span>
          <select v-model="admin.filters.pay"><option value="">Todos los pagos</option><option value="yape">Yape</option><option value="plin">Plin</option></select></label>
        <button v-if="filtersActive" class="clear" @click="clear"><Icon name="x" :size="14" /> Limpiar</button>
      </div>
    </section>

    <!-- Estados -->
    <div v-if="!backendConfigured" class="note card">
      <h3>Conecta tu hoja de cálculo</h3>
      <p>Define <code>VITE_SHEETS_URL</code> en <code>.env.local</code> con la URL de tu Apps Script y reinicia. Guía en <code>docs/ADMIN_SETUP.md</code>.</p>
    </div>
    <div v-else-if="admin.error" class="note card err" role="alert">
      <h3>No se pudieron cargar los pedidos</h3>
      <p>{{ admin.error }}</p>
      <button class="btn btn-primary btn-sm" @click="admin.load()">Reintentar</button>
    </div>
    <div v-else-if="admin.loading && !admin.orders.length" class="grid" aria-busy="true">
      <div v-for="n in 3" :key="n" class="sk" />
    </div>
    <div v-else-if="!admin.orders.length" class="note card">
      <h3>Aún no hay pedidos</h3>
      <p>Cuando un cliente envíe su pedido aparecerá aquí, con su comprobante de pago para validar.</p>
    </div>
    <div v-else-if="!admin.filtered.length" class="note card">
      <h3>Nada coincide con los filtros</h3>
      <p>Prueba con otro periodo o quita la búsqueda.</p>
      <button class="btn btn-ghost btn-sm" @click="clear">Limpiar filtros</button>
    </div>

    <ul v-else class="grid" aria-label="Lista de pedidos">
      <li v-for="o in admin.filtered" :key="o.id">
        <OrderCard :order="o" :busy="!!admin.busy[o.id]" @open="openId = o.id" @voucher="voucherId = o.id"
                   @advance="advance(o)" @reject="reject(o)" @reopen="reopen(o)" />
      </li>
    </ul>

    <OrderDrawer :order="opened" @close="openId = null" @voucher="voucherId = openId"
                 @advance="opened && advance(opened)" @reject="opened && reject(opened)" @reopen="opened && reopen(opened)" />

    <VoucherLightbox :open="!!voucherOrder" :url="voucherOrder?.voucherUrl ?? ''" :amount="voucherOrder ? money(voucherOrder.total) : ''"
                     :method="voucherOrder?.payment ?? ''" :name="voucherOrder?.name ?? ''" @close="voucherId = null">
      <template #actions>
        <StatusActions v-if="voucherOrder" :order="voucherOrder" :busy="!!admin.busy[voucherOrder.id]"
                       @advance="advance(voucherOrder)" @reject="reject(voucherOrder)" @reopen="reopen(voucherOrder)" />
      </template>
    </VoucherLightbox>

    <RejectDialog :open="!!rejectId" :id="rejectId ?? ''" @confirm="confirmReject" @cancel="rejectId = null" />
  </div>
</template>

<style scoped>
.ph { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.ph h2 { font-size: 28px; font-weight: 800; letter-spacing: -.02em; }
.sub { font-size: 13px; color: var(--txt2); }
.refresh { min-height: 40px; }
.fb { position: sticky; top: 56px; z-index: 40; display: flex; flex-direction: column; gap: 10px; padding: 10px 0 12px; margin-bottom: 8px; background: var(--bg); }
.search { position: relative; display: flex; align-items: center; }
.search :deep(svg) { position: absolute; left: 14px; color: var(--txt3); pointer-events: none; }
.search input { width: 100%; min-height: 48px; padding: 0 14px 0 42px; background: var(--bg2); border: 1px solid var(--bd2); border-radius: 12px; font-size: 15px; }
.chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -12px; padding: 0 12px; }
.chips::-webkit-scrollbar { display: none; }
.chip { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border: 1px solid var(--bd2); background: var(--bg2); color: var(--txt2); border-radius: 999px; font-size: 13.5px; font-weight: 600; white-space: nowrap; transition: background .15s, color .15s; }
.chip b { font-size: 12px; min-width: 20px; padding: 1px 6px; border-radius: 10px; background: var(--bg3); color: var(--txt2); text-align: center; font-variant-numeric: tabular-nums; }
.chip.on { background: var(--txt); border-color: var(--txt); color: #0d0d0d; }
.chip.on b { background: rgba(0,0,0,.12); color: #0d0d0d; }
.chip.warn:not(.on) b { background: rgba(255,179,64,.18); color: #ffb340; }
.chip:focus-visible, .clear:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.sel-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sel select { min-height: 44px; min-width: 150px; padding: 0 12px; }
.clear { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 10px; border: none; background: transparent; color: var(--ac); font-size: 13px; font-weight: 600; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); align-items: start; }
.sk { height: 250px; border-radius: 16px; background: linear-gradient(90deg, var(--bg2) 25%, #232323 50%, var(--bg2) 75%); background-size: 200% 100%; animation: sh 1.4s infinite; }
@keyframes sh { to { background-position: -200% 0; } }
.note { padding: 22px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; max-width: 560px; }
.note h3 { font-size: 17px; }
.note p { color: var(--txt2); font-size: 14px; line-height: 1.55; }
.note.err { border-color: rgba(255,122,122,.4); }
code { background: var(--bg3); padding: 1px 6px; border-radius: 4px; font-size: 12.5px; }

@media (max-width: 960px) {
  .ph h2 { display: none; }
  .ph { margin-bottom: 4px; }
  .refresh { display: none; }
  .fb { position: static; padding-top: 4px; }
  .grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
</style>
