<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Partner } from '../types/public'
import MediaImage from './ui/MediaImage.vue'
import { safeHttpUrl } from '../lib/presentation'
const props = defineProps<{ partners: Partner[] }>()
const root = ref<HTMLElement | null>(null),
  group = ref<HTMLElement | null>(null)
const reduced = ref(false),
  paused = ref(false),
  focused = ref(false),
  visible = ref(true),
  hidden = ref(false)
const repeats = ref(1),
  duration = ref(40)
let resize: ResizeObserver | undefined,
  observer: IntersectionObserver | undefined,
  media: MediaQueryList | undefined
const cards = computed(() =>
  Array.from({ length: reduced.value ? 1 : repeats.value }, (_, repeat) =>
    props.partners.map((partner) => ({ partner, repeat })),
  ).flat(),
)
const stopped = computed(
  () => paused.value || focused.value || reduced.value || !visible.value || hidden.value,
)
async function measure() {
  const width = root.value?.clientWidth || 0
  const card = group.value?.firstElementChild as HTMLElement | null
  const cardWidth = card?.getBoundingClientRect().width || 280
  repeats.value = props.partners.length
    ? Math.max(1, Math.ceil(width / (props.partners.length * (cardWidth + 24))))
    : 1
  await nextTick()
  duration.value = Math.max(1, (group.value?.getBoundingClientRect().width || 960) / 24)
}
function preference() {
  reduced.value = media?.matches ?? false
  void measure()
}
function visibility() {
  hidden.value = document.hidden
}
function blur(event: FocusEvent) {
  focused.value = event.relatedTarget instanceof Node && !!root.value?.contains(event.relatedTarget)
}
watch(
  () => props.partners,
  () => {
    void measure()
  },
  { deep: true },
)
onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    preference()
    media.addEventListener('change', preference)
  }
  if (typeof ResizeObserver !== 'undefined') {
    resize = new ResizeObserver(() => {
      void measure()
    })
    if (root.value) resize.observe(root.value)
    if (group.value) resize.observe(group.value)
  }
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(([entry]) => {
      visible.value = !!entry?.isIntersecting
    })
    if (root.value) observer.observe(root.value)
  }
  visibility()
  document.addEventListener('visibilitychange', visibility)
  void measure()
})
onBeforeUnmount(() => {
  resize?.disconnect()
  observer?.disconnect()
  media?.removeEventListener('change', preference)
  document.removeEventListener('visibilitychange', visibility)
})
</script>
<template>
  <div
    ref="root"
    class="partner-carousel partner-marquee"
    :class="{ 'is-reduced': reduced }"
    role="region"
    aria-label="Partenaires SASCOA"
    @focusin="focused = true"
    @focusout="blur"
  >
    <button
      v-if="!reduced"
      type="button"
      class="marquee-accessible-pause"
      :aria-pressed="paused"
      @click="paused = !paused"
    >
      {{
        paused
          ? 'Reprendre le défilement des partenaires'
          : 'Mettre en pause le défilement des partenaires'
      }}
    </button>
    <div
      class="partner-marquee-window"
      :tabindex="reduced ? 0 : undefined"
      aria-label="Liste des partenaires"
    >
      <div
        class="partner-marquee-track"
        :style="{
          '--partner-duration': `${duration}s`,
          animationPlayState: stopped ? 'paused' : 'running',
        }"
      >
        <div ref="group" class="partner-marquee-group">
          <article
            v-for="({ partner, repeat }, index) in cards"
            :key="`${partner.id}-${index}`"
            class="partner-logo-card"
            :aria-hidden="repeat > 0 ? true : undefined"
            :inert="repeat > 0 ? true : undefined"
          >
            <a
              v-if="repeat === 0 && safeHttpUrl(partner.website_url)"
              :href="safeHttpUrl(partner.website_url)!"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MediaImage :path="partner.logo_path" :alt="partner.name" contain /><span
                >{{ partner.name }} ↗</span
              >
            </a>
            <template v-else
              ><MediaImage
                :path="partner.logo_path"
                :alt="repeat ? '' : partner.name"
                contain
              /><span>{{ partner.name }}{{ safeHttpUrl(partner.website_url) ? ' ↗' : '' }}</span></template
            >
            <small>{{ partner.category }}</small>
          </article>
        </div>
        <div v-if="!reduced" class="partner-marquee-group" aria-hidden="true" inert>
          <article
            v-for="({ partner }, index) in cards"
            :key="`clone-${partner.id}-${index}`"
            class="partner-logo-card"
          >
            <MediaImage :path="partner.logo_path" alt="" contain /><span
              >{{ partner.name }}{{ safeHttpUrl(partner.website_url) ? ' ↗' : '' }}</span
            ><small>{{ partner.category }}</small>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>
