<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  page: number
  total: number
  size: number
  busy: boolean
}>()
defineEmits<{ change: [page: number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)))
</script>
<template>
  <nav v-if="pages > 1" class="pagination" aria-label="Pagination des résultats">
    <button
      type="button"
      class="button button-outline"
      :disabled="busy || page <= 1"
      @click="$emit('change', page - 1)"
    >
      ← Précédent
    </button>
    <span aria-live="polite">Page {{ page }} sur {{ pages }}</span>
    <button
      type="button"
      class="button button-outline"
      :disabled="busy || page >= pages"
      @click="$emit('change', page + 1)"
    >
      Suivant →
    </button>
  </nav>
</template>
