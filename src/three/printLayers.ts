import * as THREE from 'three'
import { MOLD_BY_ID, type Mold, type PanelId } from '../data/molds'
import { SH, TB, bodyPoint, type Metric } from './shirtGeometry'

/** Resolución del lienzo de cada molde para el 3D (px por cm de referencia). */
export const PPC_BODY = 24
export const PPC_SLEEVE = 48
export const ppcOf = (m: Mold) => (m.group === 'body' ? PPC_BODY : PPC_SLEEVE)

const LIFT = 0.0009

export interface SleeveGeo {
  st: THREE.Vector3; a: THREE.Vector3; e1: THREE.Vector3; e2: THREE.Vector3
  L: number; rS: number; rE: number
}
export const SLEEVE_D_TOP = 0.09

function finish(pos: number[], uv: number[], idx: number[]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * LIFT, p.getY(i) + n.getY(i) * LIFT, p.getZ(i) + n.getZ(i) * LIFT)
  return g
}

/**
 * Capa de estampado del torso. La coordenada horizontal es la LONGITUD DE ARCO real
 * sobre la tela, así el diseño no se deforma al girar el polo.
 */
export function bodyPrintGeometry(P: Metric, mold: Mold) {
  const NS = 80, NT = 70, SPAN = 1.0
  const front = mold.id === 'front'
  const cols = 2 * NS + 1
  const pts: THREE.Vector3[][] = []
  for (let j = 0; j <= NT; j++) {
    const t = (TB * j) / NT, row: THREE.Vector3[] = []
    for (let i = -NS; i <= NS; i++) {
      const s = (i / NS) * SPAN
      row.push(bodyPoint(front ? s : Math.PI + s, t, P))
    }
    pts.push(row)
  }
  const { w, h, top } = mold.limit
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let j = 0; j <= NT; j++) {
    const row = pts[j], arc = new Array<number>(cols).fill(0)
    for (let i = NS + 1; i < cols; i++) arc[i] = arc[i - 1] + row[i].distanceTo(row[i - 1])
    for (let i = NS - 1; i >= 0; i--) arc[i] = arc[i + 1] - row[i].distanceTo(row[i + 1])
    for (let i = 0; i < cols; i++) {
      const p = row[i]
      pos.push(p.x, p.y, p.z)
      const moldY = (SH - p.y) * 100 - top
      uv.push((arc[i] * 100 + w / 2) / w, 1 - moldY / h)
    }
  }
  for (let j = 0; j < NT; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1
    idx.push(a, b, c, b, d, c)
  }
  return finish(pos, uv, idx)
}

export function sleevePrintGeometry(sg: SleeveGeo, mold: Mold, mirrorU: boolean) {
  const { w, h } = mold.limit
  const phiC = mold.slot === 'front' ? 0 : mold.slot === 'back' ? Math.PI : Math.PI / 2
  const NJ = 28, NI = 28
  const half = (w / 2 + 1.5) / 100 / sg.rE
  const d0 = SLEEVE_D_TOP - 0.012, d1 = SLEEVE_D_TOP + h / 100 + 0.012
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let j = 0; j <= NJ; j++) {
    const d = d0 + ((d1 - d0) * j) / NJ
    const r = sg.rS + (sg.rE - sg.rS) * (d / sg.L)
    for (let i = 0; i <= NI; i++) {
      const phi = phiC + (-half + (2 * half * i) / NI)
      const p = sg.st.clone().addScaledVector(sg.a, d)
        .addScaledVector(sg.e1, r * Math.cos(phi)).addScaledVector(sg.e2, r * Math.sin(phi))
      pos.push(p.x, p.y, p.z)
      const u = ((phi - phiC) * r * 100 + w / 2) / w
      uv.push(mirrorU ? 1 - u : u, 1 - ((d - SLEEVE_D_TOP) * 100) / h)
    }
  }
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const a = j * (NI + 1) + i, b = a + 1, c = a + NI + 1, d = c + 1
    idx.push(a, c, b, b, c, d)
  }
  return finish(pos, uv, idx)
}

export function printMaterial(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map, transparent: true, roughness: 0.88, metalness: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  })
}

export type PrintTextures = Partial<Record<PanelId, THREE.Texture>>
export { MOLD_BY_ID }
