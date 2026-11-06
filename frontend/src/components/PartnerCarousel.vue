<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import type { Partner } from '../types/public'
import MediaImage from './ui/MediaImage.vue'
import { safeHttpUrl } from '../lib/presentation'
const props = defineProps<{ partners: Partner[] }>()
const track = ref<HTMLElement | null>(null),
  root = ref<HTMLElement | null>(null),
  paused = ref(false),
  reduced = ref(false),
  hover = ref(false),
  focused = ref(false),
  visible = ref(true),
  position = ref(0),
  canScroll = ref(false),
  atEnd = ref(false)
let timer: ReturnType<typeof setInterval> | undefined,
  observer: IntersectionObserver | undefined,
  resize: ResizeObserver | undefined,
  media: MediaQueryList | undefined
const auto = computed(
  () => !paused.value && !reduced.value && !hover.value && !focused.value && visible.value,
)
function measure() {
  const el = track.value
  if (!el) return
  position.value = el.scrollLeft
  canScroll.value = el.scrollWidth > el.clientWidth + 2
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
}
function move(direction: number) {
  const el = track.value
  if (!el) return
  el.scrollTo({
    left: el.scrollLeft + direction * el.clientWidth,
    behavior: reduced.value ? 'instant' : 'smooth',
  })
}
function manual(direction: number) {
  paused.value = true
  move(direction)
}
function preference() {
  reduced.value = media?.matches ?? false
}
function blur(event: FocusEvent) {
  focused.value = !!(
    event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget)
  )
}
onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    preference()
    media.addEventListener('change', preference)
  } else reduced.value = true
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(([entry]) => {
      visible.value = !!entry?.isIntersecting
    })
    if (root.value) observer.observe(root.value)
  }
  if (typeof ResizeObserver !== 'undefined') {
    resize = new ResizeObserver(measure)
    if (track.value) resize.observe(track.value)
  }
  measure()
  timer = setInterval(() => {
    if (!auto.value || document.hidden || !canScroll.value) return
    if (atEnd.value) track.value?.scrollTo({ left: 0, behavior: 'smooth' })
    else move(1)
  }, 4500)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  observer?.disconnect()
  resize?.disconnect()
  media?.removeEventListener('change', preference)
})
</script>
<template>
  <div
    ref="root"
    class="partner-carousel"
    role="region"
    aria-label="Logos des partenaires"
    aria-roledescription="carrousel"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @focusin="focused = true"
    @focusout="blur"
  >
    <div
      ref="track"
      class="partner-track"
      tabindex="0"
      aria-label="Liste des partenaires, défilement horizontal"
      @scroll.passive="measure"
      @wheel.passive="paused = true"
      @touchstart.passive="paused = true"
      @keydown.left.prevent="manual(-1)"
      @keydown.right.prevent="manual(1)"
    >
      <article v-for="partner in props.partners" :key="partner.id" class="partner-logo-card">
        <a
          v-if="safeHttpUrl(partner.website_url)"
          :href="safeHttpUrl(partner.website_url)!"
          target="_blank"
          rel="noopener noreferrer"
          ><MediaImage :path="partner.logo_path" :alt="partner.name" contain /><span
            >{{ partner.name }} ↗</span
          ></a
        ><template v-else
          ><MediaImage :path="partner.logo_path" :alt="partner.name" contain /><span>{{
            partner.name
          }}</span></template
        ><small>{{ partner.category }}</small>
      </article>
    </div>
    <div v-if="canScroll" class="partner-controls">
      <button
        type="button"
        class="button button-outline"
        :disabled="position < 2"
        @click="manual(-1)"
        aria-label="Partenaires précédents"
      >
        ←</button
      ><button
        v-if="!reduced"
        type="button"
        class="button button-outline"
        :aria-pressed="paused"
        @click="paused = !paused"
      >
        {{ paused ? 'Animer' : 'Pause' }}</button
      ><button
        type="button"
        class="button button-outline"
        :disabled="atEnd"
        @click="manual(1)"
        aria-label="Partenaires suivants"
      >
        →
      </button>
    </div>
  </div>
</template>
