import type { Mold } from '../data/molds'
import type { PlacedImage } from '../store/types'

/** Caché de imágenes decodificadas: se dibuja síncrono cuando ya están cargadas. */
const cache = new Map<string, HTMLImageElement>()

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src)
  if (hit && hit.complete && hit.naturalWidth) return Promise.resolve(hit)
  return new Promise(resolve => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => { cache.set(src, el); resolve(el) }
    el.onerror = () => resolve(el)
    el.src = src
  })
}

function cached(src: string, onReady?: () => void): HTMLImageElement | null {
  const hit = cache.get(src)
  if (hit && hit.complete && hit.naturalWidth) return hit
  loadImage(src).then(() => onReady?.())
  return null
}

export interface DrawOptions {
  /** píxeles por cm de referencia (talla M) */
  ppc: number
  guides?: boolean
  /** se llama cuando una imagen termina de cargar y hay que redibujar */
  onReady?: () => void
}

/** Dibuja las imágenes de un molde en cm de referencia → píxeles. */
export function drawMold(canvas: HTMLCanvasElement, mold: Mold, images: PlacedImage[], opt: DrawOptions) {
  const ctx = canvas.getContext('2d')!
  const k = opt.ppc
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const img of images) {
    const el = cached(img.src, opt.onReady)
    if (!el) continue
    const s = img.state
    ctx.save()
    ctx.translate((s.x + s.width / 2) * k, (s.y + s.height / 2) * k)
    ctx.rotate((s.rotation * Math.PI) / 180)
    if (s.flipH) ctx.scale(-1, 1)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(el, (-s.width / 2) * k, (-s.height / 2) * k, s.width * k, s.height * k)
    ctx.restore()
  }
  if (opt.guides) {
    ctx.save()
    ctx.strokeStyle = 'rgba(34,255,122,.9)'
    ctx.lineWidth = 0.22 * k
    ctx.setLineDash([0.9 * k, 0.6 * k])
    ctx.strokeRect(0.11 * k, 0.11 * k, canvas.width - 0.22 * k, canvas.height - 0.22 * k)
    ctx.restore()
  }
  void mold
}

/** Exporta el molde a PNG a tamaño físico real. */
export async function renderMoldPng(mold: Mold, images: PlacedImage[], factor: number, dpi: number) {
  await Promise.all(images.map(i => loadImage(i.src)))
  const ppc = (dpi / 2.54) * factor
  const c = document.createElement('canvas')
  c.width = Math.round(mold.limit.w * ppc)
  c.height = Math.round(mold.limit.h * ppc)
  drawMold(c, mold, images, { ppc })
  return c.toDataURL('image/png')
}
