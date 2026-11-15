<template>
  <div class="polo-viewer" ref="container" :class="`mode-${mode}`">

    <!-- Three.js render target -->
    <canvas ref="threeCanvas" class="three-canvas" />

    <!-- 2D design transform overlay (only in image-transform mode) -->
    <div
      v-if="mode === 'transform' && isViewingFront"
      class="transform-overlay"
      ref="overlay"
      @pointermove="onOverlayPointerMove"
      @pointerup="onOverlayPointerUp"
      @pointercancel="onOverlayPointerUp"
    >
      <!-- Print zone guide -->
      <div class="print-zone-guide">
        <span class="pz-label">Zona de estampado</span>
      </div>

      <!-- Draggable design image -->
      <div
        v-if="design.userImageSrc"
        class="design-drag"
        :style="dragStyle"
        @pointerdown.prevent="onDragStart"
      >
        <img :src="design.userImageSrc" class="design-img" draggable="false" />
        <!-- Scale handles (corners) -->
        <div class="handle nw" data-corner="nw" @pointerdown.stop.prevent="onScaleStart($event, 'nw')" />
        <div class="handle ne" data-corner="ne" @pointerdown.stop.prevent="onScaleStart($event, 'ne')" />
        <div class="handle sw" data-corner="sw" @pointerdown.stop.prevent="onScaleStart($event, 'sw')" />
        <div class="handle se" data-corner="se" @pointerdown.stop.prevent="onScaleStart($event, 'se')" />
        <!-- Rotate handle -->
        <div class="rotate-handle" @pointerdown.stop.prevent="onRotateStart">↻</div>
      </div>

      <!-- No-image prompt -->
      <div v-else class="no-image-prompt">
        <span>← Sube tu diseño en el panel</span>
      </div>
    </div>

    <!-- Mode toggle -->
    <div class="mode-toggle">
      <button :class="{ active: mode === 'transform' }" @click="setMode('transform')" title="Mover imagen">
        🖼 Imagen
      </button>
      <button :class="{ active: mode === 'rotate' }" @click="setMode('rotate')" title="Rotar polo">
        🔄 Rotar
      </button>
    </div>

    <!-- Zoom controls -->
    <div class="zoom-btns">
      <button class="zoom-btn" @click="zoomIn" title="Acercar">+</button>
      <button class="zoom-btn" @click="zoomOut" title="Alejar">−</button>
      <button class="zoom-btn" @click="resetView" title="Vista frontal">⌂</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useStore } from '../store/index'
import type { ImageState, InteractionMode } from '../store/types'

const store = useStore()
const { design } = store

// ── Template refs ────────────────────────────────────────────
const container = ref<HTMLDivElement | null>(null)
const threeCanvas = ref<HTMLCanvasElement | null>(null)
const overlay = ref<HTMLDivElement | null>(null)

// ── Three.js objects ─────────────────────────────────────────
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let poloMesh: THREE.Mesh | null = null
let texCanvas: HTMLCanvasElement | null = null
let texCanvasBack: HTMLCanvasElement | null = null
let texture: THREE.CanvasTexture | null = null
let textureBack: THREE.CanvasTexture | null = null
let sidesMat: THREE.MeshStandardMaterial | null = null
let raf: number | null = null
let resizeObserver: ResizeObserver | null = null

// ── Interaction state ─────────────────────────────────────────
const mode = ref<InteractionMode>('transform')
const isViewingFront = ref(true)
let isDragging = false
let dragOffsetX = 0
let dragOffsetY = 0
let dragAction: 'move' | 'scale-nw' | 'scale-ne' | 'scale-sw' | 'scale-se' | 'rotate' | null = null
let dragStartX = 0
let dragStartY = 0
let dragStartState: ImageState | null = null

// ── Overlay/canvas coordinate system ─────────────────────────
// The design image position is stored in px relative to the overlay div.
// Print zone on polo canvas (1024×1200):
//   x: 262–762 (500 px wide, centered), y: 230–780 (550 px tall)
// The print zone in the overlay viewport depends on the polo face scale in Three.js.
// We define a stable mapping based on the default front-facing camera.
const CANVAS_W = 1024
const CANVAS_H = 1200
// Mapping: overlay pixel → polo canvas pixel
// The polo face occupies roughly 72% of the viewport width, centered
// (derived from PlaneGeometry width=2.0, FOV=45, camera z=3.2)
// Polo canvas (1024×1200) maps to viewport polo face area.
// We use the full overlay → canvas mapping for simplicity.
function overlayToCanvas(ox: number, oy: number): [number, number] {
  const w = overlay.value?.clientWidth ?? 400
  const h = overlay.value?.clientHeight ?? 480
  return [
    Math.round((ox / w) * CANVAS_W),
    Math.round((oy / h) * CANVAS_H),
  ]
}
function canvasToOverlay(cx: number, cy: number): [number, number] {
  const w = overlay.value?.clientWidth ?? 400
  const h = overlay.value?.clientHeight ?? 480
  return [Math.round((cx / CANVAS_W) * w), Math.round((cy / CANVAS_H) * h)]
}

// ── Drag style (overlay CSS) ──────────────────────────────────
const dragStyle = computed(() => {
  const s = store.design.frontImageState
  const [ox, oy] = canvasToOverlay(s.x, s.y)
  const [ow, oh] = canvasToOverlay(s.width, s.height)
  return {
    left: `${ox}px`,
    top: `${oy}px`,
    width: `${ow}px`,
    height: `${oh}px`,
    transform: `rotate(${s.rotation}deg)${s.flipH ? ' scaleX(-1)' : ''}`,
  }
})

// ── Polo silhouette geometry builder ────────────────────────
function buildPoloGeo(sleeveType: 'short' | 'long'): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const ny = (v: number) => 1.0 - v

  if (sleeveType === 'short') {
    shape.moveTo(0.4, ny(0.083))
    shape.bezierCurveTo(0.4, ny(0.058), 0.45, ny(0.046), 0.5, ny(0.046))
    shape.bezierCurveTo(0.55, ny(0.046), 0.6, ny(0.058), 0.6, ny(0.083))
    shape.lineTo(0.636, ny(0.096))
    shape.bezierCurveTo(0.675, ny(0.098), 0.715, ny(0.1), 0.742, ny(0.104))
    shape.bezierCurveTo(0.802, ny(0.108), 0.876, ny(0.116), 0.914, ny(0.123))
    shape.bezierCurveTo(0.952, ny(0.133), 0.966, ny(0.158), 0.961, ny(0.191))
    shape.bezierCurveTo(0.958, ny(0.215), 0.948, ny(0.228), 0.93, ny(0.238))
    shape.bezierCurveTo(0.916, ny(0.245), 0.9, ny(0.248), 0.885, ny(0.246))
    shape.bezierCurveTo(0.864, ny(0.243), 0.843, ny(0.231), 0.828, ny(0.218))
    shape.bezierCurveTo(0.818, ny(0.21), 0.808, ny(0.202), 0.796, ny(0.197))
    shape.lineTo(0.783, ny(0.193))
    shape.lineTo(0.773, ny(0.947))
    shape.bezierCurveTo(0.773, ny(0.963), 0.760, ny(0.970), 0.746, ny(0.970))
    shape.lineTo(0.254, ny(0.970))
    shape.bezierCurveTo(0.240, ny(0.970), 0.227, ny(0.963), 0.227, ny(0.947))
    shape.lineTo(0.217, ny(0.193))
    shape.lineTo(0.204, ny(0.197))
    shape.bezierCurveTo(0.192, ny(0.202), 0.182, ny(0.21), 0.172, ny(0.218))
    shape.bezierCurveTo(0.157, ny(0.231), 0.136, ny(0.243), 0.115, ny(0.246))
    shape.bezierCurveTo(0.100, ny(0.248), 0.084, ny(0.245), 0.070, ny(0.238))
    shape.bezierCurveTo(0.052, ny(0.228), 0.042, ny(0.215), 0.039, ny(0.191))
    shape.bezierCurveTo(0.034, ny(0.158), 0.048, ny(0.133), 0.086, ny(0.123))
    shape.bezierCurveTo(0.124, ny(0.116), 0.198, ny(0.108), 0.258, ny(0.104))
    shape.bezierCurveTo(0.285, ny(0.1), 0.325, ny(0.098), 0.364, ny(0.096))
    shape.lineTo(0.4, ny(0.083))
  } else {
    shape.moveTo(0.4, ny(0.083))
    shape.bezierCurveTo(0.4, ny(0.058), 0.45, ny(0.046), 0.5, ny(0.046))
    shape.bezierCurveTo(0.55, ny(0.046), 0.6, ny(0.058), 0.6, ny(0.083))
    shape.lineTo(0.636, ny(0.096))
    shape.bezierCurveTo(0.675, ny(0.098), 0.715, ny(0.1), 0.742, ny(0.104))
    shape.bezierCurveTo(0.802, ny(0.108), 0.886, ny(0.116), 0.924, ny(0.123))
    shape.bezierCurveTo(0.958, ny(0.132), 0.972, ny(0.155), 0.968, ny(0.185))
    shape.bezierCurveTo(0.966, ny(0.4), 0.962, ny(0.6), 0.954, ny(0.78))
    shape.bezierCurveTo(0.948, ny(0.84), 0.94, ny(0.86), 0.924, ny(0.868))
    shape.lineTo(0.864, ny(0.868))
    shape.bezierCurveTo(0.848, ny(0.868), 0.84, ny(0.858), 0.84, ny(0.846))
    shape.bezierCurveTo(0.84, ny(0.835), 0.848, ny(0.826), 0.862, ny(0.825))
    shape.bezierCurveTo(0.874, ny(0.822), 0.882, ny(0.812), 0.884, ny(0.78))
    shape.bezierCurveTo(0.892, ny(0.6), 0.896, ny(0.4), 0.892, ny(0.185))
    shape.bezierCurveTo(0.89, ny(0.168), 0.882, ny(0.16), 0.866, ny(0.16))
    shape.lineTo(0.783, ny(0.193))
    shape.lineTo(0.773, ny(0.947))
    shape.bezierCurveTo(0.773, ny(0.963), 0.760, ny(0.970), 0.746, ny(0.970))
    shape.lineTo(0.254, ny(0.970))
    shape.bezierCurveTo(0.240, ny(0.970), 0.227, ny(0.963), 0.227, ny(0.947))
    shape.lineTo(0.217, ny(0.193))
    shape.lineTo(0.134, ny(0.16))
    shape.bezierCurveTo(0.118, ny(0.16), 0.110, ny(0.168), 0.108, ny(0.185))
    shape.bezierCurveTo(0.104, ny(0.4), 0.108, ny(0.6), 0.116, ny(0.78))
    shape.bezierCurveTo(0.118, ny(0.812), 0.126, ny(0.822), 0.138, ny(0.825))
    shape.bezierCurveTo(0.152, ny(0.826), 0.160, ny(0.835), 0.160, ny(0.846))
    shape.bezierCurveTo(0.160, ny(0.858), 0.152, ny(0.868), 0.136, ny(0.868))
    shape.lineTo(0.076, ny(0.868))
    shape.bezierCurveTo(0.060, ny(0.868), 0.052, ny(0.858), 0.046, ny(0.846))
    shape.bezierCurveTo(0.038, ny(0.84), 0.032, ny(0.825), 0.046, ny(0.78))
    shape.bezierCurveTo(0.038, ny(0.6), 0.034, ny(0.4), 0.032, ny(0.185))
    shape.bezierCurveTo(0.028, ny(0.155), 0.042, ny(0.132), 0.076, ny(0.123))
    shape.bezierCurveTo(0.114, ny(0.116), 0.198, ny(0.108), 0.258, ny(0.104))
    shape.bezierCurveTo(0.285, ny(0.1), 0.325, ny(0.098), 0.364, ny(0.096))
    shape.lineTo(0.4, ny(0.083))
  }

  // Shape coords are in [0,1]×[0,1]; depth in same units before Z-scale
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false })
  // Scale to Three.js world units and center at origin
  geo.scale(2.0, 2.4, 1.0)
  geo.translate(-1.0, -1.2, -0.07)

  // Three.js adds bottom cap (z=0 → -0.07 after translate = back) first in group 0,
  // top cap (z=depth → +0.07 = front) second. Split them for separate textures.
  const capGroup = geo.groups.find(g => g.materialIndex === 0)
  const wallGroup = geo.groups.find(g => g.materialIndex === 1)
  if (capGroup) {
    const half = capGroup.count / 2
    geo.clearGroups()
    geo.addGroup(capGroup.start, half, 0)             // bottom cap → mat[0] = backMat
    geo.addGroup(capGroup.start + half, half, 1)      // top cap    → mat[1] = frontMat
    if (wallGroup) geo.addGroup(wallGroup.start, wallGroup.count, 2) // walls → mat[2] = sidesMat
  }

  return geo
}

// ── Three.js init ─────────────────────────────────────────────
function initThree() {
  if (!threeCanvas.value || !container.value) return

  const W = container.value.clientWidth
  const H = container.value.clientHeight

  renderer = new THREE.WebGLRenderer({ canvas: threeCanvas.value, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W, H)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)

  camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
  camera.position.set(0, 0, 3.2)

  // Lighting — fabric-friendly three-point
  const ambient = new THREE.AmbientLight(0xffffff, 0.55)
  scene.add(ambient)
  const key = new THREE.DirectionalLight(0xfff5e0, 0.9)
  key.position.set(2, 3, 4)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xddeeff, 0.3)
  fill.position.set(-3, 0, 2)
  scene.add(fill)

  // Front texture canvas
  texCanvas = document.createElement('canvas')
  texCanvas.width = CANVAS_W
  texCanvas.height = CANVAS_H
  texture = new THREE.CanvasTexture(texCanvas)
  texture.colorSpace = THREE.SRGBColorSpace

  // Back texture canvas
  texCanvasBack = document.createElement('canvas')
  texCanvasBack.width = CANVAS_W
  texCanvasBack.height = CANVAS_H
  textureBack = new THREE.CanvasTexture(texCanvasBack)
  textureBack.colorSpace = THREE.SRGBColorSpace

  // ExtrudeGeometry from polo silhouette — correct shirt profile from all angles
  const geo = buildPoloGeo(design.sleeveType)

  const frontMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.88,
    metalness: 0.0,
    transparent: true,
    alphaTest: 0.08,
  })
  const backMat = new THREE.MeshStandardMaterial({
    map: textureBack,
    roughness: 0.88,
    metalness: 0.0,
    transparent: true,
    alphaTest: 0.08,
  })
  sidesMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(design.poloColor),
    roughness: 0.9,
    metalness: 0.0,
  })
  // mat[0]=backMat (bottom cap z=-0.07), mat[1]=frontMat (top cap z=+0.07), mat[2]=sidesMat
  poloMesh = new THREE.Mesh(geo, [backMat, frontMat, sidesMat])
  scene.add(poloMesh)

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableZoom = true
  controls.minDistance = 1.8
  controls.maxDistance = 6
  controls.minPolarAngle = Math.PI * 0.28
  controls.maxPolarAngle = Math.PI * 0.72
  controls.minAzimuthAngle = -Infinity
  controls.maxAzimuthAngle = Infinity
  controls.dampingFactor = 0.08
  controls.enableDamping = true
  controls.enabled = mode.value === 'rotate'

  // Track front vs back for overlay visibility
  controls.addEventListener('change', () => {
    if (!controls) return
    const az = Math.abs(controls.getAzimuthalAngle() % (2 * Math.PI))
    const normalised = az > Math.PI ? 2 * Math.PI - az : az
    isViewingFront.value = normalised < Math.PI * 0.6
  })

  // Resize observer
  resizeObserver = new ResizeObserver(() => onResize())
  resizeObserver.observe(container.value!)

  drawPolo()
  animate()
}

function animate() {
  raf = requestAnimationFrame(animate)
  controls?.update()
  renderer?.render(scene!, camera!)
}

function onResize() {
  if (!container.value || !renderer || !camera) return
  const W = container.value.clientWidth
  const H = container.value.clientHeight
  camera.aspect = W / H
  camera.updateProjectionMatrix()
  renderer.setSize(W, H)
}

// ── Polo canvas drawing ───────────────────────────────────────
function drawPolo() {
  drawFront()
  drawBack()
}

function drawFront() {
  if (!texCanvas) return
  const ctx = texCanvas.getContext('2d')!
  const W = CANVAS_W, H = CANVAS_H

  ctx.clearRect(0, 0, W, H)

  drawPoloPath(ctx, W, H)
  ctx.fillStyle = design.poloColor
  ctx.fill()

  drawFabricTexture(ctx, W, H)
  drawBodyShadows(ctx, W, H)
  drawCollar(ctx, W, H)
  drawSeams(ctx, W, H)

  if (mode.value !== 'transform' && design.userImageSrc) {
    drawDesignImage(ctx, W, H)
  }

  if (texture) texture.needsUpdate = true
}

function drawBack() {
  if (!texCanvasBack) return
  const ctx = texCanvasBack.getContext('2d')!
  const W = CANVAS_W, H = CANVAS_H

  ctx.clearRect(0, 0, W, H)

  // Mirror canvas so back face reads correctly from behind
  ctx.save()
  ctx.translate(W, 0)
  ctx.scale(-1, 1)

  drawPoloPath(ctx, W, H)
  ctx.fillStyle = design.poloColor
  ctx.fill()

  drawFabricTexture(ctx, W, H)
  drawBodyShadows(ctx, W, H)

  // Back collar — same band but no button placket
  const darkerColor = adjustColor(design.poloColor, -0.18)
  ctx.beginPath()
  ctx.moveTo(W * 0.4, H * 0.083)
  ctx.bezierCurveTo(W * 0.4, H * 0.058, W * 0.45, H * 0.046, W * 0.5, H * 0.046)
  ctx.bezierCurveTo(W * 0.55, H * 0.046, W * 0.6, H * 0.058, W * 0.6, H * 0.083)
  ctx.bezierCurveTo(W * 0.6, H * 0.1, W * 0.555, H * 0.11, W * 0.5, H * 0.11)
  ctx.bezierCurveTo(W * 0.445, H * 0.11, W * 0.4, H * 0.1, W * 0.4, H * 0.083)
  ctx.closePath()
  ctx.fillStyle = darkerColor
  ctx.fill()

  drawSeams(ctx, W, H)

  ctx.restore()

  if (textureBack) textureBack.needsUpdate = true
}

function drawPoloPath(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const { sleeveType } = design
  ctx.beginPath()
  if (sleeveType === 'short') {
    drawShortSleevePath(ctx, W, H)
  } else {
    drawLongSleevePath(ctx, W, H)
  }
}

function drawShortSleevePath(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const x = (n: number) => n * W
  const y = (n: number) => n * H

  ctx.moveTo(x(0.4), y(0.083))
  // Collar curve (round neck)
  ctx.bezierCurveTo(x(0.4), y(0.058), x(0.45), y(0.046), x(0.5), y(0.046))
  ctx.bezierCurveTo(x(0.55), y(0.046), x(0.6), y(0.058), x(0.6), y(0.083))
  // Right collar side
  ctx.lineTo(x(0.636), y(0.096))
  // Right shoulder
  ctx.bezierCurveTo(x(0.675), y(0.098), x(0.715), y(0.1), x(0.742), y(0.104))
  // Right sleeve top outer
  ctx.bezierCurveTo(x(0.802), y(0.108), x(0.876), y(0.116), x(0.914), y(0.123))
  // Outer sleeve curve
  ctx.bezierCurveTo(x(0.952), y(0.133), x(0.966), y(0.158), x(0.961), y(0.191))
  ctx.bezierCurveTo(x(0.958), y(0.215), x(0.948), y(0.228), x(0.93), y(0.238))
  // Sleeve end
  ctx.bezierCurveTo(x(0.916), y(0.245), x(0.9), y(0.248), x(0.885), y(0.246))
  // Sleeve inner curve
  ctx.bezierCurveTo(x(0.864), y(0.243), x(0.843), y(0.231), x(0.828), y(0.218))
  ctx.bezierCurveTo(x(0.818), y(0.21), x(0.808), y(0.202), x(0.796), y(0.197))
  // Right armhole → body
  ctx.lineTo(x(0.783), y(0.193))
  // Right body side
  ctx.lineTo(x(0.773), y(0.947))
  // Right hem
  ctx.bezierCurveTo(x(0.773), y(0.963), x(0.760), y(0.970), x(0.746), y(0.970))
  ctx.lineTo(x(0.254), y(0.970))
  // Left hem
  ctx.bezierCurveTo(x(0.240), y(0.970), x(0.227), y(0.963), x(0.227), y(0.947))
  // Left body side
  ctx.lineTo(x(0.217), y(0.193))
  // Left armhole
  ctx.lineTo(x(0.204), y(0.197))
  ctx.bezierCurveTo(x(0.192), y(0.202), x(0.182), y(0.21), x(0.172), y(0.218))
  ctx.bezierCurveTo(x(0.157), y(0.231), x(0.136), y(0.243), x(0.115), y(0.246))
  // Left sleeve end
  ctx.bezierCurveTo(x(0.100), y(0.248), x(0.084), y(0.245), x(0.070), y(0.238))
  ctx.bezierCurveTo(x(0.052), y(0.228), x(0.042), y(0.215), x(0.039), y(0.191))
  ctx.bezierCurveTo(x(0.034), y(0.158), x(0.048), y(0.133), x(0.086), y(0.123))
  // Left sleeve outer → left shoulder
  ctx.bezierCurveTo(x(0.124), y(0.116), x(0.198), y(0.108), x(0.258), y(0.104))
  ctx.bezierCurveTo(x(0.285), y(0.1), x(0.325), y(0.098), x(0.364), y(0.096))
  ctx.lineTo(x(0.4), y(0.083))
  ctx.closePath()
}

function drawLongSleevePath(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const x = (n: number) => n * W
  const y = (n: number) => n * H

  ctx.moveTo(x(0.4), y(0.083))
  ctx.bezierCurveTo(x(0.4), y(0.058), x(0.45), y(0.046), x(0.5), y(0.046))
  ctx.bezierCurveTo(x(0.55), y(0.046), x(0.6), y(0.058), x(0.6), y(0.083))
  ctx.lineTo(x(0.636), y(0.096))
  ctx.bezierCurveTo(x(0.675), y(0.098), x(0.715), y(0.1), x(0.742), y(0.104))
  // Right sleeve outer (long — goes all the way down with slight taper)
  ctx.bezierCurveTo(x(0.802), y(0.108), x(0.886), y(0.116), x(0.924), y(0.123))
  ctx.bezierCurveTo(x(0.958), y(0.132), x(0.972), y(0.155), x(0.968), y(0.185))
  // Long sleeve descends
  ctx.bezierCurveTo(x(0.966), y(0.4), x(0.962), y(0.6), x(0.954), y(0.78))
  ctx.bezierCurveTo(x(0.948), y(0.84), x(0.94), y(0.86), x(0.924), y(0.868))
  // Right sleeve end (cuff)
  ctx.lineTo(x(0.864), y(0.868))
  ctx.bezierCurveTo(x(0.848), y(0.868), x(0.84), y(0.858), x(0.84), y(0.846))
  ctx.bezierCurveTo(x(0.84), y(0.835), x(0.848), y(0.826), x(0.862), y(0.825))
  // Right sleeve inner (back up)
  ctx.bezierCurveTo(x(0.874), y(0.822), x(0.882), y(0.812), x(0.884), y(0.78))
  ctx.bezierCurveTo(x(0.892), y(0.6), x(0.896), y(0.4), x(0.892), y(0.185))
  ctx.bezierCurveTo(x(0.89), y(0.168), x(0.882), y(0.16), x(0.866), y(0.16))
  // Right armhole → body
  ctx.lineTo(x(0.783), y(0.193))
  ctx.lineTo(x(0.773), y(0.947))
  ctx.bezierCurveTo(x(0.773), y(0.963), x(0.760), y(0.970), x(0.746), y(0.970))
  ctx.lineTo(x(0.254), y(0.970))
  ctx.bezierCurveTo(x(0.240), y(0.970), x(0.227), y(0.963), x(0.227), y(0.947))
  ctx.lineTo(x(0.217), y(0.193))
  // Left armhole/sleeve join
  ctx.lineTo(x(0.134), y(0.16))
  ctx.bezierCurveTo(x(0.118), y(0.16), x(0.110), y(0.168), x(0.108), y(0.185))
  ctx.bezierCurveTo(x(0.104), y(0.4), x(0.108), y(0.6), x(0.116), y(0.78))
  ctx.bezierCurveTo(x(0.118), y(0.812), x(0.126), y(0.822), x(0.138), y(0.825))
  ctx.bezierCurveTo(x(0.152), y(0.826), x(0.160), y(0.835), x(0.160), y(0.846))
  ctx.bezierCurveTo(x(0.160), y(0.858), x(0.152), y(0.868), x(0.136), y(0.868))
  ctx.lineTo(x(0.076), y(0.868))
  ctx.bezierCurveTo(x(0.060), y(0.868), x(0.052), y(0.858), x(0.046), y(0.846))
  ctx.bezierCurveTo(x(0.038), y(0.84), x(0.032), y(0.825), x(0.046), y(0.78))
  ctx.bezierCurveTo(x(0.038), y(0.6), x(0.034), y(0.4), x(0.032), y(0.185))
  ctx.bezierCurveTo(x(0.028), y(0.155), x(0.042), y(0.132), x(0.076), y(0.123))
  ctx.bezierCurveTo(x(0.114), y(0.116), x(0.198), y(0.108), x(0.258), y(0.104))
  ctx.bezierCurveTo(x(0.285), y(0.1), x(0.325), y(0.098), x(0.364), y(0.096))
  ctx.lineTo(x(0.4), y(0.083))
  ctx.closePath()
}

function drawFabricTexture(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Subtle diagonal lines to simulate fabric weave
  ctx.save()
  ctx.globalAlpha = 0.045
  drawPoloPath(ctx, W, H)
  ctx.clip()
  ctx.strokeStyle = isLightColor(design.poloColor) ? '#000' : '#fff'
  ctx.lineWidth = 1.2
  for (let i = -H; i < W + H; i += 7) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + H, H)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBodyShadows(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save()
  drawPoloPath(ctx, W, H)
  ctx.clip()

  // Left edge shadow
  const lgL = ctx.createLinearGradient(0, 0, W * 0.28, 0)
  lgL.addColorStop(0, 'rgba(0,0,0,0.30)')
  lgL.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lgL
  ctx.fillRect(0, 0, W * 0.28, H)

  // Right edge shadow
  const lgR = ctx.createLinearGradient(W, 0, W * 0.72, 0)
  lgR.addColorStop(0, 'rgba(0,0,0,0.30)')
  lgR.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lgR
  ctx.fillRect(W * 0.72, 0, W * 0.28, H)

  // Top highlight
  const lgT = ctx.createLinearGradient(0, 0, 0, H * 0.22)
  lgT.addColorStop(0, 'rgba(255,255,255,0.18)')
  lgT.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = lgT
  ctx.fillRect(0, 0, W, H * 0.22)

  ctx.restore()
}

function drawCollar(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const darkerColor = adjustColor(design.poloColor, -0.18)
  ctx.save()

  // Collar fill (polo collar band)
  ctx.beginPath()
  ctx.moveTo(W * 0.4, H * 0.083)
  ctx.bezierCurveTo(W * 0.4, H * 0.058, W * 0.45, H * 0.046, W * 0.5, H * 0.046)
  ctx.bezierCurveTo(W * 0.55, H * 0.046, W * 0.6, H * 0.058, W * 0.6, H * 0.083)
  // Inner collar (creates the band thickness)
  ctx.bezierCurveTo(W * 0.6, H * 0.1, W * 0.555, H * 0.11, W * 0.5, H * 0.11)
  ctx.bezierCurveTo(W * 0.445, H * 0.11, W * 0.4, H * 0.1, W * 0.4, H * 0.083)
  ctx.closePath()
  ctx.fillStyle = darkerColor
  ctx.fill()

  // Collar ribbing lines
  ctx.strokeStyle = adjustColor(design.poloColor, -0.28)
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.7
  for (let i = 0; i < 6; i++) {
    const t = i / 5
    const cx = W * (0.4 + t * 0.2)
    const cy = H * 0.075
    ctx.beginPath()
    ctx.moveTo(cx, cy - 15)
    ctx.lineTo(cx, cy + 15)
    ctx.stroke()
  }

  // Button placket (center front)
  ctx.globalAlpha = 1
  ctx.strokeStyle = adjustColor(design.poloColor, -0.22)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W * 0.5, H * 0.11)
  ctx.lineTo(W * 0.5, H * 0.2)
  ctx.stroke()

  ctx.restore()
}

function drawSeams(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save()
  drawPoloPath(ctx, W, H)
  ctx.clip()

  ctx.strokeStyle = adjustColor(design.poloColor, -0.12)
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.globalAlpha = 0.6

  // Side seams
  ctx.beginPath()
  ctx.moveTo(W * 0.227, H * 0.197)
  ctx.lineTo(W * 0.234, H * 0.967)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(W * 0.773, H * 0.197)
  ctx.lineTo(W * 0.766, H * 0.967)
  ctx.stroke()

  // Shoulder seams
  ctx.beginPath()
  ctx.moveTo(W * 0.364, H * 0.096)
  ctx.bezierCurveTo(W * 0.345, H * 0.14, W * 0.3, H * 0.17, W * 0.217, H * 0.193)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(W * 0.636, H * 0.096)
  ctx.bezierCurveTo(W * 0.655, H * 0.14, W * 0.7, H * 0.17, W * 0.783, H * 0.193)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.restore()
}

function drawDesignImage(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const s = design.frontImageState
  if (!design.userImageSrc) return

  const img = new Image()
  img.onload = () => {
    ctx.save()
    ctx.translate(s.x + s.width / 2, s.y + s.height / 2)
    ctx.rotate((s.rotation * Math.PI) / 180)
    if (s.flipH) ctx.scale(-1, 1)
    ctx.drawImage(img, -s.width / 2, -s.height / 2, s.width, s.height)
    ctx.restore()
    if (texture) texture.needsUpdate = true
  }
  img.src = design.userImageSrc
}

// ── Color utilities ───────────────────────────────────────────
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

function adjustColor(hex: string, amount: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n))
  const r = clamp(parseInt(hex.slice(1, 3), 16) + Math.round(amount * 255))
  const g = clamp(parseInt(hex.slice(3, 5), 16) + Math.round(amount * 255))
  const b = clamp(parseInt(hex.slice(5, 7), 16) + Math.round(amount * 255))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ── Interaction: mode toggle ──────────────────────────────────
function setMode(m: InteractionMode) {
  mode.value = m
  store.setInteractionMode(m)
  if (controls) controls.enabled = m === 'rotate'
  drawPolo()
}

// ── Interaction: image drag ───────────────────────────────────
function onDragStart(e: PointerEvent) {
  if (!overlay.value) return
  isDragging = true
  dragAction = 'move'
  const rect = overlay.value.getBoundingClientRect()
  const overlayX = e.clientX - rect.left
  const overlayY = e.clientY - rect.top
  const s = store.design.frontImageState
  const [ix] = canvasToOverlay(s.x, s.y)
  const [, iy] = canvasToOverlay(s.x, s.y)
  dragOffsetX = overlayX - ix
  dragOffsetY = overlayY - iy
  dragStartState = { ...s }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onScaleStart(e: PointerEvent, corner: string) {
  if (!overlay.value) return
  isDragging = true
  dragAction = `scale-${corner}` as typeof dragAction
  const rect = overlay.value.getBoundingClientRect()
  dragStartX = e.clientX - rect.left
  dragStartY = e.clientY - rect.top
  dragStartState = { ...store.design.frontImageState }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onRotateStart(e: PointerEvent) {
  if (!overlay.value) return
  isDragging = true
  dragAction = 'rotate'
  const rect = overlay.value.getBoundingClientRect()
  dragStartX = e.clientX - rect.left
  dragStartY = e.clientY - rect.top
  dragStartState = { ...store.design.frontImageState }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onOverlayPointerMove(e: PointerEvent) {
  if (!isDragging || !dragStartState || !overlay.value) return
  const rect = overlay.value.getBoundingClientRect()
  const ox = e.clientX - rect.left
  const oy = e.clientY - rect.top

  if (dragAction === 'move') {
    const [cx, cy] = overlayToCanvas(ox - dragOffsetX, oy - dragOffsetY)
    store.updateFrontImageState({ x: cx, y: cy })
  } else if (dragAction?.startsWith('scale-')) {
    const dx = ox - dragStartX
    const dy = oy - dragStartY
    const delta = (dx + dy) * (CANVAS_W / (overlay.value.clientWidth))
    const newW = Math.max(60, dragStartState.width + delta)
    const newH = Math.max(60, dragStartState.height + delta)
    store.updateFrontImageState({ width: newW, height: newH })
  } else if (dragAction === 'rotate') {
    const s = dragStartState
    const [cx, cy] = canvasToOverlay(s.x + s.width / 2, s.y + s.height / 2)
    const startAngle = Math.atan2(dragStartY - cy, dragStartX - cx)
    const curAngle = Math.atan2(oy - cy, ox - cx)
    const delta = ((curAngle - startAngle) * 180) / Math.PI
    store.updateFrontImageState({ rotation: s.rotation + delta })
  }

  drawPolo()
}

function onOverlayPointerUp() {
  isDragging = false
  dragAction = null
  dragStartState = null
}

// ── Camera controls ───────────────────────────────────────────
function zoomIn() {
  if (!camera) return
  camera.position.multiplyScalar(0.85)
}
function zoomOut() {
  if (!camera) return
  camera.position.multiplyScalar(1.18)
}
function resetView() {
  if (!camera || !controls) return
  camera.position.set(0, 0, 3.2)
  controls.target.set(0, 0, 0)
  controls.update()
}

// ── Watchers ──────────────────────────────────────────────────
watch(() => store.design.poloColor, (newColor) => {
  if (sidesMat) sidesMat.color.set(new THREE.Color(newColor))
  drawPolo()
})
watch(() => store.design.sleeveType, () => {
  if (poloMesh) {
    poloMesh.geometry.dispose()
    poloMesh.geometry = buildPoloGeo(store.design.sleeveType)
  }
  drawPolo()
})
watch(
  () => store.design.userImageSrc,
  () => nextTick(drawPolo),
)
watch(
  () => store.design.frontImageState,
  () => { if (mode.value !== 'transform') drawPolo() },
  { deep: true },
)

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()
  initThree()
})

onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
  renderer?.dispose()
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.polo-viewer {
  position: relative; width: 100%; height: 100%;
  background: #1a1a1a; border-radius: 12px; overflow: hidden;
  user-select: none;
}

.three-canvas {
  display: block; width: 100%; height: 100%;
}

/* ── Overlay ──────────────────────────────────────────────── */
.transform-overlay {
  position: absolute; inset: 0;
  cursor: default;
}

.print-zone-guide {
  position: absolute;
  left: 29%; top: 22%; width: 42%; height: 40%;
  border: 2px dashed rgba(34,255,122,0.5);
  border-radius: 4px;
  pointer-events: none;
}
.pz-label {
  position: absolute; top: -22px; left: 0;
  font-size: 11px; color: rgba(34,255,122,0.7); font-weight: 500;
  white-space: nowrap;
}

.design-drag {
  position: absolute; cursor: grab;
  min-width: 40px; min-height: 40px;
  transform-origin: center center;
}
.design-drag:active { cursor: grabbing; }
.design-img {
  width: 100%; height: 100%; object-fit: contain;
  pointer-events: none; display: block;
}

/* Scale handles */
.handle {
  position: absolute; width: 12px; height: 12px;
  background: #fff; border: 2px solid var(--pr, #e84040);
  border-radius: 2px; z-index: 10;
}
.handle.nw { top: -6px; left: -6px; cursor: nw-resize; }
.handle.ne { top: -6px; right: -6px; cursor: ne-resize; }
.handle.sw { bottom: -6px; left: -6px; cursor: sw-resize; }
.handle.se { bottom: -6px; right: -6px; cursor: se-resize; }

/* Rotate handle */
.rotate-handle {
  position: absolute; top: -32px; left: 50%; transform: translateX(-50%);
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(232,64,64,0.9); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; cursor: grab; z-index: 10;
}

.no-image-prompt {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  pointer-events: none; text-align: center;
}
.no-image-prompt span {
  color: rgba(255,255,255,0.35); font-size: 14px;
}

/* ── Mode toggle ────────────────────────────────────────────── */
.mode-toggle {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 4px;
  background: rgba(0,0,0,0.6); border: 1px solid #333;
  border-radius: 999px; padding: 4px;
  backdrop-filter: blur(8px);
}
.mode-toggle button {
  padding: 6px 14px; border: none; border-radius: 999px;
  font-size: 12px; font-weight: 600; color: #aaa;
  background: transparent; transition: all 0.2s; cursor: pointer;
}
.mode-toggle button.active {
  background: #e84040; color: #fff;
}

/* ── Zoom controls ───────────────────────────────────────────── */
.zoom-btns {
  position: absolute; right: 12px; bottom: 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.zoom-btn {
  width: 32px; height: 32px; border: 1px solid #444;
  background: rgba(0,0,0,0.6); color: #fff;
  border-radius: 6px; font-size: 16px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(8px); transition: background 0.2s;
}
.zoom-btn:hover { background: rgba(232,64,64,0.7); }

/* Mode-specific cursor */
.mode-rotate .three-canvas { cursor: grab; }
.mode-rotate .three-canvas:active { cursor: grabbing; }
.mode-transform .three-canvas { cursor: default; }
</style>
