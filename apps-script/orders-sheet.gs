function doPost(e) {
  const action = e.parameter.action
  const data = JSON.parse(e.postData.contents)
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hoja1')
  // ↑ cambia 'Hoja1' por el nombre real de tu hoja (pestaña inferior)

  if (action === 'createOrder') {
    sheet.appendRow([
      data.orderId, data.createdAt, data.status, new Date().toISOString(),
      '', '',
      data.customerName, data.dni, data.phone,
      data.deliveryDept, data.deliveryProv, data.deliveryDist,
      data.deliveryAddress, data.deliveryRef,
      data.deliveryRate, data.size, data.quantity, data.pricePerUnit,
      data.sleeveType, data.poloColor, data.paymentMethod, data.voucherUrl,
      data.total,
    ])
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  if (action === 'updateStatus') {
    const rows = sheet.getDataRange().getValues()
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.orderId) {
        sheet.getRange(i + 1, 3).setValue(data.status)
        sheet.getRange(i + 1, 4).setValue(new Date().toISOString())
        if (data.estimatedDelivery) sheet.getRange(i + 1, 5).setValue(data.estimatedDelivery)
        if (data.notes) sheet.getRange(i + 1, 6).setValue(data.notes)
        return ContentService.createTextOutput(JSON.stringify({ ok: true }))
          .setMimeType(ContentService.MimeType.JSON)
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'not found' }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unknown action' }))
    .setMimeType(ContentService.MimeType.JSON)
}

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hoja1')
  const rows = sheet.getDataRange().getValues()
  if (rows.length <= 1) return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON)
  const headers = rows[0]
  let data = rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => obj[h] = row[i])
    return obj
  })
  if (e.parameter.status) data = data.filter(r => r.status === e.parameter.status)
  if (e.parameter.from) data = data.filter(r => new Date(r.createdAt) >= new Date(e.parameter.from))
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}
