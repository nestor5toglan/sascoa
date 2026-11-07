<script setup lang="ts">
import { sectorTree } from '../../lib/sectorTree'
import RichTextEditor from '../../components/admin/RichTextEditor.vue'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useRemote } from '../../composables/useRemote'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import {
  ADMIN_PAGE_SIZE,
  listAdminCompanies,
  saveCompany,
  sectorOptions,
} from '../../services/adminCatalog'
import { adminError, slugify, validateCompany } from '../../lib/adminValidation'
import { structureType } from '../../lib/presentation'
import type { AdminCompany, CompanyInput, PublicationStatus } from '../../types/admin'
import type { PageResult } from '../../types/public'
import PaginationBar from '../../components/ui/PaginationBar.vue'
import ResultState from '../../components/ui/ResultState.vue'
import LogoUploader from '../../components/admin/LogoUploader.vue'
const auth = useAuthStore()
const search = ref(''),
  status = ref<PublicationStatus | 'all'>('all'),
  sector = ref('')
const applied = reactive({ search: '', status: 'all' as PublicationStatus | 'all', sector: '' })
const page = ref(1)
const records = useRemote<PageResult<AdminCompany>>({ items: [], count: 0 })
const sectors = useRemote<Awaited<ReturnType<typeof sectorOptions>>>([])
const editing = ref<AdminCompany | null>(null),
  showEditor = ref(false),
  saving = ref(false),
  uploading = ref(false)
const error = ref(''),
  success = ref('')
function blank(): CompanyInput {
  return {
    name: '',
    slug: '',
    description: '',
    sector_id: '',
    structure_type: 'private',
    status: 'draft',
    services: '',
    specificities: '',
    logo_path: '',
    address: '',
    phone: '',
    public_email: '',
    website_url: '',
  }
}
const form = reactive<CompanyInput>(blank())
const baseline = ref('')
const dirty = computed(() => showEditor.value && JSON.stringify(form) !== baseline.value)
const busy = computed(() => saving.value || uploading.value)
const { confirmDiscard } = useUnsavedChanges(dirty, busy)
const label = (value: PublicationStatus) =>
  ({ draft: 'Brouillon', published: 'Publié', archived: 'Archivé' })[value]
const load = () =>
  records.run(() => listAdminCompanies(page.value, applied.search, applied.status, applied.sector))
const sectorChoices = computed(() => sectorTree(sectors.data.value))
const loadSectors = () => sectors.run(sectorOptions)
function filter() {
  Object.assign(applied, { search: search.value, status: status.value, sector: sector.value })
  page.value = 1
  void load()
}
function reset() {
  search.value = ''
  status.value = 'all'
  sector.value = ''
  filter()
}
function changePage(value: number) {
  page.value = value
  void load()
}
function values(record: AdminCompany): CompanyInput {
  return {
    name: record.name,
    slug: record.slug,
    description: record.description,
    sector_id: record.sector_id,
    structure_type: record.structure_type,
    status: record.status,
    services: record.services ?? '',
    specificities: record.specificities ?? '',
    logo_path: record.logo_path ?? '',
    address: record.address ?? '',
    phone: record.phone ?? '',
    public_email: record.public_email ?? '',
    website_url: record.website_url ?? '',
  }
}
async function open(record?: AdminCompany) {
  if (!confirmDiscard()) return
  editing.value = record ?? null
  Object.assign(form, record ? values(record) : blank())
  baseline.value = JSON.stringify(form)
  showEditor.value = true
  error.value = ''
  success.value = ''
  await nextTick()
  document.getElementById('company-name')?.focus()
}
function cancel() {
  if (confirmDiscard()) {
    showEditor.value = false
    error.value = ''
  }
}
async function save() {
  if (busy.value) return
  error.value = validateCompany(form)
  success.value = ''
  if (error.value) return
  saving.value = true
  try {
    const result = await saveCompany({ ...form }, editing.value ?? undefined)
    editing.value = result
    Object.assign(form, values(result))
    baseline.value = JSON.stringify(form)
    success.value =
      result.status === 'published'
        ? 'Fiche enregistrée et publiée dans l’annuaire.'
        : `Fiche enregistrée : ${label(result.status).toLowerCase()}. Elle reste masquée dans l’annuaire public.`
    await load()
  } catch (cause) {
    error.value = adminError(cause)
  } finally {
    saving.value = false
  }
}
onMounted(() => {
  void load()
  void loadSectors()
})
</script>
<template>
  <header class="admin-page-heading">
    <p class="eyebrow">Présenter les acteurs</p>
    <h2>Entreprises & structures</h2>
    <p>Prépare, publie et actualise les fiches de l’annuaire.</p>
    <button type="button" class="button" :disabled="busy || auth.busy" @click="open()">
      Ajouter une structure +
    </button>
  </header>
  <form
    class="admin-toolbar"
    role="search"
    aria-label="Rechercher une entreprise"
    @submit.prevent="filter"
  >
    <div class="field">
      <label for="admin-company-search">Nom ou description</label
      ><input
        id="admin-company-search"
        v-model="search"
        type="search"
        maxlength="100"
        placeholder="Rechercher une structure"
      />
    </div>
    <div class="field">
      <label for="admin-company-status">Statut</label
      ><select id="admin-company-status" v-model="status">
        <option value="all">Tous les statuts</option>
        <option value="draft">Brouillons</option>
        <option value="published">Publiés</option>
        <option value="archived">Archivés</option>
      </select>
    </div>
    <div class="field">
      <label for="admin-company-sector">Secteur</label
      ><select
        id="admin-company-sector"
        v-model="sector"
        :disabled="sectors.loading.value || Boolean(sectors.error.value)"
      >
        <option value="">Tous les secteurs</option>
        <option v-for="option in sectorChoices" :key="option.id" :value="option.id">
          {{ option.label }}
        </option>
      </select>
    </div>
    <button type="submit" class="button button-outline" :disabled="records.loading.value">
      Rechercher
    </button>
  </form>
  <button type="button" class="text-link" :disabled="records.loading.value" @click="load">
    Actualiser la liste ↻
  </button>

  <p v-if="applied.search || applied.status !== 'all' || applied.sector">
    <button type="button" class="text-link" @click="reset">Effacer les filtres ✕</button>
  </p>
  <p v-if="sectors.error.value" role="alert" class="admin-alert">
    Les secteurs ne sont pas disponibles. {{ sectors.error.value }}
    <button class="text-link" type="button" @click="loadSectors">Réessayer</button>
  </p>
  <p v-if="!records.error.value && !records.loading.value" class="admin-count" role="status">
    {{ records.data.value.count }} structure(s)
  </p>
  <ResultState
    :loading="records.loading.value"
    :error="records.error.value"
    :empty="records.data.value.items.length === 0"
    empty-title="Aucune structure pour cette sélection"
    empty-text="Ajoute une fiche ou élargis les filtres."
    @retry="load"
  />
  <div
    v-if="!records.loading.value && !records.error.value && records.data.value.items.length"
    class="admin-table-wrap"
  >
    <table class="admin-table">
      <caption class="sr-only">
        Fiches des entreprises et structures
      </caption>
      <thead>
        <tr>
          <th scope="col">Structure</th>
          <th scope="col">Secteur</th>
          <th scope="col">Statut</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records.data.value.items" :key="record.id">
          <th scope="row">
            {{ record.name }}<small>{{ structureType(record.structure_type) }}</small>
          </th>
          <td>{{ record.sector?.name || 'Secteur indisponible' }}</td>
          <td>
            <span class="admin-status" :class="`status-${record.status}`">{{
              label(record.status)
            }}</span>
          </td>
          <td>
            <button type="button" class="text-link" :disabled="busy" @click="open(record)">
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
  <section
    v-if="showEditor"
    class="admin-panel admin-editor"
    aria-labelledby="company-editor-title"
  >
    <div class="admin-editor-heading">
      <h3 id="company-editor-title">
        {{ editing ? 'Modifier la structure' : 'Nouvelle structure' }}
      </h3>
      <span v-if="dirty" class="admin-unsaved">Non enregistré</span>
    </div>
    <p v-if="error" class="admin-alert" role="alert">{{ error }}</p>
    <p v-if="success" class="admin-success" role="status">{{ success }}</p>
    <form @submit.prevent="save">
      <fieldset class="admin-fields" :disabled="busy || auth.busy">
        <div class="field">
          <label for="company-name">Nom de la structure *</label
          ><input id="company-name" v-model="form.name" maxlength="200" required />
        </div>
        <div class="field">
          <label for="company-slug">Identifiant unique *</label>
          <div class="admin-slug-field">
            <input
              id="company-slug"
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
        <div class="admin-form-grid">
          <div class="field">
            <label for="company-sector-edit">Secteur d’activité *</label
            ><select
              id="company-sector-edit"
              v-model="form.sector_id"
              required
              :disabled="sectors.loading.value || Boolean(sectors.error.value)"
            >
              <option value="" disabled>Sélectionner un secteur</option>
              <option v-for="option in sectorChoices" :key="option.id" :value="option.id">
                {{ option.label }}
              </option>
            </select>
            <p
              v-if="!sectors.loading.value && !sectors.error.value && !sectors.data.value.length"
              class="admin-help"
            >
              Crée d’abord un secteur dans le menu Secteurs d’activité.
            </p>
            <button type="button" class="text-link" @click="loadSectors">
              Actualiser les secteurs
            </button>
          </div>
          <div class="field">
            <label for="company-type">Type de structure *</label
            ><select id="company-type" v-model="form.structure_type">
              <option value="private">Entreprise privée</option>
              <option value="public">Structure publique</option>
              <option value="individual">Particulier</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="company-description">Présentation *</label
          ><RichTextEditor
            input-id="company-description"
            v-model="form.description"
            label="Présentation"
            :max-length="10000"
            :disabled="saving || auth.busy"
            @busy="uploading = $event"
          />
        </div>
        <div class="field">
          <label for="company-services"
            >Services proposés <span class="muted">(facultatif)</span></label
          ><RichTextEditor
            input-id="company-services"
            v-model="form.services"
            label="Services proposés"
            :max-length="5000"
            :disabled="saving || auth.busy"
            @busy="uploading = $event"
          />
        </div>
        <div class="field">
          <label for="company-specificities"
            >Ce qui distingue la structure <span class="muted">(facultatif)</span></label
          ><RichTextEditor
            input-id="company-specificities"
            v-model="form.specificities"
            label="Ce qui distingue la structure"
            :max-length="5000"
            :disabled="saving || auth.busy"
            @busy="uploading = $event"
          />
        </div>
        <LogoUploader
          :key="editing?.id ?? 'new'"
          :saved-at="editing?.updated_at"
          :model-value="form.logo_path ?? ''"
          :disabled="saving || auth.busy"
          @update:model-value="form.logo_path = $event"
          @busy="uploading = $event"
        />
        <div class="admin-form-grid">
          <div class="field">
            <label for="company-website">Site web <span class="muted">(facultatif)</span></label
            ><input
              id="company-website"
              v-model="form.website_url"
              type="url"
              placeholder="https://exemple.com"
              maxlength="2048"
            />
          </div>
          <div class="field">
            <label for="company-email">Email public <span class="muted">(facultatif)</span></label
            ><input id="company-email" v-model="form.public_email" type="email" maxlength="254" />
          </div>
          <div class="field">
            <label for="company-phone"
              >Téléphone public <span class="muted">(facultatif)</span></label
            ><input id="company-phone" v-model="form.phone" type="tel" maxlength="60" />
          </div>
          <div class="field">
            <label for="company-address"
              >Adresse publique <span class="muted">(facultatif)</span></label
            ><input id="company-address" v-model="form.address" maxlength="500" />
          </div>
        </div>
        <div class="admin-publish-box">
          <div class="field">
            <label for="company-publication">Visibilité de la fiche *</label
            ><select id="company-publication" v-model="form.status">
              <option value="draft">Brouillon — visible uniquement dans l’administration</option>
              <option value="published">Publié — visible dans l’annuaire public</option>
              <option value="archived">Archivé — retiré de l’annuaire public</option>
            </select>
          </div>
          <p class="admin-help">
            En publiant cette fiche, tu rends ses textes, son logo et ses coordonnées accessibles
            aux visiteurs. La visibilité change après enregistrement.
          </p>
        </div>
        <div class="admin-form-actions">
          <button
            type="submit"
            class="button"
            :disabled="!sectors.data.value.length || Boolean(sectors.error.value)"
          >
            {{ saving ? 'Enregistrement…' : 'Enregistrer la fiche' }}</button
          ><button type="button" class="button button-outline" @click="cancel">
            Fermer l’éditeur
          </button>
        </div>
      </fieldset>
    </form>
  </section>
</template>
