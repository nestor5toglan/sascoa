<script setup lang="ts">
import ContactIcon from '../ui/ContactIcon.vue'
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { getContactSettings } from '../../services/contact'
import { useRemote } from '../../composables/useRemote'
import { phoneLink, safeHttpUrl } from '../../lib/presentation'
import { useIllustrationMotion } from '../../composables/useIllustrationMotion'
import type { ContactSettings } from '../../types/contact'
const auth = useAuthStore(),
  logo = `${import.meta.env.BASE_URL}brand/sascoa-logo.png`,
  root = ref<HTMLElement | null>(null)
const contact = useRemote<ContactSettings | null>(null),
  { paused, reduced, toggle } = useIllustrationMotion(root)
const load = () => contact.run(getContactSettings)
onMounted(load)
</script>
<template>
  <footer ref="root" class="site-footer clean-footer">
    <svg
      class="footer-network"
      viewBox="0 0 1400 430"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g class="art-orbit" fill="none" stroke="currentColor">
        <ellipse cx="1100" cy="215" rx="340" ry="130" />
        <ellipse cx="1100" cy="215" rx="340" ry="130" transform="rotate(35 1100 215)" />
        <ellipse cx="1100" cy="215" rx="340" ry="130" transform="rotate(-35 1100 215)" />
      </g>
      <path
        class="art-flow"
        d="M-40 300Q250 20 510 220T1100 160T1500 250"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-dasharray="8 12"
      />
      <g class="art-float" fill="currentColor">
        <circle cx="180" cy="180" r="7" />
        <circle cx="800" cy="230" r="9" />
        <circle cx="1240" cy="110" r="9" />
      </g>
    </svg>
    <div class="container footer-top">
      <div class="footer-intro">
        <RouterLink to="/" class="brand-lockup footer-brand" aria-label="SASCOA — accueil"
          ><img :src="logo" alt="" width="48" height="48" /><strong>SASCOA.</strong></RouterLink
        >
        <p>Connecter les acteurs des services.<br />Faire grandir les opportunités en Afrique.</p>
        <RouterLink to="/salons" class="text-link">Trouver un rendez-vous ↗</RouterLink>
      </div>
      <div class="footer-explore">
        <h2>Explorer</h2>
        <nav aria-label="Navigation de pied de page">
          <RouterLink to="/">SASCOA</RouterLink><RouterLink to="/annuaire/">Annuaire</RouterLink
          ><RouterLink to="/salon/">Salon</RouterLink
          ><RouterLink to="/evenements/">Autres événements</RouterLink
          ><RouterLink to="/pitch/">Pitch</RouterLink
          ><RouterLink to="/hackathon/">Hackathon</RouterLink
          ><RouterLink to="/a-propos/">À propos</RouterLink
          ><RouterLink to="/contact/">Contact</RouterLink>
        </nav>
      </div>
      <div class="footer-contact">
        <h2>Contact</h2>
        <p v-if="contact.loading.value" role="status">Chargement des coordonnées…</p>
        <template v-else-if="contact.data.value"
          ><a :href="`mailto:${contact.data.value.email}`"
            ><ContactIcon kind="email" /><span>{{ contact.data.value.email }}</span></a
          ><template
            v-for="phone in [
              contact.data.value.phone_primary,
              contact.data.value.phone_secondary,
            ].filter(Boolean)"
            :key="phone"
            ><a v-if="phoneLink(phone)" :href="phoneLink(phone)!"
              ><ContactIcon kind="phone" /><span>{{ phone }}</span></a
            ><span v-else>{{ phone }}</span></template
          ><span>{{ contact.data.value.location }}</span
          ><a
            v-if="safeHttpUrl(contact.data.value.facebook_url)"
            :href="safeHttpUrl(contact.data.value.facebook_url)!"
            target="_blank"
            rel="noopener noreferrer"
            ><ContactIcon kind="facebook" /><span>Facebook ↗</span></a
          ></template
        ><template v-else
          ><RouterLink to="/contact/">Voir les coordonnées ↗</RouterLink
          ><button type="button" class="footer-retry" @click="load">
            Réessayer le chargement
          </button></template
        >
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© {{ new Date().getFullYear() }} SASCOA</span
      ><RouterLink v-if="auth.isAdmin" to="/administration">Administration</RouterLink
      ><button v-if="!reduced" type="button" :aria-pressed="paused" @click="toggle">
        {{ paused ? 'Animer le décor' : 'Pause du décor' }}
      </button>
    </div>
  </footer>
</template>
