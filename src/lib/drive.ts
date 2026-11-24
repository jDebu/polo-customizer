/**
 * Cliente del Apps Script que guarda los archivos de cada pedido en Google Drive.
 * Se envía como `text/plain` (petición "simple") para no disparar preflight CORS,
 * igual que sheets.ts, pero aquí SÍ se lee la respuesta para obtener los enlaces.
 */
const DRIVE_URL = import.meta.env.VITE_DRIVE_URL ?? ''
const DRIVE_TOKEN = import.meta.env.VITE_DRIVE_TOKEN ?? ''

export const driveEnabled = !!DRIVE_URL
export const DRIVE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/json']

export interface DriveFile { id: string; name: string; size: number; url: string; thumb: string }
export interface DriveResult { ok: boolean; folderUrl?: string; file?: DriveFile; error?: string; opaque?: boolean }

export function parseDataUrl(d: string): { mime: string; data: string; bytes: number } | null {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(d)
  if (!m) return null
  return { mime: m[1], data: m[2], bytes: Math.floor((m[2].length * 3) / 4) }
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

/** Periodo yyyy-MM en hora de Lima: define la subcarpeta del mes. */
export function limaPeriod(d = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).format(d)
  return p.slice(0, 7)
}

async function send(body: Record<string, unknown>): Promise<DriveResult> {
  const init = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, token: DRIVE_TOKEN }) }
  try {
    const res = await fetch(DRIVE_URL, init)
    return (await res.json()) as DriveResult
  } catch {
    // Si el navegador no deja leer la respuesta, se envía igual y se da por subido sin enlaces.
    await fetch(DRIVE_URL, { ...init, mode: 'no-cors' })
    return { ok: true, opaque: true }
  }
}

export async function uploadToDrive(p: { orderId: string; period: string; name: string; dataUrl: string }): Promise<DriveResult> {
  const parsed = parseDataUrl(p.dataUrl)
  if (!parsed) return { ok: false, error: 'Archivo no válido' }
  if (!ALLOWED.includes(parsed.mime)) return { ok: false, error: 'Formato no permitido (PNG, JPG o WebP)' }
  if (parsed.bytes > DRIVE_MAX_BYTES) return { ok: false, error: 'El archivo supera 5 MB' }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await send({ action: 'uploadFile', orderId: p.orderId, period: p.period, name: p.name, data: parsed.data })
      if (r.ok || attempt === 1) return r
    } catch (e) {
      if (attempt === 1) return { ok: false, error: e instanceof Error ? e.message : 'Error de red' }
    }
  }
  return { ok: false, error: 'No se pudo subir' }
}
