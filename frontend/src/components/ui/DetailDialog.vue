<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
function restore() {
  document.body.style.overflow = previousOverflow
  previousFocus?.focus()
}
async function sync(open: boolean) {
  await nextTick()
  if (open && dialog.value && !dialog.value.open) {
    previousFocus = document.activeElement as HTMLElement | null
    previousOverflow = document.body.style.overflow
    dialog.value.showModal()
    document.body.style.overflow = 'hidden'
  } else if (!open && dialog.value?.open) {
    dialog.value.close()
    restore()
  }
}
watch(() => props.open, sync)
onMounted(() => sync(props.open))
onBeforeUnmount(() => {
  if (dialog.value?.open) {
    dialog.value.close()
    restore()
  }
})
</script>
<template>
  <dialog
    ref="dialog"
    class="detail-dialog"
    aria-labelledby="detail-dialog-title"
    @cancel.prevent="emit('close')"
    @click="
      (event) => {
        if (event.target === dialog) emit('close')
      }
    "
  >
    <div class="dialog-inner">
      <div class="dialog-top">
        <p class="eyebrow">SASCOA · en détail</p>
        <button
          type="button"
          class="icon-button"
          aria-label="Fermer les détails"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
      <h2 id="detail-dialog-title">{{ title }}</h2>
      <slot />
      <button type="button" class="button button-outline dialog-bottom" @click="emit('close')">
        Fermer
      </button>
    </div>
  </dialog>
</template>
