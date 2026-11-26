import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_COLORS, POLO_COLORS, PRICE_PER_UNIT, SIZES, type PoloColor } from '../data/catalog'
import { fetchCatalog, type CatalogPayload } from '../lib/adminApi'

const CACHE_KEY = 'pp_catalog_v1'
const HEX = /^#[0-9a-f]{6}$/i

export type CatalogData = {
  price: number
  colors: PoloColor[]
  sizes: Record<string, boolean>
  /** "#hex|TALLA" que el proveedor no tiene (todo lo demás se asume disponible) */
  unavailable: string[]
  updatedAt?: string
}

export const comboKey = (hex: string, size: string) => `${hex.toLowerCase()}|${size}`

export function defaultCatalog(): CatalogData {
  return {
    price: PRICE_PER_UNIT,
    colors: DEFAULT_COLORS.map(c => ({ ...c, active: true })),
    sizes: Object.fromEntries(SIZES.map(s => [s, true])),
    unavailable: [],
  }
}

/** Acepta solo lo que esperamos: el catálogo viene de una hoja editable por humanos. */
export function sanitize(raw: CatalogPayload | null | undefined): CatalogData {
  const d = defaultCatalog()
  if (!raw) return d
  const price = Number(raw.price)
  const colors = Array.isArray(raw.colors)
    ? raw.colors.filter(c => c && HEX.test(String(c.value)) && String(c.label ?? '').trim())
        .slice(0, 30).map(c => ({ label: String(c.label).trim().slice(0, 30), value: String(c.value).toLowerCase(), active: c.active !== false }))
    : []
  return {
    price: price > 0 && price < 10000 ? price : d.price,
    colors: colors.length ? colors : d.colors,
    sizes: Object.fromEntries(SIZES.map(s => [s, raw.sizes?.[s] !== false])),
    unavailable: Array.isArray(raw.unavailable) ? raw.unavailable.map(String).slice(0, 600) : [],
    updatedAt: raw.updatedAt,
  }
}

export const useCatalog = defineStore('catalog', () => {
  const data = ref<CatalogData>(defaultCatalog())
  const loaded = ref(false)

  function apply(d: CatalogData) {
    data.value = d
    POLO_COLORS.splice(0, POLO_COLORS.length, ...d.colors.map(c => ({ ...c })))
  }

  /** Primero lo último guardado en el navegador (arranque inmediato); luego lo vigente en la hoja. */
  async function load() {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) apply(sanitize(JSON.parse(cached)))
    } catch { /* sin caché */ }
    const remote = await fetchCatalog()
    if (remote) {
      const clean = sanitize(remote)
      apply(clean)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(clean)) } catch { /* cuota */ }
    }
    loaded.value = true
  }

  /** Aplica el catálogo y lo deja en la caché local (para el próximo arranque). */
  function commit(d: CatalogData) {
    apply(d)
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)) } catch { /* cuota */ }
  }

  const price = computed(() => data.value.price)
  const colorActive = (hex: string) => data.value.colors.find(c => c.value.toLowerCase() === hex.toLowerCase())?.active !== false
  const sizeActive = (s: string) => data.value.sizes[s] !== false
  const isAvailable = (hex: string, size: string) =>
    colorActive(hex) && sizeActive(size) && !data.value.unavailable.includes(comboKey(hex, size))

  /** Colores que se pueden elegir (activos). */
  const colors = computed(() => data.value.colors.filter(c => c.active !== false))
  const sizes = computed(() => SIZES.filter(s => sizeActive(s)))
  const soldOut = (hex: string) => sizes.value.every(s => !isAvailable(hex, s))

  return { data, loaded, price, colors, sizes, load, apply, commit, colorActive, sizeActive, isAvailable, soldOut }
})
