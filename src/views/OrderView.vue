<template>
  <div class="main-pad container">
    <div class="order-layout">

      <!-- Form -->
      <div class="form-col">
        <h2 style="margin-bottom:24px">Datos de envío</h2>

        <!-- Size + qty -->
        <div class="card mb-24">
          <h3 class="section-label">Talla y cantidad</h3>
          <div class="size-grid">
            <button
              v-for="sz in SIZES"
              :key="sz"
              class="size-btn"
              :class="{ active: store.orderItem.size === sz }"
              @click="store.orderItem.size = sz"
            >{{ sz }}</button>
          </div>
          <div class="size-guide mu mt-8" @click="showGuide = !showGuide" style="cursor:pointer">
            📏 Guía de tallas ▾
          </div>
          <div v-if="showGuide" class="size-table mt-8">
            <table>
              <thead><tr><th>Talla</th><th>Pecho (cm)</th><th>Largo (cm)</th></tr></thead>
              <tbody>
                <tr v-for="g in SIZE_GUIDE" :key="g.size"><td>{{g.size}}</td><td>{{g.chest}}</td><td>{{g.length}}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="qty-row mt-16">
            <label>Cantidad</label>
            <div class="qty-stepper">
              <button @click="dec" :disabled="store.orderItem.quantity <= 1">−</button>
              <span>{{ store.orderItem.quantity }}</span>
              <button @click="inc" :disabled="store.orderItem.quantity >= 10">+</button>
            </div>
          </div>
        </div>

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

        <button class="btn btn-primary btn-full btn-lg" @click="next">
          Continuar al pago →
        </button>
      </div>

      <!-- Summary -->
      <div class="summary-col">
        <div class="card summary-card">
          <h3 class="section-label">Resumen del pedido</h3>

          <!-- Polo thumbnail -->
          <div class="polo-thumb-row">
            <div class="polo-thumb-box">
              <svg viewBox="0 0 60 72" fill="none">
                <path d="M24,5 Q30,3 36,5 L39,6 Q48,7 55,8 Q59,10 59,16 Q59,21 54,23 L46,21 L45,63 Q45,65 43,66 L17,66 Q15,65 15,63 L14,21 L6,23 Q1,21 1,16 Q1,10 5,8 Q12,7 21,6 Z" :fill="store.design.poloColor" stroke="#00000020" stroke-width="0.5"/>
                <path d="M24,5 Q30,3 36,5 Q34,9 30,10 Q26,9 24,5Z" :fill="adjustColor(store.design.poloColor, -0.15)"/>
              </svg>
            </div>
            <div>
              <p class="bold" style="font-size:14px">Polo personalizado</p>
              <p class="mu">{{ sleeveLabel }} · {{ colorLabel }}</p>
              <p class="mu">Talla {{ store.orderItem.size }}</p>
            </div>
          </div>

          <div class="summary-line">
            <span>Polo × {{ store.orderItem.quantity }}</span>
            <span>S/ {{ store.subtotal }}</span>
          </div>
          <div class="summary-line" v-if="store.delivery.department">
            <span>Envío — {{ deliveryTierName }}</span>
            <span>S/ {{ store.delivery.rate }}</span>
          </div>
          <div class="summary-line" v-else>
            <span class="mu">Envío (selecciona departamento)</span>
            <span class="mu">—</span>
          </div>
          <div class="summary-line total">
            <span>Total</span>
            <span class="red">S/ {{ store.delivery.department ? store.total : store.subtotal }}</span>
          </div>

          <div v-if="store.delivery.department" class="delivery-info mt-16">
            <p class="mu">🚚 Envío por <strong>Olva Courier</strong></p>
            <p class="mu">Tiempo estimado: 2–5 días hábiles</p>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../store/index'
import { SIZES, POLO_COLORS, DELIVERY_RATES } from '../data/catalog'
import { getDepartments, getProvinces, getDistricts, type UbigeoItem } from '../lib/ubigeo'

const departments: UbigeoItem[] = getDepartments()

const store = useStore()
const router = useRouter()
const errs = ref<Record<string, string>>({})
const showGuide = ref(false)

// ── Ubigeo state ────────────────────────────────────────────
const selectedDeptCode = ref('')
const selectedProvCode = ref('')
const selectedDistCode = ref('')

const provinces = ref<UbigeoItem[]>([])
const districts = ref<UbigeoItem[]>([])

const SIZE_GUIDE = [
  { size:'XS', chest:'86-91', length:'65' },
  { size:'S',  chest:'91-96', length:'68' },
  { size:'M',  chest:'96-101', length:'71' },
  { size:'L',  chest:'101-106', length:'74' },
  { size:'XL', chest:'106-111', length:'77' },
  { size:'XXL',chest:'111-116', length:'80' },
]

const sleeveLabel = computed(() =>
  store.design.sleeveType === 'short' ? 'Manga corta' : 'Manga larga'
)
const colorLabel = computed(() =>
  POLO_COLORS.find(c => c.value === store.design.poloColor)?.label ?? ''
)
const deliveryTierName = computed(() =>
  DELIVERY_RATES.find(r => r.departments.includes(store.delivery.department))?.tier ?? ''
)

function dec() { if (store.orderItem.quantity > 1) store.orderItem.quantity-- }
function inc() { if (store.orderItem.quantity < 10) store.orderItem.quantity++ }

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

function adjustColor(hex: string, amount: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n))
  const r = clamp(parseInt(hex.slice(1,3), 16) + Math.round(amount * 255))
  const g = clamp(parseInt(hex.slice(3,5), 16) + Math.round(amount * 255))
  const b = clamp(parseInt(hex.slice(5,7), 16) + Math.round(amount * 255))
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
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

function next() {
  if (validate()) router.push('/payment')
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
.order-layout { display: grid; grid-template-columns: 1fr 360px; gap: 32px; align-items: start; }
.form-col {}
.mb-24 { margin-bottom: 24px; }
.section-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--txt2); margin-bottom: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* Size */
.size-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.size-btn {
  min-width: 48px; padding: 8px 12px; border: 1px solid var(--bd);
  background: transparent; border-radius: var(--radius); color: var(--txt);
  font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.size-btn.active { background: var(--pr); border-color: var(--pr); color: #fff; }
.size-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.size-table th, .size-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--bd); }
.size-table th { color: var(--txt2); }

/* Quantity */
.qty-row { display: flex; align-items: center; gap: 16px; }
.qty-stepper { display: flex; align-items: center; gap: 0; border: 1px solid var(--bd); border-radius: var(--radius); overflow: hidden; }
.qty-stepper button { width: 36px; height: 36px; border: none; background: var(--bg3); color: var(--txt); font-size: 18px; cursor: pointer; }
.qty-stepper button:disabled { opacity: 0.3; cursor: not-allowed; }
.qty-stepper span { min-width: 36px; text-align: center; font-weight: 600; }

/* Summary */
.summary-card { position: sticky; top: 90px; }
.polo-thumb-row { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--bd); }
.polo-thumb-box { width: 56px; flex-shrink: 0; }
.summary-line { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 14px; border-bottom: 1px solid var(--bd); }
.summary-line.total { font-size: 17px; font-weight: 700; border-bottom: none; padding-top: 12px; }
.delivery-info { background: var(--bg3); border-radius: var(--radius); padding: 12px; }

@media (max-width: 800px) {
  .order-layout { grid-template-columns: 1fr; }
  .summary-col { order: -1; }
  .summary-card { position: static; }
}
</style>
