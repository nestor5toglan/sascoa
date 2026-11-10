<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getEvent, getEvents, PAGE_SIZE } from '../services/publicCatalog'
import { getPreregConfig } from '../services/preregistration'
import { useRemote } from '../composables/useRemote'
import { dateLabel } from '../lib/presentation'
import type { PageResult, SalonEvent } from '../types/public'
import type { PreregConfig } from '../types/preregistration'
import PageArtwork from '../components/PageArtwork.vue'
import ZoomableImage from '../components/ui/ZoomableImage.vue'
import RichContent from '../components/ui/RichContent.vue'
import DocumentLink from '../components/ui/DocumentLink.vue'
import PaginationBar from '../components/ui/PaginationBar.vue'
import ResultState from '../components/ui/ResultState.vue'
import SalonExhibitors from '../components/SalonExhibitors.vue'
const route = useRoute(),
  router = useRouter()
const period = ref<'upcoming' | 'past' | 'all'>('upcoming'),
  page = ref(1)
const remote = useRemote<{ list: PageResult<SalonEvent>; selected: SalonEvent | null }>({
  list: { items: [], count: 0 },
  selected: null,
})
const prereg = useRemote<PreregConfig | null>(null)
const selected = computed(() => remote.data.value.selected)
const speakers = computed(() =>
  Array.isArray(selected.value?.speakers)
    ? selected.value.speakers.filter((item): item is { name: string; role?: string } =>
        Boolean(
          item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim(),
        ),
      )
    : [],
)
const load = () => {
  const currentPage = page.value,
    currentPeriod = period.value,
    id = route.query.evenement
  return remote.run(async () => {
    const list = await getEvents(currentPage, currentPeriod, '', PAGE_SIZE, 'salon')
    const event = typeof id === 'string' ? await getEvent(id) : list.items[0] || null
    if (id && (!event || event.event_type !== 'salon'))
      throw new Error('Ce salon n’est pas disponible. Choisissez un salon publié.')
    return { list, selected: event }
  })
}
async function changeFilter() {
  page.value = 1
  if (route.query.evenement) {
    await router.replace({ path: '/salon/' })
  } else await load()
}
async function changePage(value: number) {
  page.value = value
  if (route.query.evenement) await router.replace({ path: '/salon/' })
  else await load()
}
function select(id: string) {
  void router.push({ path: '/salon/', query: { evenement: id } })
}
function goToProgram() {
  document.getElementById('salon-programme')?.scrollIntoView({ behavior: 'smooth' })
}
function preregister() {
  window.dispatchEvent(new Event('sascoa:open-preregistration'))
}
watch(() => route.query.evenement, load)
onMounted(() => {
  void load()
  void prereg.run(getPreregConfig)
})
</script>
<template>
  <section class="page-intro container internal-hero">
    <div class="internal-hero-copy">
      <p class="eyebrow">Le salon SASCOA</p>
      <h1>Un lieu pour<br /><em>faire réseau</em><span class="title-dot">.</span></h1>
      <p>
        Rencontrez les acteurs des services et du conseil en Afrique. Retrouvez le visuel du salon,
        les informations pratiques, le programme et les exposants.
      </p>
    </div>
    <ZoomableImage
      v-if="selected?.cover_image_path && !remote.loading.value && !remote.error.value"
      :key="selected.id"
      :path="selected.cover_image_path"
      :alt="selected.title"
    />
    <PageArtwork v-else variant="salons" />
  </section>
  <section class="container section-bottom salon-page">
    <form class="salon-filter" @submit.prevent="changeFilter">
      <label for="salon-period">Éditions du salon</label>
      <select id="salon-period" v-model="period">
        <option value="upcoming">En cours et à venir</option>
        <option value="past">Éditions passées</option>
        <option value="all">Toutes les éditions</option>
      </select>
      <button class="button button-outline" :disabled="remote.loading.value">Afficher</button>
    </form>
    <ResultState
      :loading="remote.loading.value"
      :error="remote.error.value"
      :empty="!selected"
      empty-title="Le prochain salon se prépare"
      empty-text="Le visuel, les dates et le programme seront affichés dès la publication du salon. Vous pouvez aussi consulter les éditions passées."
      @retry="load"
    />
    <template v-if="selected && !remote.loading.value && !remote.error.value">
      <article class="salon-feature salon-practical" :aria-label="selected.title">
        <div class="salon-feature-info">
          <p class="eyebrow">Rencontres · Services · Conseil</p>
          <span v-if="selected.is_demo" class="demo-badge"
            >Salon de démonstration · dates fictives</span
          >
          <h2>{{ selected.title }}</h2>
          <dl class="salon-facts">
            <div>
              <dt>Début</dt>
              <dd>{{ dateLabel(selected.starts_at, selected.timezone) }}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>{{ dateLabel(selected.ends_at, selected.timezone) }}</dd>
            </div>
            <div>
              <dt>Lieu</dt>
              <dd>{{ selected.location || 'À confirmer' }}</dd>
            </div>
          </dl>
          <div class="salon-actions">
            <a href="#salon-programme" class="button button-outline" @click.prevent="goToProgram"
              >Voir le programme ↓</a
            >
            <button
              v-if="prereg.data.value?.event_id === selected.id"
              class="button"
              type="button"
              @click="preregister"
            >
              Se préinscrire ↗
            </button>
            <RouterLink v-else to="/contact/" class="button">Contacter l’organisation ↗</RouterLink>
          </div>
        </div>
      </article>
      <section class="salon-section" aria-label="Présentation du salon">
        <h2>À propos du salon</h2>
        <RichContent :value="selected.description" />
      </section>
      <section id="salon-programme" class="salon-section">
        <p class="eyebrow">Préparer votre venue</p>
        <h2>Le programme</h2>
        <RichContent v-if="selected.program_text" :value="selected.program_text" />
        <p v-else>Le programme détaillé sera communiqué par l’organisation.</p>
        <DocumentLink v-if="selected.program_pdf_path" :path="selected.program_pdf_path" />
        <template v-if="speakers.length"
          ><h3>Les intervenants</h3>
          <ul class="speaker-list">
            <li v-for="(speaker, index) in speakers" :key="index">
              <strong>{{ speaker.name }}</strong
              ><span v-if="speaker.role">{{ speaker.role }}</span>
            </li>
          </ul></template
        >
      </section>
      <SalonExhibitors :key="selected.id" :event-id="selected.id" />
    </template>
    <section class="salon-programs salon-section" aria-label="Pitch et Hackathon">
      <div>
        <p class="eyebrow">Des idées à l’action</p>
        <h2>Pitch & Hackathon</h2>
        <p>
          Découvrez ces deux programmes et leurs modalités. Les sessions et les candidatures sont
          annoncées sur leurs pages lorsqu’elles sont ouvertes par l’organisation.
        </p>
      </div>
      <div class="salon-program-grid">
        <RouterLink to="/pitch/" class="salon-program-card"
          ><span class="eyebrow">Présenter · Convaincre</span>
          <h3>Business Pitch ↗</h3>
          <p>
            Découvrez le programme et présentez votre projet lors d’un appel à candidatures.
          </p></RouterLink
        >
        <RouterLink to="/hackathon/" class="salon-program-card"
          ><span class="eyebrow">Imaginer · Construire</span>
          <h3>Hackathon ↗</h3>
          <p>
            Découvrez les défis et les modalités de participation, seul ou en équipe.
          </p></RouterLink
        >
      </div>
    </section>
    <section
      v-if="!remote.loading.value && !remote.error.value && remote.data.value.list.items.length"
      class="salon-section"
    >
      <h2>Les éditions du salon</h2>
      <div class="salon-editions">
        <button
          v-for="event in remote.data.value.list.items"
          :key="event.id"
          type="button"
          :aria-pressed="selected?.id === event.id"
          @click="select(event.id)"
        >
          {{ event.title }} <span>↗</span>
        </button>
      </div>
      <PaginationBar
        :page="page"
        :size="PAGE_SIZE"
        :total="remote.data.value.list.count"
        :busy="remote.loading.value"
        @change="changePage"
      />
    </section>
  </section>
</template>
