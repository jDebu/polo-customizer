<template>
  <div id="polo-app" :class="{ 'is-design': isDesign }">
    <header class="app-header">
      <div class="container row">
        <router-link to="/" class="header-logo">Polo<span>Print</span></router-link>
        <div class="spacer" />
        <nav class="header-nav">
          <router-link to="/design" class="nav-link">Crear polo</router-link>
          <router-link to="/admin" class="nav-link admin-link" v-if="store.isAdmin">Admin</router-link>
          <router-link v-else to="/admin/login" class="nav-link mu">Admin ↗</router-link>
        </nav>
      </div>
    </header>

    <!-- Step progress (shown on checkout screens) -->
    <div v-if="showSteps && !isDesign" class="steps" aria-label="Progreso del pedido">
      <router-link to="/design" class="step" :class="stepClass('/design')">
        <span class="step-num">1</span><span class="step-lbl">Diseño</span>
      </router-link>
      <span class="step-sep">›</span>
      <router-link to="/order" class="step" :class="stepClass('/order')">
        <span class="step-num">2</span><span class="step-lbl">Datos</span>
      </router-link>
      <span class="step-sep">›</span>
      <router-link to="/payment" class="step" :class="stepClass('/payment')">
        <span class="step-num">3</span><span class="step-lbl">Pago</span>
      </router-link>
      <span class="step-sep">›</span>
      <span class="step" :class="stepClass('/confirm')">
        <span class="step-num">4</span><span class="step-lbl">Confirmación</span>
      </span>
    </div>

    <router-view />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from './store/index'

const store = useStore()
const route = useRoute()

const checkoutPaths = ['/design', '/order', '/payment', '/confirm']
const showSteps = computed(() => checkoutPaths.some(p => route.path.startsWith(p)))
const isDesign = computed(() => route.path.startsWith('/design'))

function stepClass(path: string) {
  const idx = checkoutPaths.indexOf(path)
  const curIdx = checkoutPaths.findIndex(p => route.path.startsWith(p))
  if (idx === curIdx) return 'active'
  if (idx < curIdx) return 'done'
  return ''
}
</script>

<style scoped>
#polo-app { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }
/* Diseño: el espacio de trabajo ocupa la pantalla; no hay scroll de página */
#polo-app.is-design { height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
@media (max-width: 960px) { #polo-app.is-design .app-header { display: none; } }
/* Pasos: en pantallas pequeñas solo el paso actual muestra su nombre */
@media (max-width: 600px) { :deep(.step:not(.active) .step-lbl) { display: none; } :deep(.steps) { justify-content: center; padding: 10px 12px; } }
.header-nav { display: flex; gap: 20px; align-items: center; }
.nav-link {
  font-size: 14px; font-weight: 500; color: var(--txt2);
  transition: color 0.2s;
}
.nav-link:hover, .nav-link.router-link-active { color: var(--txt); }
.nav-link.admin-link { color: var(--pr); }
</style>
