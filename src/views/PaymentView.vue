<template>
  <div class="main-pad container">
    <div class="payment-layout">

      <div class="payment-col">
        <h2 style="margin-bottom:24px">Realizar pago</h2>

        <!-- Method select -->
        <div class="card mb-24">
          <h3 class="section-label">Método de pago</h3>
          <div class="method-grid">
            <button
              class="method-btn"
              :class="{ active: store.payment.method === 'yape' }"
              @click="store.payment.method = 'yape'"
            >
              <span class="method-icon">📱</span>
              <span class="method-name">Yape</span>
            </button>
            <button
              class="method-btn"
              :class="{ active: store.payment.method === 'plin' }"
              @click="store.payment.method = 'plin'"
            >
              <span class="method-icon">💜</span>
              <span class="method-name">Plin</span>
            </button>
          </div>
        </div>

        <!-- Payment details -->
        <div class="card mb-24">
          <h3 class="section-label">
            Datos de {{ store.payment.method === 'yape' ? 'Yape' : 'Plin' }}
          </h3>
          <div class="payment-details">
            <div class="qr-box">
              <div class="qr-placeholder">
                <span style="font-size:48px">{{ store.payment.method === 'yape' ? '📱' : '💜' }}</span>
                <p class="mu mt-8">QR de {{ store.payment.method === 'yape' ? 'Yape' : 'Plin' }}</p>
                <p class="mu" style="font-size:11px">Escanea o usa el número</p>
              </div>
            </div>
            <div class="payment-info">
              <p class="bold" style="font-size:1.3rem">S/ {{ store.total }}</p>
              <p class="mu mt-4">Total a pagar</p>
              <div class="phone-display mt-16">
                <p class="mu">Número {{ store.payment.method === 'yape' ? 'Yape' : 'Plin' }}:</p>
                <p class="phone-number bold">{{ paymentNumber }}</p>
              </div>
              <div class="payment-steps mt-16">
                <div class="step-item">
                  <span class="step-num-sm">1</span>
                  <span>Abre {{ store.payment.method === 'yape' ? 'Yape' : 'Plin' }} en tu celular</span>
                </div>
                <div class="step-item">
                  <span class="step-num-sm">2</span>
                  <span>Envía S/ {{ store.total }} al número indicado</span>
                </div>
                <div class="step-item">
                  <span class="step-num-sm">3</span>
                  <span>Toma captura de pantalla del comprobante</span>
                </div>
                <div class="step-item">
                  <span class="step-num-sm">4</span>
                  <span>Súbela abajo y envía tu pedido</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Voucher upload -->
        <div class="card mb-24">
          <h3 class="section-label">Subir comprobante de pago *</h3>
          <div
            class="voucher-zone"
            :class="{ 'has-file': !!voucherPreview, dragging: vDragging }"
            @dragover.prevent="vDragging = true"
            @dragleave="vDragging = false"
            @drop.prevent="handleVoucherDrop"
            @click="triggerVoucher"
          >
            <input
              type="file" ref="voucherInput" accept="image/*"
              style="display:none" @change="handleVoucherChange"
            />
            <template v-if="voucherPreview">
              <img :src="voucherPreview" class="voucher-preview" />
              <p class="mu mt-8">{{ voucherFileName }}</p>
              <button class="btn btn-ghost btn-sm mt-8" @click.stop="clearVoucher">Cambiar</button>
            </template>
            <template v-else>
              <span class="upload-icon">📸</span>
              <p class="bold">Captura del comprobante</p>
              <p class="mu">JPG, PNG · máx 10 MB</p>
            </template>
          </div>
          <p v-if="voucherError" class="err mt-4">{{ voucherError }}</p>
        </div>

        <!-- Submit (desktop) -->
        <button v-if="wide" class="btn btn-primary btn-full btn-lg" :disabled="!canSubmit || store.submitting" @click="submit">
          <Icon name="check" :size="20" /> Enviar pedido
        </button>
        <p v-if="!canSubmit && wide" class="mu text-center mt-8">Sube el comprobante de pago para poder enviar.</p>
        <p class="mu text-center mt-8">Al enviar confirmas que el diseño es de tu autoría o tienes derechos para usarlo.</p>
        <OrderSummary v-if="!wide" :delivery="true" class="mt-16" />
        <div v-if="!wide" class="card mt-16 delivery-summary-m">
          <p class="mu bold">Destinatario</p>
          <p class="mu">{{ store.delivery.recipientName }} · {{ store.delivery.phone }}</p>
          <p class="mu">{{ store.delivery.address }}, {{ store.delivery.district }}, {{ store.delivery.province }}, {{ store.delivery.department }}</p>
        </div>
      </div>

      <!-- Summary (desktop) -->
      <div v-if="wide" class="summary-col">
        <OrderSummary class="summary-card" />
        <div class="card delivery-summary mt-16">
          <p class="mu bold">Destinatario</p>
          <p class="mu">{{ store.delivery.recipientName }} · {{ store.delivery.phone }}</p>
          <p class="mu">{{ store.delivery.address }}, {{ store.delivery.district }}</p>
          <p class="mu">{{ store.delivery.province }}, {{ store.delivery.department }}</p>
        </div>
      </div>

    </div>

    <!-- Mobile: total y botón de envío siempre visibles -->
    <div v-if="!wide" class="cta-bar">
      <div class="cta-tot"><span>Total a pagar</span><b>S/ {{ store.total }}</b></div>
      <button class="btn btn-primary" :disabled="!canSubmit || store.submitting" @click="submit">
        {{ canSubmit ? 'Enviar pedido' : 'Sube tu comprobante' }}
      </button>
    </div>

    <SubmitOverlay :open="overlay" :error="store.submitError" @retry="submit" @close="closeOverlay" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import OrderSummary from '../components/OrderSummary.vue'
import SubmitOverlay from '../components/SubmitOverlay.vue'
import Icon from '../components/Icon.vue'
import { useStore } from '../store/index'

const store = useStore()
const router = useRouter()

const voucherInput = ref<HTMLInputElement | null>(null)
const voucherPreview = ref<string | null>(null)
const voucherFileName = ref('')
const voucherError = ref('')
const vDragging = ref(false)

const paymentNumber = computed(() =>
  store.payment.method === 'yape'
    ? (import.meta.env.VITE_YAPE_NUMBER ?? '9XX XXX XXX')
    : (import.meta.env.VITE_PLIN_NUMBER ?? '9XX XXX XXX')
)

const canSubmit = computed(() => !!store.payment.voucherFile)

function triggerVoucher() {
  if (!voucherPreview.value) voucherInput.value?.click()
}

function handleVoucherChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) processVoucher(f)
}

function handleVoucherDrop(e: DragEvent) {
  vDragging.value = false
  const f = e.dataTransfer?.files[0]
  if (f) processVoucher(f)
}

function processVoucher(file: File) {
  voucherError.value = ''
  if (!file.type.startsWith('image/')) { voucherError.value = 'Debe ser una imagen.'; return }
  if (file.size > 10 * 1024 * 1024) { voucherError.value = 'Máximo 10 MB.'; return }
  const reader = new FileReader()
  reader.onload = () => {
    voucherPreview.value = reader.result as string
    voucherFileName.value = file.name
    store.payment.voucherFile = file
  }
  reader.readAsDataURL(file)
}

function clearVoucher() {
  voucherPreview.value = null
  voucherFileName.value = ''
  store.payment.voucherFile = null
  if (voucherInput.value) voucherInput.value.value = ''
}

const overlay = ref(false)

async function submit() {
  if (!canSubmit.value || store.submitting) return
  overlay.value = true
  try {
    const id = await store.submitOrder()
    router.push(`/confirm/${id}`)
  } catch {
    // el overlay muestra store.submitError con «Reintentar»
  }
}
function closeOverlay() { overlay.value = false }

// Mientras se sube no se puede salir: evita pedidos a medias
function guard(e: BeforeUnloadEvent) { if (store.submitting) { e.preventDefault(); e.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', guard))
onBeforeUnmount(() => window.removeEventListener('beforeunload', guard))
onBeforeRouteLeave(() => !store.submitting)

const mq = window.matchMedia('(min-width: 961px)')
const wide = ref(mq.matches)
const onMq = (e: MediaQueryListEvent) => (wide.value = e.matches)
onMounted(() => mq.addEventListener('change', onMq))
onBeforeUnmount(() => mq.removeEventListener('change', onMq))
</script>

<style scoped>
.main-pad { padding: 40px 24px; }
.payment-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 32px; align-items: start; }
.summary-card { position: sticky; top: 24px; }
.cta-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); background: var(--bg2); border-top: 1px solid var(--bd); box-shadow: 0 -8px 24px rgba(0,0,0,.35); }
.cta-bar .btn { min-height: 52px; padding: 0 20px; font-size: 16px; }
.cta-tot { display: flex; flex-direction: column; line-height: 1.25; font-size: 12px; color: var(--txt2); }
.cta-tot b { font-size: 18px; color: var(--txt); font-variant-numeric: tabular-nums; }
.payment-col {}
.mb-24 { margin-bottom: 24px; }
.section-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--txt2); margin-bottom: 16px; }

/* Method */
.method-grid { display: flex; gap: 12px; }
.method-btn {
  flex: 1; padding: 16px; border: 2px solid var(--bd);
  background: transparent; border-radius: var(--radius-lg);
  cursor: pointer; display: flex; flex-direction: column;
  align-items: center; gap: 8px; transition: all 0.2s;
}
.method-btn.active { border-color: var(--pr); background: rgba(232,64,64,0.08); }
.method-icon { font-size: 32px; }
.method-name { font-size: 14px; font-weight: 600; color: var(--txt); }

/* Payment details */
.payment-details { display: grid; grid-template-columns: 160px 1fr; gap: 24px; }
.qr-box { aspect-ratio: 1; background: var(--bg3); border: 1px solid var(--bd); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; }
.qr-placeholder { text-align: center; padding: 16px; }
.phone-display { background: var(--bg3); border-radius: var(--radius); padding: 12px; }
.phone-number { font-size: 1.3rem; letter-spacing: 0.05em; }
.payment-steps { display: flex; flex-direction: column; gap: 8px; }
.step-item { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--txt2); }
.step-num-sm { width: 20px; height: 20px; border-radius: 50%; background: var(--pr); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* Voucher */
.voucher-zone {
  border: 2px dashed var(--bd); border-radius: var(--radius-lg);
  padding: 32px; text-align: center; cursor: pointer; transition: all 0.2s;
}
.voucher-zone:hover, .voucher-zone.dragging { border-color: var(--pr); background: rgba(232,64,64,0.05); }
.voucher-zone.has-file { cursor: default; }
.upload-icon { font-size: 36px; display: block; margin-bottom: 8px; }
.voucher-preview { max-width: 200px; max-height: 200px; object-fit: contain; border-radius: 8px; margin: 0 auto; }

/* Summary */
.summary-card { position: sticky; top: 90px; }
.summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid var(--bd); }
.total-row { font-size: 16px; border-bottom: none; padding-top: 12px; }
.delivery-summary { background: var(--bg3); border-radius: var(--radius); padding: 12px; }

@media (max-width: 960px) {
  .main-pad { padding: 20px 14px 108px; }
  .payment-layout { grid-template-columns: 1fr; gap: 0; }
  .payment-details { grid-template-columns: 1fr; }
}
</style>
