<script setup lang="ts">
import { plainText } from '../lib/richText'
import MediaImage from './ui/MediaImage.vue'
import { dateLabel, eventType, shortText } from '../lib/presentation'
import type { SalonEvent } from '../types/public'
defineProps<{ event: SalonEvent }>()
defineEmits<{ open: [event: SalonEvent] }>()
</script>
<template>
  <article class="catalog-card event-card">
    <div class="event-visual">
      <MediaImage :path="event.cover_image_path" :alt="event.title" /><span class="visual-badge">{{
        eventType(event.event_type)
      }}</span>
    </div>
    <div class="card-body">
      <span v-if="event.is_demo" class="demo-badge">Dates fictives · démonstration</span>
      <p class="event-date">{{ dateLabel(event.starts_at, event.timezone) }}</p>
      <h3>{{ event.title }}</h3>
      <p>{{ shortText(plainText(event.description)) }}</p>
      <p class="location">
        <span aria-hidden="true">⌖</span>
        {{ event.location || 'Lieu à confirmer' }}
      </p>
      <button type="button" class="text-link" @click="$emit('open', event)">
        Voir les détails <span aria-hidden="true">↗</span
        ><span class="sr-only"> de {{ event.title }}</span>
      </button>
    </div>
  </article>
</template>
