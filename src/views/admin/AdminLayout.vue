<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from '../../store/index'
import { useAdmin } from '../../store/admin'
import Icon from '../../components/Icon.vue'
import ToastHost from '../../components/admin/ToastHost.vue'
import { timeAgo } from '../../lib/orderModel'

const store = useStore()
const admin = useAdmin()
const route = useRoute()
const router = useRouter()

const NAV = [
  { to: '/admin', label: 'Resumen', icon: 'dash', exact: true },
  { to: '/admin/orders', label: 'Pedidos', icon: 'orders' },
  { to: '/admin/catalog', label: 'Catálogo', icon: 'shirt' },
] as const
const active = (n: (typeof NAV)[number]) => ('exact' in n ? route.path === n.to : route.path.startsWith(n.to))
const title = computed(() => NAV.find(active)?.label ?? 'Admin')

function logout() { store.adminLogout(); router.replace('/admin/login') }

// Datos frescos: al entrar, al volver a la pestaña y cada 90 s mientras está visible
let timer = 0
const onVis = () => { if (document.visibilityState === 'visible') void admin.load(true) }
onMounted(() => {
  void admin.load()
  document.addEventListener('visibilitychange', onVis)
  timer = window.setInterval(() => { if (document.visibilityState === 'visible') void admin.load(true) }, 90000)
})
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', onVis); clearInterval(timer) })
</script>

<template>
  <div class="adm">
    <aside class="rail" aria-label="Administración">
      <router-link to="/admin" class="logo"><span class="lw">Polo<span>Print</span></span><small>Admin</small></router-link>
      <nav class="rail-nav">
        <router-link v-for="n in NAV" :key="n.to" :to="n.to" class="ni" :class="{ on: active(n) }" :aria-current="active(n) ? 'page' : undefined">
          <Icon :name="n.icon" :size="20" /><span>{{ n.label }}</span>
          <b v-if="n.to === '/admin/orders' && admin.pending.length" class="pend" :aria-label="`${admin.pending.length} por validar`">{{ admin.pending.length }}</b>
        </router-link>
      </nav>
      <div class="rail-foot">
        <p class="upd"><Icon name="clock" :size="14" /> {{ admin.loadedAt ? `Actualizado ${timeAgo(admin.loadedAt)}` : 'Sin cargar' }}</p>
        <router-link to="/design" class="ni sm" target="_blank"><Icon name="external" :size="18" /><span>Ver tienda</span></router-link>
        <button class="ni sm" @click="logout"><Icon name="logout" :size="18" /><span>Cerrar sesión</span></button>
      </div>
    </aside>

    <div class="main">
      <header class="top">
        <h1>{{ title }}</h1>
        <div class="top-r">
          <button class="ib" :class="{ spin: admin.loading }" aria-label="Actualizar datos" @click="admin.load()"><Icon name="reset" :size="20" /></button>
          <button class="ib" aria-label="Cerrar sesión" @click="logout"><Icon name="logout" :size="20" /></button>
        </div>
      </header>
      <main class="content"><router-view /></main>
    </div>

    <nav class="tabbar" aria-label="Administración">
      <router-link v-for="n in NAV" :key="n.to" :to="n.to" class="tb" :class="{ on: active(n) }" :aria-current="active(n) ? 'page' : undefined">
        <span class="ico"><Icon :name="n.icon" :size="22" /><b v-if="n.to === '/admin/orders' && admin.pending.length" class="pend">{{ admin.pending.length }}</b></span>
        <span>{{ n.label }}</span>
      </router-link>
    </nav>
    <ToastHost />
  </div>
</template>

<style scoped>
.adm { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; min-height: 100dvh; background: var(--bg); }
.rail { position: sticky; top: 0; height: 100vh; height: 100dvh; display: flex; flex-direction: column; padding: 20px 14px; border-right: 1px solid var(--bd); background: var(--bg2); }
.logo { font-size: 20px; font-weight: 800; letter-spacing: -.03em; color: var(--txt); padding: 4px 10px 18px; display: flex; align-items: baseline; gap: 8px; }
.logo .lw span { color: var(--pr); }
.logo small { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--txt3); }
.rail-nav { display: flex; flex-direction: column; gap: 4px; }
.ni { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px; border-radius: 10px; color: var(--txt2); font-size: 15px; font-weight: 600; border: none; background: transparent; width: 100%; text-align: left; transition: background .15s, color .15s; }
.ni:hover { background: var(--bg3); color: var(--txt); }
.ni.on { background: var(--bg3); color: var(--txt); box-shadow: inset 3px 0 0 var(--pr); }
.ni.sm { font-weight: 500; font-size: 14px; min-height: 40px; }
.ni:focus-visible, .tb:focus-visible, .ib:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.pend { margin-left: auto; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: var(--warn); color: #1a1000; font-size: 12px; line-height: 22px; text-align: center; font-weight: 800; }
.rail-foot { margin-top: auto; display: flex; flex-direction: column; gap: 2px; padding-top: 12px; border-top: 1px solid var(--bd); }
.upd { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--txt3); padding: 0 12px 8px; }

.main { min-width: 0; display: flex; flex-direction: column; }
.top { display: none; }
.content { padding: 28px 32px 48px; max-width: 1400px; width: 100%; }
.tabbar { display: none; }

@media (max-width: 960px) {
  .adm { grid-template-columns: 1fr; }
  .rail { display: none; }
  .top { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; justify-content: space-between; min-height: 56px; padding: 0 8px 0 16px; background: rgba(13,13,13,.94); backdrop-filter: blur(10px); border-bottom: 1px solid var(--bd); }
  .top h1 { font-size: 18px; font-weight: 800; }
  .top-r { display: flex; gap: 2px; }
  .ib { width: 44px; height: 44px; border: none; background: transparent; color: var(--txt2); border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
  .ib:active { background: var(--bg3); }
  .ib.spin :deep(svg) { animation: spin .8s linear infinite; }
  .content { padding: 14px 12px calc(88px + env(safe-area-inset-bottom, 0px)); }
  .tabbar { position: fixed; z-index: 70; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(3, 1fr); background: rgba(20,20,20,.97); backdrop-filter: blur(12px); border-top: 1px solid var(--bd); padding-bottom: env(safe-area-inset-bottom, 0px); }
  .tb { min-height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--txt2); font-size: 12px; font-weight: 600; }
  .tb.on { color: var(--txt); }
  .tb.on .ico :deep(svg) { color: var(--pr); }
  .ico { position: relative; display: inline-flex; }
  .ico .pend { position: absolute; top: -6px; right: -14px; min-width: 18px; height: 18px; line-height: 18px; font-size: 11px; padding: 0 5px; }
}
@media (prefers-reduced-motion: reduce) { .ib.spin :deep(svg) { animation-duration: 3s; } }
</style>
