<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { safeAdminRedirect } from '../lib/adminValidation'
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
async function connect() {
  const secret = password.value
  password.value = ''
  if (await auth.signIn(email.value, secret))
    await router.replace(safeAdminRedirect(route.query.redirect))
}
async function retry() {
  if (await auth.verifyAccess(true)) await router.replace(safeAdminRedirect(route.query.redirect))
}
onMounted(async () => {
  await auth.initialize()
  if (auth.isAdmin) await router.replace(safeAdminRedirect(route.query.redirect))
})
</script>
<template>
  <section class="admin-login container">
    <div class="admin-login-copy">
      <p class="eyebrow">Administration SASCOA</p>
      <h1>Le salon prend vie<br /><em>dans les détails.</em></h1>
      <p>Gère les secteurs et les structures de l’annuaire depuis ton espace réservé.</p>
      <RouterLink to="/" class="text-link">← Revenir au site</RouterLink>
    </div>
    <section class="admin-panel login-panel" aria-labelledby="access-title">
      <p class="eyebrow">Accès réservé</p>
      <h2 id="access-title">Se connecter</h2>
      <p>Utilise ton compte administrateur existant.</p>
      <p v-if="auth.checking" role="status">Vérification de la session…</p>
      <div v-if="auth.error" class="admin-alert" role="alert">
        {{ auth.error
        }}<button
          v-if="auth.sessionPresent && !auth.busy"
          class="text-link"
          type="button"
          @click="retry"
        >
          Vérifier à nouveau
        </button>
      </div>
      <form @submit.prevent="connect">
        <fieldset :disabled="auth.busy || auth.checking" class="admin-fields">
          <div class="field">
            <label for="admin-email">Email</label
            ><input
              id="admin-email"
              v-model="email"
              type="email"
              autocomplete="username"
              required
            />
          </div>
          <div class="field">
            <label for="admin-password">Mot de passe</label
            ><input
              id="admin-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>
          <button type="submit" class="button">
            {{ auth.busy ? 'Connexion…' : 'Se connecter ↗' }}
          </button>
        </fieldset>
      </form>
      <button
        v-if="auth.sessionPresent"
        type="button"
        class="text-link"
        :disabled="auth.busy || auth.checking"
        @click="auth.signOut"
      >
        Se déconnecter de ce compte
      </button>
    </section>
  </section>
</template>
