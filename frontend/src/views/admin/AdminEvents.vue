<script setup lang="ts">
import RichTextEditor from '../../components/admin/RichTextEditor.vue'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useRemote } from '../../composables/useRemote'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import { ADMIN_PAGE_SIZE } from '../../services/adminCatalog'
import { listAdminEvents, saveEvent } from '../../services/adminEvents'
import { fromUtcInput, utcInput } from '../../lib/eventValidation'
import { adminError, slugify } from '../../lib/adminValidation'
import { dateLabel, eventType } from '../../lib/presentation'
import type { AdminEvent, EventInput, PublicationStatus } from '../../types/admin'
import type { PageResult } from '../../types/public'
import PaginationBar from '../../components/ui/PaginationBar.vue'
import ResultState from '../../components/ui/ResultState.vue'
import EditorialUpload from '../../components/admin/EditorialUpload.vue'
const auth = useAuthStore()
const search = ref(''),
  status = ref<PublicationStatus | 'all'>('all'),
  page = ref(1)
const applied = reactive({ search: '', status: 'all' as PublicationStatus | 'all' })
const records = useRemote<PageResult<AdminEvent>>({ items: [], count: 0 })
const editing = ref<AdminEvent | null>(null),
  showEditor = ref(false),
  saving = ref(false)
const uploadingCover = ref(false),
  uploadingPdf = ref(false)
const uploadingRich = ref(false)
const busy = computed(
  () => saving.value || uploadingRich.value || uploadingCover.value || uploadingPdf.value,
)
const error = ref(''),
  success = ref('')
function blank(): EventInput {
  return {
    title: '',
    slug: '',
    description: '',
    event_type: 'salon',
    starts_at: '',
    ends_at: '',
    timezone: 'Africa/Lome',
    location: '',
    cover_image_path: '',
    program_text: '',
    program_pdf_path: '',
    speakers: [],
    registrations_open: false,
    registration_deadline: null,
    is_demo: false,
    status: 'draft',
  }
}
const form = reactive<EventInput>(blank())
const dates = reactive({ start: '', end: '', deadline: '' })
const originalDates = { start: '', end: '', deadline: '' }
const baseline = ref('')
const snapshot = () => JSON.stringify({ form, dates })
const dirty = computed(() => showEditor.value && snapshot() !== baseline.value)
const { confirmDiscard } = useUnsavedChanges(dirty, busy)
const label = (value: PublicationStatus) =>
  ({ draft: 'Brouillon', published: 'Publié', archived: 'Archivé' })[value]
const load = () => records.run(() => listAdminEvents(page.value, applied.search, applied.status))
function filter() {
  Object.assign(applied, { search: search.value, status: status.value })
  page.value = 1
  void load()
}
function changePage(value: number) {
  page.value = value
  void load()
}
function fill(record?: AdminEvent) {
  editing.value = record ?? null
  const {
    id: _id,
    updated_at: _updated,
    ...values
  } = record ?? { ...blank(), id: '', updated_at: '' }
  Object.assign(form, values, { speakers: structuredClone(values.speakers) })
  dates.start = utcInput(record?.starts_at ?? null)
  dates.end = utcInput(record?.ends_at ?? null)
  dates.deadline = utcInput(record?.registration_deadline ?? null)
  Object.assign(originalDates, dates)
  baseline.value = snapshot()
}
async function open(record?: AdminEvent) {
  if (!confirmDiscard()) return
  fill(record)
  showEditor.value = true
  error.value = ''
  success.value = ''
  await nextTick()
  document.getElementById('event-title')?.focus()
}
function cancel() {
  if (confirmDiscard()) {
    showEditor.value = false
    error.value = ''
  }
}
async function save() {
  if (busy.value) return
  error.value = ''
  success.value = ''
  saving.value = true
  try {
    // Préserver les secondes/précisions déjà en base si les champs de date n'ont pas changé.
    const starts_at =
      editing.value && dates.start === originalDates.start
        ? editing.value.starts_at
        : fromUtcInput(dates.start)
    const ends_at =
      editing.value && dates.end === originalDates.end
        ? editing.value.ends_at
        : fromUtcInput(dates.end)
    const registration_deadline = !dates.deadline
      ? null
      : editing.value && dates.deadline === originalDates.deadline
        ? editing.value.registration_deadline
        : fromUtcInput(dates.deadline)
    const result = await saveEvent(
      { ...form, starts_at, ends_at, registration_deadline },
      editing.value ?? undefined,
    )
    fill(result)
    success.value = `Événement enregistré : ${label(result.status).toLowerCase()}.`
    await load()
  } catch (cause) {
    error.value = adminError(cause)
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<template>
  <header class="admin-page-heading">
    <p class="eyebrow">Les rendez-vous SASCOA</p>
    <h2>Salons & événements</h2>
    <p>
      Prépare le programme, les visuels et les informations qui apparaîtront dans l’agenda public.
    </p>
    <button type="button" class="button" :disabled="busy || auth.busy" @click="open()">
      Ajouter un événement +
    </button>
  </header>
  <form
    class="admin-toolbar"
    role="search"
    aria-label="Rechercher un événement administrateur"
    @submit.prevent="filter"
  >
    <div class="field">
      <label for="admin-event-search">Titre ou description</label
      ><input id="admin-event-search" v-model="search" type="search" maxlength="100" />
    </div>
    <div class="field">
      <label for="admin-event-status">Statut</label
      ><select id="admin-event-status" v-model="status">
        <option value="all">Tous les statuts</option>
        <option value="draft">Brouillons</option>
        <option value="published">Publiés</option>
        <option value="archived">Archivés</option>
      </select>
    </div>
    <button class="button button-outline" type="submit" :disabled="records.loading.value">
      Rechercher
    </button>
  </form>
  <button class="text-link" type="button" :disabled="records.loading.value" @click="load">
    Actualiser la liste ↻
  </button>
  <p v-if="!records.loading.value && !records.error.value" role="status">
    {{ records.data.value.count }} événement(s)
  </p>
  <ResultState
    :loading="records.loading.value"
    :error="records.error.value"
    :empty="records.data.value.items.length === 0"
    empty-title="Aucun événement pour cette sélection"
    empty-text="Ajoute un événement ou élargis ta recherche."
    @retry="load"
  />
  <div
    v-if="!records.loading.value && !records.error.value && records.data.value.items.length"
    class="admin-table-wrap"
  >
    <table class="admin-table">
      <caption class="sr-only">
        Événements administratifs
      </caption>
      <thead>
        <tr>
          <th scope="col">Événement</th>
          <th scope="col">Début</th>
          <th scope="col">Statut</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records.data.value.items" :key="record.id">
          <th scope="row">
            {{ record.title
            }}<small
              >{{ eventType(record.event_type)
              }}{{ record.is_demo ? ' · Démonstration' : '' }}</small
            >
          </th>
          <td>{{ dateLabel(record.starts_at, record.timezone) }}</td>
          <td>
            <span class="admin-status" :class="`status-${record.status}`">{{
              label(record.status)
            }}</span>
          </td>
          <td>
            <button type="button" class="text-link" :disabled="busy" @click="open(record)">
              Modifier<span class="sr-only"> {{ record.title }}</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-if="records.data.value.items.length" class="admin-scroll-help">
    Fais glisser le tableau pour voir les actions.
  </p>
  <PaginationBar
    v-if="!records.error.value"
    :page="page"
    :total="records.data.value.count"
    :size="ADMIN_PAGE_SIZE"
    :busy="records.loading.value"
    @change="changePage"
  />
  <section v-if="showEditor" class="admin-panel admin-editor" aria-labelledby="event-editor-title">
    <div class="admin-editor-heading">
      <h3 id="event-editor-title">{{ editing ? 'Modifier l’événement' : 'Nouvel événement' }}</h3>
      <span v-if="dirty" class="admin-unsaved">Non enregistré</span>
    </div>
    <p v-if="error" class="admin-alert" role="alert">{{ error }}</p>
    <p v-if="success" class="admin-success" role="status">{{ success }}</p>
    <form @submit.prevent="save">
      <fieldset class="admin-fields" :disabled="busy || auth.busy">
        <div class="field">
          <label for="event-title">Titre *</label
          ><input id="event-title" v-model="form.title" required maxlength="200" />
        </div>
        <div class="field">
          <label for="event-slug">Identifiant unique *</label>
          <div class="admin-slug-field">
            <input
              id="event-slug"
              v-model="form.slug"
              required
              maxlength="100"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            /><button
              type="button"
              class="button button-outline"
              @click="form.slug = slugify(form.title)"
            >
              Générer depuis le titre
            </button>
          </div>
        </div>
        <div class="admin-form-grid">
          <div class="field">
            <label for="event-type">Type d’événement</label
            ><select id="event-type" v-model="form.event_type">
              <option value="salon">Salon</option>
              <option value="forum">Forum</option>
              <option value="conference">Conférence</option>
              <option value="other">Autre rencontre</option>
            </select>
          </div>
          <div class="field">
            <label for="event-location">Lieu <span class="muted">(facultatif)</span></label
            ><input id="event-location" v-model="form.location" maxlength="500" />
          </div>
        </div>
        <p class="admin-note">
          Saisis les horaires ci-dessous en <strong>UTC</strong>. À Lomé, l’heure locale correspond
          à UTC. Le fuseau sert à l’affichage public.
        </p>
        <div class="admin-form-grid">
          <div class="field">
            <label for="event-start">Début en UTC *</label
            ><input
              id="event-start"
              v-model="dates.start"
              type="datetime-local"
              step="1"
              required
            />
          </div>
          <div class="field">
            <label for="event-end">Fin en UTC *</label
            ><input id="event-end" v-model="dates.end" type="datetime-local" step="1" required />
          </div>
          <div class="field">
            <label for="event-timezone">Fuseau d’affichage *</label
            ><input
              id="event-timezone"
              v-model="form.timezone"
              required
              placeholder="Africa/Lome"
            />
          </div>
          <div class="field">
            <label for="event-deadline"
              >Échéance en UTC <span class="muted">(facultative)</span></label
            ><input id="event-deadline" v-model="dates.deadline" type="datetime-local" step="1" />
          </div>
        </div>
        <label class="admin-check"
          ><input v-model="form.is_demo" type="checkbox" /> Dates fictives, événement de
          démonstration</label
        >
        <div class="field">
          <label for="event-description">Présentation *</label
          ><RichTextEditor
            input-id="event-description"
            v-model="form.description"
            label="Présentation"
            :max-length="10000"
            :disabled="saving || auth.busy"
            @busy="uploadingRich = $event"
          />
        </div>
        <EditorialUpload
          :key="`cover-${editing?.id ?? 'new'}`"
          :model-value="form.cover_image_path ?? ''"
          kind="image"
          folder="events"
          label="Image de couverture"
          input-id="event-cover"
          :disabled="saving || auth.busy"
          :saved-at="editing?.updated_at"
          @update:model-value="form.cover_image_path = $event"
          @busy="uploadingCover = $event"
        />
        <div class="field">
          <label for="event-program">Programme <span class="muted">(facultatif)</span></label
          ><RichTextEditor
            input-id="event-program"
            v-model="form.program_text"
            label="Programme"
            :max-length="30000"
            :disabled="saving || auth.busy"
            @busy="uploadingRich = $event"
          />
        </div>
        <EditorialUpload
          :key="`pdf-${editing?.id ?? 'new'}`"
          :model-value="form.program_pdf_path ?? ''"
          kind="pdf"
          folder="events"
          label="Programme PDF"
          input-id="event-pdf"
          :disabled="saving || auth.busy"
          :saved-at="editing?.updated_at"
          @update:model-value="form.program_pdf_path = $event"
          @busy="uploadingPdf = $event"
        />
        <section aria-labelledby="speakers-heading">
          <h4 id="speakers-heading">Intervenants <span class="muted">(facultatif)</span></h4>
          <div v-for="(speaker, index) in form.speakers" :key="index" class="admin-speaker-row">
            <div class="field">
              <label :for="`speaker-${index}-name`">Nom de l’intervenant {{ index + 1 }} *</label
              ><input
                :id="`speaker-${index}-name`"
                v-model="speaker.name"
                maxlength="200"
                required
              />
            </div>
            <div class="field">
              <label :for="`speaker-${index}-role`">Fonction</label
              ><input :id="`speaker-${index}-role`" v-model="speaker.role" maxlength="200" />
            </div>
            <button type="button" class="text-link" @click="form.speakers.splice(index, 1)">
              Retirer<span class="sr-only"> l’intervenant {{ index + 1 }}</span>
            </button>
          </div>
          <button
            type="button"
            class="button button-outline"
            :disabled="form.speakers.length >= 50"
            @click="form.speakers.push({ name: '', role: '' })"
          >
            Ajouter un intervenant +
          </button>
        </section>
        <div class="admin-publish-box">
          <div class="field">
            <label for="event-publication">Visibilité *</label
            ><select id="event-publication" v-model="form.status">
              <option value="draft">Brouillon</option>
              <option value="published">Publié</option>
              <option value="archived">Archivé</option>
            </select>
          </div>
          <p class="admin-help">
            Publier rend le programme et ses fichiers accessibles aux visiteurs. Les formulaires
            d’inscription ne sont pas ouverts par cet éditeur.
          </p>
        </div>
        <div class="admin-form-actions">
          <button type="submit" class="button">
            {{ saving ? 'Enregistrement…' : 'Enregistrer l’événement' }}</button
          ><button type="button" class="button button-outline" @click="cancel">
            Fermer l’éditeur</button
          ><RouterLink
            v-if="editing?.status === 'published'"
            :to="{ path: '/salons', query: { evenement: editing.id } }"
            class="text-link"
            target="_blank"
            rel="noopener"
            >Voir la fiche publique ↗</RouterLink
          >
        </div>
      </fieldset>
    </form>
  </section>
</template>
