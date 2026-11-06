<script setup lang="ts">
import { ref, watch } from 'vue'
import { supabase } from '../../lib/supabase'
const props = defineProps<{
  path?: string | null
  alt: string
  contain?: boolean
}>()
const source = ref('')
let version = 0
watch(
  () => props.path,
  async (path) => {
    const current = ++version
    source.value = ''
    if (!path || path.includes('..') || path.startsWith('/')) return
    try {
      const { data, error } = await supabase.storage
        .from('sascoa-media')
        .createSignedUrl(path, 3600)
      if (current === version && !error && data?.signedUrl) source.value = data.signedUrl
    } catch {
      /* Le texte de remplacement reste affiché. */
    }
  },
  { immediate: true },
)
</script>
<template>
  <div class="media-image" :class="{ 'media-contain': contain }">
    <img v-if="source" :src="source" :alt="alt" loading="lazy" @error="source = ''" />
    <div v-else class="media-placeholder" role="img" :aria-label="alt">
      <span aria-hidden="true">S</span><small>{{ alt }}</small>
    </div>
  </div>
</template>
