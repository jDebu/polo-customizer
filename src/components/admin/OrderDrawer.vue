<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '../Icon.vue'
import VoucherThumb from './VoucherThumb.vue'
import StatusBadge from './StatusBadge.vue'
import StatusActions from './StatusActions.vue'
import { useAdmin } from '../../store/admin'
import { fmtDateTime, money, previewUrl, telLink, waLink, type AdminOrder } from '../../lib/orderModel'

const props = defineProps<{ order: AdminOrder | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'voucher'): void; (e: 'advance'): void; (e: 'reject'): void; (e: 'reopen'): void }>()
const admin = useAdmin()
const box = ref<HTMLElement | null>(null)
const notes = ref('')
const est = ref('')

watch(() => props.order?.id, async (id) => {
  document.body.style.overflow = id ? 'hidden' : ''
  if (id) { notes.value = props.order!.notes; est.value = props.order!.estimatedDelivery.slice(0, 10); await nextTick(); box.value?.focus() }
}, { immediate: true })
watch(() => props.order?.notes, v => { if (v !== undefined) notes.value = v })
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
onBeforeUnmount(() => { document.body.style.overflow = '' })

async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); admin.toast(`${what} copiado`) } catch { admin.toast('No se pudo copiar', 'err') }
}
const label = computed(() => {
  const o = props.order
  if (!o) return ''
  return [o.name, `DNI ${o.dni} · Tel ${o.phone}`, o.address, [o.dist, o.prov, o.dept].filter(Boolean).join(', '), o.reference ? `Ref: ${o.reference}` : ''].filter(Boolean).join('\n')
})
const busy = computed(() => !!(props.order && admin.busy[props.order.id]))
const showEst = computed(() => !!props.order && ['confirmed', 'in_production', 'shipped'].includes(props.order.status))
</script>

<template>
  <Teleport to="body">
    <div v-if="order" class="ov" @click.self="emit('close')" @keydown="onKey">
      <section ref="box" class="dr" tabindex="-1" role="dialog" aria-modal="true" :aria-label="`Pedido ${order.id}`">
        <header class="hd">
          <div class="ttl">
            <p class="idl"><span class="mono">{{ order.id }}</span>
              <button class="cp" aria-label="Copiar número de pedido" @click="copy(order.id, 'Número de pedido')"><Icon name="copy" :size="15" /></button></p>
            <p class="dt">{{ fmtDateTime(order.createdAt) }}</p>
          </div>
          <StatusBadge :status="order.status" />
          <button class="cl" aria-label="Cerrar detalle" @click="emit('close')"><Icon name="x" :size="22" /></button>
        </header>

        <div class="sc">
          <section class="blk pay">
            <div class="vimg"><VoucherThumb :url="order.voucherUrl" @open="emit('voucher')" /></div>
            <div class="pinfo">
              <p class="k">Monto a verificar</p>
              <p class="amt">{{ money(order.total) }}</p>
              <p class="m"><span class="pm">{{ order.payment || 'pago' }}</span> · {{ order.pieces }} polo{{ order.pieces === 1 ? '' : 's' }} + envío {{ money(order.shipping) }}</p>
              <a v-if="order.voucherUrl" class="lk" :href="order.voucherUrl" target="_blank" rel="noopener"><Icon name="external" :size="14" /> Abrir original</a>
            </div>
          </section>

          <section class="blk">
            <h3>Cliente</h3>
            <p class="big">{{ order.name || '—' }}</p>
            <p class="row2"><span>DNI {{ order.dni || '—' }}</span>
              <button v-if="order.dni" class="cp" aria-label="Copiar DNI" @click="copy(order.dni, 'DNI')"><Icon name="copy" :size="15" /></button></p>
            <div v-if="order.phone" class="contact">
              <a class="btn btn-ghost btn-sm" :href="telLink(order.phone)"><Icon name="phone" :size="16" /> Llamar</a>
              <a class="btn btn-ghost btn-sm" :href="waLink(order.phone, `Hola ${order.name.split(' ')[0]}, te escribimos de PoloPrint por tu pedido ${order.id.slice(-4)}.`)" target="_blank" rel="noopener">WhatsApp</a>
            </div>
          </section>

          <section class="blk">
            <h3>Entrega</h3>
            <p>{{ order.address || '—' }}</p>
            <p class="mu">{{ [order.dist, order.prov, order.dept].filter(Boolean).join(', ') }}</p>
            <p v-if="order.reference" class="mu">Ref.: {{ order.reference }}</p>
            <button class="btn btn-ghost btn-sm mt" @click="copy(label, 'Datos de envío')"><Icon name="copy" :size="15" /> Copiar datos para la etiqueta</button>
          </section>

          <section class="blk">
            <h3>Pedido</h3>
            <ul class="lines">
              <li v-for="(l, i) in order.lines" :key="i">
                <span class="lt"><i :style="{ background: l.hex }" />{{ l.qty }} × {{ l.size }} <span class="mu">{{ l.colorName }}</span></span>
                <span>{{ order.unitPrice ? money(l.qty * order.unitPrice) : '' }}</span>
              </li>
              <li><span class="mu">Envío</span><span>{{ money(order.shipping) }}</span></li>
              <li class="tt"><span>Total</span><span>{{ money(order.total) }}</span></li>
            </ul>
          </section>

          <section v-if="order.renders.length || order.designUrls.length || order.folderUrl" class="blk">
            <h3>Diseño</h3>
            <div v-if="order.renders.length" class="rend">
              <a v-for="(r, i) in order.renders" :key="i" :href="r" target="_blank" rel="noopener" :aria-label="`Vista ${i + 1} del diseño`">
                <img :src="previewUrl(r, 400)" alt="" loading="lazy" referrerpolicy="no-referrer" />
              </a>
            </div>
            <div class="links">
              <a v-for="(d, i) in order.designUrls" :key="d" :href="d" target="_blank" rel="noopener" class="lk"><Icon name="photo" :size="14" /> Imagen {{ i + 1 }}</a>
              <a v-if="order.folderUrl" :href="order.folderUrl" target="_blank" rel="noopener" class="lk"><Icon name="folder" :size="14" /> Carpeta en Drive</a>
            </div>
          </section>

          <section class="blk">
            <h3>Seguimiento</h3>
            <div v-if="showEst" class="fld">
              <label for="est">Entrega estimada</label>
              <input id="est" v-model="est" type="date" @change="admin.saveEstimated(order, est)" />
            </div>
            <div class="fld">
              <label for="nt">Notas internas</label>
              <textarea id="nt" v-model="notes" rows="3" maxlength="500" placeholder="Solo las ves tú" @blur="admin.saveNotes(order, notes)" />
            </div>
            <p class="mu small">Última actualización: {{ fmtDateTime(order.updatedAt) }}</p>
          </section>
        </div>

        <footer class="ft">
          <StatusActions :order="order" :busy="busy" @advance="emit('advance')" @reject="emit('reject')" @reopen="emit('reopen')" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.ov { position: fixed; inset: 0; z-index: 300; display: flex; justify-content: flex-end; align-items: flex-end; background: rgba(0,0,0,.6); }
.dr { display: flex; flex-direction: column; width: 100%; max-height: 94dvh; height: 94dvh; background: var(--bg2); border-radius: 20px 20px 0 0; border: 1px solid var(--bd2); outline: none; animation: up .22s ease; }
.hd { display: flex; align-items: center; gap: 10px; padding: 12px 8px 12px 16px; border-bottom: 1px solid var(--bd); }
.ttl { flex: 1; min-width: 0; }
.idl { display: flex; align-items: center; gap: 2px; }
.mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
.dt { font-size: 12px; color: var(--txt3); }
.cp { width: 36px; height: 36px; border: none; background: transparent; color: var(--txt2); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
.cp:hover { background: var(--bg3); color: var(--txt); }
.cl { width: 44px; height: 44px; border: none; background: transparent; color: var(--txt); border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
.cl:hover { background: var(--bg3); }
.cp:focus-visible, .cl:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.sc { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.blk { padding: 14px; background: var(--bg3); border: 1px solid var(--bd); border-radius: 14px; }
.blk h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--txt3); margin: 0 0 8px; }
.pay { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 14px; align-items: stretch; }
.vimg { height: 150px; }
.pinfo { display: flex; flex-direction: column; gap: 3px; justify-content: center; }
.k { font-size: 12px; color: var(--txt2); }
.amt { font-size: 30px; font-weight: 800; color: var(--ac); font-variant-numeric: tabular-nums; line-height: 1.1; }
.m { font-size: 13px; color: var(--txt2); }
.pm { text-transform: uppercase; font-weight: 700; color: var(--txt); }
.lk { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; color: var(--ac); font-size: 13px; }
.big { font-size: 17px; font-weight: 700; color: var(--txt); }
.row2 { display: flex; align-items: center; gap: 2px; color: var(--txt2); font-size: 14px; }
.contact { display: flex; gap: 8px; margin-top: 8px; }
.mu { color: var(--txt2); font-size: 13px; }
.mt { margin-top: 10px; }
.lines { list-style: none; margin: 0; padding: 0; }
.lines li { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--bd); font-size: 14px; font-variant-numeric: tabular-nums; }
.lines .tt { border-bottom: none; font-weight: 800; font-size: 16px; padding-bottom: 0; }
.lt { display: inline-flex; align-items: center; gap: 8px; }
.lt i { width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); }
.rend { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
.rend a { aspect-ratio: 5 / 6; border-radius: 8px; overflow: hidden; background: #e6e8ed; display: block; }
.rend img { width: 100%; height: 100%; object-fit: cover; }
.links { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.fld { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.fld label { font-size: 12px; color: var(--txt2); }
.small { font-size: 12px; }
.ft { padding: 10px 16px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--bd); background: var(--bg2); }
.ft :deep(.sa) { justify-content: stretch; }
.ft :deep(.sa .btn) { flex: 1; min-height: 50px; }
@keyframes up { from { transform: translateY(24px); opacity: .6; } }
@media (min-width: 961px) {
  .ov { align-items: stretch; }
  .dr { width: 520px; max-height: none; height: 100%; border-radius: 0; border-width: 0 0 0 1px; animation: slide .22s ease; }
  @keyframes slide { from { transform: translateX(24px); opacity: .6; } }
}
@media (prefers-reduced-motion: reduce) { .dr { animation: none; } }
</style>
