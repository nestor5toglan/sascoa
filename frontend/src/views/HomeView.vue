<script setup lang="ts">
import AfricaGlobe from '../components/AfricaGlobe.vue'
import '../assets/lot38.css'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getEvents, getPartners } from '../services/publicCatalog'
import { useRemote } from '../composables/useRemote'
import PartnerCarousel from '../components/PartnerCarousel.vue'
import type { PageResult, Partner, SalonEvent } from '../types/public'
import EventCard from '../components/EventCard.vue'
import ResultState from '../components/ui/ResultState.vue'
const router = useRouter()
const events = useRemote<PageResult<SalonEvent>>({ items: [], count: 0 })
const partners = useRemote<Partner[]>([])
const loadEvents = () => events.run(() => getEvents(1, 'upcoming', '', 3))
const loadPartners = () => partners.run(getPartners)
onMounted(() => {
  void loadEvents()
  void loadPartners()
})
</script>
<template>
  <section class="hero container">
    <div class="hero-copy">
      <p class="eyebrow">
        <span class="live-dot" aria-hidden="true"></span> Le rendez-vous des services en Afrique
      </p>
      <h1>
        Des rencontres<br />qui ouvrent<br /><em>des perspectives</em
        ><span class="title-dot">.</span>
      </h1>
      <p class="hero-lead">
  SASCOA réunit les entreprises, les administrations, les experts et les porteurs de projets
  autour d’un salon professionnel et d’un annuaire des services en Afrique.
</p>
      <div class="hero-actions">
        <RouterLink to="/salon/" class="button"
          >Découvrir le salon <span aria-hidden="true">↗</span></RouterLink
        ><RouterLink to="/annuaire/" class="text-link"
          >Explorer l’annuaire <span aria-hidden="true">→</span></RouterLink
        >
      </div>
      <RouterLink
        :to="{ path: '/contact/', query: { demande: 'annuaire' } }"
        class="button button-outline directory-subscribe"
        >Souscrire à l’annuaire ↗</RouterLink
      >
      <div class="hero-bottom">
        <span class="little-orbit" aria-hidden="true">✳</span>
        <p>Les bonnes connexions commencent<br /><strong>par une première rencontre.</strong></p>
      </div>
    </div>
    <div class="hero-poster globe-poster" aria-label="SASCOA : rencontres, partage, perspectives">
      <div class="poster-top"><span>SASCOA</span><span>AFRIQUE ↗</span></div>
      <AfricaGlobe />
      <div class="poster-copy">
        <span>Relier. Grandir.</span><strong>La force<br />d’un réseau.</strong>
      </div>
      <div class="poster-bottom">
        <span>Rencontrer · Partager · Avancer</span><span aria-hidden="true">↗</span>
      </div>
    </div>
  </section>
  <div class="ribbon" aria-label="Les acteurs SASCOA">
    <div class="container">
      <span>Administrations</span><b aria-hidden="true">✳</b><span>Entreprises</span
      ><b aria-hidden="true">✳</b><span>Experts & conseils</span><b aria-hidden="true">✳</b
      ><span>Porteurs de projets</span>
    </div>
  </div>
  <section class="section container">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Un écosystème ouvert</p>
        <h2>Les services ont besoin<br /><em>de se rencontrer</em></h2>
      </div>
      <p>
        Le SASCOA rapproche les acteurs publics et privés autour de leurs savoir-faire. Sur le
        terrain comme en ligne, nous créons un espace pour découvrir les services et engager le
        dialogue.
      </p>
    </div>
    <div class="pillar-grid">
      <article>
        <span class="pillar-number">01 /</span>
        <h3>Découvrir les acteurs</h3>
        <p>
          Identifiez une entreprise, une expertise ou un service grâce à un annuaire organisé par
          secteur.
        </p>
        <RouterLink to="/annuaire/" class="text-link">Trouver un acteur ↗</RouterLink>
      </article>
      <article>
        <span class="pillar-number">02 /</span>
        <h3>Partager les idées</h3>
        <p>Salons, conférences et forums font circuler les expériences et ouvrent la discussion.</p>
        <RouterLink to="/salons" class="text-link">Voir les événements ↗</RouterLink>
      </article>
      <article>
        <span class="pillar-number">03 /</span>
        <h3>Construire la suite</h3>
        <p>
          Donnez de la visibilité à vos activités et découvrez les personnes avec qui envisager de
          nouvelles collaborations.
        </p>
        <RouterLink to="/annuaire/" class="text-link">Explorer les services ↗</RouterLink>
      </article>
    </div>
  </section>
  <section class="section section-tinted ambient-section">
    <span class="ambient-orb ambient-one" aria-hidden="true"></span
    ><span class="ambient-orb ambient-two" aria-hidden="true"></span>
    <div class="container">
      <div class="section-heading compact">
        <div>
          <p class="eyebrow">À l’agenda</p>
          <h2>Les prochains <em>rendez-vous</em></h2>
        </div>
        <RouterLink to="/salons" class="text-link">Tout l’agenda ↗</RouterLink>
      </div>
      <ResultState
        :loading="events.loading.value"
        :error="events.error.value"
        :empty="events.data.value.items.length === 0"
        empty-title="Les prochains rendez-vous se préparent"
        empty-text="Les événements publiés apparaîtront ici dès leur annonce."
        @retry="loadEvents"
      />
      <div
        v-if="!events.loading.value && !events.error.value && events.data.value.items.length"
        class="card-grid"
      >
        <EventCard
          v-for="event in events.data.value.items"
          :key="event.id"
          :event="event"
          @open="
            router.push({
              path: event.event_type === 'salon' ? '/salon/' : '/evenements/',
              query: { evenement: event.id },
            })
          "
        />
      </div>
    </div>
  </section>
  <section aria-label="Partenaires du SASCOA" class="section container partners-section">
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">Un engagement partagé</p>
        <h2>À nos <em>côtés</em></h2>
      </div>
      <p>Les partenaires présentés par l’organisation.</p>
    </div>
    <ResultState
      :loading="partners.loading.value"
      :error="partners.error.value"
      :empty="partners.data.value.length === 0"
      empty-title="Les partenaires seront annoncés prochainement"
      empty-text="Leurs logos apparaîtront ici après publication par l’organisation."
      @retry="loadPartners"
    />
    <PartnerCarousel
      v-if="!partners.loading.value && !partners.error.value && partners.data.value.length"
      :partners="partners.data.value"
    />
  </section>
  <div class="closing-band">
    <section class="container closing-banner ambient-section">
      <span class="ambient-orb ambient-one" aria-hidden="true"></span>
      <div>
        <p class="eyebrow">Passons du contact à la rencontre</p>
        <h2>Votre prochaine connexion<br />commence <em>ici</em>.</h2>
      </div>
      <RouterLink to="/annuaire/" class="button button-light"
        >Découvrir les entreprises ↗</RouterLink
      >
    </section>
  </div>
</template>
