import { onMounted, onBeforeUnmount, ref, type Ref } from 'vue'
import { gsap } from 'gsap'
export function useIllustrationMotion(root: Ref<HTMLElement | null>) {
  const paused = ref(false),
    reduced = ref(false)
  let context: gsap.Context | undefined,
    timeline: gsap.core.Timeline | undefined,
    media: MediaQueryList | undefined,
    observer: IntersectionObserver | undefined,
    visible = false
  function sync() {
    reduced.value = media?.matches ?? false
    if (paused.value || reduced.value || !visible || document.hidden) timeline?.pause()
    else timeline?.resume()
  }
  function toggle() {
    paused.value = !paused.value
    sync()
  }
  onMounted(() => {
    if (typeof window.matchMedia !== 'function' || typeof IntersectionObserver === 'undefined') {
      reduced.value = true
      return
    }
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.value = media.matches
    context = gsap.context(() => {
      timeline = gsap
        .timeline({ repeat: -1, yoyo: true, paused: true })
        .to(
          '.art-float',
          { y: -14, rotation: 3, duration: 4, stagger: 0.45, ease: 'sine.inOut' },
          0,
        )
        .to(
          '.art-orbit',
          { rotation: 18, transformOrigin: '50% 50%', duration: 7, ease: 'sine.inOut' },
          0,
        )
        .to('.art-flow', { strokeDashoffset: -80, duration: 7, ease: 'none' }, 0)
    }, root.value!)
    observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false
        sync()
      },
      { threshold: 0.08 },
    )
    if (root.value) observer.observe(root.value)
    media.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    sync()
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    media?.removeEventListener('change', sync)
    document.removeEventListener('visibilitychange', sync)
    context?.revert()
  })
  return { paused, reduced, toggle }
}
