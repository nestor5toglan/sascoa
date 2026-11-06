import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** Animations du site public, isolées et nettoyées à chaque changement de page. */
export function useSiteMotion(root: Ref<HTMLElement | null>, routePath: () => string) {
  let context: gsap.Context | undefined
  let observer: MutationObserver | undefined
  let media: MediaQueryList | undefined
  let frame = 0
  let active = false
  let seen = new WeakSet<Element>()
  let resizeObserver: ResizeObserver | undefined

  function revealNewContent() {
    if (!root.value || !context || media?.matches) return
    context.add(() => {
      const hero = root.value!.querySelector('.hero-copy')
      if (hero && !seen.has(hero)) {
        seen.add(hero)
        gsap.from(hero.children, {
          y: 18,
          opacity: 0,
          duration: 0.65,
          stagger: 0.08,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        })
        const poster = root.value!.querySelector('.poster-orbits')
        if (poster)
          gsap.from(poster, {
            rotation: -12,
            scale: 0.92,
            duration: 1.25,
            ease: 'power2.out',
            clearProps: 'transform',
          })
      }

      root.value!.querySelectorAll<HTMLElement>('.ambient-orb').forEach((orb, index) => {
        if (seen.has(orb)) return
        seen.add(orb)
        gsap.fromTo(
          orb,
          { yPercent: -12, xPercent: index % 2 ? -10 : 10 },
          {
            yPercent: 16,
            xPercent: index % 2 ? 10 : -10,
            ease: 'none',
            scrollTrigger: {
              trigger: orb.parentElement,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.5,
            },
          },
        )
      })
      const elements = root.value!.querySelectorAll<HTMLElement>(
        '.section-heading, .pillar-grid > article, .catalog-card, .partner-card, ' +
          '.closing-banner, .page-intro, .filter-bar, .footer-top > *',
      )
      elements.forEach((element) => {
        if (seen.has(element)) return
        seen.add(element)
        // Ne jamais cacher un élément dans lequel l'utilisateur est en train d'agir.
        if (element.contains(document.activeElement)) return
        gsap.fromTo(
          element,
          { y: 22, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            scrollTrigger: { trigger: element, start: 'top 94%', once: true },
          },
        )
      })
    })
    ScrollTrigger.refresh()
  }

  function scheduleRefresh() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      if (active) revealNewContent()
    })
  }

  function cleanup() {
    cancelAnimationFrame(frame)
    observer?.disconnect()
    resizeObserver?.disconnect()
    context?.revert()
    context = undefined
    seen = new WeakSet<Element>()
  }

  function setup() {
    cleanup()
    if (!active || !root.value || media?.matches) return
    // Le contenu reste visible dans le CSS, même si les animations sont désactivées.
    context = gsap.context(() => {}, root.value)
    revealNewContent()
    observer = new MutationObserver(scheduleRefresh)
    observer.observe(root.value, { childList: true, subtree: true })
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleRefresh)
      resizeObserver.observe(root.value)
    }
  }

  const stop = watch(
    routePath,
    async () => {
      cleanup()
      await nextTick()
      if (active) setup()
    },
    { flush: 'post' },
  )

  onMounted(() => {
    active = true
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    media.addEventListener('change', setup)
    setup()
  })
  onBeforeUnmount(() => {
    active = false
    stop()
    media?.removeEventListener('change', setup)
    cleanup()
  })
}
