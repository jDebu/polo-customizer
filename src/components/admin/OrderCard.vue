<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../Icon.vue'
import VoucherThumb from './VoucherThumb.vue'
import StatusBadge from './StatusBadge.vue'
import StatusActions from './StatusActions.vue'
import { fmtDateTime, money, timeAgo, telLink, type AdminOrder } from '../../lib/orderModel'

const props = defineProps<{ order: AdminOrder; busy: boolean }>()
const emit = defineEmits<{ (e: 'open'): void; (e: 'voucher'): void; (e: 'advance'): void; (e: 'reject'): void; (e: 'reopen'): void }>()

const shown = computed(() => props.order.lines.slice(0, 3))
const more = computed(() => Math.max(0, props.order.lines.length - 3))
const phone = computed(() => props.order.phone.replace(/(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3'))
const urgent = computed(() => props.order.status === 'pending_validation')
</script>

<template>
  <article class="oc" :class="{ urgent }" :aria-labelledby="`oc-${order.id}`">
    <header class="hd">
      <button class="idb" :id="`oc-${order.id}`" :title="order.id" @click="emit('open')">
        <span class="mono">#{{ order.id.slice(-4) }}</span>
        <span class="when" :title="fmtDateTime(order.createdAt)">{{ timeAgo(order.createdAt) }}</span>
      </button>
      <StatusBadge :status="order.status" />
    </header>

    <div class="bd">
      <div class="vwrap"><VoucherThumb :url="order.voucherUrl" @open="emit('voucher')" /></div>
      <div class="info">
        <button class="nm" @click="emit('open')">{{ order.name || 'Sin nombre' }}</button>
        <p class="sub">
          <a v-if="order.phone" :href="telLink(order.phone)" class="tel"><Icon name="phone" :size="14" /> {{ phone }}</a>
          <span v-if="order.dept">· {{ order.dept }}</span>
        </p>
        <ul class="vars" aria-label="Variantes del pedido">
          <li v-for="(l, i) in shown" :key="i"><i :style="{ background: l.hex }" aria-hidden="true" />{{ l.qty }}×{{ l.size }} <span>{{ l.colorName }}</span></li>
          <li v-if="more" class="more">+{{ more }} más</li>
        </ul>
        <p class="tot"><b>{{ money(order.total) }}</b><span class="pay">{{ order.payment || 'pago' }}</span><span class="pc">{{ order.pieces }} polo{{ order.pieces === 1 ? '' : 's' }}</span></p>
      </div>
    </div>

    <footer class="ft">
      <StatusActions :order="order" :busy="busy" compact @advance="emit('advance')" @reject="emit('reject')" @reopen="emit('reopen')" />
      <button class="det" @click="emit('open')">Detalle <Icon name="chevron-right" :size="16" /></button>
    </footer>
  </article>
</template>

<style scoped>
.oc { display: flex; flex-direction: column; background: var(--bg2); border: 1px solid var(--bd); border-radius: 16px; overflow: hidden; transition: border-color .15s; }
.oc.urgent { border-color: rgba(255,179,64,.35); }
.hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px 10px 6px; border-bottom: 1px solid var(--bd); }
.idb { display: flex; align-items: baseline; gap: 10px; min-height: 40px; padding: 0 8px; border: none; background: transparent; color: var(--txt); border-radius: 8px; text-align: left; }
.idb:hover { background: var(--bg3); }
.mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-weight: 700; font-size: 15px; color: var(--pr); }
.when { font-size: 12px; color: var(--txt3); }
.bd { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 12px; padding: 12px; }
.vwrap { height: 124px; }
.info { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.nm { align-self: flex-start; max-width: 100%; padding: 0; min-height: 28px; border: none; background: transparent; color: var(--txt); font-size: 16px; font-weight: 700; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nm:hover { text-decoration: underline; }
.sub { font-size: 13px; color: var(--txt2); display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; }
.tel { display: inline-flex; align-items: center; gap: 4px; color: var(--ac); min-height: 28px; }
.vars { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 5px; }
.vars li { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; background: var(--bg3); border: 1px solid var(--bd); font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.vars li span { font-weight: 500; color: var(--txt2); }
.vars li i { width: 11px; height: 11px; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); }
.vars .more { color: var(--txt2); }
.tot { display: flex; align-items: baseline; gap: 8px; margin-top: auto; color: var(--txt); }
.tot b { font-size: 19px; font-variant-numeric: tabular-nums; }
.pay { text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: .04em; color: var(--txt2); padding: 1px 7px; border: 1px solid var(--bd2); border-radius: 999px; }
.pc { font-size: 12px; color: var(--txt3); }
.ft { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--bd); background: rgba(255,255,255,.015); flex-wrap: wrap; }
.det { display: inline-flex; align-items: center; gap: 2px; min-height: 40px; padding: 0 6px 0 10px; border: none; background: transparent; color: var(--txt2); font-size: 13px; font-weight: 600; margin-left: auto; }
.det:hover { color: var(--txt); }
.idb:focus-visible, .nm:focus-visible, .det:focus-visible, .tel:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
@media (max-width: 380px) { .bd { grid-template-columns: 80px minmax(0, 1fr); } .vwrap { height: 108px; } }
</style>
