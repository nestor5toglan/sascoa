<script setup lang="ts">
defineProps<{
  loading: boolean
  error: string
  empty: boolean
  emptyTitle: string
  emptyText: string
}>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <div v-if="loading" class="state-box" role="status">
    <span class="loader" aria-hidden="true"></span>
    <p>Chargement en cours…</p>
  </div>
  <div v-else-if="error" class="state-box state-error" role="alert">
    <h3>Le contenu n’a pas pu être chargé</h3>
    <p>{{ error }}</p>
    <button type="button" class="button button-outline" @click="$emit('retry')">Réessayer</button>
  </div>
  <div v-else-if="empty" class="state-box">
    <span class="empty-symbol" aria-hidden="true">↗</span>
    <h3>{{ emptyTitle }}</h3>
    <p>{{ emptyText }}</p>
    <slot />
  </div>
</template>
