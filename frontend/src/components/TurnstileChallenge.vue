<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
const props = withDefaults(defineProps<{ action?: string }>(), { action: 'salon-preregistration' })
const emit = defineEmits<{ token: [value: string] }>()
const container = ref<HTMLElement | null>(null),
  error = ref('')
interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string
  remove(id: string): void
  reset(id: string): void
}
const api = () => (window as unknown as { turnstile?: Turnstile }).turnstile
let widget: string | undefined,
  disposed = false
async function mountWidget() {
  try {
    const key = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
    if (!key) {
      error.value = 'La vérification anti-robot doit être configurée par l’organisation.'
      return
    }
    if (!api())
      await new Promise<void>((resolve, reject) => {
        let script = document.querySelector<HTMLScriptElement>('script[data-sascoa-turnstile]')
        if (!script) {
          script = document.createElement('script')
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
          script.dataset.sascoaTurnstile = 'true'
          script.async = true
          document.head.appendChild(script)
        }
        const timeout = setTimeout(() => reject(new Error('timeout')), 12000)
        script.addEventListener(
          'load',
          () => {
            clearTimeout(timeout)
            resolve()
          },
          { once: true },
        )
        script.addEventListener(
          'error',
          () => {
            clearTimeout(timeout)
            script?.remove()
            reject(new Error('network'))
          },
          { once: true },
        )
      })
    if (disposed || !container.value) return
    widget = api()!.render(container.value, {
      sitekey: key,
      action: props.action,
      language: 'fr',
      size: 'flexible',
      callback: (t: string) => emit('token', t),
      'expired-callback': () => emit('token', ''),
      'error-callback': () => {
        emit('token', '')
        error.value = 'Vérification indisponible. Ferme puis rouvre le formulaire pour réessayer.'
      },
    })
  } catch {
    error.value =
      'La vérification anti-robot ne charge pas. Vérifie ta connexion puis rouvre le formulaire.'
  }
}
function reset() {
  emit('token', '')
  if (widget) api()?.reset(widget)
}
defineExpose({ reset })
onMounted(mountWidget)
onBeforeUnmount(() => {
  disposed = true
  if (widget) api()?.remove(widget)
})
</script>
<template>
  <div>
    <div ref="container" />
    <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
  </div>
</template>
