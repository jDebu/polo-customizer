import rawCsv from '../data/ubigeos.csv?raw'

export interface UbigeoItem {
  code: string
  name: string
}

// ── Code helpers ──────────────────────────────────────────────────────────────
function pad6(code: string): string {
  return code.padStart(6, '0')
}

type Level = 'department' | 'province' | 'district'

function getLevel(code: string): Level {
  const p = pad6(code)
  if (p.slice(-4) === '0000') return 'department'
  if (p.slice(-2) === '00') return 'province'
  return 'district'
}

/** Department code from any child code (strips leading zeros to match CSV keys). */
export function deptCodeOf(code: string): string {
  return String(parseInt(pad6(code).slice(0, 2) + '0000', 10))
}

/** Province code from a district code. */
export function provCodeOf(code: string): string {
  return String(parseInt(pad6(code).slice(0, 4) + '00', 10))
}

// ── Parse CSV once at module load ─────────────────────────────────────────────
const _depts: UbigeoItem[] = []
const _provByDept = new Map<string, UbigeoItem[]>()
const _distByProv = new Map<string, UbigeoItem[]>()

;(function parseCSV() {
  const lines = rawCsv.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = line.split(',')
    if (parts.length < 2) continue
    const code = parts[0].replace(/"/g, '').trim()
    const name = parts[1].replace(/"/g, '').trim()
    if (!code || !name) continue

    const item: UbigeoItem = { code, name }
    const lv = getLevel(code)

    if (lv === 'department') {
      _depts.push(item)
    } else if (lv === 'province') {
      const dk = deptCodeOf(code)
      if (!_provByDept.has(dk)) _provByDept.set(dk, [])
      _provByDept.get(dk)!.push(item)
    } else {
      const pk = provCodeOf(code)
      if (!_distByProv.has(pk)) _distByProv.set(pk, [])
      _distByProv.get(pk)!.push(item)
    }
  }
  _depts.sort((a, b) => a.name.localeCompare(b.name, 'es'))
})()

function sorted(items: UbigeoItem[]): UbigeoItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

// ── Public API (synchronous, no network) ──────────────────────────────────────
export function getDepartments(): UbigeoItem[] {
  return [..._depts]
}

export function getProvinces(deptCode: string): UbigeoItem[] {
  return sorted(_provByDept.get(deptCode) ?? [])
}

export function getDistricts(provCode: string): UbigeoItem[] {
  return sorted(_distByProv.get(provCode) ?? [])
}
