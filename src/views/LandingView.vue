<template>
  <div class="landing">

    <!-- Hero -->
    <section class="hero">
      <div class="hero-bg">
        <div class="hero-glow-r" />
        <div class="hero-glow-g" />
      </div>
      <div class="container hero-content">
        <div class="hero-text">
          <div class="hero-eyebrow">🔥 Estampado de alta calidad</div>
          <h1>Diseña tu polo<br/><span class="red">único.</span></h1>
          <p>
            Sube tu imagen, posiciónala en 3D sobre el polo y recíbelo en casa.
            Envío a todo el Perú · Yape y Plin.
          </p>
          <div class="hero-cta">
            <router-link to="/design" class="btn btn-primary btn-lg">
              🎨 Crear mi polo ahora
            </router-link>
            <a href="#designs" class="btn btn-ghost btn-lg">Ver diseños populares</a>
          </div>
          <div class="hero-stats">
            <div class="stat"><span>⚡</span> Envío express Lima</div>
            <div class="stat"><span>🛡️</span> 100% seguro</div>
            <div class="stat"><span>🎨</span> Calidad premium</div>
          </div>
        </div>
        <div class="hero-preview">
          <div class="polo-preview-box">
            <svg viewBox="0 0 200 240" class="polo-svg" fill="none">
              <!-- T-shirt silhouette -->
              <path d="
                M80,17 Q100,10 120,17 L130,20 Q155,22 182,25
                Q198,33 196,55 Q194,70 180,76
                Q165,82 156,78 L152,72
                L150,210 Q150,218 143,220 L57,220 Q50,218 50,210
                L48,72 L44,78 Q35,82 20,76
                Q6,70 4,55 Q2,33 18,25
                Q45,22 70,20 Z
              " fill="#e84040" stroke="#c02020" stroke-width="1"/>
              <!-- Collar -->
              <path d="M80,17 Q100,10 120,17 Q113,30 100,32 Q87,30 80,17 Z" fill="#b01818"/>
              <!-- Center seam -->
              <line x1="100" y1="32" x2="100" y2="55" stroke="#c02020" stroke-width="1.5" stroke-dasharray="3,2"/>
              <!-- Design area (Cristian Maiden inspired) -->
              <rect x="62" y="55" width="76" height="80" rx="2" fill="rgba(0,0,0,0.3)"/>
              <text x="100" y="98" text-anchor="middle" fill="white" font-size="8" font-weight="bold">YOUR DESIGN</text>
              <text x="100" y="110" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="6">aquí va tu imagen</text>
            </svg>
            <div class="preview-pulse" />
          </div>
        </div>
      </div>
    </section>

    <!-- Features bar -->
    <section class="features-bar">
      <div class="container features-grid">
        <div class="feature">
          <span class="f-icon">📐</span>
          <div>
            <div class="f-title">Visor 3D</div>
            <div class="f-desc">Rota y mueve tu diseño en tiempo real</div>
          </div>
        </div>
        <div class="feature">
          <span class="f-icon">🚚</span>
          <div>
            <div class="f-title">Envío Lima S/15</div>
            <div class="f-desc">Olva Courier, cobertura nacional</div>
          </div>
        </div>
        <div class="feature">
          <span class="f-icon">📱</span>
          <div>
            <div class="f-title">Paga con Yape/Plin</div>
            <div class="f-desc">Rápido, seguro y sin comisión</div>
          </div>
        </div>
        <div class="feature">
          <span class="f-icon">✅</span>
          <div>
            <div class="f-title">Confirmación inmediata</div>
            <div class="f-desc">Te avisamos por Telegram en minutos</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Popular designs -->
    <section class="designs-section" id="designs">
      <div class="container">
        <div class="section-header">
          <h2>Diseños populares</h2>
          <p>Selecciona uno y personaliza el polo directamente</p>
        </div>
        <div class="designs-grid">
          <div
            v-for="d in store.popularDesigns"
            :key="d.id"
            class="design-card card card-hover"
            @click="pickDesign(d.id, d.designUrl, d.thumbnailUrl)"
          >
            <div class="design-thumb">
              <img :src="d.thumbnailUrl" :alt="d.name" @error="onThumbError" />
              <div class="design-overlay">
                <span>Usar este diseño →</span>
              </div>
            </div>
            <div class="design-info">
              <span class="design-name">{{ d.name }}</span>
              <div class="design-tags">
                <span v-for="t in d.tags.slice(0,3)" :key="t" class="tag">{{ t }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- TikTok inspiration -->
    <section class="tiktok-section">
      <div class="container">
        <div class="section-header">
          <h2>Viral en TikTok 🔥</h2>
          <p>Estos diseños están arrasando — úsalos o inspírate</p>
        </div>
        <div class="tiktok-grid">
          <div class="tiktok-embed card">
            <div class="tiktok-placeholder">
              <span class="tiktok-icon">▶</span>
              <p class="bold">@chevichenk</p>
              <p class="mu">Polo Cristian Maiden viral</p>
              <a
                href="https://www.tiktok.com/@chevichenk/video/7698177491541839120"
                target="_blank" rel="noopener"
                class="btn btn-ghost btn-sm mt-16"
              >Ver en TikTok ↗</a>
            </div>
          </div>
          <div class="tiktok-info">
            <h3>¿Viste algo que quieres en tu polo?</h3>
            <p>
              Puedes subir capturas, screenshots de TikTok, fotos de arte o cualquier
              imagen en alta resolución. Nuestro equipo revisa cada pedido para
              garantizar la calidad del estampado.
            </p>
            <ul class="tips-list">
              <li>✓ Mínimo recomendado: 1200 × 1200 px</li>
              <li>✓ Formato: JPG, PNG o WebP</li>
              <li>✓ Fondo transparente (PNG) para mejor resultado</li>
              <li>✓ Colores vibrantes para stampado por calor</li>
            </ul>
            <router-link to="/design" class="btn btn-primary mt-16">
              Empezar mi diseño →
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA final -->
    <section class="cta-section">
      <div class="container text-center">
        <h2>¿Listo para crear tu polo?</h2>
        <p class="mt-8">Solo 4 pasos: diseña → elige talla → paga → recibe.</p>
        <router-link to="/design" class="btn btn-accent btn-lg mt-24">
          🎨 Diseñar ahora — es gratis
        </router-link>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useStore } from '../store/index'

const store = useStore()
const router = useRouter()

function pickDesign(id: string, designUrl: string, _thumb: string) {
  store.setPopularDesign(id, designUrl)
  router.push('/design')
}

function onThumbError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.background = '#333'
  img.style.minHeight = '120px'
}
</script>

<style scoped>
/* ── Hero ──────────────────────────────────────────────── */
.hero {
  position: relative; overflow: hidden;
  padding: 80px 0 60px;
  min-height: 90vh; display: flex; align-items: center;
}
.hero-bg {
  position: absolute; inset: 0; pointer-events: none;
}
.hero-glow-r {
  position: absolute; width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(232,64,64,0.18) 0%, transparent 70%);
  top: -100px; right: -100px; border-radius: 50%;
}
.hero-glow-g {
  position: absolute; width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(34,255,122,0.1) 0%, transparent 70%);
  bottom: -50px; left: -50px; border-radius: 50%;
}
.hero-content {
  display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;
  position: relative; z-index: 1;
}
.hero-eyebrow {
  font-size: 13px; font-weight: 600; color: var(--pr);
  letter-spacing: 0.08em; text-transform: uppercase;
  margin-bottom: 16px;
}
.hero-text h1 { margin-bottom: 20px; }
.hero-text p { font-size: 17px; margin-bottom: 32px; color: var(--txt2); max-width: 440px; }
.hero-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 32px; }
.hero-stats { display: flex; gap: 20px; flex-wrap: wrap; }
.stat {
  font-size: 13px; color: var(--txt2); display: flex; align-items: center; gap: 6px;
}
.stat span { font-size: 16px; }

/* ── Polo preview ────────────────────────────────────────── */
.hero-preview { display: flex; justify-content: center; }
.polo-preview-box {
  position: relative; width: 300px;
  filter: drop-shadow(0 20px 60px rgba(232,64,64,0.3));
}
.polo-svg { width: 100%; height: auto; }
.preview-pulse {
  position: absolute; inset: -20px;
  border-radius: 50%; border: 2px solid rgba(232,64,64,0.2);
  animation: pulse 2.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.05); opacity: 0.1; }
}

/* ── Features bar ────────────────────────────────────────── */
.features-bar {
  border-top: 1px solid var(--bd); border-bottom: 1px solid var(--bd);
  padding: 24px 0; background: var(--bg2);
}
.features-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
}
.feature {
  display: flex; gap: 12px; align-items: flex-start;
}
.f-icon { font-size: 24px; flex-shrink: 0; }
.f-title { font-weight: 600; font-size: 14px; }
.f-desc { font-size: 12px; color: var(--txt2); margin-top: 2px; }

/* ── Popular designs ─────────────────────────────────────── */
.designs-section { padding: 80px 0; }
.section-header { margin-bottom: 40px; }
.section-header h2 { margin-bottom: 8px; }
.section-header p { color: var(--txt2); }
.designs-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px;
}
.design-card { padding: 0; overflow: hidden; cursor: pointer; transition: transform 0.2s; }
.design-card:hover { transform: translateY(-4px); }
.design-thumb {
  position: relative; aspect-ratio: 1; overflow: hidden; background: var(--bg3);
}
.design-thumb img { width: 100%; height: 100%; object-fit: cover; }
.design-overlay {
  position: absolute; inset: 0;
  background: rgba(232,64,64,0.85);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.2s;
}
.design-card:hover .design-overlay { opacity: 1; }
.design-overlay span { color: #fff; font-weight: 600; font-size: 14px; }
.design-info { padding: 12px 14px; }
.design-name { font-size: 13px; font-weight: 500; display: block; margin-bottom: 6px; }
.design-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.tag {
  font-size: 11px; padding: 2px 7px;
  background: var(--bg3); border: 1px solid var(--bd);
  border-radius: 999px; color: var(--txt2);
}

/* ── TikTok section ──────────────────────────────────────── */
.tiktok-section { padding: 80px 0; background: var(--bg2); border-top: 1px solid var(--bd); }
.tiktok-grid {
  display: grid; grid-template-columns: 1fr 1.5fr; gap: 48px; align-items: center;
}
.tiktok-embed { display: flex; align-items: center; justify-content: center; }
.tiktok-placeholder {
  text-align: center; padding: 40px;
}
.tiktok-icon {
  display: block; font-size: 48px; margin-bottom: 16px;
  color: var(--txt3);
}
.tiktok-info h3 { font-size: 1.3rem; margin-bottom: 12px; }
.tiktok-info p { margin-bottom: 16px; }
.tips-list {
  list-style: none; display: flex; flex-direction: column; gap: 8px;
}
.tips-list li { font-size: 14px; color: var(--txt2); }

/* ── CTA section ─────────────────────────────────────────── */
.cta-section {
  padding: 100px 0;
  background: linear-gradient(180deg, transparent, rgba(232,64,64,0.05));
}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 900px) {
  .hero-content { grid-template-columns: 1fr; gap: 40px; }
  .hero-preview { display: none; }
  .features-grid { grid-template-columns: repeat(2, 1fr); }
  .tiktok-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .hero { padding: 60px 0 40px; min-height: auto; }
  .features-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
  .hero-cta { flex-direction: column; }
}
</style>
