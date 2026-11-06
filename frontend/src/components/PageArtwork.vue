<script setup lang="ts">
import { computed, ref } from 'vue'
import { useIllustrationMotion } from '../composables/useIllustrationMotion'
const props = withDefaults(defineProps<{ variant?: string; compact?: boolean }>(), {
  variant: 'a-propos',
  compact: false,
})
const root = ref<HTMLElement | null>(null),
  { paused, reduced, toggle } = useIllustrationMotion(root)
const identity = computed(
  () =>
    ({
      contact: ['Ouvrir le dialogue', 'Échanger. Relier. Avancer.'],
      'a-propos': ['Une vision partagée', 'Les services en mouvement.'],
      pitch: ['Donner voix aux idées', 'Présenter. Convaincre. Rencontrer.'],
      hackathon: ['Construire ensemble', 'Imaginer. Créer. Collaborer.'],
      annuaire: ['Un réseau de savoir-faire', 'Trouver les bonnes connexions.'],
      salons: ['Des rencontres qui comptent', 'Un même lieu. De nouvelles perspectives.'],
    })[props.variant] || ['Les services en mouvement', 'Créer des liens.'],
)
</script>
<template>
  <aside ref="root" class="page-artwork" :class="{ 'artwork-compact': compact }">
    <div class="artwork-heading">
      <span>SASCOA · AFRIQUE</span><span aria-hidden="true">↗</span>
    </div>
    <svg viewBox="0 0 460 320" aria-hidden="true" focusable="false">
      <g class="art-orbit" fill="none" stroke="currentColor" stroke-opacity=".2">
        <ellipse cx="230" cy="160" rx="180" ry="112" />
        <ellipse cx="230" cy="160" rx="180" ry="112" transform="rotate(45 230 160)" />
        <ellipse cx="230" cy="160" rx="180" ry="112" transform="rotate(-45 230 160)" />
      </g>
      <g fill="none" stroke="#f8d6cb" stroke-width="1.5">
        <path
          class="art-flow"
          stroke-dasharray="8 8"
          d="M80 160Q170 40 230 160T390 155M125 265Q330 250 335 65"
        />
        <circle cx="230" cy="160" r="68" fill="#640b25" stroke-opacity=".5" />
        <circle cx="230" cy="160" r="59" stroke-opacity=".25" />
      </g>
      <g
        stroke="#fff8f2"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <g v-if="variant === 'contact'">
          <rect x="199" y="139" width="62" height="43" rx="7" />
          <path d="m200 141 30 24 30-24" />
        </g>
        <g v-else-if="variant === 'salons'">
          <rect x="203" y="134" width="54" height="54" rx="7" />
          <path d="M203 149h54m-40-22v16m26-16v16m-26 22h5m14 0h5m-24 12h5" />
        </g>
        <g v-else-if="variant === 'pitch'">
          <rect x="221" y="127" width="19" height="40" rx="9" />
          <path d="M210 154v7a20 20 0 0 0 40 0v-7m-20 28v13m-13 0h26" />
        </g>
        <g v-else-if="variant === 'hackathon'">
          <path d="m215 145-15 15 15 15m30-30 15 15-15 15m-12-39-7 48" />
        </g>
        <g v-else>
          <circle cx="230" cy="145" r="12" />
          <path d="M207 187v-8a23 23 0 0 1 46 0v8m-51-46a10 10 0 0 0-8 18m64-18a10 10 0 0 1 8 18" />
        </g>
      </g>
      <g class="art-float">
        <circle cx="80" cy="160" r="27" fill="#f8f2ee" />
        <path d="m70 160 7 7 14-14" fill="none" stroke="#640b25" stroke-width="3" />
      </g>
      <g class="art-float">
        <rect x="309" y="42" width="58" height="48" rx="13" fill="#e79573" />
        <path d="M326 66h24m-12-12v24" stroke="#640b25" stroke-width="3" />
      </g>
      <g class="art-float">
        <circle cx="380" cy="195" r="23" fill="#f8f2ee" />
        <path d="M370 195h20m-8-8 8 8-8 8" stroke="#640b25" stroke-width="2.5" fill="none" />
      </g>
      <g class="art-float">
        <rect x="101" y="244" width="61" height="32" rx="16" fill="#e79573" />
        <circle cx="120" cy="260" r="4" fill="#640b25" />
        <circle cx="141" cy="260" r="4" fill="#640b25" />
      </g>
      <g fill="#f8f2ee">
        <circle cx="158" cy="65" r="4" />
        <circle cx="280" cy="269" r="4" />
        <circle cx="406" cy="109" r="3" />
      </g>
    </svg>
    <div class="artwork-copy">
      <strong>{{ identity[0] }}</strong>
      <p>{{ identity[1] }}</p>
    </div>
    <button
      v-if="!reduced"
      type="button"
      class="artwork-pause"
      :aria-pressed="paused"
      @click="toggle"
    >
      {{ paused ? 'Animer' : 'Pause' }}<span class="sr-only"> l’illustration</span>
    </button>
  </aside>
</template>
