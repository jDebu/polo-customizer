// Prueba local del script con una simulación de Sheets:  node apps-script/test-orders-sheet.js
// Simulación mínima de Apps Script + Sheets para probar la lógica del script
const fs = require('fs')
const src = fs.readFileSync(__dirname + '/orders-sheet.gs', 'utf8')
function makeSheet(){
  const cells = {} // "r,c" -> value
  const fmt = {}
  let maxRows = 1000
  return {
    getLastColumn(){ let m=0; for(const k in cells){ const [r,c]=k.split(',').map(Number); if(r===1) m=Math.max(m,c) } return m },
    getLastRow(){ let m=0; for(const k in cells){ const [r]=k.split(',').map(Number); m=Math.max(m,r) } return m },
    getMaxRows(){ return maxRows },
    setFrozenRows(){}, 
    getRange(r,c,nr=1,nc=1){
      if (typeof r === 'string') { return { setValue(v){ cells['2,1']=v }, getValue(){ return cells[r==='A2'?'2,1':'1,1']||'' }, setNumberFormat(){ return this } } }
      return {
        setValues(v){ v.forEach((row,i)=>row.forEach((x,j)=>cells[`${r+i},${c+j}`]=x)) },
        getValues(){ const out=[]; for(let i=0;i<nr;i++){ const row=[]; for(let j=0;j<nc;j++) row.push(cells[`${r+i},${c+j}`] ?? ''); out.push(row) } return out },
        setValue(v){ cells[`${r},${c}`]=v }, setFontWeight(){ return this }, setNumberFormat(f){ for(let i=0;i<nr;i++) fmt[`${r+i},${c}`]=f; return this },
        getValue(){ return cells[`${r},${c}`] ?? '' },
      }
    },
    appendRow(row){ const r=this.getLastRow()+1; row.forEach((x,j)=>cells[`${r},${j+1}`]=x) },
    _cells: cells, _fmt: fmt,
  }
}
const sheets = {}
const store = { ADMIN_TOKEN: 'secreto123' }
const cache = {}
const ctx = {
  console, Logger: { log: console.log },
  SpreadsheetApp: { getActiveSpreadsheet(){ return { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet()) } } },
  PropertiesService: { getScriptProperties(){ return { getProperty: k => store[k] } } },
  CacheService: { getScriptCache(){ return { get: k => cache[k], put: (k,v)=>{ cache[k]=v }, remove: k=>{ delete cache[k] } } } },
  LockService: { getScriptLock(){ return { waitLock(){}, releaseLock(){} } } },
  Utilities: { sleep(){} },
  ContentService: { createTextOutput: t => ({ t, setMimeType(){ return this } }), MimeType: { JSON: 'json' } },
}
const run = new Function(...Object.keys(ctx), src + `\nreturn { setupSheets, doGet, doPost }`)(...Object.values(ctx))
const post = (action, body) => JSON.parse(run.doPost({ parameter: { action }, postData: { contents: JSON.stringify(body) } }).t)
const get = (action) => JSON.parse(run.doGet({ parameter: { action } }).t)
const assert = (c, m) => { if (!c) { console.log('✗', m); process.exitCode = 1 } else console.log('✓', m) }

run.setupSheets()
assert(Object.keys(sheets).sort().join() === 'Catalogo,Hoja1', 'crea las dos pestañas')
const order = { orderId: 'PP-MWVH38XZ-LIZ5', createdAt: '2026-11-25T03:00:00.000Z', customerName: '=HYPERLINK("x")', dni: '01234567', phone: '938783273', deliveryDept: 'Arequipa', size: 'L Negro ×3 | M Azul ×1', quantity: 4, pricePerUnit: 45, total: 203, paymentMethod: 'yape', voucherUrl: 'https://drive.google.com/file/d/abc/view', variants: '[{"size":"L","color":"#111111","quantity":3}]', status: 'confirmed' }
assert(post('createOrder', order).ok, 'createOrder sin token')
assert(post('createOrder', order).duplicate === true, 'reintento no duplica')
assert(!post('createOrder', { ...order, orderId: 'x' }).ok, 'rechaza orderId inválido')
assert(!post('listOrders', {}).ok, 'listOrders sin token → rechazado')
assert(!post('listOrders', { token: 'mal' }).ok, 'listOrders con token malo → rechazado')
const rows = post('listOrders', { token: 'secreto123' }).rows
assert(rows.length === 1 && rows[0].dni === '01234567', 'conserva el 0 inicial del DNI')
assert(rows[0].status === 'pending_validation', 'ignora el status que manda el cliente')
assert(rows[0].statusUpdatedAt && rows[0].variants.startsWith('['), 'guarda fecha y variantes')
assert(post('updateStatus', { token: 'secreto123', orderId: order.orderId, status: 'confirmed', notes: 'ok' }).ok, 'confirmar pago')
const r2 = post('listOrders', { token: 'secreto123' }).rows[0]
assert(r2.status === 'confirmed' && r2.notes === 'ok', 'el cambio queda en la hoja')
assert(!post('updateStatus', { token: 'secreto123', orderId: order.orderId, status: 'hackeado' }).ok, 'estado inválido rechazado')
assert(!post('updateStatus', { token: 'secreto123', orderId: 'PP-NOEXISTE-AAAA', status: 'confirmed' }).ok, 'pedido inexistente')
assert(get('x').service === 'poloprint-orders' && !get('x').rows, 'doGet ya no expone pedidos')
const cat = { price: 50, colors: [{ label: 'Blanco', value: '#FFFFFF', active: true }, { label: 'Negro', value: '#111111', active: false }], sizes: { XS: false, S: true }, unavailable: ['#111111|M'] }
assert(!post('saveCatalog', { token: 'secreto123', catalog: { ...cat, price: -1 } }).ok, 'precio inválido rechazado')
assert(!post('saveCatalog', { token: 'secreto123', catalog: { ...cat, colors: [{ label: 'x', value: 'rojo' }] } }).ok, 'color inválido rechazado')
assert(post('saveCatalog', { token: 'secreto123', catalog: cat }).ok, 'guarda catálogo')
const c2 = get('catalog').catalog
assert(c2.price === 50 && c2.colors[0].value === '#ffffff' && c2.sizes.XS === false && c2.sizes.M === true, 'catálogo público normalizado')
// bloqueo por intentos
for (let i = 0; i < 9; i++) post('auth', { token: 'x' })
assert(/Demasiados/.test(post('auth', { token: 'secreto123' }).error), 'bloquea tras varios intentos fallidos')
// hoja legacy con nombres antiguos
const sh = sheets['Hoja1']; sh._cells['1,4']='updatedAt'; sh._cells['1,6']='adminNotes'; delete cache.fails
post('createOrder', { ...order, orderId: 'PP-LEGACY-ABCD' })
const h = []; for (let c=1;c<=40;c++){ if(sh._cells['1,'+c]) h.push(sh._cells['1,'+c]) }
assert(h.filter(x=>x==='statusUpdatedAt').length===0 && h.includes('updatedAt'), 'respeta encabezados antiguos (no duplica columnas)')
