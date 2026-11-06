<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { gsap } from 'gsap'
import type { GlobeInstance } from 'globe.gl'
import { africaContacts } from '../data/globeContacts'
const host = ref<HTMLElement | null>(null),
  failure = ref(''),
  loading = ref(true),
  paused = ref(false),
  reduced = ref(false)
let globe: GlobeInstance | undefined,
  resize: ResizeObserver | undefined,
  intersection: IntersectionObserver | undefined,
  media: MediaQueryList | undefined,
  visible = true,
  disposed = false,
  enter: gsap.core.Tween | undefined
let renderFrame = 0
const abort = new AbortController()
function motion() {
  if (!globe) return
  const stop = paused.value || reduced.value || !visible || document.hidden
  if (stop) {
    globe.controls().autoRotate = false
    globe.pauseAnimation()
  } else {
    globe.controls().autoRotate = true
    globe.resumeAnimation()
  }
}
function preference() {
  reduced.value = media?.matches ?? false
  motion()
}
watch(paused, motion)
onMounted(async () => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  preference()
  media.addEventListener('change', preference)
  document.addEventListener('visibilitychange', motion)
  try {
    const [{ default: Globe }, response] = await Promise.all([
      import('globe.gl'),
      fetch(`${import.meta.env.BASE_URL}globe/countries.json`, { signal: abort.signal }),
    ])
    if (!response.ok) throw new Error('countries')
    const countries = await response.json()
    if (disposed || !host.value) return
    const hub = africaContacts[0]!
    const arcs = africaContacts.slice(1).map((target) => ({
      startLat: hub.lat,
      startLng: hub.lng,
      endLat: target.lat,
      endLng: target.lng,
      color: ['#ffffff', '#f8f2ee'],
    }))
    for (const [fromId, toId] of [
      ['abidjan', 'dakar'],
      ['lagos', 'douala'],
      ['nairobi', 'kigali'],
      ['casablanca', 'dakar'],
      ['johannesburg', 'nairobi'],
    ]) {
      const from = africaContacts.find((p) => p.id === fromId),
        to = africaContacts.find((p) => p.id === toId)
      if (from && to)
        arcs.push({
          startLat: from.lat,
          startLng: from.lng,
          endLat: to.lat,
          endLng: to.lng,
          color: ['#ffffff', '#f8f2ee'],
        })
    }
    globe = Globe({ animateIn: !reduced.value })(host.value)
      .width(host.value.clientWidth)
      .height(host.value.clientHeight)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#f8f2ee')
      .atmosphereAltitude(0.15)
      .arcsData(arcs)
      .arcColor('color')
      .arcDashLength(0.5)
      .arcDashGap(2)
      .arcDashAnimateTime(reduced.value ? 0 : 1800)
      .arcStroke(0.8)
      .arcAltitude(0.18)
      .polygonsTransitionDuration(0)
      .arcsTransitionDuration(0)
      .htmlTransitionDuration(0)
      .polygonsData(countries.features)
      .polygonCapColor((obj: object) =>
        (obj as { properties: { CONTINENT: string } }).properties.CONTINENT === 'Africa'
          ? '#640b25'
          : '#4a081b',
      )
      .polygonSideColor(() => 'rgba(100,11,37,.9)')
      .polygonStrokeColor((obj: object) =>
        (obj as { properties: { CONTINENT: string } }).properties.CONTINENT === 'Africa'
          ? '#f8f2ee'
          : 'rgba(248,242,238,.15)',
      )
      .polygonAltitude((obj: object) =>
        (obj as { properties: { CONTINENT: string } }).properties.CONTINENT === 'Africa'
          ? 0.02
          : 0.005,
      )
      .htmlElementsData(africaContacts)
      .htmlElement((obj: object) => {
        const d = obj as typeof hub,
          isHub = d.id === 'lome',
          el = document.createElement('div')
        el.className = `globe-avatar${isHub ? ' globe-avatar-hub' : ''}`
        const pulse = document.createElement('span')
        pulse.className = 'globe-avatar-pulse'
        const frame = document.createElement('span')
        frame.className = 'globe-avatar-frame'
        frame.textContent = d.name.slice(0, 1)
        const img = document.createElement('img')
        img.src = `${import.meta.env.BASE_URL}globe/portraits/${d.id}.jpg`
        img.alt = ''
        img.loading = 'lazy'
        img.referrerPolicy = 'no-referrer'
        img.addEventListener('error', () => img.remove(), { once: true })
        frame.append(img)
        const tip = document.createElement('span')
        tip.className = 'globe-tooltip'
        const name = document.createElement('strong')
        name.textContent = d.name
        const role = document.createElement('span')
        role.textContent = d.role
        tip.append(name, role)
        el.append(pulse, frame, tip)
        return el
      })
    globe.controls().enableZoom = false
    globe.controls().autoRotateSpeed = 0.5
    globe.controls().enablePan = false
    globe.pointOfView({ lat: 5, lng: 20, altitude: 2.1 }, 0)
    resize = new ResizeObserver(() => {
      if (globe && host.value) {
        globe.width(host.value.clientWidth).height(host.value.clientHeight)
        // Redessiner aussi un globe mis en pause après un changement de taille.
        globe.resumeAnimation()
        cancelAnimationFrame(renderFrame)
        renderFrame = requestAnimationFrame(() => {
          renderFrame = requestAnimationFrame(motion)
        })
      }
    })
    resize.observe(host.value)
    intersection = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false
        motion()
      },
      { threshold: 0.05 },
    )
    intersection.observe(host.value)
    loading.value = false
    motion()
    if (!reduced.value)
      enter = gsap.fromTo(
        host.value,
        { opacity: 0, scale: 0.8 },
        {
          opacity: 1,
          scale: 1,
          duration: 1.8,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
      )
  } catch {
    if (!disposed) {
      loading.value = false
      failure.value = 'Le globe 3D ne peut pas être affiché sur ce navigateur.'
    }
  }
})
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(renderFrame)
  abort.abort()
  resize?.disconnect()
  intersection?.disconnect()
  media?.removeEventListener('change', preference)
  document.removeEventListener('visibilitychange', motion)
  enter?.kill()
  globe?._destructor()
  globe = undefined
})
</script>
<template>
  <div class="africa-globe" :class="{ 'globe-still': paused || reduced }">
    <div
      ref="host"
      class="globe-host"
      role="img"
      aria-label="Globe illustratif de l’Afrique avec portraits et connexions animées"
    />
    <p v-if="loading" class="globe-state" role="status">Le réseau prend forme…</p>
    <p v-if="failure" class="globe-state" role="status">{{ failure }}</p>
    <div class="globe-controls">
      <span>Réseau illustratif · profils de démonstration</span
      ><button
        v-if="!failure && !reduced"
        type="button"
        :aria-pressed="paused"
        @click="paused = !paused"
      >
        {{ paused ? 'Animer' : 'Pause' }}
      </button>
    </div>
  </div>
</template>
