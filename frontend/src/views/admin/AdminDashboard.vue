<script setup lang="ts">
import { onMounted } from 'vue'
import { useRemote } from '../../composables/useRemote'
import { getAdminCounts } from '../../services/adminCatalog'
import ResultState from '../../components/ui/ResultState.vue'
const counts = useRemote<Awaited<ReturnType<typeof getAdminCounts>> | null>(null)
const load = () => counts.run(getAdminCounts)
onMounted(load)
</script>
<template>
  <header class="admin-page-heading">
    <p class="eyebrow">Vue d’ensemble</p>
    <h2>Un annuaire qui<br /><em>prend forme.</em></h2>
    <p>Prépare les fiches, vérifie leurs contenus et publie-les quand elles sont prêtes.</p>
  </header>
  <ResultState
    :loading="counts.loading.value"
    :error="counts.error.value"
    :empty="false"
    empty-title=""
    empty-text=""
    @retry="load"
  />
  <dl
    v-if="counts.data.value && !counts.loading.value && !counts.error.value"
    class="admin-metrics"
  >
    <div>
      <dt>Secteurs</dt>
      <dd>{{ counts.data.value.sectors }}</dd>
    </div>
    <div>
      <dt>Brouillons</dt>
      <dd>{{ counts.data.value.drafts }}</dd>
    </div>
    <div>
      <dt>Entreprises publiées</dt>
      <dd>{{ counts.data.value.published }}</dd>
    </div>
    <div>
      <dt>Fiches archivées</dt>
      <dd>{{ counts.data.value.archived }}</dd>
    </div>
  </dl>
  <div class="admin-start-grid">
    <article class="admin-panel">
      <span class="eyebrow">01 / Organiser</span>
      <h3>Les secteurs d’activité</h3>
      <p>Crée les catégories qui aideront les visiteurs à trouver les bons acteurs.</p>
      <RouterLink to="/administration/secteurs" class="button button-outline"
        >Gérer les secteurs ↗</RouterLink
      >
    </article>
    <article class="admin-panel">
      <span class="eyebrow">02 / Présenter</span>
      <h3>Les entreprises</h3>
      <p>Rédige une fiche, ajoute un logo et choisis quand la rendre visible dans l’annuaire.</p>
      <RouterLink to="/administration/entreprises" class="button"
        >Gérer les entreprises ↗</RouterLink
      >
    </article>
  </div>
  <section class="admin-panel admin-module-links">
    <h3>Programmes et rendez-vous</h3>
    <p>Publie les dates dans l’agenda et présente les dispositifs sur leurs pages dédiées.</p>
    <RouterLink to="/administration/evenements" class="text-link">Gérer les événements ↗</RouterLink
    ><RouterLink to="/administration/pages/pitch" class="text-link">Éditer Pitch ↗</RouterLink
    ><RouterLink to="/administration/pages/hackathon" class="text-link"
      >Éditer Hackathon ↗</RouterLink
    >
  </section>
  <p class="admin-note">
    Une fiche en brouillon ou archivée n’apparaît pas dans l’annuaire public. Les secteurs sont
    publics dès leur création.
  </p>
</template>
