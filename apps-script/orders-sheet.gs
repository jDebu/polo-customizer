/**
 * PoloPrint · Pedidos en Google Sheets (v2)
 * ───────────────────────────────────────────────────────────────
 * Reemplaza al script anterior de la hoja. Cambios importantes:
 *  - Escribe cada dato por NOMBRE de columna (ya no depende del orden).
 *  - Las acciones de administrador exigen ADMIN_TOKEN: el PIN ya no está en el JavaScript público
 *    y la lista de pedidos (con DNI y teléfono) deja de ser pública.
 *  - Guarda el catálogo (colores, tallas, precio, disponibilidad) en la pestaña «Catalogo».
 *  - DNI, teléfono y textos se guardan como TEXTO (no pierden ceros ni se interpretan como fórmulas).
 *
 * Propiedades del script (Configuración del proyecto → Propiedades de la secuencia de comandos):
 *   ADMIN_TOKEN   el PIN/clave del administrador (6 o más caracteres)
 *
 * Primera vez: ejecuta setupSheets() una vez desde el editor y acepta los permisos.
 */

const SHEET_NAME = 'Hoja1'          // pestaña de pedidos
const CATALOG_SHEET = 'Catalogo'    // pestaña del catálogo
const ORDER_ID_RE = /^PP-[A-Z0-9]+-[A-Z0-9]{4}$/
const MAX_ROWS = 3000

const HEADERS = [
  'orderId', 'createdAt', 'status', 'statusUpdatedAt', 'estimatedDelivery', 'notes',
  'customerName', 'dni', 'phone',
  'deliveryDept', 'deliveryProv', 'deliveryDist', 'deliveryAddress', 'deliveryRef', 'deliveryRate',
  'size', 'quantity', 'pricePerUnit', 'sleeveType', 'poloColor', 'paymentMethod', 'voucherUrl', 'total',
  'subtotal', 'variants', 'designUrls', 'renderFront', 'renderBack', 'renderRight', 'renderLeft', 'folderUrl',
]
// Columnas numéricas (se pueden sumar). Todas las demás se guardan como texto.
const NUMERIC = ['deliveryRate', 'quantity', 'pricePerUnit', 'total', 'subtotal']
// Nombres antiguos que pudo tener tu hoja
const ALIASES = {
  statusUpdatedAt: ['updatedAt'],
  estimatedDelivery: ['entregaEstimada'],
  notes: ['adminNotes', 'notas'],
}

/* ═════════ Configuración inicial (ejecutar a mano) ═════════ */

function setupSheets() {
  const sh = ordersSheet_()
  ensureHeaders_(sh, true)
  catalogSheet_()
  if (!props_().getProperty('ADMIN_TOKEN')) Logger.log('⚠ Falta la propiedad ADMIN_TOKEN (Configuración del proyecto)')
  Logger.log('Listo. Pestañas «' + SHEET_NAME + '» y «' + CATALOG_SHEET + '» preparadas.')
}

/* ═════════ Web app ═════════ */

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || ''
  if (action === 'catalog') return json_({ ok: true, catalog: readCatalog_() })
  // Antes devolvía TODOS los pedidos a cualquiera con la URL. Ahora no.
  return json_({ ok: true, service: 'poloprint-orders', v: 2 })
}

function doPost(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || ''
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {}

    if (action === 'createOrder') return json_(createOrder_(body)) // la hace el cliente al pagar: sin token

    checkToken_(body.token)
    if (action === 'auth') return json_({ ok: true })
    if (action === 'listOrders') return json_({ ok: true, rows: listOrders_() })
    if (action === 'updateStatus') return json_(updateOrder_(body))
    if (action === 'saveCatalog') return json_({ ok: true, catalog: saveCatalog_(body.catalog) })
    return json_({ ok: false, error: 'Acción desconocida' })
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) })
  }
}

/* ═════════ Pedidos ═════════ */

function createOrder_(d) {
  const id = String(d.orderId || '')
  if (!ORDER_ID_RE.test(id)) throw new Error('orderId inválido')
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const sh = ordersSheet_()
    const headers = ensureHeaders_(sh)
    if (findRow_(sh, headers, id) > 0) return { ok: true, duplicate: true } // reintento: no duplica
    const now = new Date().toISOString()
    const row = headers.map(function (h) {
      const k = aliasOf_(h) || h
      if (k === 'statusUpdatedAt') return now
      if (k === 'status') return 'pending_validation' // nunca confiar en el estado que manda el navegador
      if (k === 'estimatedDelivery' || k === 'notes') return ''
      const v = d[k]
      return v === undefined || v === null ? '' : clip_(v)
    })
    sh.appendRow(row)
    return { ok: true }
  } finally {
    lock.releaseLock()
  }
}

function listOrders_() {
  const sh = ordersSheet_()
  const last = sh.getLastRow()
  if (last < 2) return []
  const headers = headersOf_(sh)
  const from = Math.max(2, last - MAX_ROWS + 1)
  const values = sh.getRange(from, 1, last - from + 1, headers.length).getValues()
  return values.map(function (r) {
    const o = {}
    headers.forEach(function (h, i) {
      const v = r[i]
      o[h] = v instanceof Date ? v.toISOString() : v
    })
    return o
  })
}

function updateOrder_(d) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const sh = ordersSheet_()
    const headers = ensureHeaders_(sh)
    const row = findRow_(sh, headers, String(d.orderId || ''))
    if (row < 0) throw new Error('Pedido no encontrado')
    const set = function (name, value) {
      const c = colOf_(headers, name)
      if (c > 0) sh.getRange(row, c).setValue(value)
    }
    const ALLOWED = ['pending_validation', 'confirmed', 'in_production', 'shipped', 'delivered', 'rejected']
    if (d.status !== undefined) {
      if (ALLOWED.indexOf(d.status) < 0) throw new Error('Estado inválido')
      set('status', d.status)
      set('statusUpdatedAt', new Date().toISOString())
    }
    if (d.estimatedDelivery !== undefined) set('estimatedDelivery', clip_(d.estimatedDelivery))
    if (d.notes !== undefined) set('notes', clip_(d.notes))
    return { ok: true }
  } finally {
    lock.releaseLock()
  }
}

/* ═════════ Catálogo ═════════ */

function readCatalog_() {
  const v = catalogSheet_().getRange('A2').getValue()
  if (!v) return null
  try { return JSON.parse(String(v)) } catch (_) { return null }
}

function saveCatalog_(c) {
  if (!c || typeof c !== 'object') throw new Error('Catálogo inválido')
  const price = Number(c.price)
  if (!(price > 0 && price < 10000)) throw new Error('Precio inválido')
  if (!Array.isArray(c.colors) || c.colors.length < 1 || c.colors.length > 30) throw new Error('Colores inválidos')
  const colors = c.colors.map(function (x) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(x.value))) throw new Error('Color inválido: ' + x.value)
    const label = String(x.label || '').trim().slice(0, 30)
    if (!label) throw new Error('Cada color necesita un nombre')
    return { label: label, value: String(x.value).toLowerCase(), active: x.active !== false }
  })
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const sizes = {}
  SIZES.forEach(function (s) { sizes[s] = !c.sizes || c.sizes[s] !== false })
  if (!SIZES.some(function (s) { return sizes[s] })) throw new Error('Debe quedar al menos una talla activa')
  const unavailable = (Array.isArray(c.unavailable) ? c.unavailable : []).map(String).slice(0, 600)
  const clean = { price: price, colors: colors, sizes: sizes, unavailable: unavailable, updatedAt: new Date().toISOString() }
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try { catalogSheet_().getRange('A2').setValue(JSON.stringify(clean)) } finally { lock.releaseLock() }
  return clean
}

/* ═════════ Seguridad ═════════ */

function checkToken_(t) {
  const real = props_().getProperty('ADMIN_TOKEN')
  if (!real) throw new Error('El servidor no tiene ADMIN_TOKEN configurado')
  const cache = CacheService.getScriptCache()
  const fails = Number(cache.get('fails') || 0)
  if (fails >= 8) throw new Error('Demasiados intentos. Espera 10 minutos.')
  if (String(t || '') !== real) {
    cache.put('fails', String(fails + 1), 600)
    Utilities.sleep(500)
    throw new Error('PIN incorrecto')
  }
  if (fails) cache.remove('fails')
}

/* ═════════ Utilidades ═════════ */

function props_() { return PropertiesService.getScriptProperties() }

function ordersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME)
}

function catalogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sh = ss.getSheetByName(CATALOG_SHEET)
  if (!sh) {
    sh = ss.insertSheet(CATALOG_SHEET)
    sh.getRange('A1').setValue('json (lo escribe el panel admin; no editar a mano)')
    sh.getRange('A2').setNumberFormat('@')
  }
  return sh
}

function headersOf_(sh) {
  const n = sh.getLastColumn()
  if (n < 1) return []
  return sh.getRange(1, 1, 1, n).getValues()[0].map(function (h) { return String(h).trim() })
}

/**
 * Crea la fila de títulos si falta y añade (a la derecha) las columnas nuevas.
 * El formato de texto solo se aplica en setupSheets() o al crear columnas: es lento y no hace falta repetirlo en cada pedido.
 */
function ensureHeaders_(sh, formatAll) {
  let headers = headersOf_(sh).filter(function (h) { return h })
  let touched = !!formatAll
  if (!headers.length) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    headers = HEADERS.slice()
    touched = true
  } else {
    const missing = HEADERS.filter(function (h) {
      return headers.indexOf(h) < 0 && !(ALIASES[h] || []).some(function (a) { return headers.indexOf(a) >= 0 })
    })
    if (missing.length) {
      sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing])
      headers = headers.concat(missing)
      touched = true
    }
  }
  if (touched) {
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold')
    sh.setFrozenRows(1)
    headers.forEach(function (h, i) {
      if (NUMERIC.indexOf(h) < 0) sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@')
    })
  }
  return headers
}

function colOf_(headers, name) {
  let i = headers.indexOf(name)
  if (i < 0) (ALIASES[name] || []).some(function (a) { i = headers.indexOf(a); return i >= 0 })
  return i + 1 // 0 si no existe
}

function aliasOf_(h) {
  for (const k in ALIASES) if (ALIASES[k].indexOf(h) >= 0) return k
  return ''
}

function findRow_(sh, headers, orderId) {
  if (!orderId) return -1
  const col = colOf_(headers, 'orderId')
  const last = sh.getLastRow()
  if (col < 1 || last < 2) return -1
  const ids = sh.getRange(2, col, last - 1, 1).getValues()
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === orderId) return i + 2
  return -1
}

function clip_(v) { return typeof v === 'string' ? v.slice(0, 5000) : v }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
