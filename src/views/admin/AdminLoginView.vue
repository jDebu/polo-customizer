<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../../store/index'
import { backendConfigured } from '../../lib/adminApi'
import Icon from '../../components/Icon.vue'

const store = useStore()
const router = useRouter()
const pin = ref('')
const show = ref(false)
const error = ref('')
const busy = ref(false)
const field = ref<HTMLInputElement | null>(null)

onMounted(() => { if (store.isAdmin) router.replace('/admin'); field.value?.focus() })

async function submit() {
  if (busy.value || !pin.value) return
  busy.value = true; error.value = ''
  try {
    if (await store.adminLogin(pin.value)) { router.replace('/admin'); return }
    error.value = 'Clave incorrecta. Revísala e inténtalo de nuevo.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo verificar la clave.'
  } finally {
    busy.value = false
    if (error.value) { pin.value = ''; await nextTick(); field.value?.focus() }
  }
}
</script>

<template>
  <main class="lg">
    <form class="box" @submit.prevent="submit" novalidate>
      <p class="logo">Polo<span>Print</span></p>
      <h1>Panel de administración</h1>
      <p class="d">Ingresa tu clave para ver pedidos y validar pagos.</p>

      <label for="pin">Clave de acceso</label>
      <div class="inp">
        <input id="pin" ref="field" v-model="pin" :type="show ? 'text' : 'password'" autocomplete="current-password" inputmode="text"
               autocapitalize="off" :aria-invalid="!!error" aria-describedby="pin-e" placeholder="••••••" />
        <button type="button" class="eye" :aria-label="show ? 'Ocultar clave' : 'Mostrar clave'" :aria-pressed="show" @click="show = !show"><Icon name="eye" :size="20" /></button>
      </div>
      <p id="pin-e" class="err" role="alert">{{ error }}</p>

      <button class="btn btn-primary btn-lg full" :disabled="busy || !pin">
        <span v-if="busy" class="spin" aria-hidden="true" />{{ busy ? 'Verificando…' : 'Entrar' }}
      </button>
      <p v-if="!backendConfigured" class="demo">Modo local: sin <code>VITE_SHEETS_URL</code> la clave por defecto es <code>1234</code>.</p>
      <router-link to="/" class="back">← Volver a la tienda</router-link>
    </form>
  </main>
</template>

<style scoped>
.lg { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 20px; background: radial-gradient(900px 500px at 50% -10%, rgba(232,64,64,.12), transparent), var(--bg); }
.box { width: 100%; max-width: 400px; background: var(--bg2); border: 1px solid var(--bd); border-radius: 20px; padding: 32px 26px 24px; display: flex; flex-direction: column; }
.logo { font-size: 22px; font-weight: 800; letter-spacing: -.03em; margin-bottom: 18px; }
.logo span { color: var(--pr); }
h1 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
.d { color: var(--txt2); font-size: 14px; margin: 4px 0 20px; }
label { font-size: 13px; color: var(--txt2); margin-bottom: 6px; }
.inp { position: relative; }
.inp input { width: 100%; min-height: 52px; padding: 0 52px 0 14px; font-size: 17px; }
.eye { position: absolute; right: 2px; top: 2px; width: 48px; height: 48px; border: none; background: transparent; color: var(--txt2); border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
.eye[aria-pressed='true'] { color: var(--ac); }
.eye:focus-visible { outline: 2px solid var(--ac); outline-offset: 0; }
.err { min-height: 22px; margin: 6px 0 8px; font-size: 13px; color: var(--err); }
.full { width: 100%; min-height: 54px; gap: 8px; }
.demo { margin-top: 14px; font-size: 12px; color: var(--txt3); }
code { background: var(--bg3); padding: 1px 5px; border-radius: 4px; }
.back { margin-top: 16px; text-align: center; font-size: 13px; color: var(--txt2); min-height: 40px; display: flex; align-items: center; justify-content: center; }
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: spin .7s linear infinite; }
@media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2s; } }
</style>
