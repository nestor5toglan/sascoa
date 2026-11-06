<script setup lang="ts">
import SalonExhibitors from '../components/SalonExhibitors.vue'
import PageArtwork from '../components/PageArtwork.vue'
import RichContent from '../components/ui/RichContent.vue'

import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getEvent, getEvents, PAGE_SIZE } from '../services/publicCatalog'
import { useRemote } from '../composables/useRemote'
import { dateLabel, errorText, eventType } from '../lib/presentation'
import type { PageResult, SalonEvent } from '../types/public'
import EventCard from '../components/EventCard.vue'
import DetailDialog from '../components/ui/DetailDialog.vue'
import DocumentLink from '../components/ui/DocumentLink.vue'
import MediaImage from '../components/ui/MediaImage.vue'
import PaginationBar from '../components/ui/PaginationBar.vue'
import ResultState from '../components/ui/ResultState.vue'
const route = useRoute()
const router = useRouter()
const period = ref<'upcoming' | 'past' | 'all'>('upcoming')
const appliedPeriod = ref<'upcoming' | 'past' | 'all'>('upcoming')
const text = ref('')
const appliedText = ref('')
const page = ref(1)
const results = useRemote<PageResult<SalonEvent>>({ items: [], count: 0 })
const selected = ref<SalonEvent | null>(null)
const detailError = ref('')
const detailLoading = ref(false)
let detailVersion = 0
const speakers = computed(() => {
  const raw = selected.value?.speakers
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is { name: string; role?: string } =>
    Boolean(item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim()),
  )
})
const load = () => results.run(() => getEvents(page.value, appliedPeriod.value, appliedText.value))
function search() {
  appliedPeriod.value = period.value
  page.value = 1
  appliedText.value = text.value
  void load()
}
function reset() {
  text.value = ''
  period.value = 'upcoming'
  search()
}
function changePage(value: number) {
  page.value = value
  void load()
  document.getElementById('event-results')?.scrollIntoView({ block: 'start', behavior: 'auto' })
}
function open(event: SalonEvent) {
  detailVersion += 1
  detailLoading.value = false
  detailError.value = ''
  selected.value = event
}
function close() {
  detailVersion += 1
  selected.value = null
  if (route.query.evenement) {
    const query = { ...route.query }
    delete query.evenement
    void router.replace({ path: route.path, query })
  }
}
async function openFromQuery() {
  const current = ++detailVersion
  const id = route.query.evenement
  detailError.value = ''
  if (typeof id !== 'string') {
    detailLoading.value = false
    return
  }
  detailLoading.value = true
  try {
    const event = await getEvent(id)
    if (current === detailVersion) {
      selected.value = event
      if (!event) detailError.value = 'Cet événement n’est pas disponible.'
    }
  } catch (error) {
    if (current === detailVersion) detailError.value = errorText(error)
  } finally {
    if (current === detailVersion) detailLoading.value = false
  }
}
watch(() => route.query.evenement, openFromQuery)
onMounted(() => {
  void load()
  void openFromQuery()
})
</script>
<template>
  <section class="page-intro container internal-hero">
    <div class="internal-hero-copy">
      <p class="eyebrow">Salons & événements</p>
      <h1>Se retrouver<br />pour <em>aller plus loin</em><span class="title-dot">.</span></h1>
      <p>
        Un salon pour découvrir, un forum pour échanger, une conférence pour ouvrir les
        perspectives. Retrouvez les rendez-vous du SASCOA.
      </p>
    </div>
    <PageArtwork variant="salons" />
  </section>
  <section class="container section-bottom">
    <form
      class="filter-bar"
      role="search"
      aria-label="Rechercher un événement"
      @submit.prevent="search"
    >
      <div class="field search-field">
        <label for="event-search">Un événement ou un thème</label
        ><input
          id="event-search"
          v-model="text"
          type="search"
          maxlength="100"
          placeholder="Ex. salon, innovation…"
        />
      </div>
      <div class="field">
        <label for="event-period">Période</label
        ><select id="event-period" v-model="period">
          <option value="upcoming">En cours & à venir</option>
          <option value="past">Événements passés</option>
          <option value="all">Tous les événements</option>
        </select>
      </div>
      <button type="submit" class="button" :disabled="results.loading.value">Rechercher ↗</button>
    </form>
    <p v-if="detailLoading" role="status">Ouverture de l’événement…</p>
    <p v-if="detailError" class="inline-error" role="alert">
      {{ detailError }}
      <button type="button" class="text-link" @click="openFromQuery">Réessayer</button>
    </p>
    <div id="event-results" class="results-top">
      <p v-if="!results.loading.value && !results.error.value" role="status">
        <strong>{{ results.data.value.count }}</strong> rendez-vous
      </p>
      <p v-else>L’agenda SASCOA</p>
      <button
        v-if="appliedText || appliedPeriod !== 'upcoming'"
        type="button"
        class="text-link"
        @click="reset"
      >
        Réinitialiser les filtres ✕
      </button>
    </div>
    <ResultState
      :loading="results.loading.value"
      :error="results.error.value"
      :empty="results.data.value.items.length === 0"
      empty-title="Aucun événement pour cette sélection"
      empty-text="Changez la période ou le mot-clé. Les nouveaux rendez-vous seront annoncés ici dès leur publication."
      @retry="load"
    />
    <div
      v-if="!results.loading.value && !results.error.value && results.data.value.items.length"
      class="card-grid"
    >
      <EventCard
        v-for="event in results.data.value.items"
        :key="event.id"
        :event="event"
        @open="open"
      />
    </div>
    <PaginationBar
      v-if="!results.error.value"
      :page="page"
      :total="results.data.value.count"
      :size="PAGE_SIZE"
      :busy="results.loading.value"
      @change="changePage"
    />
  </section>
  <DetailDialog :open="Boolean(selected)" :title="selected?.title || ''" @close="close"
    ><template v-if="selected"
      ><p v-if="selected.is_demo" class="demo-badge">Dates fictives — démonstration</p>
      <p class="tag">{{ eventType(selected.event_type) }}</p>
      <MediaImage
        v-if="selected.cover_image_path"
        class="detail-cover"
        :path="selected.cover_image_path"
        :alt="selected.title"
      />
      <dl class="event-facts">
        <div>
          <dt>Du</dt>
          <dd>{{ dateLabel(selected.starts_at, selected.timezone) }}</dd>
        </div>
        <div>
          <dt>Au</dt>
          <dd>{{ dateLabel(selected.ends_at, selected.timezone) }}</dd>
        </div>
        <div>
          <dt>Lieu</dt>
          <dd>{{ selected.location || 'À confirmer' }}</dd>
        </div>
      </dl>
      <RichContent :value="selected.description" />
      <template v-if="selected.program_text"
        ><h3>Le programme</h3>
        <RichContent :value="selected.program_text" /></template
      ><DocumentLink v-if="selected.program_pdf_path" :path="selected.program_pdf_path" /><template
        v-if="speakers.length"
        ><h3>Les intervenants</h3>
        <ul class="speaker-list">
          <li v-for="(speaker, index) in speakers" :key="index">
            <strong>{{ speaker.name }}</strong
            ><span v-if="speaker.role">{{ speaker.role }}</span>
          </li>
        </ul></template
      >
      <SalonExhibitors
        v-if="selected.event_type === 'salon'"
        :key="selected.id"
        :event-id="selected.id"
      />
      <div class="contact-box">
        <h3>Participation</h3>
        <p v-if="new Date(selected.ends_at).getTime() < Date.now()">Cet événement est terminé.</p>
        <p v-else>Les modalités de participation seront précisées par l’organisation.</p>
        <p v-if="selected.is_demo" class="muted">
          Ce rendez-vous est présenté pour tester la plateforme. Aucune inscription réelle n’est
          collectée.
        </p>
      </div></template
    ></DetailDialog
  >
</template>
