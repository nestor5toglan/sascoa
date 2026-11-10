<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
let interval: ReturnType<typeof setInterval> | undefined
async function disconnect() {
  // Le message avant déconnexion préserve le sens de l'action en cas de saisie.
  if (!window.confirm('Se déconnecter ? Les modifications non enregistrées seront perdues.')) return
  if (await auth.signOut()) await router.replace('/administration/connexion')
}
watch(
  () => auth.isAdmin,
  (allowed) => {
    if (!allowed && route.meta.requiresAdmin)
      void router.replace({ path: '/administration/connexion', query: { redirect: route.path } })
  },
)
onMounted(() => {
  interval = setInterval(() => {
    void auth.verifyAccess(true)
  }, 60000)
})
onBeforeUnmount(() => clearInterval(interval))
</script>
<template>
  <section class="admin-shell container">
    <aside class="admin-sidebar" aria-label="Administration">
      <p class="eyebrow">Ton espace SASCOA</p>
      <h1>Administration</h1>
      <p class="admin-identity">
        <strong>{{ auth.profile?.display_name }}</strong
        ><span>{{ auth.profile?.role === 'root' ? 'Développeur racine' : 'Directeur' }}</span>
      </p>
      <nav aria-label="Navigation administration">
        <RouterLink to="/administration/candidatures/pitch" active-class="is-active"
          >Candidatures Pitch ↗</RouterLink
        ><RouterLink to="/administration/candidatures/hackathon" active-class="is-active"
          >Candidatures Hackathon ↗</RouterLink
        >
        <RouterLink to="/administration/exposants" active-class="is-active"
          >Exposants et stands ↗</RouterLink
        >
        <RouterLink to="/administration/partenaires" active-class="is-active"
          >Partenaires ↗</RouterLink
        >
        <RouterLink to="/administration/tableau-de-bord" active-class="is-active"
          >Vue d’ensemble <span aria-hidden="true">↗</span></RouterLink
        ><RouterLink to="/administration/secteurs" active-class="is-active"
          >Secteurs d’activité <span aria-hidden="true">↗</span></RouterLink
        ><RouterLink to="/administration/entreprises" active-class="is-active"
          >Entreprises <span aria-hidden="true">↗</span></RouterLink
        >
        <RouterLink to="/administration/evenements" active-class="is-active"
          >Événements <span aria-hidden="true">↗</span></RouterLink
        >
        <RouterLink to="/administration/preinscriptions" active-class="is-active"
          >Préinscriptions salon <span aria-hidden="true">↗</span></RouterLink
        >
        <RouterLink to="/administration/pages/pitch" active-class="is-active"
          >Page Pitch <span aria-hidden="true">↗</span></RouterLink
        >
        <RouterLink to="/administration/pages/hackathon" active-class="is-active"
          >Page Hackathon <span aria-hidden="true">↗</span></RouterLink
        >
        <RouterLink to="/administration/pages/a-propos" active-class="is-active"
          >Page À propos ↗</RouterLink
        >
        <RouterLink to="/administration/pages/contact" active-class="is-active"
          >Page Contact ↗</RouterLink
        >
        <RouterLink to="/administration/messages" active-class="is-active"
          >Messages reçus ↗</RouterLink
        >
      </nav>
      <RouterLink to="/annuaire/" class="text-link" target="_blank" rel="noopener"
        >Voir l’annuaire public ↗</RouterLink
      >
      <button
        type="button"
        class="button button-outline"
        :disabled="auth.busy || auth.checking"
        @click="disconnect"
      >
        Se déconnecter
      </button>
      <p v-if="auth.checking" role="status">Vérification de l’accès…</p>
      <p v-if="auth.error && auth.isAdmin" class="admin-alert" role="alert">{{ auth.error }}</p>
    </aside>
    <div v-if="auth.isAdmin" class="admin-workspace"><RouterView /></div>
    <p v-else role="status">Vérification de l’accès…</p>
  </section>
</template>
