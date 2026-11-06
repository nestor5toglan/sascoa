<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getPreregSettings,
  savePreregSettings,
  preregSalons,
  listPreregistrations,
  reviewPreregistration,
  deletePreregistration,
} from '../../services/preregistration'
import { preregStatuses, preregInterests } from '../../types/preregistration'
import type { PreregSettings, PreregRequest } from '../../types/preregistration'
import { useAuthStore } from '../../stores/auth'
import { useRemote } from '../../composables/useRemote'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import { adminError } from '../../lib/adminValidation'
const auth = useAuthStore(),
  settings = ref<PreregSettings | null>(null),
  baseline = ref('null'),
  salons = ref<{ id: string; title: string }[]>([]),
  settingsError = ref(''),
  message = ref(''),
  saving = ref(false),
  page = ref(1),
  status = ref(''),
  interest = ref(''),
  selected = ref<PreregRequest | null>(null),
  selectedBaseline = ref('')
const requests = useRemote<{ items: PreregRequest[]; count: number }>({ items: [], count: 0 })
const dirty = computed(
  () =>
    JSON.stringify(settings.value) !== baseline.value ||
    (selected.value !== null && JSON.stringify(selected.value) !== selectedBaseline.value),
)
const { confirmDiscard } = useUnsavedChanges(dirty, saving)
const pages = computed(() => Math.max(1, Math.ceil(requests.data.value.count / 10)))
async function loadSettings() {
  settingsError.value = ''
  try {
    const [cfg, options] = await Promise.all([getPreregSettings(), preregSalons()])
    settings.value = cfg
    baseline.value = JSON.stringify(cfg)
    salons.value = options
  } catch (e) {
    settingsError.value = adminError(e)
  }
}
function changePage(value: number) {
  page.value = value
  void load()
}
async function load() {
  await requests.run(() => listPreregistrations(page.value, status.value, interest.value))
}
async function save() {
  if (!settings.value) return
  saving.value = true
  message.value = ''
  settingsError.value = ''
  try {
    settings.value = await savePreregSettings(settings.value)
    baseline.value = JSON.stringify(settings.value)
    message.value =
      'Configuration enregistrée. Recharge une page publique pour vérifier le formulaire.'
  } catch (e) {
    settingsError.value = adminError(e)
  } finally {
    saving.value = false
  }
}
function open(item: PreregRequest) {
  if (
    selected.value &&
    JSON.stringify(selected.value) !== selectedBaseline.value &&
    !window.confirm('Abandonner les modifications de cette demande ?')
  )
    return
  selected.value = { ...item }
  selectedBaseline.value = JSON.stringify(item)
  message.value = ''
}
async function remove(item: PreregRequest) {
  if (saving.value) return
  if (
    !window.confirm(
      `Supprimer définitivement la préinscription ${item.reference} de ${item.first_name} ${item.last_name} ? La préinscription, son message et son suivi seront effacés. Un dossier exposant déjà créé est conservé séparément. Cette action est irréversible.`,
    )
  )
    return
  saving.value = true
  message.value = ''
  try {
    await deletePreregistration(item)
    if (selected.value?.id === item.id) {
      selected.value = null
      selectedBaseline.value = ''
    }
    if (requests.data.value.items.length === 1 && page.value > 1) page.value--
    await load()
    message.value = 'Préinscription supprimée définitivement.'
  } catch (e) {
    message.value = adminError(e)
  } finally {
    saving.value = false
  }
}
async function review() {
  if (!selected.value) return
  saving.value = true
  message.value = ''
  try {
    await reviewPreregistration(selected.value)
    selected.value = null
    selectedBaseline.value = ''
    await load()
    message.value = 'Suivi enregistré.'
  } catch (e) {
    message.value = adminError(e)
  } finally {
    saving.value = false
  }
}
function close() {
  if (
    selected.value &&
    JSON.stringify(selected.value) !== selectedBaseline.value &&
    !window.confirm('Fermer sans enregistrer le suivi ?')
  )
    return
  selected.value = null
  selectedBaseline.value = ''
}
function reload() {
  if (confirmDiscard()) {
    selected.value = null
    void loadSettings()
    void load()
  }
}
onMounted(() => {
  void loadSettings()
  void load()
})
</script>
<template>
  <div class="prereg-admin">
    <p class="eyebrow">Administration · Salon</p>
    <h2>Préinscriptions</h2>
    <p>
      Ces demandes expriment un intérêt. Elles ne confirment ni participation, ni stand, ni
      paiement.
    </p>
    <p v-if="message" role="status" class="admin-alert">{{ message }}</p>
    <section class="admin-panel">
      <h3>Formulaire et pop-up</h3>
      <p v-if="settingsError" role="alert" class="admin-alert">{{ settingsError }}</p>
      <form v-if="settings" class="admin-form" @submit.prevent="save">
        <fieldset
          class="admin-fields"
          :disabled="saving || auth.busy"
          style="border: 0; padding: 0; min-width: 0"
        >
          <label
            >Salon concerné<select v-model="settings.event_id" aria-label="Salon concerné">
              <option :value="null">Choisir un salon</option>
              <option
                v-if="settings.event_id && !salons.some((s) => s.id === settings?.event_id)"
                :value="settings.event_id"
              >
                Salon sélectionné devenu indisponible — choisir un autre salon ou désactiver
              </option>
              <option v-for="salon in salons" :key="salon.id" :value="salon.id">
                {{ salon.title }}
              </option>
            </select></label
          >
          <p>
            Seuls les salons publiés dont la date de fin est à venir sont proposés. Au besoin, crée
            d’abord un événement de type Salon.
          </p>
          <label
            >Notice présentée au visiteur<textarea
              v-model="settings.notice"
              required
              minlength="30"
              maxlength="3000"
              rows="4"
            />
          </label>
          <label class="prereg-consent"
            ><input v-model="settings.enabled" type="checkbox" />Activer les préinscriptions et
            l’ouverture automatique après 3 secondes</label
          >
          <p>
            Le pop-up s’ouvre une fois par session de navigation, uniquement sur le site public. Le
            bouton permet toujours de le rouvrir. La fin du salon ou son archivage ferme
            automatiquement la collecte.
          </p>
          <button class="button" type="submit">
            {{ saving ? 'Enregistrement…' : 'Enregistrer la configuration' }}
          </button>
        </fieldset>
      </form>
      <button type="button" class="button button-outline" :disabled="saving" @click="reload">
        Recharger
      </button>
    </section>
    <section class="admin-panel">
      <h3>Demandes reçues</h3>
      <form class="admin-form" @submit.prevent="changePage(1)">
        <label
          >État du suivi<select v-model="status" aria-label="État du suivi">
            <option value="">Tous les états</option>
            <option v-for="(label, value) in preregStatuses" :key="value" :value="value">
              {{ label }}
            </option>
          </select></label
        ><label
          >Profil<select v-model="interest" aria-label="Profil des demandes">
            <option value="">Tous les profils</option>
            <option v-for="(label, value) in preregInterests" :key="value" :value="value">
              {{ label }}
            </option>
          </select></label
        ><button class="button" :disabled="requests.loading.value">Filtrer</button>
      </form>
      <p v-if="requests.loading.value" role="status">Chargement…</p>
      <div v-else-if="requests.error.value" role="alert">
        <p>{{ requests.error.value }}</p>
        <button class="button" @click="load">Réessayer</button>
      </div>
      <template v-else
        ><p>{{ requests.data.value.count }} demande(s)</p>
        <p v-if="!requests.data.value.items.length">Aucune préinscription pour ce filtre.</p>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Nom</th>
                <th>Profil</th>
                <th>Suivi</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in requests.data.value.items" :key="item.id">
                <td>{{ new Date(item.created_at).toLocaleDateString('fr-FR') }}</td>
                <td>{{ item.first_name }} {{ item.last_name }}</td>
                <td>{{ preregInterests[item.interest as keyof typeof preregInterests] }}</td>
                <td>{{ preregStatuses[item.status as keyof typeof preregStatuses] }}</td>
                <td>
                  <button class="button button-outline" :disabled="saving" @click="open(item)">
                    Consulter
                  </button>
                  <button
                    class="button button-outline danger-button"
                    type="button"
                    :disabled="saving"
                    @click="remove(item)"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <button class="button button-outline" :disabled="page <= 1" @click="changePage(page - 1)">
            Précédent</button
          ><span>Page {{ page }} / {{ pages }}</span
          ><button
            class="button button-outline"
            :disabled="page >= pages"
            @click="changePage(page + 1)"
          >
            Suivant
          </button>
        </div></template
      >
    </section>
    <section v-if="selected" class="admin-panel" aria-labelledby="request-title">
      <h3 id="request-title">{{ selected.first_name }} {{ selected.last_name }}</h3>
      <dl class="prereg-details">
        <div>
          <dt>Référence</dt>
          <dd>{{ selected.reference }}</dd>
        </div>
        <div>
          <dt>Salon (identifiant)</dt>
          <dd>{{ selected.event_id }}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{{ selected.email }}</dd>
        </div>
        <div>
          <dt>Téléphone</dt>
          <dd>{{ selected.phone || 'Non renseigné' }}</dd>
        </div>
        <div>
          <dt>Organisation</dt>
          <dd>{{ selected.organization || 'Non renseignée' }}</dd>
        </div>
        <div>
          <dt>Message</dt>
          <dd class="prereg-private-message">{{ selected.message || 'Aucun message' }}</dd>
        </div>
        <div>
          <dt>Notice acceptée le {{ new Date(selected.consent_at).toLocaleString('fr-FR') }}</dt>
          <dd>{{ selected.notice }}</dd>
        </div>
      </dl>
      <form class="admin-form" @submit.prevent="review">
        <fieldset
          class="admin-fields"
          :disabled="saving || auth.busy"
          style="border: 0; padding: 0; min-width: 0"
        >
          <label
            >Suivi<select v-model="selected.status" aria-label="Suivi">
              <option v-for="(label, value) in preregStatuses" :key="value" :value="value">
                {{ label }}
              </option>
            </select></label
          ><label
            >Note interne (administration uniquement)<textarea
              v-model="selected.internal_note"
              rows="4"
              maxlength="5000"
            /></label
          ><button class="button">Enregistrer le suivi</button>
        </fieldset>
      </form>
      <button class="button button-outline" :disabled="saving" @click="close">
        Fermer la demande
      </button>
    </section>
  </div>
</template>
