<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
const auth = useAuthStore()
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
function skipToContent() {
  const main = document.getElementById('page-main')
  main?.focus()
  main?.scrollIntoView({ block: 'start' })
}
const open = ref(false)
const route = useRoute()
const logo = `${import.meta.env.BASE_URL}brand/sascoa-logo.png`
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
</script>
<template>
  <a class="skip-link" href="#page-main" @click.prevent="skipToContent">Aller au contenu</a>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand-lockup" aria-label="SASCOA — accueil"
        ><img :src="logo" alt="" width="48" height="48" /><span
          ><strong>SASCOA<span class="brand-dot">.</span></strong
          ><small>Les services en mouvement</small></span
        ></RouterLink
      >
      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="open"
        aria-controls="main-navigation"
        @click="open = !open"
        @keydown.esc="open = false"
      >
        <span>{{ open ? 'Fermer' : 'Menu' }}</span
        ><span aria-hidden="true">{{ open ? '✕' : '☰' }}</span>
      </button>
      <nav
        id="main-navigation"
        :class="{ 'is-open': open }"
        aria-label="Navigation principale"
        @keydown.esc="open = false"
      >
        <RouterLink to="/" exact-active-class="active">Accueil</RouterLink>
        <RouterLink to="/annuaire" active-class="active">L’annuaire</RouterLink>
        <RouterLink to="/salons" active-class="active">Salons & événements</RouterLink>
        <RouterLink to="/pitch" active-class="active">Pitch</RouterLink>
        <RouterLink to="/hackathon" active-class="active">Hackathon</RouterLink
        ><RouterLink to="/a-propos" active-class="active">À propos</RouterLink
        ><RouterLink to="/contact" active-class="active">Contact</RouterLink>
        <RouterLink
          v-if="auth.isAdmin"
          to="/administration"
          class="admin-link"
          active-class="active"
          >Espace admin <span aria-hidden="true">↗</span></RouterLink
        >
      </nav>
    </div>
  </header>
</template>
