<template>
  <div class="confirm-wrap container">
    <div class="confirm-card card">

      <div class="confirm-icon">🎉</div>
      <h1 class="mt-16">¡Pedido recibido!</h1>
      <p class="mt-8">Tu pedido está siendo procesado. Te avisaremos cuando el pago sea validado.</p>

      <div class="order-id-box mt-24">
        <p class="mu">Número de pedido</p>
        <p class="order-id">{{ route.params.orderId }}</p>
        <button class="btn btn-ghost btn-sm mt-8" @click="copyId">
          {{ copied ? '✓ Copiado' : '📋 Copiar' }}
        </button>
      </div>

      <!-- Status timeline -->
      <div class="timeline mt-32">
        <div class="tl-item done">
          <div class="tl-dot">✓</div>
          <div class="tl-content">
            <p class="bold">Pedido recibido</p>
            <p class="mu">{{ now }}</p>
          </div>
        </div>
        <div class="tl-item pending">
          <div class="tl-dot tl-spin">⏳</div>
          <div class="tl-content">
            <p class="bold">Validando pago</p>
            <p class="mu">En proceso — generalmente menos de 1 hora</p>
          </div>
        </div>
        <div class="tl-item future">
          <div class="tl-dot">🖨</div>
          <div class="tl-content">
            <p class="bold">En producción</p>
            <p class="mu">Estampado de tu diseño</p>
          </div>
        </div>
        <div class="tl-item future">
          <div class="tl-dot">🚚</div>
          <div class="tl-content">
            <p class="bold">Enviado</p>
            <p class="mu">Olva Courier · 2–5 días hábiles</p>
          </div>
        </div>
        <div class="tl-item future">
          <div class="tl-dot">📦</div>
          <div class="tl-content">
            <p class="bold">Entregado</p>
            <p class="mu">En la dirección indicada</p>
          </div>
        </div>
      </div>

      <!-- Contact / share -->
      <div class="actions mt-32">
        <a
          :href="telegramLink"
          target="_blank" rel="noopener"
          class="btn btn-ghost"
        >
          💬 Consultar por Telegram
        </a>
        <button class="btn btn-ghost" @click="shareOrder">
          🔗 Compartir pedido
        </button>
      </div>

      <div class="new-order mt-24">
        <router-link to="/design" class="btn btn-primary">
          🎨 Crear otro polo
        </router-link>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const copied = ref(false)

const now = new Date().toLocaleString('es-PE', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
})

const telegramLink = computed(() => {
  const id = route.params.orderId as string
  const msg = encodeURIComponent(`Hola, consulto por mi pedido ${id}`)
  return `https://t.me/poloprintpe?text=${msg}`
})

function copyId() {
  navigator.clipboard.writeText(route.params.orderId as string)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function shareOrder() {
  const url = `${window.location.origin}${window.location.pathname}#/confirm/${route.params.orderId}`
  if (navigator.share) {
    navigator.share({ title: 'Mi pedido PoloPrint', url })
  } else {
    navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>

<style scoped>
.confirm-wrap { padding: 60px 24px; display: flex; justify-content: center; }
.confirm-card { max-width: 560px; width: 100%; text-align: center; }
.confirm-icon { font-size: 64px; display: block; }

/* Order ID */
.order-id-box { background: var(--bg3); border-radius: var(--radius); padding: 20px; }
.order-id { font-size: 1.4rem; font-weight: 800; letter-spacing: 0.06em; color: var(--pr); margin-top: 6px; }

/* Timeline */
.timeline { text-align: left; display: flex; flex-direction: column; gap: 0; }
.tl-item { display: flex; gap: 16px; align-items: flex-start; padding: 12px 0; position: relative; }
.tl-item:not(:last-child)::after {
  content: ''; position: absolute; left: 15px; top: 44px;
  width: 2px; height: calc(100% - 20px); background: var(--bd);
}
.tl-dot {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; border: 2px solid var(--bd); background: var(--bg3);
  position: relative; z-index: 1;
}
.tl-item.done .tl-dot { background: var(--ac); border-color: var(--ac); color: #0d0d0d; font-weight: 700; }
.tl-item.pending .tl-dot { background: rgba(245,166,35,.15); border-color: var(--warn); }
.tl-spin { animation: spin-slow 2s linear infinite; }
@keyframes spin-slow { to { transform: rotate(360deg); } }
.tl-item.future .tl-dot { opacity: 0.4; }
.tl-item.future .tl-content { opacity: 0.4; }
.tl-content { padding-top: 4px; }
.tl-content .bold { font-size: 14px; }
.tl-content .mu { font-size: 12px; }

/* Actions */
.actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.new-order { border-top: 1px solid var(--bd); padding-top: 24px; }
</style>
