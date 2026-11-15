import * as THREE from 'three'

/** Medidas en cm (así las expone la UI). */
export interface ShirtParams {
  dropF: number   // profundidad del escote frontal
  dropB: number   // profundidad del escote posterior
  neckW: number   // semi-ancho del escote
  bandW: number   // ancho del ribete
  color: string
  wire: boolean
  detail: boolean // true = muestra marcaje (ribete, dobladillos, costuras)
}
/** Mismas medidas en metros, para la geometría. */
export interface Metric { dropF: number; dropB: number; neckW: number; bandW: number }

export const toMetric = (q: ShirtParams): Metric => ({
  dropF: q.dropF / 100, dropB: q.dropB / 100, neckW: q.neckW / 100, bandW: q.bandW / 100
})

export const TB = 0.6   // fracción de la malla que es torso recto
export const Y0 = 0.62  // alto del torso recto
export const SH = 0.71  // altura del hombro (punto más alto del escote)

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const sm = (t: number) => t * t * (3 - 2 * t)
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Altura del borde del escote por ángulo (0 = centro frontal, PI = nuca).
 *  La caída vale 0 en el hombro y crece suave hacia ambos lados: sin esquinas. */
function neckY(th: number, P: Metric) {
  const c = Math.cos(th)
  return SH - (c >= 0 ? P.dropF * Math.pow(c, 1.8) : P.dropB * Math.pow(-c, 1.8))
}
/** Altura donde el torso recto empieza a cerrarse (mínimo suave). */
function torsoTop(th: number, P: Metric) {
  const b = neckY(th, P) - 0.025
  return (Y0 + b - Math.sqrt((Y0 - b) ** 2 + 0.0004)) / 2
}

export function bodyPoint(th: number, t: number, P: Metric) {
  const c = Math.cos(th), s = Math.sin(th), yT = torsoTop(th, P)
  if (t <= TB) {
    const k = t / TB, fade = 1 - k, y = yT * k
    const rx = 0.245 + 0.012 * k + 0.008 * fade ** 3
    const rz = 0.122 + 0.008 * k + 0.006 * fade ** 3
    const m = 1 + fade * (0.004 * Math.sin(th * 6 + y * 18) + 0.003 * Math.sin(th * 11 - y * 9))
    return V(rx * m * s, y, rz * m * c)
  }
  const u = (t - TB) / (1 - TB)
  const er = 0.65 * sm(u) + 0.35 * u
  const ey = 1 - Math.pow(1 - u, 1.3)
  const ez = Math.pow(er, 1.5)
  return V(lerp(0.257 * s, P.neckW * s, er), lerp(yT, neckY(th, P), ey), lerp(0.13 * c, 0.115 * c - 0.004, ez))
}

export function buildBody(P: Metric) {
  const NT = 112, NM = 72
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let j = 0; j <= NM; j++) for (let i = 0; i <= NT; i++) {
    const p = bodyPoint((i / NT) * Math.PI * 2, j / NM, P)
    pos.push(p.x, p.y, p.z); uv.push((i / NT) * 36, (j / NM) * 24)
  }
  for (let j = 0; j < NM; j++) for (let i = 0; i < NT; i++) {
    const a = j * (NT + 1) + i, b = a + 1, c = a + NT + 1, d = c + 1
    idx.push(a, b, c, b, d, c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx); g.computeVertexNormals()
  // une la costura de normales en el centro frontal
  const n = g.attributes.normal as THREE.BufferAttribute
  for (let j = 0; j <= NM; j++) {
    const a = j * (NT + 1), b = a + NT
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b)
    const l = Math.hypot(x, y, z) || 1
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l)
  }
  return g
}

/* ---------- Bandas (ribete, dobladillo, puños) ---------- */
export interface Ring { cs: THREE.Vector3[]; fr: { S: THREE.Vector3; N: THREE.Vector3 }[] }
export type Profile = [number, number][]

/** Un anillo = curva + marco local {S: dirección sobre la tela, N: normal exterior}. */
export function makeRing(
  ptFn: (a: number) => THREE.Vector3,
  sFn: (a: number, p: THREE.Vector3) => THREE.Vector3,
  N: number, C: THREE.Vector3
): Ring {
  const cs: THREE.Vector3[] = [], fr: Ring['fr'] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, p = ptFn(a), S = sFn(a, p)
    const T = ptFn(a + 1e-3).sub(ptFn(a - 1e-3)).normalize()
    const Nn = new THREE.Vector3().crossVectors(T, S).normalize()
    if (Nn.dot(p.clone().sub(C)) < 0) Nn.negate()
    cs.push(p); fr.push({ S, N: Nn })
  }
  return { cs, fr }
}

export function band(r: Ring, prof: Profile, mat: THREE.Material) {
  const n = r.cs.length, m = prof.length
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], arc = [0]
  for (let j = 1; j < m; j++) arc.push(arc[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]))
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const c = r.cs[i], f = r.fr[i], s = prof[j][0], h = prof[j][1]
    pos.push(c.x + f.S.x * s + f.N.x * h, c.y + f.S.y * s + f.N.y * h, c.z + f.S.z * s + f.N.z * h)
    uv.push(0, arc[j] / 0.008)
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m - 1; j++) {
    const k = (i + 1) % n, a = i * m + j, b = a + 1, c = k * m + j, d = c + 1
    idx.push(a, b, c, b, d, c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx); g.computeVertexNormals()
  return new THREE.Mesh(g, mat)
}

export function stitch(r: Ring, s: number, h: number, color: THREE.Color) {
  const pts = r.cs.map((c, i) => c.clone().addScaledVector(r.fr[i].S, s).addScaledVector(r.fr[i].N, h))
  const l = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color, dashSize: 0.006, gapSize: 0.003 })
  )
  l.computeLineDistances()
  return l
}

/* ---------- Unión manga–torso ---------- */
function insideBody(p: THREE.Vector3, P: Metric) {
  const k = Math.min(1, p.y / Y0)
  let rx = 0.245 + 0.012 * k
  if (p.y > Y0) {
    const ey = Math.min(1, (p.y - Y0) / (SH - Y0))
    const u = 1 - Math.pow(1 - ey, 1 / 1.3)
    rx = lerp(0.257, P.neckW, 0.65 * sm(u) + 0.35 * u)
  }
  return (p.x / rx) ** 2 + (p.z / (0.122 + 0.008 * k)) ** 2 < 1
}

/** Curva donde la manga sale del cuerpo (se usa para la costura en relieve). */
export function armSeam(
  P: Metric, st: THREE.Vector3, a: THREE.Vector3, e1: THREE.Vector3, e2: THREE.Vector3,
  L: number, rS: number, rE: number
) {
  const pts: THREE.Vector3[] = [], N = 72
  let miss = 0
  for (let i = 0; i < N; i++) {
    const f = (i / N) * Math.PI * 2
    const at = (d: number) => {
      const r = lerp(rS, rE, d / L)
      return st.clone().addScaledVector(a, d).addScaledVector(e1, r * Math.cos(f)).addScaledVector(e2, r * Math.sin(f))
    }
    let lo = 0, hi = -1
    for (let d = 0; d <= L; d += 0.004) { if (!insideBody(at(d), P)) { hi = d; break } lo = d }
    if (hi < 0) { miss++; continue }
    for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (insideBody(at(m), P)) lo = m; else hi = m }
    pts.push(at(hi))
  }
  return { pts, closed: miss === 0 }
}

/** Hueco de la sisa: descarta la tela del torso que queda dentro del tubo de la manga. */
export function armholeCut(
  mat: THREE.Material, st: THREE.Vector3, a: THREE.Vector3, L: number, rS: number, rE: number
) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSt = { value: st }; sh.uniforms.uA = { value: a }
    sh.uniforms.uL = { value: L }; sh.uniforms.uRS = { value: rS }; sh.uniforms.uRE = { value: rE }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform vec3 uSt; uniform vec3 uA; uniform float uL; uniform float uRS; uniform float uRE;')
      .replace('void main() {', `void main() {
  vec3 w = vec3(abs(vWp.x), vWp.y, vWp.z) - uSt; float d = dot(w, uA);
  if (d > 0.0 && d < uL) { float r = mix(uRS, uRE, d / uL); if (length(w - uA * d) < r - 0.001) discard; }`)
  }
}
