<script setup lang="ts">
import { ref, watch } from 'vue'
import { supabase } from '../../lib/supabase'
const props = defineProps<{ path: string }>()
const url = ref('')
const error = ref(false)
let version = 0
watch(
  () => props.path,
  async (path) => {
    const current = ++version
    url.value = ''
    error.value = false
    try {
      if (!path || path.includes('..') || path.startsWith('/')) throw new Error('Chemin invalide')
      const { data, error: cause } = await supabase.storage
        .from('sascoa-media')
        .createSignedUrl(path, 3600)
      if (cause) throw cause
      if (current === version) url.value = data.signedUrl
    } catch {
      if (current === version) error.value = true
    }
  },
  { immediate: true },
)
</script>
<template>
  <a v-if="url" :href="url" target="_blank" rel="noopener noreferrer" class="button button-outline"
    >Ouvrir le programme PDF ↗</a
  >
  <p v-else-if="error" class="muted">Le programme PDF est momentanément indisponible.</p>
  <p v-else role="status">Préparation du programme PDF…</p>
</template>
