const API_KEY = import.meta.env.VITE_IMGBB_KEY ?? ''

export async function uploadBase64Image(base64: string, name: string): Promise<string> {
  if (!API_KEY) {
    console.warn(`[imgbb] No API key — skipping upload for ${name}`)
    return ''
  }
  if (!base64 || !base64.startsWith('data:')) return base64
  const form = new FormData()
  form.append('key', API_KEY)
  form.append('image', base64.split(',')[1])
  form.append('name', name)
  try {
    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form })
    if (!res.ok) throw new Error(`ImgBB ${res.status}`)
    const json = await res.json()
    return json.data.url as string
  } catch (e) {
    console.warn(`[imgbb] Upload failed for ${name}:`, e)
    return ''
  }
}

export async function uploadVoucher(file: File): Promise<string> {
  if (!API_KEY) {
    console.warn('[imgbb] No API key — returning object URL as fallback')
    return URL.createObjectURL(file)
  }
  const base64 = await fileToBase64(file)
  const form = new FormData()
  form.append('key', API_KEY)
  form.append('image', base64.split(',')[1])
  form.append('name', `voucher_${Date.now()}`)
  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`ImgBB upload failed: ${res.status}`)
  const json = await res.json()
  return json.data.url as string
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
