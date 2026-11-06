<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from './lib/supabase'

type Sector = {
  id: string
  name: string
}

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const sectors = ref<Sector[]>([])
const connectionSucceeded = ref(false)

async function testConnection() {
  if (loading.value) return

  loading.value = true
  errorMessage.value = null
  connectionSucceeded.value = false
  sectors.value = []

  try {
    const { data, error } = await supabase
      .from('activity_sectors')
      .select('id, name')
      .order('name')
      .limit(5)

    if (error) throw error

    sectors.value = data ?? []
    connectionSucceeded.value = true
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : 'Impossible de contacter Supabase.'
  } finally {
    loading.value = false
  }
}

onMounted(testConnection)
</script>

<template>
  <main class="connection-page">
    <section class="connection-card" aria-labelledby="page-title">
      <p class="brand">SASCOA</p>
      <h1 id="page-title">Test de connexion</h1>
      <p>Vérification de la lecture des secteurs d’activité dans Supabase.</p>

      <div aria-live="polite" :aria-busy="loading">
        <p v-if="loading" class="status">Connexion en cours…</p>

        <div v-else-if="errorMessage" class="status error">
          <strong>La lecture a échoué.</strong>
          <p>{{ errorMessage }}</p>
        </div>

        <div v-else-if="connectionSucceeded" class="status success">
          <strong>Connexion réussie à Supabase.</strong>

          <p v-if="sectors.length === 0">
            Aucun secteur visible pour le moment. C’est normal si la table est vide.
          </p>

          <ul v-else>
            <li v-for="sector in sectors" :key="sector.id">
              {{ sector.name }}
            </li>
          </ul>
        </div>
      </div>

      <button type="button" :disabled="loading" @click="testConnection">
        {{ loading ? 'Vérification…' : 'Relancer le test' }}
      </button>
    </section>
  </main>
</template>

<style scoped>
.connection-page {
  min-height: 100svh;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #faf6f7;
  color: #282027;
  font-family: Arial, sans-serif;
}

.connection-card {
  box-sizing: border-box;
  width: 100%;
  max-width: 620px;
  padding: clamp(24px, 5vw, 40px);
  border: 1px solid #e7dce0;
  border-radius: 20px;
  background: #fff;
}

.brand {
  margin: 0 0 20px;
  color: #640b25;
  font-weight: 800;
  letter-spacing: 0.12em;
}

h1 {
  margin: 0 0 12px;
  font-size: clamp(26px, 5vw, 36px);
}

p,
li {
  line-height: 1.6;
}

.status {
  margin: 24px 0;
  padding: 18px;
  border-radius: 12px;
  background: #f1edf0;
  overflow-wrap: anywhere;
}

.success {
  color: #175338;
  background: #edf8f1;
}

.error {
  color: #8a2020;
  background: #fff0f0;
}

.status p:last-child {
  margin-bottom: 0;
}

button {
  min-height: 46px;
  padding: 12px 20px;
  border: 0;
  border-radius: 10px;
  background: #640b25;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

button:focus-visible {
  outline: 3px solid #b66a82;
  outline-offset: 4px;
}
</style>
