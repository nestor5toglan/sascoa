<script setup lang="ts">
import { sectorTree } from '../lib/sectorTree'
import PageArtwork from '../components/PageArtwork.vue'
import RichContent from '../components/ui/RichContent.vue'
import { plainText } from '../lib/richText'
import { computed, onMounted, ref } from 'vue'
import { useRemote } from '../composables/useRemote'
import { getCompanies, getSectors, PAGE_SIZE } from '../services/publicCatalog'
import {
  phoneLink,
  readableEmail,
  safeHttpUrl,
  shortText,
  structureType,
} from '../lib/presentation'
import type { Company, PageResult, Sector } from '../types/public'
import DetailDialog from '../components/ui/DetailDialog.vue'
import MediaImage from '../components/ui/MediaImage.vue'
import PaginationBar from '../components/ui/PaginationBar.vue'
import ResultState from '../components/ui/ResultState.vue'
const text = ref('')
const sectorId = ref('')
const appliedText = ref('')
const appliedSector = ref('')
const page = ref(1)
const selected = ref<Company | null>(null)
const results = useRemote<PageResult<Company>>({ items: [], count: 0 })
const sectors = useRemote<Sector[]>([])
const sectorChoices = computed(() => sectorTree(sectors.data.value))
const hasFilter = computed(() => Boolean(appliedText.value || appliedSector.value))
const load = () =>
  results.run(() => getCompanies(page.value, appliedText.value, appliedSector.value))
function search() {
  appliedText.value = text.value
  appliedSector.value = sectorId.value
  page.value = 1
  void load()
}
function reset() {
  text.value = ''
  sectorId.value = ''
  search()
}
function changePage(value: number) {
  page.value = value
  void load()
  document.getElementById('directory-results')?.scrollIntoView({ block: 'start', behavior: 'auto' })
}
onMounted(() => {
  void load()
  void sectors.run(getSectors)
})
</script>
<template>
  <section class="page-intro container internal-hero">
    <div class="internal-hero-copy">
      <p class="eyebrow">L’annuaire SASCOA</p>
      <h1>Les bons acteurs<br /><em>à portée de rencontre</em><span class="title-dot">.</span></h1>
      <p>
        Parcourez les entreprises et structures publiques, explorez leurs expertises et trouvez un
        service qui répond à votre besoin.
      </p>
    </div>
    <PageArtwork variant="annuaire" />
  </section>
  <section class="container section-bottom">
    <form
      class="filter-bar"
      role="search"
      aria-label="Rechercher dans l’annuaire"
      @submit.prevent="search"
    >
      <div class="field search-field">
        <label for="company-search">Un nom, une expertise, un service</label
        ><input
          id="company-search"
          v-model="text"
          type="search"
          maxlength="100"
          placeholder="Ex. conseil, numérique…"
        />
      </div>
      <div class="field">
        <label for="company-sector">Secteur d’activité</label
        ><select
          id="company-sector"
          v-model="sectorId"
          :disabled="sectors.loading.value || Boolean(sectors.error.value)"
        >
          <option value="">Tous les secteurs</option>
          <option v-for="sector in sectorChoices" :key="sector.id" :value="sector.id">
            {{ sector.label }}
          </option>
        </select>
      </div>
      <button class="button" type="submit" :disabled="results.loading.value">
        Rechercher <span aria-hidden="true">↗</span>
      </button>
    </form>
    <p class="muted">Choisir une catégorie inclut aussi tous ses sous-secteurs.</p>
    <p v-if="sectors.error.value" class="inline-error" role="alert">
      Les secteurs n’ont pas pu être chargés.
      <button type="button" class="text-link" @click="sectors.run(getSectors)">Réessayer</button>
    </p>
    <div id="directory-results" class="results-top">
      <p v-if="!results.loading.value && !results.error.value" role="status">
        <strong>{{ results.data.value.count }}</strong>
        {{ results.data.value.count > 1 ? 'structures à découvrir' : 'structure à découvrir' }}
      </p>
      <p v-else>Les acteurs de l’annuaire</p>
      <button v-if="hasFilter" type="button" class="text-link" @click="reset">
        Effacer les filtres ✕
      </button>
    </div>
    <ResultState
      :loading="results.loading.value"
      :error="results.error.value"
      :empty="results.data.value.items.length === 0"
      :empty-title="hasFilter ? 'Aucun résultat pour cette recherche' : 'L’annuaire se prépare'"
      :empty-text="
        hasFilter
          ? 'Essayez un autre mot-clé ou élargissez le secteur.'
          : 'Les premières fiches apparaîtront dès leur publication par l’organisation.'
      "
      @retry="load"
      ><button v-if="hasFilter" type="button" class="button button-outline" @click="reset">
        Voir toutes les structures
      </button></ResultState
    >
    <div
      v-if="!results.loading.value && !results.error.value && results.data.value.items.length"
      class="card-grid"
    >
      <article
        v-for="company in results.data.value.items"
        :key="company.id"
        class="catalog-card company-card"
      >
        <div class="company-card-top">
          <MediaImage :path="company.logo_path" :alt="company.name" contain /><span class="tag">{{
            company.sector?.name || 'Services'
          }}</span>
        </div>
        <div class="card-body">
          <p class="micro-label">{{ structureType(company.structure_type) }}</p>
          <h2>{{ company.name }}</h2>
          <p>{{ shortText(plainText(company.description)) }}</p>
          <button type="button" class="text-link" @click="selected = company">
            Découvrir la structure <span aria-hidden="true">↗</span
            ><span class="sr-only"> {{ company.name }}</span>
          </button>
        </div>
      </article>
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
  <DetailDialog :open="Boolean(selected)" :title="selected?.name || ''" @close="selected = null"
    ><template v-if="selected"
      ><p class="tag">
        {{ selected.sector?.name }} ·
        {{ structureType(selected.structure_type) }}
      </p>
      <MediaImage
        v-if="selected.logo_path"
        class="detail-logo"
        :path="selected.logo_path"
        :alt="selected.name"
        contain
      />
      <RichContent :value="selected.description" />
      <template v-if="selected.services"
        ><h3>Services proposés</h3>
        <RichContent :value="selected.services" /></template
      ><template v-if="selected.specificities"
        ><h3>Ce qui nous distingue</h3>
        <RichContent :value="selected.specificities"
      /></template>
      <div
        v-if="
          selected.address ||
          selected.phone ||
          selected.public_email ||
          safeHttpUrl(selected.website_url)
        "
        class="contact-box"
      >
        <h3>Coordonnées</h3>
        <p v-if="selected.address">{{ selected.address }}</p>
        <p v-if="selected.phone">
          <a v-if="phoneLink(selected.phone)" :href="phoneLink(selected.phone)!">{{
            selected.phone
          }}</a
          ><span v-else>{{ selected.phone }}</span>
        </p>
        <p v-if="readableEmail(selected.public_email)">
          <a :href="`mailto:${readableEmail(selected.public_email)}`">{{
            selected.public_email
          }}</a>
        </p>
        <a
          v-if="safeHttpUrl(selected.website_url)"
          :href="safeHttpUrl(selected.website_url)!"
          target="_blank"
          rel="noopener noreferrer"
          class="text-link"
          >Consulter le site web ↗</a
        >
      </div></template
    ></DetailDialog
  >
</template>
