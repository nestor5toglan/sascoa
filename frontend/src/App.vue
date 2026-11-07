<script setup lang="ts">
import SalonPreregistration from './components/SalonPreregistration.vue'
import './assets/preregistration.css'
import './assets/lot38.css'
import './assets/lot39.css'
import './assets/lot40.css'
import './assets/lot41.css'
import './assets/lot42.css'
import './assets/lot43.css'
import './assets/lot44.css'
import { nextTick, ref, watch } from 'vue'
import { useSiteMotion } from './composables/useSiteMotion'
import { useRoute } from 'vue-router'
import SiteHeader from './components/layout/SiteHeader.vue'
import SiteFooter from './components/layout/SiteFooter.vue'
const route = useRoute()
const siteRoot = ref<HTMLElement | null>(null)
useSiteMotion(siteRoot, () => route.path)
watch(
  () => route.path,
  async () => {
    await nextTick()
    document.getElementById('page-main')?.focus({ preventScroll: true })
  },
)
</script>

<template>
  <div ref="siteRoot">
    <SiteHeader />
    <main id="page-main" tabindex="-1"><RouterView /></main>
    <SiteFooter /><SalonPreregistration />
  </div>
</template>
