<template>
  <div class="main-pad container">
    <div class="order-layout">

      <!-- Form -->
      <div class="form-col">
        <h2 style="margin-bottom:24px">Datos de envío</h2>

        <OrderLines class="mb-24" />
        <p v-if="linesError" class="err mb-24" role="alert">{{ linesError }}</p>
        <OrderSummary v-if="!wide" class="mb-24" />

        <!-- Recipient -->
        <div class="card mb-24">
          <h3 class="section-label">Datos del destinatario</h3>
          <div class="field">
            <label>Nombre completo *</label>
            <input v-model="store.delivery.recipientName" placeholder="Como aparece en el DNI" />
            <p v-if="errs.recipientName" class="err">{{ errs.recipientName }}</p>
          </div>
          <div class="form-row">
            <div class="field">
              <label>DNI *</label>
              <input
                :value="store.delivery.dni"
                @input="onDniInput"
                type="text"
                inputmode="numeric"
                maxlength="8"
                placeholder="12345678"
              />
              <p v-if="errs.dni" class="err">{{ errs.dni }}</p>
            </div>
            <div class="field">
              <label>Teléfono móvil *</label>
              <input
                :value="store.delivery.phone"
                @input="onPhoneInput"
                type="text"
                inputmode="numeric"
                maxlength="9"
                placeholder="9XXXXXXXX"
              />
              <p v-if="errs.phone" class="err">{{ errs.phone }}</p>
            </div>
          </div>
        </div>

        <!-- Delivery address -->
        <div class="card mb-24">
          <h3 class="section-label">Dirección de entrega</h3>
          <div class="field">
            <label>Departamento *</label>
            <select v-model="selectedDeptCode" @change="onDeptChange">
              <option value="">Selecciona departamento</option>
              <option v-for="d in departments" :key="d.code" :value="d.code">{{ d.name }}</option>
            </select>
            <p v-if="errs.department" class="err">{{ errs.department }}</p>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Provincia *</label>
              <select v-model="selectedProvCode" :disabled="!selectedDeptCode" @change="onProvChange">
                <option value="">{{ selectedDeptCode ? 'Selecciona provincia' : 'Primero elige un departamento' }}</option>
                <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }}</option>
              </select>
              <p v-if="errs.province" class="err">{{ errs.province }}</p>
            </div>
            <div class="field">
              <label>Distrito *</label>
              <select v-model="selectedDistCode" :disabled="!selectedProvCode" @change="onDistChange">
                <option value="">{{ selectedProvCode ? 'Selecciona distrito' : 'Primero elige una provincia' }}</option>
                <option v-for="d in districts" :key="d.code" :value="d.code">{{ d.name }}</option>
              </select>
              <p v-if="errs.district" class="err">{{ errs.district }}</p>
            </div>
          </div>
          <div class="field">
            <label>Dirección completa *</label>
            <input v-model="store.delivery.address" placeholder="Av. / Jr. / Calle, número" />
            <p v-if="errs.address" class="err">{{ errs.address }}</p>
          </div>
          <div class="field">
            <label>Referencia</label>
            <input v-model="store.delivery.reference" placeholder="Cerca de... / Color de casa..." />
          </div>
        </div>

        <button v-if="wide" class="btn btn-primary btn-full btn-lg" @click="next">
          Continuar al pago →
        </button>
      </div>

      <!-- Summary (desktop: fija a la derecha) -->
      <div v-if="wide" class="summary-col"><OrderSummary class="summary-card" /></div>

    </div>

    <!-- Mobile: el total y el botón siempre a la vista -->
    <div v-if="!wide" class="cta-bar">
      <div class="cta-tot"><span>{{ store.totalPieces }} polo{{ store.totalPieces === 1 ? '' : 's' }}</span><b>S/ {{ store.delivery.department ? store.total : store.subtotal }}</b></div>
      <button class="btn btn-primary" @click="next">Continuar al pago <Icon name="arrow-right" :size="18" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../store/index'
import OrderLines from '../components/OrderLines.vue'
import { useCatalog } from '../store/catalog'
import OrderSummary from '../components/OrderSummary.vue'
import Icon from '../components/Icon.vue'
import { getDepartments, getProvinces, getDistricts, type UbigeoItem } from '../lib/ubigeo'

const departments: UbigeoItem[] = getDepartments()

const store = useStore()
const catalog = useCatalog()
const router = useRouter()
const errs = ref<Record<string, string>>({})

// ── Ubigeo state ────────────────────────────────────────────
const selectedDeptCode = ref('')
const selectedProvCode = ref('')
const selectedDistCode = ref('')

const provinces = ref<UbigeoItem[]>([])
const districts = ref<UbigeoItem[]>([])

// Escritorio: resumen fijo a la derecha. Mobile: el resumen se integra tras las variantes.
const mq = window.matchMedia('(min-width: 961px)')
const wide = ref(mq.matches)
const onMq = (e: MediaQueryListEvent) => (wide.value = e.matches)
onMounted(() => { store.ensureLines(); mq.addEventListener('change', onMq) })
onBeforeUnmount(() => mq.removeEventListener('change', onMq))

function onDeptChange() {
  const dept = departments.find(d => d.code === selectedDeptCode.value)
  store.delivery.department = dept?.name ?? ''
  store.setDepartment(store.delivery.department)
  selectedProvCode.value = ''
  selectedDistCode.value = ''
  store.delivery.province = ''
  store.delivery.district = ''
  provinces.value = selectedDeptCode.value ? getProvinces(selectedDeptCode.value) : []
  districts.value = []
}

function onProvChange() {
  const prov = provinces.value.find(p => p.code === selectedProvCode.value)
  store.delivery.province = prov?.name ?? ''
  selectedDistCode.value = ''
  store.delivery.district = ''
  districts.value = selectedProvCode.value ? getDistricts(selectedProvCode.value) : []
}

function onDistChange() {
  const dist = districts.value.find(d => d.code === selectedDistCode.value)
  store.delivery.district = dist?.name ?? ''
}

function validate() {
  const e: Record<string, string> = {}
  const d = store.delivery
  if (!d.recipientName.trim()) e.recipientName = 'Campo obligatorio'
  if (!/^\d{8}$/.test(d.dni)) e.dni = 'DNI de 8 dígitos'
  if (!/^9\d{8}$/.test(d.phone)) e.phone = 'Formato: 9XXXXXXXX'
  if (!d.department) e.department = 'Selecciona un departamento'
  if (!d.province.trim()) e.province = 'Campo obligatorio'
  if (!d.district.trim()) e.district = 'Campo obligatorio'
  if (!d.address.trim()) e.address = 'Campo obligatorio'
  errs.value = e
  return !Object.keys(e).length
}

const linesError = ref('')
function next() {
  linesError.value = ''
  if (store.lines.some(l => !catalog.isAvailable(l.color, l.size))) {
    linesError.value = 'Hay variantes que ya no están disponibles. Cámbialas para continuar.'
    document.querySelector('.lines')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    return
  }
  if (validate()) { store.mergeLines(); router.push('/payment'); return }
  // lleva al primer campo con error (en mobile el error puede quedar fuera de pantalla)
  setTimeout(() => document.querySelector('.err')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50)
}

const onDniInput = (e: Event) => {
  const input = e.target as HTMLInputElement
  const clean = input.value.replace(/\D/g, '').slice(0, 8)
  
  input.value = clean // Fuerza a que la letra desaparezca visualmente del input
  store.delivery.dni = clean
}

const onPhoneInput = (e: Event) => {
  const input = e.target as HTMLInputElement
  let clean = input.value.replace(/\D/g, '')
  
  // Si no empieza con 9, lo deja vacío
  if (!clean.startsWith('9')) {
    clean = ''
  } else {
    clean = clean.slice(0, 9)
  }

  input.value = clean // Fuerza a que cualquier carácter inválido desaparezca al instante
  store.delivery.phone = clean
}
</script>

<style scoped>
.main-pad { padding: 40px 24px; }
.order-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 32px; align-items: start; }
.form-col {}
.mb-24 { margin-bottom: 24px; }
.section-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--txt2); margin-bottom: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.summary-card { position: sticky; top: 24px; }
.cta-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); background: var(--bg2); border-top: 1px solid var(--bd); box-shadow: 0 -8px 24px rgba(0,0,0,.35); }
.cta-bar .btn { min-height: 52px; padding: 0 20px; font-size: 16px; }
.cta-tot { display: flex; flex-direction: column; line-height: 1.25; font-size: 12px; color: var(--txt2); }
.cta-tot b { font-size: 18px; color: var(--txt); font-variant-numeric: tabular-nums; }

@media (max-width: 960px) {
  .main-pad { padding: 20px 14px 108px; }
  .order-layout { grid-template-columns: 1fr; gap: 0; }
}
</style>
