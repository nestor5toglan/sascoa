<script setup lang="ts">
import { watch } from 'vue'
import { publicExhibitors } from '../services/exhibitors'
import { useRemote } from '../composables/useRemote'
import type { PublicExhibitor } from '../types/exhibitors'
import MediaImage from './ui/MediaImage.vue'
import { safeHttpUrl } from '../lib/presentation'
const props = defineProps<{ eventId: string }>(),
  remote = useRemote<PublicExhibitor[]>([])
const load = () => remote.run(() => publicExhibitors(props.eventId))
watch(
  () => props.eventId,
  () => {
    remote.data.value = []
    void load()
  },
  { immediate: true },
)
</script>
<template>
  <section class="salon-exhibitors" aria-label="Exposants admis">
    <h3>Les exposants du salon</h3>
    <p v-if="remote.loading.value" role="status">Chargement des exposants…</p>
    <div v-else-if="remote.error.value" role="alert">
      <p>Impossible de charger les exposants.</p>
      <button class="button button-outline" @click="load">Réessayer les exposants</button>
    </div>
    <p v-else-if="!remote.data.value.length">
      Les exposants seront annoncés après leur admission par l’organisation.
    </p>
    <div v-else class="expo-public-grid">
      <article v-for="item in remote.data.value" :key="item.id" class="expo-public-card">
        <MediaImage v-if="item.logo_path" :path="item.logo_path" :alt="item.public_name" contain />
        <p v-if="item.is_demo" class="demo-badge">Exposant fictif · démonstration</p>
        <h4>{{ item.public_name }}</h4>
        <p class="tag">Stand {{ item.stand_number }} · {{ item.category_name }}</p>
        <p class="expo-description">{{ item.public_description }}</p>
        <a
          v-if="safeHttpUrl(item.public_website)"
          :href="safeHttpUrl(item.public_website)!"
          target="_blank"
          rel="noopener noreferrer"
          >Visiter le site ↗</a
        >
      </article>
    </div>
  </section>
</template>
