<script setup lang="ts">
import { ref, watch } from 'vue'
import { supabase } from '../../lib/supabase'
const props = defineProps<{ path: string }>()
const url = ref('')
const downloadUrl = ref('')
const error = ref(false)
let version = 0
watch(
  () => props.path,
  async (path) => {
    const current = ++version
    url.value = ''
    downloadUrl.value = ''
    error.value = false
    try {
      if (!path || path.includes('..') || path.startsWith('/')) throw new Error('Chemin invalide')
      const { data, error: cause } = await supabase.storage
        .from('sascoa-media')
        .createSignedUrl(path, 3600)
      if (cause) throw cause
      const download = await supabase.storage
        .from('sascoa-media')
        .createSignedUrl(path, 3600, { download: 'programme-sascoa.pdf' })
        .catch(() => ({ data: null, error: true }))
      if (current === version) {
        url.value = data.signedUrl
        if (!download.error) downloadUrl.value = download.data?.signedUrl || ''
      }
    } catch {
      if (current === version) error.value = true
    }
  },
  { immediate: true },
)
</script>
<template>
  <div v-if="url" class="program-download-actions">
    <a :href="url" target="_blank" rel="noopener noreferrer" class="button button-outline"
      >Ouvrir le programme PDF ↗</a
    >
    <a v-if="downloadUrl" :href="downloadUrl" class="button" download="programme-sascoa.pdf"
      >Télécharger le programme ↓</a
    >
    <p v-else class="muted">
      Le téléchargement est momentanément indisponible ; vous pouvez ouvrir le PDF.
    </p>
  </div>
  <p v-else-if="error" class="muted">Le programme PDF est momentanément indisponible.</p>
  <p v-else role="status">Préparation du programme PDF…</p>
</template>
