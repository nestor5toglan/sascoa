<script setup lang="ts">
import { ref, watch } from 'vue'
import MediaImage from '../ui/MediaImage.vue'
import { uploadCompanyLogo } from '../../services/adminMedia'
import { adminError } from '../../lib/adminValidation'
const props = defineProps<{ modelValue: string; disabled: boolean; savedAt?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; busy: [value: boolean] }>()
const uploading = ref(false)
const error = ref('')
const notice = ref('')
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
    const path = await uploadCompanyLogo(file)
    emit('update:modelValue', path)
    notice.value = 'Logo téléversé. Enregistre la fiche pour conserver ce choix.'
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
  notice.value = 'Le logo sera retiré de la fiche après enregistrement.'
}
</script>
<template>
  <div class="admin-logo-editor">
    <label for="company-logo">Logo de la structure <span class="muted">(facultatif)</span></label>
    <MediaImage
      v-if="modelValue"
      :path="modelValue"
      alt="Logo de la structure en cours d’édition"
      contain
    />
    <input
      id="company-logo"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      :disabled="disabled || uploading"
      aria-describedby="logo-help"
      @change="choose"
    />
    <p id="logo-help" class="admin-help">
      JPEG, PNG ou WebP, 2 Mo maximum. Le fichier reste privé tant que sa fiche n’est pas publiée.
    </p>
    <button
      v-if="modelValue"
      type="button"
      class="text-link"
      :disabled="disabled || uploading"
      @click="detach"
    >
      Retirer le logo de la fiche
    </button>
    <p v-if="uploading" role="status">Téléversement en cours…</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" class="admin-alert" role="alert">{{ error }}</p>
  </div>
</template>
