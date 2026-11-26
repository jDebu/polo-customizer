/**
 * Cliente del Apps Script de pedidos. Las acciones de admin viajan por POST `text/plain`
 * (petición "simple", sin preflight) y SÍ se lee la respuesta. Cada una lleva el token del admin;
 * el servidor lo compara con la propiedad ADMIN_TOKEN, así el PIN no vive en el JavaScript público.
 */
const URL_ = import.meta.env.VITE_SHEETS_URL ?? ''
export const backendConfigured = !!URL_

export class ApiError extends Error {
  constructor(message: string, public code: 'network' | 'auth' | 'server' = 'server') { super(message) }
}

async function call<T>(action: string, token: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!URL_) throw new ApiError('Falta VITE_SHEETS_URL en .env.local', 'server')
  let res: Response
  try {
    res = await fetch(`${URL_}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token }),
    })
  } catch {
    throw new ApiError('No se pudo conectar con la hoja. Revisa tu internet y que el script esté publicado para «Cualquier persona».', 'network')
  }
  let data: { ok?: boolean; error?: string } & Record<string, unknown>
  try { data = await res.json() } catch { throw new ApiError('Respuesta no válida del script. ¿Publicaste una nueva versión?', 'server') }
  if (!data.ok) throw new ApiError(String(data.error ?? 'Error del servidor'), /autoriz|PIN|token/i.test(String(data.error)) ? 'auth' : 'server')
  return data as T
}

export async function adminAuth(token: string): Promise<boolean> {
  try { await call('auth', token); return true } catch (e) {
    if (e instanceof ApiError && e.code === 'auth') return false
    throw e
  }
}

export async function listOrderRows(token: string): Promise<Record<string, unknown>[]> {
  const r = await call<{ rows: Record<string, unknown>[] }>('listOrders', token)
  return r.rows ?? []
}

export async function updateOrderRow(
  token: string,
  p: { orderId: string; status?: string; notes?: string; estimatedDelivery?: string },
): Promise<void> {
  await call('updateStatus', token, p)
}

export interface CatalogPayload {
  price: number
  colors: { label: string; value: string; active?: boolean }[]
  sizes: Record<string, boolean>
  unavailable: string[]
  updatedAt?: string
}

/** Público (sin token): lo lee la tienda para ocultar colores/tallas agotados. */
export async function fetchCatalog(): Promise<CatalogPayload | null> {
  if (!URL_) return null
  try {
    const res = await fetch(`${URL_}?action=catalog`, { cache: 'no-store' })
    const d = await res.json()
    return d?.ok && d.catalog ? (d.catalog as CatalogPayload) : null
  } catch { return null }
}

export async function saveCatalogRemote(token: string, c: CatalogPayload): Promise<CatalogPayload> {
  const r = await call<{ catalog: CatalogPayload }>('saveCatalog', token, { catalog: c })
  return r.catalog ?? c
}
