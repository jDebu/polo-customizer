import type { PopularDesign } from '../store/types'

export interface DeliveryRate {
  tier: string
  departments: string[]
  rate: number
}

export const POPULAR_DESIGNS: PopularDesign[] = [
  {
    id: 'cristian-maiden',
    name: 'Cristian Maiden — Run For Your Lives',
    thumbnailUrl: '/designs/thumbs/cristian-maiden.jpg',
    designUrl: '/designs/cristian-maiden.jpg',
    tags: ['rock', 'metal', 'viral'],
  },
  {
    id: 'iron-maiden-fotd',
    name: 'Iron Maiden — Fear of the Dark',
    thumbnailUrl: '/designs/thumbs/iron-maiden-fotd.jpg',
    designUrl: '/designs/iron-maiden-fotd.jpg',
    tags: ['rock', 'metal', 'classic'],
  },
  {
    id: 'tiktok-viral-1',
    name: 'TikTok Viral — Diseño abstracto',
    thumbnailUrl: '/designs/thumbs/tiktok-1.jpg',
    designUrl: '/designs/tiktok-1.jpg',
    tags: ['viral', 'abstract', 'tiktok'],
  },
  {
    id: 'tiktok-viral-2',
    name: 'TikTok Viral — Neon cats',
    thumbnailUrl: '/designs/thumbs/tiktok-2.jpg',
    designUrl: '/designs/tiktok-2.jpg',
    tags: ['viral', 'cute', 'tiktok'],
  },
  {
    id: 'geometric-1',
    name: 'Geométrico Negro',
    thumbnailUrl: '/designs/thumbs/geo-1.jpg',
    designUrl: '/designs/geo-1.jpg',
    tags: ['geometric', 'minimal'],
  },
  {
    id: 'geometric-2',
    name: 'Mandala Neon',
    thumbnailUrl: '/designs/thumbs/geo-2.jpg',
    designUrl: '/designs/geo-2.jpg',
    tags: ['geometric', 'mandala', 'neon'],
  },
]

export const DELIVERY_RATES: DeliveryRate[] = [
  {
    tier: 'Lima Metropolitana',
    departments: ['Lima', 'Callao'],
    rate: 15,
  },
  {
    tier: 'Lima Provincia',
    departments: ['Lima Provincia'],
    rate: 18,
  },
  {
    tier: 'Costa Norte',
    departments: ['Áncash', 'La Libertad', 'Lambayeque', 'Piura', 'Tumbes'],
    rate: 23,
  },
  {
    tier: 'Costa Sur',
    departments: ['Ica', 'Arequipa', 'Moquegua', 'Tacna'],
    rate: 23,
  },
  {
    tier: 'Sierra Centro',
    departments: ['Junín', 'Huancavelica', 'Pasco', 'Huánuco'],
    rate: 27,
  },
  {
    tier: 'Sierra Norte',
    departments: ['Cajamarca', 'Amazonas', 'San Martín'],
    rate: 29,
  },
  {
    tier: 'Sierra Sur',
    departments: ['Cusco', 'Puno', 'Apurímac', 'Ayacucho'],
    rate: 32,
  },
  {
    tier: 'Oriente',
    departments: ['Loreto', 'Ucayali', 'Madre de Dios'],
    rate: 42,
  },
]

export const ALL_DEPARTMENTS = DELIVERY_RATES.flatMap(r => r.departments).sort()

import { reactive } from 'vue'

export interface PoloColor { label: string; value: string; active?: boolean }

export const DEFAULT_COLORS: PoloColor[] = [
  { label: 'Blanco',   value: '#ffffff' },
  { label: 'Negro',    value: '#111111' },
  { label: 'Azul marino', value: '#1a2a4a' },
  { label: 'Rojo',     value: '#cc2222' },
  { label: 'Verde',    value: '#1a5c2a' },
  { label: 'Amarillo', value: '#f0c020' },
  { label: 'Gris',     value: '#888888' },
  { label: 'Granate',  value: '#7a1a2a' },
]

/**
 * Lista viva de colores: la tienda la reemplaza con lo que defina el admin (store/catalog.ts).
 * Los selectores usan solo los `active !== false`; las búsquedas de nombre usan todos
 * (así los pedidos antiguos conservan su color aunque se desactive).
 */
export const POLO_COLORS: PoloColor[] = reactive(DEFAULT_COLORS.map(c => ({ ...c, active: true })))

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
export const PRICE_PER_UNIT = 45
