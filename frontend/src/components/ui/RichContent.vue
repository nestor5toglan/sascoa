<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { safeRichHtml } from '../../lib/richText'
import { supabase } from '../../lib/supabase'
const props = defineProps<{ value?: string | null }>(),
  root = ref<HTMLElement | null>(null),
  html = ref('')
let version = 0
watch(
  () => props.value,
  async (value) => {
    const current = ++version
    html.value = safeRichHtml(value)
    await nextTick()
    if (current !== version) return
    const images = Array.from(
      root.value?.querySelectorAll<HTMLImageElement>('img[data-media-path]') || [],
    )
    await Promise.all(
      images.map(async (img) => {
        const path = img.dataset.mediaPath!
        try {
          const { data, error } = await supabase.storage
            .from('sascoa-media')
            .createSignedUrl(path, 3600)
          if (current === version && root.value?.contains(img) && !error && data?.signedUrl) {
            img.src = data.signedUrl
            img.loading = 'lazy'
            img.onerror = () => {
              img.removeAttribute('src')
              img.classList.add('rich-image-unavailable')
            }
          }
        } catch {
          /* Le texte alternatif reste disponible. */
        }
      }),
    )
  },
  { immediate: true },
)
onBeforeUnmount(() => version++)
</script>
<template><div ref="root" class="rich-content" v-html="html" /></template>
