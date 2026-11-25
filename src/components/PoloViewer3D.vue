<template>
  <div class="polo-viewer" ref="container">
    <canvas ref="threeCanvas" class="three-canvas" aria-label="Vista previa 3D del polo" />

    <div class="viewer-tools">
      <button class="vt" :class="{ on: guides }" :aria-pressed="guides" title="Guía del molde" @click="guides = !guides">
        <Icon name="grid" /> Guía
      </button>
    </div>
    <div class="zoom-btns">
      <button class="zoom-btn" @click="zoom(0.85)" aria-label="Acercar"><Icon name="plus" /></button>
      <button class="zoom-btn" @click="zoom(1.18)" aria-label="Alejar"><Icon name="minus" /></button>
      <button class="zoom-btn" @click="resetView" aria-label="Restablecer vista"><Icon name="reset" /></button>
    </div>
    <p class="viewer-hint">Arrastra para girar · rueda para acercar</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useStore } from '../store/index'
import { MOLDS, type PanelId } from '../data/molds'
import { buildShirt, disposeObject } from '../three/buildShirt'
import { ppcOf, type PrintTextures } from '../three/printLayers'
import { drawMold } from '../lib/moldCanvas'
import Icon from './Icon.vue'

const store = useStore()
const container = ref<HTMLDivElement | null>(null)
const threeCanvas = ref<HTMLCanvasElement | null>(null)
const guides = ref(false)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let shirt: THREE.Group | null = null
let raf = 0
let resizeObserver: ResizeObserver | null = null

/* ── Lienzos de estampado: uno por molde, en cm de referencia ─ */
const prints = {} as Record<PanelId, { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }>

function initPrintTextures() {
  for (const m of MOLDS) {
    const canvas = document.createElement('canvas')
    const k = ppcOf(m)
    canvas.width = Math.round(m.limit.w * k)
    canvas.height = Math.round(m.limit.h * k)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 4
    prints[m.id] = { canvas, tex }
  }
}

let redrawQueued = false
function redrawPrints(withGuides = guides.value) {
  for (const m of MOLDS) {
    const p = prints[m.id]
    drawMold(p.canvas, m, store.design.placedImages.filter(i => i.panel === m.id), {
      ppc: ppcOf(m),
      guides: withGuides && m.id === store.design.activePanel,
      onReady: queueRedraw,
    })
    p.tex.needsUpdate = true
  }
}
function queueRedraw() {
  if (redrawQueued) return
  redrawQueued = true
  requestAnimationFrame(() => { redrawQueued = false; redrawPrints() })
}

/* ── Cámara: vuelos suaves ───────────────────────────────── */
type Pose = { az: number; el: number; r: number; tx: number; ty: number; tz: number }
const HOME: Pose = { az: 0, el: 0.06, r: 1.9, tx: 0, ty: 0.36, tz: 0 }
const POSES: Record<PanelId, Pose> = {
  front: HOME,
  back: { ...HOME, az: Math.PI },
  'left-front':  { az: -0.55, el: 0.12, r: 1.15, tx: -0.3, ty: 0.5, tz: 0.04 },
  'left-back':   { az: Math.PI + 0.55, el: 0.12, r: 1.15, tx: -0.3, ty: 0.5, tz: -0.04 },
  'left-side':   { az: -1.15, el: 0.75, r: 1.1, tx: -0.3, ty: 0.55, tz: 0 },
  'right-front': { az: 0.55, el: 0.12, r: 1.15, tx: 0.3, ty: 0.5, tz: 0.04 },
  'right-back':  { az: Math.PI - 0.55, el: 0.12, r: 1.15, tx: 0.3, ty: 0.5, tz: -0.04 },
  'right-side':  { az: 1.15, el: 0.75, r: 1.1, tx: 0.3, ty: 0.55, tz: 0 },
}
let fly: Pose | null = null

function currentPose(): Pose {
  const t = controls!.target, off = camera!.position.clone().sub(t)
  const r = off.length()
  return { az: Math.atan2(off.x, off.z), el: Math.asin(off.y / r), r, tx: t.x, ty: t.y, tz: t.z }
}
function stepFly() {
  if (!fly || !camera || !controls) return
  const c = currentPose(), k = 0.14
  const d = ((((fly.az - c.az + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
  const az = c.az + d * k, el = c.el + (fly.el - c.el) * k, r = c.r + (fly.r - c.r) * k
  const tx = c.tx + (fly.tx - c.tx) * k, ty = c.ty + (fly.ty - c.ty) * k, tz = c.tz + (fly.tz - c.tz) * k
  controls.target.set(tx, ty, tz)
  camera.position.set(tx + r * Math.sin(az) * Math.cos(el), ty + r * Math.sin(el), tz + r * Math.cos(az) * Math.cos(el))
  if (Math.abs(d) < 0.003 && Math.abs(fly.r - r) < 0.003 && Math.abs(fly.el - el) < 0.003) fly = null
}

/* ── Three.js init ───────────────────────────────────────── */
function initThree() {
  if (!threeCanvas.value || !container.value) return
  const W = container.value.clientWidth || 640, H = container.value.clientHeight || 760

  renderer = new THREE.WebGLRenderer({ canvas: threeCanvas.value, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W, H, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1a)

  camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 20)
  camera.position.set(0, 0.36, 1.9)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6f747e, 0.5 * Math.PI))
  const keyL = new THREE.DirectionalLight(0xffffff, 0.9 * Math.PI); keyL.position.set(1.5, 2, 2.5); scene.add(keyL)
  const fillL = new THREE.DirectionalLight(0xffffff, 0.3 * Math.PI); fillL.position.set(-2, 1, 1.5); scene.add(fillL)
  const backL = new THREE.DirectionalLight(0xffffff, 0.4 * Math.PI); backL.position.set(0, 1.5, -2.5); scene.add(backL)

  const shC = document.createElement('canvas'); shC.width = shC.height = 128
  const shG = shC.getContext('2d')!
  const gr = shG.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
  shG.fillStyle = gr; shG.fillRect(0, 0, 128, 128)
  const shTex = new THREE.CanvasTexture(shC); shTex.colorSpace = THREE.SRGBColorSpace
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }))
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.04; scene.add(floor)

  initPrintTextures()
  rebuildShirt()
  redrawPrints()

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.36, 0)
  controls.enablePan = false
  controls.minDistance = 0.5
  controls.maxDistance = 4.0
  controls.minPolarAngle = Math.PI * 0.08
  controls.maxPolarAngle = Math.PI * 0.92
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.addEventListener('start', () => { fly = null })
  controls.update()

  resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(container.value)
  animate()
}

function rebuildShirt() {
  if (!scene) return
  if (shirt) { scene.remove(shirt); disposeObject(shirt) }
  const tex: PrintTextures = {}
  for (const m of MOLDS) tex[m.id] = prints[m.id].tex
  shirt = buildShirt({ dropF: 11.5, dropB: 3, neckW: 10, bandW: 3, color: store.design.poloColor, wire: false, detail: false }, tex)
  shirt.scale.setScalar(store.factor)
  scene.add(shirt)
}

function animate() {
  raf = requestAnimationFrame(animate)
  stepFly()
  controls?.update()
  renderer?.render(scene!, camera!)
}

function onResize() {
  if (!container.value || !renderer || !camera) return
  const W = container.value.clientWidth, H = container.value.clientHeight
  if (!W || !H) return
  camera.aspect = W / H
  camera.updateProjectionMatrix()
  renderer.setSize(W, H, false)
}

function zoom(f: number) {
  if (!camera || !controls) return
  fly = null
  const dir = camera.position.clone().sub(controls.target).multiplyScalar(f)
  camera.position.copy(controls.target.clone().add(dir))
}
function resetView() { fly = { ...POSES[store.design.activePanel] } }

/* ── Watchers ────────────────────────────────────────────── */
watch(() => store.design.poloColor, rebuildShirt)
watch(() => store.factor, f => { shirt?.scale.setScalar(f) })
watch(() => store.design.placedImages, () => redrawPrints(), { deep: true })
watch(guides, () => redrawPrints())
watch(() => store.design.activePanel, (p) => { fly = { ...POSES[p] }; redrawPrints() })

onMounted(async () => { await nextTick(); initThree() })

/* ── Capturas para el pedido ─────────────────────────────── */
async function captureViews(): Promise<string[]> {
  if (!renderer || !scene || !camera || !controls) return []
  const saved = currentPose()
  const prevSize = renderer.getSize(new THREE.Vector2()), prevAspect = camera.aspect, prevPR = renderer.getPixelRatio()
  // Tamaño fijo: la captura sale igual aunque el visor esté oculto o en una pantalla pequeña
  renderer.setPixelRatio(1); renderer.setSize(720, 860, false)
  camera.aspect = 720 / 860; camera.updateProjectionMatrix()
  redrawPrints(false)
  const shots: string[] = []
  for (const az of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    controls.target.set(0, 0.36, 0)
    camera.position.set(Math.sin(az) * 1.9, 0.36 + 0.1, Math.cos(az) * 1.9)
    camera.lookAt(controls.target)
    renderer.render(scene, camera)
    shots.push(renderer.domElement.toDataURL('image/jpeg', 0.88))
  }
  renderer.setPixelRatio(prevPR); renderer.setSize(prevSize.x, prevSize.y, false)
  camera.aspect = prevAspect; camera.updateProjectionMatrix()
  controls.target.set(saved.tx, saved.ty, saved.tz)
  camera.position.set(
    saved.tx + saved.r * Math.sin(saved.az) * Math.cos(saved.el),
    saved.ty + saved.r * Math.sin(saved.el),
    saved.tz + saved.r * Math.cos(saved.az) * Math.cos(saved.el),
  )
  controls.update()
  redrawPrints()
  return shots
}
defineExpose({ captureViews })

onUnmounted(() => {
  cancelAnimationFrame(raf)
  if (shirt) disposeObject(shirt)
  Object.values(prints).forEach(p => p.tex.dispose())
  controls?.dispose()
  renderer?.dispose()
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.polo-viewer { position: relative; width: 100%; height: 100%; min-height: 0; background: #1a1a1a; border-radius: var(--radius-lg); overflow: hidden; user-select: none; }
.three-canvas { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
.three-canvas:active { cursor: grabbing; }

.viewer-tools { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; }
.vt, .zoom-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid #3a3a3a; background: rgba(13,13,13,.78); color: #eee;
  border-radius: 8px; font-size: 12px; font-weight: 600; transition: background .18s, border-color .18s, color .18s;
}
.vt { height: 32px; padding: 0 12px; }
.vt.on { border-color: var(--ac-dark); color: var(--ac); }
.zoom-btn { width: 32px; height: 32px; }
.vt:hover, .zoom-btn:hover { background: rgba(40,40,40,.95); border-color: #555; }
.vt:focus-visible, .zoom-btn:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.zoom-btns { position: absolute; right: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.viewer-hint { position: absolute; left: 14px; bottom: 12px; font-size: 11px; color: #777; pointer-events: none; }
@media (max-width: 960px) {
  .viewer-hint { display: none; }
  .zoom-btn, .vt { width: 40px; height: 40px; }
  .vt { width: auto; padding: 0 12px; }
  .zoom-btns { bottom: 12px; right: 12px; }
}
</style>
