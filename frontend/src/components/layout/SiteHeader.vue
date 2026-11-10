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
const submenu = ref(false)
function toggleMenu() {
  open.value = !open.value
  if (!open.value) submenu.value = false
}
const submenuButton = ref<HTMLButtonElement | null>(null)
function openOnHover() {
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) submenu.value = true
}
function closeSubmenu() {
  submenu.value = false
  submenuButton.value?.focus()
}
const route = useRoute()
const logo = `${import.meta.env.BASE_URL}brand/sascoa-logo.png`
watch(
  () => route.fullPath,
  () => {
    open.value = false
    submenu.value = false
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
        @click="toggleMenu"
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
        <RouterLink to="/" exact-active-class="active">SASCOA</RouterLink>
        <RouterLink to="/annuaire/" active-class="active">Annuaire</RouterLink>
        <RouterLink to="/salon/" active-class="active">Salon</RouterLink>
        <div
          class="nav-events"
          @mouseenter="openOnHover"
          @mouseleave="submenu = false"
          @keydown.esc.stop="closeSubmenu"
          @focusout="
            (event) => {
              if (
                !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)
              )
                submenu = false
            }
          "
        >
          <div class="nav-events-heading">
            <RouterLink
              to="/evenements/"
              :class="{
                active: ['/evenements/', '/pitch/', '/hackathon/'].includes(route.path),
              }"
              >Autres événements</RouterLink
            >
            <button
              ref="submenuButton"
              type="button"
              class="submenu-toggle"
              :aria-expanded="submenu"
              aria-controls="events-submenu"
              aria-label="Afficher les programmes Pitch et Hackathon"
              @click="submenu = !submenu"
            >
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path
                  d="m5 7.5 5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
          <div v-if="submenu" id="events-submenu" class="events-submenu">
            <RouterLink to="/pitch/" active-class="active">Pitch</RouterLink>
            <RouterLink to="/hackathon/" active-class="active">Hackathon</RouterLink>
          </div>
        </div>
        <RouterLink to="/a-propos/" active-class="active">À propos</RouterLink>
        <RouterLink to="/contact/" active-class="active">Contact</RouterLink>
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
