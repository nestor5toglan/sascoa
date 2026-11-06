<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listContactMessages, reviewContact } from '../../services/contact'
import { contactStatuses } from '../../types/contact'
import type { ContactMessage } from '../../types/contact'
import { useRemote } from '../../composables/useRemote'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import { useAuthStore } from '../../stores/auth'
import { adminError } from '../../lib/adminValidation'
const auth = useAuthStore(),
  remote = useRemote<{ items: ContactMessage[]; count: number }>({ items: [], count: 0 }),
  page = ref(1),
  filter = ref(''),
  applied = ref(''),
  selected = ref<ContactMessage | null>(null),
  baseline = ref('null'),
  busy = ref(false),
  notice = ref('')
const dirty = computed(() => JSON.stringify(selected.value) !== baseline.value)
const { confirmDiscard } = useUnsavedChanges(dirty, busy)
const pages = computed(() => Math.max(1, Math.ceil(remote.data.value.count / 10)))
const load = () => remote.run(() => listContactMessages(page.value, applied.value))
function search() {
  applied.value = filter.value
  page.value = 1
  void load()
}
function paginate(value: number) {
  page.value = value
  void load()
}
function open(value: ContactMessage) {
  if (!confirmDiscard()) return
  selected.value = { ...value }
  baseline.value = JSON.stringify(selected.value)
  notice.value = ''
}
function close() {
  if (!confirmDiscard()) return
  selected.value = null
  baseline.value = 'null'
}
async function save() {
  if (!selected.value || busy.value) return
  busy.value = true
  notice.value = ''
  try {
    await reviewContact(selected.value)
    selected.value = null
    baseline.value = 'null'
    await load()
    notice.value = 'Suivi du message enregistré.'
  } catch (e) {
    notice.value = adminError(e)
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>
<template>
  <div class="prereg-admin">
    <header class="admin-page-heading">
      <p class="eyebrow">Administration · Contact</p>
      <h2>Messages reçus</h2>
      <p>
        Les messages envoyés depuis la page Contact arrivent ici. La réponse se fait avec votre
        messagerie habituelle.
      </p>
    </header>
    <p v-if="notice" class="admin-alert" role="status">{{ notice }}</p>
    <section class="admin-panel">
      <form class="admin-form" @submit.prevent="search">
        <label for="contact-filter">État du message</label
        ><select id="contact-filter" v-model="filter">
          <option value="">Tous les états</option>
          <option v-for="(label, value) in contactStatuses" :key="value" :value="value">
            {{ label }}
          </option></select
        ><button class="button" :disabled="remote.loading.value">Filtrer</button>
      </form>
      <p v-if="remote.loading.value" role="status">Chargement…</p>
      <div v-else-if="remote.error.value" role="alert">
        <p>{{ remote.error.value }}</p>
        <button class="button" @click="load">Réessayer</button>
      </div>
      <template v-else
        ><p>{{ remote.data.value.count }} message(s)</p>
        <p v-if="!remote.data.value.items.length">Aucun message pour ce filtre.</p>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Nom</th>
                <th>Objet</th>
                <th>État</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in remote.data.value.items" :key="item.id">
                <td>{{ new Date(item.created_at).toLocaleDateString('fr-FR') }}</td>
                <td>{{ item.full_name }}</td>
                <td>{{ item.subject }}</td>
                <td>{{ contactStatuses[item.status as keyof typeof contactStatuses] }}</td>
                <td>
                  <button class="button button-outline" :disabled="busy" @click="open(item)">
                    Lire le message
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <nav class="pagination" aria-label="Pagination des messages">
          <button class="button button-outline" :disabled="page <= 1" @click="paginate(page - 1)">
            Précédent</button
          ><span>Page {{ page }} / {{ pages }}</span
          ><button
            class="button button-outline"
            :disabled="page >= pages"
            @click="paginate(page + 1)"
          >
            Suivant
          </button>
        </nav></template
      >
    </section>
    <section v-if="selected" class="admin-panel">
      <h3>{{ selected.subject }}</h3>
      <dl class="prereg-details">
        <div>
          <dt>Référence</dt>
          <dd>{{ selected.reference }}</dd>
        </div>
        <div>
          <dt>Expéditeur</dt>
          <dd>{{ selected.full_name }} · {{ selected.email }}</dd>
        </div>
        <div>
          <dt>Téléphone / organisation</dt>
          <dd>
            {{ selected.phone || 'Non renseigné' }} ·
            {{ selected.organization || 'Non renseignée' }}
          </dd>
        </div>
        <div>
          <dt>Message</dt>
          <dd class="prereg-private-message">{{ selected.message }}</dd>
        </div>
        <div v-if="selected.notice">
          <dt>Notice enregistrée</dt>
          <dd>{{ selected.notice }}</dd>
        </div>
      </dl>
      <form class="admin-form" @submit.prevent="save">
        <fieldset class="admin-fields" :disabled="busy || auth.busy">
          <div class="field">
            <label for="message-status">État du suivi</label
            ><select id="message-status" v-model="selected.status">
              <option v-for="(label, value) in contactStatuses" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="message-note">Note interne</label
            ><textarea
              id="message-note"
              v-model="selected.internal_note"
              maxlength="5000"
              rows="4"
            />
          </div>
          <div class="admin-form-actions">
            <button class="button">Enregistrer le suivi</button
            ><button class="button button-outline" type="button" @click="close">Fermer</button>
          </div>
        </fieldset>
      </form>
    </section>
  </div>
</template>
