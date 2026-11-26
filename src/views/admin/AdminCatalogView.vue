<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStore } from '../../store/index'
import { useAdmin } from '../../store/admin'
import { comboKey, sanitize, useCatalog, type CatalogData } from '../../store/catalog'
import { backendConfigured, saveCatalogRemote } from '../../lib/adminApi'
import { DEFAULT_COLORS, SIZES } from '../../data/catalog'
import { SIZE_TABLE, type SizeId } from '../../data/molds'
import Icon from '../../components/Icon.vue'

const store = useStore()
const admin = useAdmin()
const catalog = useCatalog()

const clone = (d: CatalogData): CatalogData => JSON.parse(JSON.stringify(d))
const draft = ref<CatalogData>(clone(catalog.data))
const saving = ref(false)
const newName = ref('')
const newHex = ref('#2e7d6b')
const addError = ref('')

onMounted(async () => { if (!catalog.loaded) await catalog.load(); draft.value = clone(catalog.data) })

const strip = (d: CatalogData) => JSON.stringify({ p: d.price, c: d.colors, s: d.sizes, u: [...d.unavailable].sort() })
const dirty = computed(() => strip(draft.value) !== strip(catalog.data))
const isDefault = (hex: string) => DEFAULT_COLORS.some(c => c.value.toLowerCase() === hex.toLowerCase())

/* Colores */
function addColor() {
  const label = newName.value.trim()
  const hex = newHex.value.toLowerCase()
  addError.value = ''
  if (!label) { addError.value = 'Ponle un nombre al color.'; return }
  if (draft.value.colors.some(c => c.value.toLowerCase() === hex)) { addError.value = 'Ese tono ya existe en tu lista.'; return }
  if (draft.value.colors.length >= 30) { addError.value = 'Máximo 30 colores.'; return }
  draft.value.colors.push({ label, value: hex, active: true })
  newName.value = ''
}
function removeColor(i: number) {
  const hex = draft.value.colors[i].value.toLowerCase()
  draft.value.colors.splice(i, 1)
  draft.value.unavailable = draft.value.unavailable.filter(k => !k.startsWith(hex + '|'))
}

/* Disponibilidad */
const out = (hex: string, s: string) => draft.value.unavailable.includes(comboKey(hex, s))
function toggleCell(hex: string, s: string) {
  const k = comboKey(hex, s)
  draft.value.unavailable = out(hex, s) ? draft.value.unavailable.filter(x => x !== k) : [...draft.value.unavailable, k]
}
function setMany(keys: string[], makeOut: boolean) {
  const set = new Set(draft.value.unavailable)
  keys.forEach(k => (makeOut ? set.add(k) : set.delete(k)))
  draft.value.unavailable = [...set]
}
const rowAllOut = (hex: string) => SIZES.filter(s => draft.value.sizes[s]).every(s => out(hex, s))
const colAllOut = (s: string) => draft.value.colors.every(c => out(c.value, s))
const toggleRow = (hex: string) => setMany(SIZES.filter(s => draft.value.sizes[s]).map(s => comboKey(hex, s)), !rowAllOut(hex))
const toggleCol = (s: string) => setMany(draft.value.colors.map(c => comboKey(c.value, s)), !colAllOut(s))
const outCount = computed(() => draft.value.unavailable.length)

/* Guardar */
const priceOk = computed(() => draft.value.price > 0 && draft.value.price < 10000)
const sizesOk = computed(() => SIZES.some(s => draft.value.sizes[s]))
const colorsOk = computed(() => draft.value.colors.some(c => c.active !== false))
const canSave = computed(() => dirty.value && priceOk.value && sizesOk.value && colorsOk.value && !saving.value)

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const payload = { ...clone(draft.value), updatedAt: undefined }
    const saved = backendConfigured ? await saveCatalogRemote(store.adminToken, payload) : payload
    catalog.commit(sanitize(saved))
    store.setPrice(catalog.price)
    draft.value = clone(catalog.data)
    admin.toast(backendConfigured ? 'Catálogo guardado. La tienda lo usa desde ahora.' : 'Guardado solo en este navegador (sin hoja conectada).')
  } catch (e) {
    admin.toast(e instanceof Error ? e.message : 'No se pudo guardar el catálogo', 'err')
  } finally {
    saving.value = false
  }
}
const discard = () => { draft.value = clone(catalog.data); addError.value = '' }
</script>

<template>
  <div class="cat">
    <header class="ph">
      <h2>Catálogo</h2>
      <p>Lo que ven y pueden pedir tus clientes. Los cambios se aplican al guardar.</p>
    </header>

    <div v-if="!backendConfigured" class="warn card" role="note">
      <Icon name="alert" :size="18" /> Sin hoja conectada: los cambios solo se guardan en este navegador.
    </div>

    <div class="cols">
      <section class="card" aria-labelledby="pr-h">
        <h3 id="pr-h">Precio por polo</h3>
        <label class="price"><span>S/</span><input v-model.number="draft.price" type="number" inputmode="decimal" min="1" max="9999" step="1" aria-label="Precio por polo en soles" /></label>
        <p v-if="!priceOk" class="bad" role="alert">Ingresa un precio entre 1 y 9999.</p>
        <p class="hint">Se aplica a los pedidos nuevos. Los pedidos ya hechos conservan su precio.</p>
      </section>

      <section class="card" aria-labelledby="sz-h">
        <h3 id="sz-h">Tallas que ofreces</h3>
        <div class="sizes">
          <button v-for="s in SIZES" :key="s" class="sz" role="switch" :aria-checked="draft.sizes[s] !== false" :class="{ on: draft.sizes[s] !== false }"
                  @click="draft.sizes[s] = draft.sizes[s] === false">
            <b>{{ s }}</b><span>{{ SIZE_TABLE[s as SizeId].chest }} cm</span>
          </button>
        </div>
        <p v-if="!sizesOk" class="bad" role="alert">Deja al menos una talla activa.</p>
        <p class="hint">Una talla desactivada no aparece en la tienda.</p>
      </section>
    </div>

    <section class="card" aria-labelledby="co-h">
      <h3 id="co-h">Colores</h3>
      <ul class="colors">
        <li v-for="(c, i) in draft.colors" :key="c.value" :class="{ off: c.active === false }">
          <label class="pick" :style="{ background: c.value }"><span class="sr">Tono de {{ c.label }}</span>
            <input v-model="c.value" type="color" @change="c.value = c.value.toLowerCase()" /></label>
          <input v-model="c.label" class="nm" maxlength="30" :aria-label="`Nombre del color ${c.label}`" />
          <button class="sw" role="switch" :aria-checked="c.active !== false" :aria-label="`${c.label} visible en la tienda`" :class="{ on: c.active !== false }"
                  @click="c.active = c.active === false">
            <i /><span>{{ c.active === false ? 'Oculto' : 'Visible' }}</span>
          </button>
          <button v-if="!isDefault(c.value)" class="del" :aria-label="`Eliminar ${c.label}`" @click="removeColor(i)"><Icon name="trash" :size="18" /></button>
          <span v-else class="del ph-d" aria-hidden="true" />
        </li>
      </ul>
      <div class="add">
        <label class="pick sm" :style="{ background: newHex }"><span class="sr">Elegir tono</span><input v-model="newHex" type="color" /></label>
        <input v-model="newName" class="nm" maxlength="30" placeholder="Nuevo color (ej. Verde botella)" aria-label="Nombre del nuevo color" @keydown.enter="addColor" />
        <button class="btn btn-ghost" @click="addColor"><Icon name="plus" :size="16" /> Agregar</button>
      </div>
      <p v-if="addError" class="bad" role="alert">{{ addError }}</p>
      <p v-if="!colorsOk" class="bad" role="alert">Deja al menos un color visible.</p>
    </section>

    <section class="card" aria-labelledby="av-h">
      <div class="av-h">
        <h3 id="av-h">Disponibilidad del proveedor <span class="beta">BETA</span></h3>
        <p class="cnt" :class="{ some: outCount }">{{ outCount ? `${outCount} combinaci${outCount === 1 ? 'ón agotada' : 'ones agotadas'}` : 'Todo disponible' }}</p>
      </div>
      <p class="hint">Trabajas a pedido: si tu proveedor no tiene un color en una talla, márcalo como <b>Agotado</b> y la tienda no dejará pedirlo. No lleva conteo de stock.</p>
      <div class="mx-w">
        <table class="mx">
          <colgroup><col class="c0" /><col v-for="s in SIZES" :key="s" /></colgroup>
          <thead>
            <tr>
              <th scope="col" class="corner">Color</th>
              <th v-for="s in SIZES" :key="s" scope="col" :class="{ dis: draft.sizes[s] === false }">
                <button :disabled="draft.sizes[s] === false" :aria-label="`${colAllOut(s) ? 'Marcar disponible' : 'Marcar agotada'} toda la talla ${s}`" @click="toggleCol(s)">{{ s }}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in draft.colors" :key="c.value" :class="{ hid: c.active === false }">
              <th scope="row">
                <button class="rowb" :aria-label="`${rowAllOut(c.value) ? 'Marcar disponible' : 'Marcar agotado'} todo ${c.label}`" @click="toggleRow(c.value)">
                  <i :style="{ background: c.value }" /><span>{{ c.label }}</span>
                </button>
              </th>
              <td v-for="s in SIZES" :key="s">
                <button class="cell" :class="{ out: out(c.value, s) }" :disabled="draft.sizes[s] === false" :aria-pressed="out(c.value, s)"
                        :aria-label="`${c.label}, talla ${s}: ${out(c.value, s) ? 'agotado' : 'disponible'}`" @click="toggleCell(c.value, s)">
                  <Icon :name="out(c.value, s) ? 'x' : 'check'" :size="16" /><span>{{ out(c.value, s) ? 'Agotado' : 'Hay' }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="hint small">Toca el nombre de un color o de una talla para marcar toda la fila o columna.</p>
    </section>

    <div v-if="dirty" class="savebar" role="region" aria-label="Cambios sin guardar">
      <p><b>Sin guardar</b></p>
      <div class="sb-a">
        <button class="btn btn-ghost" :disabled="saving" @click="discard">Descartar</button>
        <button class="btn btn-primary" :disabled="!canSave" @click="save"><span v-if="saving" class="spin" aria-hidden="true" /><Icon v-else name="save" :size="16" /> {{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cat { display: flex; flex-direction: column; gap: 16px; max-width: 980px; padding-bottom: 80px; }
.ph h2 { font-size: 28px; font-weight: 800; letter-spacing: -.02em; }
.ph p { color: var(--txt2); font-size: 14px; margin-top: 2px; }
.warn { display: flex; gap: 8px; align-items: center; padding: 12px 14px; border-color: rgba(255,179,64,.4); color: #ffb340; font-size: 14px; }
.card { background: var(--bg2); border: 1px solid var(--bd); border-radius: 16px; padding: 18px; }
.card h3 { font-size: 15px; font-weight: 700; margin: 0 0 12px; }
.cols { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; align-items: start; }
.hint { font-size: 13px; color: var(--txt2); line-height: 1.5; margin-top: 10px; }
.small { font-size: 12px; color: var(--txt3); }
.bad { color: var(--err); font-size: 13px; margin-top: 8px; }
.price { display: flex; align-items: center; gap: 8px; border: 1px solid var(--bd2); border-radius: 12px; padding: 0 14px; background: var(--bg3); max-width: 200px; }
.price span { color: var(--txt2); font-weight: 700; }
.price input { border: none; background: transparent; min-height: 52px; font-size: 24px; font-weight: 800; width: 100%; padding: 0; font-variant-numeric: tabular-nums; }
.sizes { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
.sz { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 64px; padding: 8px 4px; border: 1px solid var(--bd2); background: var(--bg3); color: var(--txt3); border-radius: 12px; text-decoration: line-through; }
.sz b { font-size: 16px; } .sz span { font-size: 11px; }
.sz.on { color: var(--txt); border-color: var(--ac-dark); background: rgba(34,255,122,.06); text-decoration: none; }
.sz:focus-visible, .sw:focus-visible, .rowb:focus-visible, .cell:focus-visible, .del:focus-visible, .mx th button:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }

.colors { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.colors li { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto 44px; gap: 10px; align-items: center; }
.colors li.off .nm { opacity: .5; }
.pick { position: relative; width: 48px; height: 48px; border-radius: 12px; border: 2px solid var(--bd2); overflow: hidden; cursor: pointer; flex-shrink: 0; }
.pick input { position: absolute; inset: -8px; width: 200%; height: 200%; opacity: 0; cursor: pointer; }
.pick:focus-within { outline: 2px solid var(--ac); outline-offset: 2px; }
.nm { min-height: 48px; }
.sw { display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 10px; border: none; background: transparent; color: var(--txt2); font-size: 13px; font-weight: 600; }
.sw i { width: 40px; height: 24px; border-radius: 12px; background: var(--bd2); position: relative; transition: background .15s; }
.sw i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .15s; }
.sw.on i { background: var(--ok); } .sw.on i::after { transform: translateX(16px); }
.sw.on { color: var(--txt); }
.del { width: 44px; height: 44px; border: none; background: transparent; color: #ff8a8a; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
.del:hover { background: rgba(255,138,138,.1); }
.ph-d { pointer-events: none; }
.add { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 10px; align-items: center; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--bd); }
.add .btn { min-height: 48px; gap: 6px; }

.av-h { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.av-h h3 { margin-bottom: 4px; }
.beta { margin-left: 6px; font-size: 10px; letter-spacing: .08em; padding: 2px 6px; border-radius: 6px; background: rgba(108,180,255,.15); color: #6cb4ff; vertical-align: 2px; }
.cnt { font-size: 13px; color: var(--ok); font-weight: 600; } .cnt.some { color: #ffb340; }
.mx-w { overflow-x: auto; margin: 12px -18px 0; padding: 0 18px; }
.mx { border-collapse: separate; border-spacing: 4px; width: 100%; min-width: 600px; table-layout: fixed; }
.mx col.c0 { width: 138px; }
.mx th { font-weight: 600; font-size: 13px; text-align: center; }
.mx thead th button { width: 100%; min-height: 40px; border: none; background: var(--bg3); color: var(--txt); border-radius: 8px; font-weight: 700; }
.mx th.dis button { opacity: .35; }
.mx .corner { text-align: left; color: var(--txt3); font-size: 12px; position: sticky; left: 0; background: var(--bg2); z-index: 1; }
.mx tbody th { position: sticky; left: 0; background: var(--bg2); z-index: 1; text-align: left; padding: 0; }
.rowb { display: flex; align-items: center; gap: 8px; min-height: 48px; width: 100%; min-width: 128px; padding: 0 8px 0 4px; border: none; background: transparent; color: var(--txt); font-size: 14px; text-align: left; }
.rowb i { width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); flex-shrink: 0; }
.rowb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx tr.hid .rowb { opacity: .45; }
.cell { width: 100%; min-height: 48px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; border: 1px solid rgba(61,220,132,.28); background: rgba(61,220,132,.08); color: #3ddc84; border-radius: 10px; font-size: 11px; font-weight: 700; }
.cell.out { border-color: rgba(255,122,122,.4); background: rgba(255,122,122,.12); color: #ff7a7a; }
.cell:disabled { opacity: .25; }

.savebar { position: fixed; z-index: 90; left: 0; right: 0; bottom: calc(62px + env(safe-area-inset-bottom, 0px)); display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: #1c1c1c; border-top: 1px solid var(--bd2); box-shadow: 0 -10px 30px rgba(0,0,0,.45); }
.savebar p { font-size: 14px; }
.sb-a { display: flex; gap: 8px; }
.sb-a .btn { min-height: 46px; gap: 6px; }
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: spin .7s linear infinite; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (min-width: 961px) { .savebar { left: 240px; bottom: 0; padding: 12px 32px; } }
@media (max-width: 960px) {
  .ph h2 { display: none; }
  .cols { grid-template-columns: 1fr; }
  .colors li { grid-template-columns: 44px minmax(0, 1fr) auto; }
  .colors li .del { grid-column: 3; grid-row: 2; justify-self: end; margin-top: -4px; }
  .colors li:has(.ph-d) .ph-d { display: none; }
  .add { grid-template-columns: 48px minmax(0, 1fr); }
  .add .btn { grid-column: 1 / -1; }
  .pick { width: 44px; height: 44px; }
  .sb-a .btn { padding: 0 14px; }
}
@media (prefers-reduced-motion: reduce) { .sw i, .sw i::after { transition: none; } .spin { animation-duration: 2s; } }
</style>
