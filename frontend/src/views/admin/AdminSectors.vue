<script setup lang="ts">
import { sectorTree, descendantIds } from '../../lib/sectorTree'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useRemote } from '../../composables/useRemote'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import {
  ADMIN_PAGE_SIZE,
  listAdminSectors,
  saveSector,
  sectorOptions,
} from '../../services/adminCatalog'
import { adminError, slugify, validateSector } from '../../lib/adminValidation'
import type { AdminSector, SectorInput } from '../../types/admin'
import type { PageResult } from '../../types/public'
import PaginationBar from '../../components/ui/PaginationBar.vue'
import ResultState from '../../components/ui/ResultState.vue'
const auth = useAuthStore()
const search = ref(''),
  applied = ref(''),
  page = ref(1)
const records = useRemote<PageResult<AdminSector>>({ items: [], count: 0 })
const editing = ref<AdminSector | null>(null),
  showEditor = ref(false),
  saving = ref(false)
const error = ref(''),
  success = ref('')
const form = reactive<SectorInput>({ name: '', slug: '', description: '', parent_id: null })
const options = useRemote<Awaited<ReturnType<typeof sectorOptions>>>([])
const loadOptions = () => options.run(sectorOptions)
const allChoices = computed(() => sectorTree(options.data.value))
const parentChoices = computed(() => {
  const excluded = editing.value
    ? descendantIds(options.data.value, editing.value.id)
    : new Set<string>()
  return allChoices.value.filter((option) => !excluded.has(option.id))
})
function parentLabel(id?: string | null) {
  return id
    ? allChoices.value.find((option) => option.id === id)?.label || 'Parent indisponible'
    : 'Catégorie principale'
}
const baseline = ref('')
const dirty = computed(() => showEditor.value && JSON.stringify(form) !== baseline.value)
const { confirmDiscard } = useUnsavedChanges(dirty, saving)
const load = () => records.run(() => listAdminSectors(page.value, applied.value))
function filter() {
  applied.value = search.value
  page.value = 1
  void load()
}
function changePage(value: number) {
  page.value = value
  void load()
}
async function open(record?: AdminSector) {
  if (!confirmDiscard()) return
  editing.value = record ?? null
  Object.assign(form, {
    name: record?.name ?? '',
    slug: record?.slug ?? '',
    description: record?.description ?? '',
    parent_id: record?.parent_id ?? null,
  })
  baseline.value = JSON.stringify(form)
  showEditor.value = true
  error.value = ''
  success.value = ''
  await nextTick()
  document.getElementById('sector-name')?.focus()
}
function cancel() {
  if (confirmDiscard()) {
    showEditor.value = false
    error.value = ''
  }
}
async function save() {
  if (saving.value) return
  error.value = validateSector(form)
  success.value = ''
  if (error.value) return
  saving.value = true
  try {
    const result = await saveSector({ ...form }, editing.value ?? undefined)
    editing.value = result
    Object.assign(form, {
      name: result.name,
      slug: result.slug,
      description: result.description ?? '',
      parent_id: result.parent_id ?? null,
    })
    baseline.value = JSON.stringify(form)
    success.value = 'Secteur enregistré.'
    await Promise.all([load(), loadOptions()])
  } catch (cause) {
    error.value = adminError(cause)
  } finally {
    saving.value = false
  }
}
onMounted(() => {
  void load()
  void loadOptions()
})
</script>
<template>
  <header class="admin-page-heading">
    <p class="eyebrow">Organiser l’annuaire</p>
    <h2>Secteurs d’activité</h2>
    <p>Des catégories claires pour orienter les visiteurs.</p>
    <button type="button" class="button" :disabled="saving || auth.busy" @click="open()">
      Ajouter un secteur +
    </button>
  </header>
  <form
    class="admin-toolbar"
    role="search"
    aria-label="Rechercher un secteur"
    @submit.prevent="filter"
  >
    <div class="field">
      <label for="sector-search">Nom du secteur</label
      ><input
        id="sector-search"
        v-model="search"
        type="search"
        maxlength="100"
        placeholder="Ex. conseil"
      />
    </div>
    <button type="submit" class="button button-outline" :disabled="records.loading.value">
      Rechercher
    </button>
  </form>
  <button type="button" class="text-link" :disabled="records.loading.value" @click="load">
    Actualiser la liste ↻
  </button>

  <p v-if="!records.error.value && !records.loading.value" class="admin-count" role="status">
    {{ records.data.value.count }} secteur(s)
  </p>
  <ResultState
    :loading="records.loading.value"
    :error="records.error.value"
    :empty="records.data.value.items.length === 0"
    empty-title="Aucun secteur pour cette sélection"
    empty-text="Ajoute un secteur ou modifie ta recherche."
    @retry="load"
  />
  <div
    v-if="!records.loading.value && !records.error.value && records.data.value.items.length"
    class="admin-table-wrap"
  >
    <table class="admin-table">
      <caption class="sr-only">
        Secteurs d’activité
      </caption>
      <thead>
        <tr>
          <th scope="col">Secteur</th>
          <th scope="col">Catégorie parente</th>
          <th scope="col">Identifiant</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records.data.value.items" :key="record.id">
          <th scope="row">{{ record.name }}</th>
          <td>{{ parentLabel(record.parent_id) }}</td>
          <td>{{ record.slug }}</td>
          <td>
            <button type="button" class="text-link" :disabled="saving" @click="open(record)">
              Modifier<span class="sr-only"> {{ record.name }}</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p
    v-if="records.data.value.items.length && !records.loading.value && !records.error.value"
    class="admin-scroll-help"
  >
    Fais glisser le tableau pour voir toutes les colonnes et les actions.
  </p>
  <PaginationBar
    v-if="!records.error.value"
    :page="page"
    :total="records.data.value.count"
    :size="ADMIN_PAGE_SIZE"
    :busy="records.loading.value"
    @change="changePage"
  />
  <section v-if="showEditor" class="admin-panel admin-editor" aria-labelledby="sector-editor-title">
    <div class="admin-editor-heading">
      <h3 id="sector-editor-title">{{ editing ? 'Modifier le secteur' : 'Nouveau secteur' }}</h3>
      <span v-if="dirty" class="admin-unsaved">Non enregistré</span>
    </div>
    <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
    <p v-if="success" role="status" class="admin-success">{{ success }}</p>
    <form @submit.prevent="save">
      <fieldset :disabled="saving || auth.checking || auth.busy" class="admin-fields">
        <div class="field">
          <label for="sector-name">Nom *</label
          ><input id="sector-name" v-model="form.name" maxlength="200" required />
        </div>
        <div class="field">
          <label for="sector-slug">Identifiant unique *</label>
          <div class="admin-slug-field">
            <input
              id="sector-slug"
              v-model="form.slug"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxlength="100"
              required
            /><button
              type="button"
              class="button button-outline"
              @click="form.slug = slugify(form.name)"
            >
              Générer depuis le nom
            </button>
          </div>
        </div>
        <div class="field">
          <label for="sector-parent">Catégorie parente</label>
          <select
            id="sector-parent"
            v-model="form.parent_id"
            :disabled="options.loading.value || Boolean(options.error.value)"
          >
            <option :value="null">Aucune : catégorie principale</option>
            <option v-for="option in parentChoices" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
          <p class="muted">
            Choisissez la catégorie dont ce secteur dépend, ou laissez-le à la racine. Ses propres
            enfants le suivront lors d’un déplacement.
          </p>
          <p v-if="options.error.value" class="admin-alert" role="alert">
            Impossible de charger l’arbre.
            <button type="button" class="text-link" @click="loadOptions">Réessayer</button>
          </p>
        </div>
        <div class="field">
          <label for="sector-description"
            >Description <span class="muted">(facultative)</span></label
          ><textarea
            id="sector-description"
            v-model="form.description"
            rows="4"
            maxlength="10000"
          ></textarea>
        </div>
        <div class="admin-form-actions">
          <button
            type="submit"
            class="button"
            :disabled="options.loading.value || Boolean(options.error.value)"
          >
            {{ saving ? 'Enregistrement…' : 'Enregistrer le secteur' }}</button
          ><button type="button" class="button button-outline" @click="cancel">
            Fermer l’éditeur
          </button>
        </div>
      </fieldset>
    </form>
  </section>
</template>
