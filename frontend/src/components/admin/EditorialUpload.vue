<script setup lang="ts">
import { ref, watch } from 'vue'
import { uploadEditorialFile } from '../../services/adminMedia'
import { adminError } from '../../lib/adminValidation'
import MediaImage from '../ui/MediaImage.vue'
import DocumentLink from '../ui/DocumentLink.vue'
const props = defineProps<{
  modelValue: string
  kind: 'image' | 'pdf'
  folder: 'events' | 'pages'
  label: string
  inputId: string
  disabled: boolean
  savedAt?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; busy: [value: boolean] }>()
const uploading = ref(false),
  error = ref(''),
  notice = ref('')
watch(
  () => props.savedAt,
  () => {
    notice.value = ''
  },
)
async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || props.disabled || uploading.value) return
  uploading.value = true
  emit('busy', true)
  error.value = ''
  notice.value = ''
  try {
    emit('update:modelValue', await uploadEditorialFile(file, props.folder, props.kind))
    notice.value = 'Fichier téléversé. Enregistre le contenu pour conserver ce choix.'
  } catch (cause) {
    error.value = adminError(cause)
  } finally {
    uploading.value = false
    emit('busy', false)
    input.value = ''
  }
}
function detach() {
  emit('update:modelValue', '')
  notice.value = 'Le fichier sera détaché après enregistrement.'
}
</script>
<template>
  <div class="admin-logo-editor">
    <label :for="inputId">{{ label }} <span class="muted">(facultatif)</span></label>
    <MediaImage v-if="modelValue && kind === 'image'" :path="modelValue" :alt="label" contain />
    <DocumentLink v-if="modelValue && kind === 'pdf'" :path="modelValue" />
    <input
      :id="inputId"
      type="file"
      :accept="kind === 'image' ? 'image/jpeg,image/png,image/webp' : 'application/pdf'"
      :disabled="disabled || uploading"
      @change="choose"
    />
    <p class="admin-help">
      {{ kind === 'image' ? 'JPEG, PNG ou WebP, 2 Mo maximum.' : 'PDF, 10 Mo maximum.' }} Le fichier
      devient lisible par les visiteurs lorsque son contenu est publié.
    </p>
    <button
      v-if="modelValue"
      type="button"
      class="text-link"
      :disabled="disabled || uploading"
      @click="detach"
    >
      Retirer de ce contenu
    </button>
    <p v-if="uploading" role="status">Téléversement en cours…</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
  </div>
</template>
