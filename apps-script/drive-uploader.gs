/**
 * Polo Customizer · Subida de archivos de pedidos a Google Drive
 * ───────────────────────────────────────────────────────────────
 * Proyecto de Apps Script INDEPENDIENTE del que escribe en la hoja de cálculo.
 *
 * Estructura que crea dentro de tu carpeta raíz (ROOT_FOLDER_ID):
 *   Pedidos/
 *     2026-11/
 *       PP-MIB2K9X-4F7A/
 *         voucher.jpg
 *         diseno-1-frontal.png
 *         render-frente.jpg  render-espalda.jpg  render-derecha.jpg  render-izquierda.jpg
 *         pedido.json
 *
 * Propiedades del script (Configuración del proyecto → Propiedades de la secuencia de comandos):
 *   ROOT_FOLDER_ID  ID de la carpeta raíz (lo escribe crearCarpetaRaiz() o lo pegas tú)
 *   API_TOKEN       texto secreto; el mismo que pones en VITE_DRIVE_TOKEN
 *   PUBLIC_LINKS    "true" (por defecto) = enlace visible para quien lo tenga; "false" = solo tú
 */

const CFG = {
  MAX_BYTES: 5 * 1024 * 1024,          // tamaño máximo por archivo
  MAX_FILES_PER_ORDER: 25,             // evita llenar tu Drive si alguien abusa del endpoint
  TZ: 'America/Lima',
  ALLOWED_IMAGES: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' },
  ORDER_ID_RE: /^PP-[A-Z0-9]+-[A-Z0-9]{4}$/,
  PERIOD_RE: /^\d{4}-(0[1-9]|1[0-2])$/,
}

/* ═════════ Se ejecutan UNA vez a mano desde el editor ═════════ */

/** Opción A (recomendada): crea «Polo Customizer / Pedidos» en Mi unidad y guarda su ID. */
function crearCarpetaRaiz() {
  const app = getOrCreate_(DriveApp.getRootFolder(), 'Polo Customizer')
  const pedidos = getOrCreate_(app, 'Pedidos')
  props_().setProperty('ROOT_FOLDER_ID', pedidos.getId())
  Logger.log('Carpeta raíz lista: ' + pedidos.getUrl())
}

/** Comprueba la configuración y fuerza la pantalla de permisos de Drive. */
function verificarConfiguracion() {
  const p = props_()
  if (!p.getProperty('API_TOKEN')) throw new Error('Falta la propiedad API_TOKEN')
  const id = p.getProperty('ROOT_FOLDER_ID')
  if (!id) throw new Error('Falta ROOT_FOLDER_ID: ejecuta crearCarpetaRaiz() o pega el ID de tu carpeta')
  const f = DriveApp.getFolderById(id)
  Logger.log('OK · carpeta raíz: «' + f.getName() + '» → ' + f.getUrl())
}

/* ═════════ Web app ═════════ */

function doGet() {
  return json_({ ok: true, service: 'polo-drive-uploader' }) // sirve para probar la URL en el navegador
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents)
    const token = props_().getProperty('API_TOKEN')
    if (!token) throw new Error('Servidor sin API_TOKEN configurado')
    if (body.token !== token) throw new Error('No autorizado')

    if (body.action === 'uploadFile') return json_(uploadFile_(body))
    throw new Error('Acción desconocida')
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) })
  }
}

function uploadFile_(b) {
  const orderId = String(b.orderId || '')
  if (!CFG.ORDER_ID_RE.test(orderId)) throw new Error('orderId inválido')
  const period = CFG.PERIOD_RE.test(String(b.period || ''))
    ? b.period
    : Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM')

  const bytes = Utilities.base64Decode(String(b.data || ''))
  if (!bytes.length) throw new Error('Archivo vacío')
  if (bytes.length > CFG.MAX_BYTES) throw new Error('El archivo supera ' + (CFG.MAX_BYTES / 1048576) + ' MB')

  // Formato por contenido real (no por lo que diga el navegador)
  let name = sanitize_(b.name)
  let mime
  if (name === 'pedido.json') {
    JSON.parse(Utilities.newBlob(bytes).getDataAsString()) // lanza error si no es JSON válido
    mime = 'application/json'
  } else {
    mime = detectImage_(bytes)
    if (!mime) throw new Error('Formato no permitido: solo PNG, JPG o WebP')
    name = stripExt_(name) + '.' + CFG.ALLOWED_IMAGES[mime]
  }

  const lock = LockService.getScriptLock() // evita carpetas duplicadas si llegan subidas en paralelo
  lock.waitLock(25000)
  let folder
  try { folder = orderFolder_(period, orderId) } finally { lock.releaseLock() }

  if (countFiles_(folder) >= CFG.MAX_FILES_PER_ORDER) throw new Error('Demasiados archivos en este pedido')

  // Idempotente: si se reintenta, reemplaza el archivo con el mismo nombre
  const same = folder.getFilesByName(name)
  while (same.hasNext()) same.next().setTrashed(true)

  const file = folder.createFile(Utilities.newBlob(bytes, mime, name))
  if (props_().getProperty('PUBLIC_LINKS') !== 'false') {
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW) } catch (_) { /* política del dominio */ }
  }
  const id = file.getId()
  return {
    ok: true,
    folderUrl: folder.getUrl(),
    file: {
      id: id, name: name, size: bytes.length,
      url: 'https://drive.google.com/file/d/' + id + '/view',
      thumb: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600',
    },
  }
}

/* ═════════ Utilidades ═════════ */

function props_() { return PropertiesService.getScriptProperties() }

function orderFolder_(period, orderId) {
  const rootId = props_().getProperty('ROOT_FOLDER_ID')
  if (!rootId) throw new Error('Servidor sin ROOT_FOLDER_ID configurado')
  const month = getOrCreate_(DriveApp.getFolderById(rootId), period)
  return getOrCreate_(month, orderId)
}

function getOrCreate_(parent, name) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}

function countFiles_(folder) {
  let n = 0
  const it = folder.getFiles()
  while (it.hasNext()) { it.next(); n++ }
  return n
}

function sanitize_(s) {
  return String(s || 'archivo').replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'archivo'
}
function stripExt_(n) { return n.replace(/\.[A-Za-z0-9]{1,5}$/, '') }

/** Los bytes de Apps Script son con signo: se enmascara con & 0xff. */
function detectImage_(bytes) {
  const g = function (i) { return bytes[i] & 0xff }
  if (g(0) === 0x89 && g(1) === 0x50 && g(2) === 0x4e && g(3) === 0x47) return 'image/png'
  if (g(0) === 0xff && g(1) === 0xd8 && g(2) === 0xff) return 'image/jpeg'
  if (g(0) === 0x52 && g(1) === 0x49 && g(2) === 0x46 && g(3) === 0x46 &&
      g(8) === 0x57 && g(9) === 0x45 && g(10) === 0x42 && g(11) === 0x50) return 'image/webp'
  return null
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
