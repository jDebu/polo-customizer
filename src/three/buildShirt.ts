import * as THREE from 'three'
import {
  ShirtParams, V, armholeCut, armSeam, band, bodyPoint, buildBody, makeRing, stitch, toMetric, Profile
} from './shirtGeometry'

/** Textura de rib para el ribete (solo en modo marcaje). */
function ribTexture() {
  const w = 8, h = 16
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!, d = g.createImageData(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 150 + 90 * Math.sin((y / h) * Math.PI * 4), o = (y * w + x) * 4
    d.data[o] = d.data[o + 1] = d.data[o + 2] = v; d.data[o + 3] = 255
  }
  g.putImageData(d, 0, 0)
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
let texRib: THREE.CanvasTexture | null = null

export function buildShirt(Q: ShirtParams) {
  const P = toMetric(Q)
  const D = Q.detail, hk = D ? 1 : 0.3
  const pf = (pr: Profile): Profile => pr.map(([s, h]) => [s, h * hk])
  if (!texRib) texRib = ribTexture()

  // Three r152+ gestiona el color: el hex se interpreta como sRGB y se convierte solo.
  const col = new THREE.Color(Q.color)
  const line = col.clone().multiplyScalar(0.78)
  const root = new THREE.Group()

  const mk = (m: number, side: THREE.Side, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({
      color: col.clone().multiplyScalar(m), roughness: 0.95, side, wireframe: Q.wire, ...o
    })
  const po = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }
  const mBody = mk(1, THREE.FrontSide)
  const mIn = mk(0.6, THREE.BackSide) // cara interior más oscura: se lee el hueco
  const mBand = D
    ? mk(0.97, THREE.DoubleSide, { bumpMap: texRib, bumpScale: 1.2, wireframe: false, ...po })
    : mk(1, THREE.DoubleSide, { wireframe: false, ...po })
  const mSleeve = mk(1, THREE.FrontSide), mSleeveIn = mk(0.6, THREE.BackSide)
  const mSeam = mk(0.9, THREE.DoubleSide, { wireframe: false })

  const bg = buildBody(P)
  root.add(new THREE.Mesh(bg, mBody), new THREE.Mesh(bg, mIn))

  // Ribete: sigue la curva del escote; su marco S/N sale del propio cuerpo.
  const W = P.bandW
  const neck = makeRing(
    (a) => bodyPoint(a, 1, P), (a, p) => bodyPoint(a, 0.94, P).sub(p).normalize(), 200, V(0, 0.3, 0)
  )
  root.add(band(neck, pf([
    [W, 0.0008], [W * 0.8, 0.0035], [W * 0.4, 0.0045], [0.004, 0.0045], [-0.0005, 0.003],
    [-0.0035, 0], [-0.0005, -0.003], [0.004, -0.0045], [W * 0.9, -0.0045]
  ]), mBand))
  if (D) root.add(stitch(neck, W + 0.004, 0.0009, line))

  // Dobladillo inferior
  const hem = makeRing((a) => bodyPoint(a, 0, P), () => V(0, 1, 0), 200, V(0, 0, 0))
  const hp = pf([[0.034, 0.0006], [0.028, 0.0028], [0.01, 0.0033], [0.001, 0.003], [-0.0015, 0], [0.001, -0.003], [0.02, -0.003]])
  root.add(band(hem, hp, mBand))
  if (D) root.add(stitch(hem, 0.024, 0.0034, line))

  // Costuras laterales (solo marcaje)
  if (D) for (const sg of [-1, 1]) {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 30; k++) { const p = bodyPoint((sg * Math.PI) / 2, (k / 30) * 0.5, P); p.x += sg * 0.0012; pts.push(p) }
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: line })))
  }

  // Mangas con puño
  const ang = (25 * Math.PI) / 180
  const a = V(Math.cos(ang), -Math.sin(ang), 0), st = V(0.15, 0.6, 0), L = 0.2, rS = 0.077, rE = 0.067
  const cyl = new THREE.CylinderGeometry(rE, rS, L, 56, 12, true); cyl.translate(0, L / 2, 0)
  const sl = new THREE.Mesh(cyl, mSleeve)
  sl.add(new THREE.Mesh(cyl, mSleeveIn))
  sl.position.copy(st); sl.rotation.z = -(Math.PI / 2 + ang)
  const end = st.clone().addScaledVector(a, L), e1 = V(0, 0, 1), e2 = V(Math.sin(ang), Math.cos(ang), 0)
  const cuff = makeRing(
    (t) => end.clone().addScaledVector(e1, rE * Math.cos(t)).addScaledVector(e2, rE * Math.sin(t)),
    () => a.clone().negate(), 120, end
  )

  const sam = armSeam(P, st, a, e1, e2, L, rS, rE)
  armholeCut(mBody, st, a, L, rS, rE); armholeCut(mIn, st, a, L, rS, rE)

  const sR = new THREE.Group()
  sR.add(sl, band(cuff, hp, mBand))
  if (D) sR.add(stitch(cuff, 0.022, 0.0034, line))
  if (sam.pts.length > 8) {
    const curve = new THREE.CatmullRomCurve3(sam.pts, sam.closed)
    sR.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.0024, 8, sam.closed), mSeam))
  }
  const sL = sR.clone(); sL.scale.x = -1
  root.add(sR, sL)
  return root
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh
    m.geometry?.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose()
  })
}
