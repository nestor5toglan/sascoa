<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import MediaImage from './MediaImage.vue'
defineProps<{ path: string; alt: string }>()
const dialog = ref<HTMLDialogElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
let overflow = ''
function open() {
  if (!dialog.value || dialog.value.open) return
  overflow = document.body.style.overflow
  dialog.value.showModal()
  document.body.style.overflow = 'hidden'
}
function restore() {
  document.body.style.overflow = overflow
  trigger.value?.focus({ preventScroll: true })
}
function close() {
  dialog.value?.close()
}
onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close()
    restore()
  }
})
</script>
<template>
  <div class="zoomable-image">
    <button
      ref="trigger"
      class="salon-poster-button"
      type="button"
      :aria-label="`Agrandir le visuel : ${alt}`"
      @click="open"
    >
      <MediaImage :path="path" :alt="alt" contain />
      <span class="zoom-caption">Voir le visuel en grand <span aria-hidden="true">⤢</span></span>
    </button>
    <dialog
      ref="dialog"
      class="salon-lightbox"
      :aria-label="`Visuel agrandi : ${alt}`"
      @close="restore"
      @cancel.prevent="close"
      @click="
        (event) => {
          if (event.target === dialog) close()
        }
      "
    >
      <button class="button lightbox-close" type="button" autofocus @click="close">Fermer ✕</button>
      <MediaImage :path="path" :alt="alt" contain />
      <p>{{ alt }}</p>
    </dialog>
  </div>
</template>
