import { driveEnabled, fileToDataUrl, uploadToDrive } from './drive'
import { uploadBase64Image, uploadVoucher } from './imgbb'

export interface AssetInput {
  period: string
  voucher: File | null
  designs: { src: string; label: string }[]
  renders: string[]
  /** contenido de pedido.json (solo Drive) */
  meta: (urls: { designUrls: string[]; renderUrls: string[]; voucherUrl: string; failed: string[] }) => object
}
export interface AssetResult { voucherUrl: string; designUrls: string[]; renderUrls: string[]; folderUrl: string }

const RENDER_NAMES = ['frente', 'espalda', 'derecha', 'izquierda']

/** Ejecuta tareas con concurrencia limitada (Apps Script tolera pocas peticiones simultáneas). */
async function pool<T>(tasks: (() => Promise<T>)[], limit = 3): Promise<T[]> {
  const out: T[] = new Array(tasks.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) { const i = next++; out[i] = await tasks[i]() }
  }))
  return out
}

/**
 * Sube voucher, diseños y renders del pedido.
 * Con VITE_DRIVE_URL → carpeta del pedido en Google Drive. Sin ella → ImgBB (comportamiento anterior).
 * Un fallo de subida nunca cancela la venta: deja el enlace vacío y lo registra.
 */
export async function uploadOrderAssets(orderId: string, a: AssetInput): Promise<AssetResult> {
  if (!driveEnabled) {
    const [voucherUrl, ...rest] = await Promise.all([
      a.voucher ? uploadVoucher(a.voucher) : Promise.resolve(''),
      ...a.designs.map((d, i) => uploadBase64Image(d.src, `${orderId}-design-${i}`)),
      ...a.renders.map((r, i) => uploadBase64Image(r, `${orderId}-render-${RENDER_NAMES[i] ?? i}`)),
    ])
    return { voucherUrl, designUrls: rest.slice(0, a.designs.length), renderUrls: rest.slice(a.designs.length), folderUrl: '' }
  }

  let folderUrl = ''
  const failed: string[] = []
  const up = async (name: string, dataUrl: string): Promise<string> => {
    const r = await uploadToDrive({ orderId, period: a.period, name, dataUrl })
    if (r.folderUrl) folderUrl = r.folderUrl
    if (!r.ok) { failed.push(`${name}: ${r.error}`); console.warn('[drive]', name, r.error); return '' }
    return r.file?.url ?? ''
  }

  const tasks: (() => Promise<string>)[] = []
  tasks.push(async () => (a.voucher ? up('voucher', await fileToDataUrl(a.voucher)) : ''))
  a.designs.forEach((d, i) => tasks.push(async () =>
    d.src.startsWith('data:') ? up(`diseno-${i + 1}-${d.label}`, d.src) : d.src)) // diseños populares: ya son URL del catálogo
  a.renders.forEach((r, i) => tasks.push(() => up(`render-${RENDER_NAMES[i] ?? i}`, r)))

  const urls = await pool(tasks)
  const voucherUrl = urls[0]
  const designUrls = urls.slice(1, 1 + a.designs.length)
  const renderUrls = urls.slice(1 + a.designs.length)

  // pedido.json al final: ya incluye los enlaces y los fallos
  const meta = JSON.stringify(a.meta({ designUrls, renderUrls, voucherUrl, failed }), null, 2)
  await up('pedido.json', `data:application/json;base64,${btoa(unescape(encodeURIComponent(meta)))}`)

  return { voucherUrl, designUrls, renderUrls, folderUrl }
}
