<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAdmin } from '../../store/admin'
import { backendConfigured } from '../../lib/adminApi'
import { PAID, STATUSES, STATUS_META, limaDay, money, timeAgo, type AdminOrder, type Status } from '../../lib/orderModel'
import Icon from '../../components/Icon.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'

const admin = useAdmin()
const router = useRouter()

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return limaDay(d) }
const dayOf = (o: AdminOrder) => (o.createdAt ? limaDay(o.createdAt) : '')
const live = computed(() => admin.orders.filter(o => o.status !== 'rejected'))
const paid = computed(() => admin.orders.filter(o => PAID.includes(o.status)))

function sales(fromDay: string) {
  const list = paid.value.filter(o => dayOf(o) >= fromDay)
  return { amount: list.reduce((n, o) => n + o.total, 0), count: list.length }
}
const kpis = computed(() => [
  { k: 'Cobrado hoy', ...sales(daysAgo(0)) },
  { k: 'Últimos 7 días', ...sales(daysAgo(6)) },
  { k: 'Últimos 30 días', ...sales(daysAgo(29)) },
])
const pendingAmount = computed(() => admin.pending.reduce((n, o) => n + o.total, 0))
const attention = computed(() => [...admin.pending].sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)).slice(0, 5))

/* Pedidos por día (14 días, sin rechazados) */
const WD = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const series = computed(() => {
  const days = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i))
  const rows = days.map(d => {
    const list = live.value.filter(o => dayOf(o) === d)
    const dt = new Date(`${d}T12:00:00`)
    return { d, n: list.length, amount: list.reduce((s, o) => s + o.total, 0), label: String(dt.getDate()), wd: WD[dt.getDay()] }
  })
  return { rows, max: Math.max(1, ...rows.map(r => r.n)) }
})
const summaryChart = computed(() => `Pedidos de los últimos 14 días: ${series.value.rows.map(r => `${r.d} ${r.n}`).join(', ')}`)

/* Distribuciones (30 días, sin rechazados) */
const recent = computed(() => live.value.filter(o => dayOf(o) >= daysAgo(29)))
const payments = computed(() => {
  const m = new Map<string, number>()
  recent.value.forEach(o => m.set(o.payment || 'otro', (m.get(o.payment || 'otro') ?? 0) + 1))
  const total = recent.value.length || 1
  let off = 0
  return [...m].sort((a, b) => b[1] - a[1]).map(([k, n], i) => {
    const pct = (n / total) * 100
    const r = { k, n, pct: Math.round(pct), dash: `${pct} ${100 - pct}`, off: -off, color: ['#e84040', '#8b5cf6', '#6cb4ff'][i % 3] }
    off += pct
    return r
  })
})
function tally(pick: (o: AdminOrder) => { key: string; hex?: string; n: number }[]) {
  const m = new Map<string, { n: number; hex?: string }>()
  recent.value.forEach(o => pick(o).forEach(x => { const c = m.get(x.key) ?? { n: 0, hex: x.hex }; c.n += x.n; m.set(x.key, c) }))
  const rows = [...m].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.n - a.n).slice(0, 6)
  return { rows, max: Math.max(1, ...rows.map(r => r.n)) }
}
const topColors = computed(() => tally(o => o.lines.map(l => ({ key: l.colorName, hex: l.hex, n: l.qty }))))
const topSizes = computed(() => tally(o => o.lines.map(l => ({ key: l.size, n: l.qty }))))
const pipeline = computed(() => STATUSES.map(s => ({ s, n: admin.orders.filter(o => o.status === s && dayOf(o) >= daysAgo(29)).length })))

const go = (q: Record<string, string>) => router.push({ path: '/admin/orders', query: q })
</script>

<template>
  <div class="dash">
    <div v-if="!backendConfigured" class="card note">
      <h3>Conecta tu hoja de cálculo</h3>
      <p>Sin <code>VITE_SHEETS_URL</code> no hay pedidos que mostrar. Sigue <code>docs/ADMIN_SETUP.md</code>.</p>
    </div>
    <div v-else-if="admin.error" class="card note err" role="alert">
      <h3>No se pudieron cargar los datos</h3><p>{{ admin.error }}</p>
      <button class="btn btn-primary btn-sm" @click="admin.load()">Reintentar</button>
    </div>

    <!-- Prioridad: lo que necesita acción -->
    <section class="hero" :class="{ clear: !admin.pending.length }" aria-labelledby="att-h">
      <div class="hero-t">
        <div>
          <h2 id="att-h">{{ admin.pending.length ? `${admin.pending.length} pedido${admin.pending.length === 1 ? '' : 's'} por validar` : 'Todo al día' }}</h2>
          <p>{{ admin.pending.length ? `${money(pendingAmount)} esperando que confirmes el pago.` : 'No hay comprobantes pendientes de revisar.' }}</p>
        </div>
        <button v-if="admin.pending.length" class="btn btn-primary" @click="go({ status: 'pending_validation' })">Revisar pagos <Icon name="arrow-right" :size="18" /></button>
      </div>
      <ul v-if="attention.length" class="att">
        <li v-for="o in attention" :key="o.id">
          <button class="att-r" @click="go({ open: o.id })">
            <span class="a-n">{{ o.name || o.id.slice(-9) }}</span>
            <span class="a-m">{{ o.pieces }} polo{{ o.pieces === 1 ? '' : 's' }} · {{ o.payment }} · {{ timeAgo(o.createdAt) }}</span>
            <b>{{ money(o.total) }}</b>
            <Icon name="chevron-right" :size="18" />
          </button>
        </li>
      </ul>
    </section>

    <section class="kpis" aria-label="Ventas cobradas">
      <div v-for="k in kpis" :key="k.k" class="kpi">
        <p class="k">{{ k.k }}</p>
        <p class="v">{{ money(k.amount) }}</p>
        <p class="s">{{ k.count }} pedido{{ k.count === 1 ? '' : 's' }}</p>
      </div>
      <p class="kpi-n">Solo cuenta pedidos con el pago ya confirmado.</p>
    </section>

    <section class="pipe card" aria-label="Estado de los pedidos (30 días)">
      <h3 class="ct">Flujo de pedidos <span>últimos 30 días</span></h3>
      <div class="pp">
        <button v-for="p in pipeline" :key="p.s" class="ps" :class="STATUS_META[p.s].tone" @click="go({ status: p.s })">
          <b>{{ p.n }}</b><span>{{ STATUS_META[p.s].plural }}</span>
        </button>
      </div>
    </section>

    <div class="charts">
      <section class="card c-bars">
        <h3 class="ct">Pedidos por día <span>últimos 14 días</span></h3>
        <div class="bars" role="img" :aria-label="summaryChart">
          <div v-for="r in series.rows" :key="r.d" class="bar" :title="`${r.d}: ${r.n} pedido(s) · ${money(r.amount)}`">
            <span class="bn">{{ r.n || '' }}</span>
            <i :style="{ height: `${(r.n / series.max) * 100}%` }" :class="{ z: !r.n }" />
            <span class="bd">{{ r.label }}</span><span class="bw">{{ r.wd }}</span>
          </div>
        </div>
      </section>

      <section class="card">
        <h3 class="ct">Método de pago</h3>
        <div v-if="payments.length" class="donut">
          <svg viewBox="0 0 36 36" role="img" :aria-label="payments.map(p => `${p.k} ${p.pct}%`).join(', ')">
            <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--bg3)" stroke-width="4" />
            <circle v-for="p in payments" :key="p.k" cx="18" cy="18" r="15.915" fill="none" :stroke="p.color" stroke-width="4"
                    :stroke-dasharray="p.dash" :stroke-dashoffset="p.off" transform="rotate(-90 18 18)" />
            <text x="18" y="19.5" text-anchor="middle" class="dt">{{ recent.length }}</text>
          </svg>
          <ul><li v-for="p in payments" :key="p.k"><i :style="{ background: p.color }" /><span class="pn">{{ p.k }}</span><b>{{ p.pct }}%</b></li></ul>
        </div>
        <p v-else class="empty">Sin pedidos en el periodo.</p>
      </section>

      <section class="card">
        <h3 class="ct">Colores más pedidos <span>polos</span></h3>
        <ul v-if="topColors.rows.length" class="rank">
          <li v-for="r in topColors.rows" :key="r.k"><i class="sw" :style="{ background: r.hex }" /><span class="rn">{{ r.k }}</span>
            <span class="rb"><u :style="{ width: `${(r.n / topColors.max) * 100}%` }" /></span><b>{{ r.n }}</b></li>
        </ul>
        <p v-else class="empty">Sin datos todavía.</p>
        <h3 class="ct ct2">Tallas más pedidas</h3>
        <ul v-if="topSizes.rows.length" class="rank">
          <li v-for="r in topSizes.rows" :key="r.k"><span class="rn sz">{{ r.k }}</span>
            <span class="rb"><u :style="{ width: `${(r.n / topSizes.max) * 100}%` }" /></span><b>{{ r.n }}</b></li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 16px; }
.note { padding: 20px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.note p { color: var(--txt2); font-size: 14px; }
.note.err { border-color: rgba(255,122,122,.4); }
code { background: var(--bg3); padding: 1px 6px; border-radius: 4px; font-size: 12.5px; }

.hero { border: 1px solid rgba(255,179,64,.4); background: linear-gradient(160deg, rgba(255,179,64,.08), rgba(255,179,64,.02)); border-radius: 18px; padding: 18px; }
.hero.clear { border-color: var(--bd); background: var(--bg2); }
.hero-t { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.hero h2 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--txt); }
.hero p { color: var(--txt2); font-size: 14px; margin-top: 2px; }
.hero .btn { min-height: 48px; gap: 8px; }
.att { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.att-r { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto 18px; grid-template-areas: 'n a c' 'm a c'; gap: 0 12px; align-items: center; min-height: 58px; padding: 8px 12px; text-align: left; border: 1px solid var(--bd); background: var(--bg2); color: var(--txt); border-radius: 12px; }
.att-r:hover { border-color: var(--bd2); background: var(--bg3); }
.att-r:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.a-n { grid-area: n; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.a-m { grid-area: m; font-size: 12px; color: var(--txt2); }
.att-r b { grid-area: a; font-size: 16px; font-variant-numeric: tabular-nums; }
.att-r :deep(svg) { grid-area: c; color: var(--txt3); }

.kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.kpi { background: var(--bg2); border: 1px solid var(--bd); border-radius: 16px; padding: 16px; }
.k { font-size: 12px; color: var(--txt2); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.v { font-size: 30px; font-weight: 800; letter-spacing: -.02em; margin-top: 4px; font-variant-numeric: tabular-nums; color: var(--txt); }
.s { font-size: 13px; color: var(--txt3); }
.kpi-n { grid-column: 1 / -1; font-size: 12px; color: var(--txt3); margin-top: -4px; }

.card { background: var(--bg2); border: 1px solid var(--bd); border-radius: 16px; padding: 18px; }
.ct { font-size: 14px; font-weight: 700; margin: 0 0 12px; display: flex; justify-content: space-between; align-items: baseline; }
.ct span { font-size: 12px; font-weight: 500; color: var(--txt3); }
.ct2 { margin-top: 18px; }
.pp { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.ps { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 8px 12px; background: var(--bg3); border: 1px solid var(--bd); border-radius: 12px; color: var(--txt2); font-size: 13px; text-align: left; }
.ps b { font-size: 22px; color: var(--txt); font-variant-numeric: tabular-nums; }
.ps.warn b { color: #ffb340; } .ps.ok b { color: #3ddc84; } .ps.info b { color: #6cb4ff; } .ps.err b { color: #ff7a7a; }
.ps:hover { border-color: var(--bd2); }
.ps:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }

.charts { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; align-items: start; }
.bars { display: flex; align-items: flex-end; gap: 6px; height: 190px; padding-top: 18px; }
.bar { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; position: relative; }
.bar i { display: block; width: 100%; max-width: 28px; min-height: 3px; border-radius: 6px 6px 2px 2px; background: var(--pr); transition: height .3s ease; }
.bar i.z { background: var(--bg3); }
.bn { font-size: 11px; font-weight: 700; color: var(--txt); min-height: 14px; font-variant-numeric: tabular-nums; }
.bd { font-size: 11px; color: var(--txt2); }
.bw { font-size: 10px; color: var(--txt3); }
.donut { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.donut svg { width: 120px; height: 120px; flex-shrink: 0; }
.dt { fill: var(--txt); font-size: 8px; font-weight: 800; }
.donut ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 110px; }
.donut li { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.donut li i { width: 10px; height: 10px; border-radius: 50%; }
.pn { flex: 1; text-transform: capitalize; }
.rank { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.rank li { display: grid; grid-template-columns: 16px 86px 1fr 28px; align-items: center; gap: 8px; font-size: 13.5px; }
.rank li:has(.sz) { grid-template-columns: 38px 1fr 28px; }
.sw { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); }
.rn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sz { font-weight: 700; }
.rb { height: 8px; background: var(--bg3); border-radius: 4px; overflow: hidden; }
.rb u { display: block; height: 100%; background: var(--pr); border-radius: 4px; }
.rank b { text-align: right; font-variant-numeric: tabular-nums; }
.empty { color: var(--txt3); font-size: 13px; }

@media (max-width: 1100px) { .charts { grid-template-columns: 1fr 1fr; } .c-bars { grid-column: 1 / -1; } }
@media (max-width: 960px) {
  .hero h2 { font-size: 19px; }
  .hero .btn { width: 100%; }
  .kpis { grid-template-columns: 1fr 1fr; }
  .kpi:first-child { grid-column: 1 / -1; }
  .v { font-size: 26px; }
  .charts { grid-template-columns: 1fr; }
  .bars { gap: 3px; height: 160px; }
  .bw { display: none; }
  .pp { grid-template-columns: 1fr 1fr; }
}
@media (prefers-reduced-motion: reduce) { .bar i { transition: none; } }
</style>
