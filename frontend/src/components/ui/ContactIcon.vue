<script setup lang="ts">
defineProps<{ kind: 'email' | 'phone' | 'location' | 'facebook' }>()
</script>
<template>
  <svg
    class="contact-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <g v-if="kind === 'email'">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </g>
    <path
      v-else-if="kind === 'phone'"
      d="M8 3H5a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 3a14 14 0 0 1-7-7l3-2-2-5Z"
    />
    <g v-else-if="kind === 'location'">
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </g>
    <path v-else d="M14 22v-9h3l.5-4H14V7c0-1 .5-2 2-2h2V1h-3c-4 0-6 2-6 6v2H6v4h3v9" />
  </svg>
</template>
