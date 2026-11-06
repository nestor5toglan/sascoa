<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type {
  Program,
  ProgramSettings,
  ProgramApplication,
  ApplicationStatus,
} from '../../types/applications'
import { applicationStatuses } from '../../types/applications'
import {
  getProgramSettings,
  saveProgramSettings,
  listApplications,
  reviewApplication,
  applicationPdfLink,
} from '../../services/applications'
import { exhibitorSalons } from '../../services/exhibitors'
import { useAuthStore } from '../../stores/auth'
import { useRemote } from '../../composables/useRemote'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
const props = defineProps<{ program: Program }>(),
  auth = useAuthStore(),
  settings = ref<ProgramSettings | null>(null),
  settingsBase = ref('null'),
  deadline = ref(''),
  deadlineBase = ref(''),
  salons = ref<Awaited<ReturnType<typeof exhibitorSalons>>>([]),
  busy = ref(false),
  error = ref(''),
  message = ref(''),
  selected = ref<ProgramApplication | null>(null),
  selectedBase = ref('null'),
  filter = ref<ApplicationStatus | 'all'>('all'),
  applied = ref<ApplicationStatus | 'all'>('all'),
  page = ref(1),
  pdfUrl = ref(''),
  pdfExpires = ref(0),
  now = ref(Date.now())
const name = computed(() => (props.program === 'pitch' ? 'Pitch' : 'Hackathon')),
  remote = useRemote<{ items: ProgramApplication[]; count: number }>({ items: [], count: 0 })
const dirty = computed(
  () =>
    JSON.stringify(settings.value) !== settingsBase.value ||
    deadline.value !== deadlineBase.value ||
    JSON.stringify(selected.value) !== selectedBase.value,
)
const { confirmDiscard } = useUnsavedChanges(dirty, busy),
  pages = computed(() => Math.max(1, Math.ceil(remote.data.value.count / 10))),
  pdfValid = computed(() => pdfUrl.value && now.value < pdfExpires.value)
let timer: ReturnType<typeof setInterval> | undefined
function explain(e: unknown) {
  return e && typeof e === 'object' && 'message' in e
    ? String(e.message)
    : 'Impossible de terminer cette opération. Réessaie.'
}
async function action(fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = explain(e)
  } finally {
    busy.value = false
  }
}
const load = () => remote.run(() => listApplications(props.program, page.value, applied.value))
async function init() {
  selected.value = null
  selectedBase.value = 'null'
  pdfUrl.value = ''
  settings.value = null
  settingsBase.value = 'null'
  deadline.value = ''
  deadlineBase.value = ''
  page.value = 1
  filter.value = 'all'
  applied.value = 'all'
  remote.data.value = { items: [], count: 0 }
  await action(async () => {
    const [cfg, events] = await Promise.all([getProgramSettings(props.program), exhibitorSalons()])
    settings.value = cfg
    settingsBase.value = JSON.stringify(cfg)
    deadline.value = cfg.deadline ? new Date(cfg.deadline).toISOString().slice(0, 16) : ''
    deadlineBase.value = deadline.value
    salons.value = events
    await load()
  })
}
async function reload() {
  if (confirmDiscard()) await init()
}
async function saveSettings() {
  if (!settings.value) return
  await action(async () => {
    const cfg = {
      ...settings.value!,
      deadline: deadline.value ? new Date(deadline.value + ':00Z').toISOString() : null,
    }
    const saved = await saveProgramSettings(cfg)
    settings.value = saved
    settingsBase.value = JSON.stringify(saved)
    deadline.value = saved.deadline ? new Date(saved.deadline).toISOString().slice(0, 16) : ''
    deadlineBase.value = deadline.value
    message.value =
      'Configuration enregistrée. Recharge la page publique pour obtenir le formulaire à jour.'
  })
}
function search() {
  page.value = 1
  applied.value = filter.value
  void load()
}
function go(n: number) {
  page.value = n
  void load()
}
function open(value: ProgramApplication) {
  if (!confirmDiscard()) return
  selected.value = JSON.parse(JSON.stringify(value))
  selectedBase.value = JSON.stringify(selected.value)
  pdfUrl.value = ''
  error.value = ''
  message.value = ''
}
function close() {
  if (confirmDiscard()) {
    selected.value = null
    selectedBase.value = 'null'
    pdfUrl.value = ''
  }
}
async function review() {
  if (!selected.value) return
  await action(async () => {
    const saved = await reviewApplication(selected.value!)
    selected.value = saved
    selectedBase.value = JSON.stringify(saved)
    await load()
    message.value = 'Décision et note interne enregistrées. Aucun email automatique n’a été envoyé.'
  })
}
async function pdf() {
  if (!selected.value?.file_path) return
  await action(async () => {
    pdfUrl.value = ''
    pdfUrl.value = await applicationPdfLink(selected.value!.file_path!)
    now.value = Date.now()
    pdfExpires.value = now.value + 60000
    if (!timer) timer = setInterval(() => (now.value = Date.now()), 1000)
  })
}
watch(() => props.program, init, { immediate: true })
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <div class="program-admin prereg-admin">
    <p class="eyebrow">Administration · Candidatures</p>
    <h2>Candidatures {{ name }}</h2>
    <p>
      Demandes et documents privés. Une décision ne publie aucune fiche et ne crée ni paiement ni
      compte candidat. La réponse aux candidats se fait avec votre messagerie habituelle.
    </p>
    <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
    <p v-if="message" role="status" class="admin-alert">{{ message }}</p>
    <button class="button button-outline" :disabled="busy" @click="reload">
      Recharger le module
    </button>
    <section class="admin-panel">
      <h3>Ouverture et règles du formulaire</h3>
      <form v-if="settings" class="admin-form" @submit.prevent="saveSettings">
        <fieldset
          class="admin-fields program-settings-grid"
          :disabled="busy || auth.busy"
          style="border: 0; padding: 0; min-width: 0"
        >
          <label
            >Salon concerné<select v-model="settings.event_id">
              <option :value="null">Choisir un salon</option>
              <option v-for="s in salons" :key="s.id" :value="s.id">
                {{ s.title }}{{ s.is_demo ? ' · Démonstration' : '' }}
              </option>
              <option
                v-if="settings.event_id && !salons.some((s) => s.id === settings?.event_id)"
                :value="settings.event_id"
              >
                Salon sélectionné indisponible
              </option>
            </select></label
          ><label
            >Clôture en UTC (facultative)<input v-model="deadline" type="datetime-local" /></label
          ><label v-if="program === 'hackathon'"
            >Maximum de personnes par équipe, responsable inclus<input
              v-model.number="settings.team_max_size"
              type="number"
              min="2"
              max="20"
              step="1"
              required /></label
          ><label
            >Nouvelles candidatures maximum par jour (UTC)<input
              v-model.number="settings.daily_limit"
              type="number"
              min="1"
              max="500"
              step="1"
              required /></label
          ><label class="program-wide"
            >Notice présentée au candidat<textarea
              v-model="settings.notice"
              minlength="30"
              maxlength="3000"
              rows="4"
              required
            /></label
          ><label class="program-wide prereg-consent"
            ><input v-model="settings.enabled" type="checkbox" />Ouvrir les candidatures
            {{ name }}</label
          >
          <p class="program-wide">
            Le formulaire exige aussi une page {{ name }} publiée et un salon publié dont la date de
            fin est à venir. La clôture est facultative ; la fin du salon ferme automatiquement les
            candidatures. Une modification invalide la version des formulaires déjà ouverts.
          </p>
          <button class="button program-wide">Enregistrer la configuration</button>
        </fieldset>
      </form>
      <p v-else>Configuration non chargée. Utilise Recharger le module.</p>
    </section>
    <section class="admin-panel">
      <h3>Dossiers reçus</h3>
      <form class="admin-form" @submit.prevent="search">
        <label
          >État de la candidature<select v-model="filter">
            <option value="all">Tous les états</option>
            <option v-for="(label, key) in applicationStatuses" :key="key" :value="key">
              {{ label }}
            </option>
          </select></label
        ><button class="button" :disabled="remote.loading.value">Filtrer les candidatures</button>
      </form>
      <p v-if="remote.loading.value" role="status">Chargement…</p>
      <div v-else-if="remote.error.value" role="alert">
        <p>{{ remote.error.value }}</p>
        <button class="button" @click="load">Réessayer la liste</button>
      </div>
      <template v-else
        ><p>{{ remote.data.value.count }} candidature(s)</p>
        <p v-if="!remote.data.value.items.length">Aucune candidature pour ce filtre.</p>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Candidat / responsable</th>
                <th>Projet / équipe</th>
                <th>Participation</th>
                <th>État</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in remote.data.value.items" :key="item.id">
                <td>{{ new Date(item.created_at).toLocaleDateString('fr-FR') }}</td>
                <td>{{ item.full_name }}</td>
                <td>{{ item.team_name || item.project_name || 'Non renseigné' }}</td>
                <td>
                  {{
                    item.participation_mode === 'team'
                      ? `Équipe de ${1 + item.members.length}`
                      : 'Individuelle'
                  }}
                </td>
                <td>{{ applicationStatuses[item.status] }}</td>
                <td>
                  <button class="button button-outline" :disabled="busy" @click="open(item)">
                    Consulter {{ item.full_name }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <button
            class="button button-outline"
            :disabled="page <= 1 || busy || remote.loading.value"
            @click="go(page - 1)"
          >
            Précédent</button
          ><span>Page {{ page }} / {{ pages }}</span
          ><button
            class="button button-outline"
            :disabled="page >= pages || busy || remote.loading.value"
            @click="go(page + 1)"
          >
            Suivant
          </button>
        </div></template
      >
    </section>
    <section v-if="selected" class="admin-panel">
      <h3>{{ selected.project_name || selected.team_name || selected.full_name }}</h3>
      <dl class="prereg-details">
        <div>
          <dt>Référence</dt>
          <dd>{{ selected.reference }}</dd>
        </div>
        <div>
          <dt>Salon</dt>
          <dd>{{ salons.find((s) => s.id === selected?.event_id)?.title || selected.event_id }}</dd>
        </div>
        <div>
          <dt>Candidat / responsable</dt>
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
          <dt>Présentation</dt>
          <dd class="program-review-body">{{ selected.description || 'Non renseignée' }}</dd>
        </div>
        <div v-if="selected.objective">
          <dt>Objectif et besoins</dt>
          <dd class="program-review-body">{{ selected.objective }}</dd>
        </div>
        <div v-if="selected.skills">
          <dt>Compétences du responsable / candidat</dt>
          <dd class="program-review-body">{{ selected.skills }}</dd>
        </div>
        <div v-if="selected.participation_mode === 'team'">
          <dt>Équipe : {{ selected.team_name }} · {{ 1 + selected.members.length }} personnes</dt>
          <dd>
            <ul>
              <li v-for="(member, index) in selected.members" :key="index">
                {{ member.full_name }} · {{ member.skills || 'Compétences non précisées' }}
              </li>
            </ul>
            <p>
              Autorisation de transmission des membres déclarée :
              {{ selected.members_authorized ? 'Oui' : 'Non' }}
            </p>
          </dd>
        </div>
        <div>
          <dt>Notice enregistrée le {{ new Date(selected.consent_at).toLocaleString('fr-FR') }}</dt>
          <dd>{{ selected.notice }}</dd>
        </div>
      </dl>
      <div v-if="selected.file_path" class="program-private-pdf">
        <p>
          Document privé : {{ selected.file_name }} · {{ Math.ceil(selected.file_size / 1024) }} Ko
        </p>
        <button class="button button-outline" :disabled="busy" @click="pdf">
          Préparer le téléchargement PDF
        </button>
        <p v-if="pdfValid">
          <a :href="pdfUrl" target="_blank" rel="noopener noreferrer">Télécharger le PDF privé ↗</a>
          · lien valable une minute
        </p>
        <p v-else-if="pdfUrl">Le lien a expiré. Prépare un nouveau téléchargement.</p>
      </div>
      <p v-else>Aucun document joint.</p>
      <form class="admin-form" @submit.prevent="review">
        <fieldset
          class="admin-fields"
          :disabled="busy || auth.busy"
          style="border: 0; padding: 0; min-width: 0"
        >
          <label
            >Décision / suivi<select v-model="selected.status">
              <option v-for="(label, key) in applicationStatuses" :key="key" :value="key">
                {{ label }}
              </option>
            </select></label
          ><label
            >Note interne<textarea
              v-model="selected.internal_note"
              maxlength="5000"
              rows="4"
            /></label
          ><button class="button">Enregistrer la décision</button>
        </fieldset>
      </form>
      <div class="program-admin-actions">
        <button class="button button-outline" :disabled="busy" @click="close">
          Fermer le dossier
        </button>
      </div>
    </section>
  </div>
</template>
