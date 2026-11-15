<template>
  <div class="login-wrap">
    <div class="login-card card">
      <div class="login-logo">Polo<span>Print</span> Admin</div>
      <p class="mu text-center mt-8">Acceso restringido al panel de administración</p>

      <form @submit.prevent="submit" class="login-form mt-24">
        <div class="field">
          <label>PIN de acceso</label>
          <input
            v-model="pin"
            type="password"
            placeholder="••••"
            maxlength="10"
            autofocus
            @input="err = ''"
          />
          <p v-if="err" class="err mt-4">{{ err }}</p>
        </div>
        <button class="btn btn-primary btn-full mt-8" :disabled="!pin || loading">
          {{ loading ? 'Verificando…' : 'Ingresar' }}
        </button>
      </form>

      <p class="mu text-center mt-24" style="font-size:12px">
        El PIN se configura en las variables de entorno del proyecto.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../../store/index'

const store = useStore()
const router = useRouter()
const pin = ref('')
const err = ref('')
const loading = ref(false)

async function submit() {
  loading.value = true
  await new Promise(r => setTimeout(r, 300))
  const ok = store.adminLogin(pin.value)
  loading.value = false
  if (ok) {
    router.replace('/admin')
  } else {
    err.value = 'PIN incorrecto. Intenta de nuevo.'
    pin.value = ''
  }
}
</script>

<style scoped>
.login-wrap {
  display: flex; align-items: center; justify-content: center;
  min-height: calc(100vh - 64px); padding: 24px;
}
.login-card { width: 100%; max-width: 380px; }
.login-logo {
  font-size: 22px; font-weight: 800; letter-spacing: -0.03em;
  text-align: center;
}
.login-logo span { color: var(--pr); }
.login-form { display: flex; flex-direction: column; gap: 4px; }
</style>
