<script setup lang="ts">
import ProgramApplicationForm from '../components/ProgramApplicationForm.vue'
import ContactPanel from '../components/ContactPanel.vue'
import { computed, onMounted, watch } from 'vue'
import { getPublicEditorial } from '../services/editorial'
import { useRemote } from '../composables/useRemote'
import type { EditorialPage, EditorialSlug } from '../types/admin'
import PageArtwork from '../components/PageArtwork.vue'
import RichContent from '../components/ui/RichContent.vue'
import MediaImage from '../components/ui/MediaImage.vue'
import ResultState from '../components/ui/ResultState.vue'
const props = defineProps<{ slug: EditorialSlug }>()
const name = computed(
  () =>
    ({ pitch: 'Pitch', hackathon: 'Hackathon', contact: 'Contact', 'a-propos': 'À propos' })[
      props.slug
    ],
)
const remote = useRemote<EditorialPage | null>(null)
const load = () => remote.run(() => getPublicEditorial(props.slug))
const content = computed(() => (remote.data.value?.slug === props.slug ? remote.data.value : null))
watch(() => props.slug, load)
onMounted(load)
</script>
<template>
  <section class="page-intro container internal-hero">
    <div class="internal-hero-copy">
      <p class="eyebrow">SASCOA · {{ name }}</p>
      <h1>{{ content?.title || name }}<span class="title-dot">.</span></h1>
      <p v-if="content?.summary">{{ content.summary }}</p>
    </div>
    <PageArtwork :variant="slug" />
  </section>
  <section
    v-if="content?.cover_image_path && !remote.loading.value && !remote.error.value"
    class="editorial-banner"
    aria-label="Image de présentation"
  >
    <MediaImage :path="content.cover_image_path" :alt="content.title" />
  </section>
  <section class="container section-bottom editorial-content">
    <ResultState
      :loading="remote.loading.value"
      :error="remote.error.value"
      :empty="!content"
      :empty-title="
        slug === 'contact' || slug === 'a-propos'
          ? `La page ${name} se prépare`
          : `Le programme ${name} se prépare`
      "
      empty-text="La présentation, les dates et les modalités seront disponibles ici après leur publication par l’organisation."
      @retry="load"
    />
    <article
      v-if="!remote.loading.value && !remote.error.value && content"
      :aria-label="`Présentation ${name}`"
    >
      <RichContent :value="content.body" />
    </article>
    <ContactPanel
      v-if="slug === 'contact' && content && !remote.loading.value && !remote.error.value"
    />
    <ProgramApplicationForm
      v-if="
        (slug === 'pitch' || slug === 'hackathon') &&
        content &&
        !remote.loading.value &&
        !remote.error.value
      "
      :key="slug"
      :program="slug"
    />
    <div class="editorial-related">
      <RouterLink to="/salons" class="button button-outline">Consulter les événements ↗</RouterLink
      ><RouterLink
        v-if="slug === 'pitch' || slug === 'hackathon'"
        :to="slug === 'pitch' ? '/hackathon' : '/pitch'"
        class="text-link"
        >Découvrir {{ slug === 'pitch' ? 'le Hackathon' : 'le Pitch' }} ↗</RouterLink
      >
    </div>
  </section>
</template>
