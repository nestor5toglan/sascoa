<script setup lang="ts">
import RichTextEditor from '../../components/admin/RichTextEditor.vue'
import ContactSettingsEditor from '../../components/admin/ContactSettingsEditor.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useRemote } from '../../composables/useRemote'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import { getAdminEditorial, saveEditorial } from '../../services/editorial'
import { adminError } from '../../lib/adminValidation'
import { dateLabel } from '../../lib/presentation'
import type { EditorialInput, EditorialPage, EditorialSlug } from '../../types/admin'
import ResultState from '../../components/ui/ResultState.vue'
import EditorialUpload from '../../components/admin/EditorialUpload.vue'
const props = defineProps<{ slug: EditorialSlug }>()
const auth = useAuthStore()
const name = computed(
  () =>
    ({ pitch: 'Pitch', hackathon: 'Hackathon', contact: 'Contact', 'a-propos': 'À propos' })[
      props.slug
    ],
)
const remote = useRemote<EditorialPage | null>(null)
const editing = ref<EditorialPage | null>(null)
const saving = ref(false),
  uploading = ref(false),
  loaded = ref(false)
const busy = computed(() => saving.value || uploading.value)
const form = reactive<EditorialInput>({
  slug: props.slug,
  title: name.value,
  summary: '',
  body: '',
  cover_image_path: '',
  status: 'draft',
})
const error = ref(''),
  success = ref(''),
  baseline = ref('')
const dirty = computed(() => loaded.value && JSON.stringify(form) !== baseline.value)
const { confirmDiscard } = useUnsavedChanges(dirty, busy)
function fill(record: EditorialPage | null) {
  editing.value = record
  Object.assign(form, {
    slug: props.slug,
    title: record?.title ?? name.value,
    summary: record?.summary ?? '',
    body: record?.body ?? '',
    cover_image_path: record?.cover_image_path ?? '',
    status: record?.status ?? 'draft',
  })
  baseline.value = JSON.stringify(form)
}
async function load() {
  if (!confirmDiscard()) return
  loaded.value = false
  error.value = ''
  success.value = ''
  const slug = props.slug
  await remote.run(() => getAdminEditorial(slug))
  if (slug !== props.slug) return
  if (!remote.error.value) {
    fill(remote.data.value)
    loaded.value = true
  }
}
async function save() {
  if (busy.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await saveEditorial({ ...form }, editing.value ?? undefined)
    fill(result)
    success.value = 'Page enregistrée.'
  } catch (cause) {
    error.value = adminError(cause)
  } finally {
    saving.value = false
  }
}
watch(
  () => props.slug,
  () => {
    loaded.value = false
    void load()
  },
)
onMounted(load)
</script>
<template>
  <header class="admin-page-heading">
    <p class="eyebrow">Pages publiques</p>
    <h2>{{ name }}</h2>
    <p>
      Ajoute ou modifie le titre, l’introduction, l’image et le contenu, puis choisis la visibilité.
    </p>
    <RouterLink :to="`/${slug}`" class="text-link" target="_blank" rel="noopener"
      >Voir la page publique ↗</RouterLink
    >
  </header>
  <ResultState
    :loading="remote.loading.value"
    :error="remote.error.value"
    :empty="false"
    empty-title=""
    empty-text=""
    @retry="load"
  />
  <ContactSettingsEditor v-if="slug === 'contact'" />
  <section v-if="loaded && !remote.error.value" class="admin-panel" :aria-label="`Éditeur ${name}`">
    <p v-if="error" class="admin-alert" role="alert">{{ error }}</p>
    <p v-if="success" class="admin-success" role="status">{{ success }}</p>
    <p v-if="dirty" class="admin-unsaved">Modifications non enregistrées</p>
    <p v-if="!editing" class="admin-note">
      Cette page n’a pas encore de contenu enregistré. Rédige le texte puis choisis sa visibilité.
    </p>
    <form @submit.prevent="save">
      <fieldset class="admin-fields" :disabled="busy || auth.busy">
        <div class="field">
          <label for="editorial-title">Titre *</label
          ><input id="editorial-title" v-model="form.title" required maxlength="200" />
        </div>
        <div class="field">
          <label for="editorial-summary"
            >Introduction <span class="muted">(facultative)</span></label
          ><textarea
            id="editorial-summary"
            v-model="form.summary"
            rows="3"
            maxlength="1000"
          ></textarea>
        </div>
        <EditorialUpload
          :key="`${slug}-${editing?.id ?? 'new'}`"
          :model-value="form.cover_image_path ?? ''"
          folder="pages"
          kind="image"
          label="Image de présentation"
          input-id="editorial-cover"
          :disabled="saving || auth.busy"
          :saved-at="editing?.updated_at"
          @update:model-value="form.cover_image_path = $event"
          @busy="uploading = $event"
        />
        <div class="field">
          <label for="editorial-body">Contenu de la page *</label
          ><RichTextEditor
            input-id="editorial-body"
            v-model="form.body"
            label="Contenu de la page"
            :max-length="50000"
            :disabled="saving || auth.busy"
            @busy="uploading = $event"
          />
          <p class="admin-help">
            Structure le contenu avec la barre de mise en forme : titres, listes, liens et images.
            Enregistre ensuite la page pour publier tes changements. Ne présente pas les critères de
            2025 comme ceux de la prochaine édition sans validation.
          </p>
        </div>
        <div class="field">
          <label for="editorial-status">Visibilité *</label
          ><select id="editorial-status" v-model="form.status">
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="archived">Archivé</option>
          </select>
          <p v-if="editing?.published_at" class="admin-help">
            Date de publication enregistrée : {{ dateLabel(editing.published_at, 'UTC') }}. Une date
            future conserve le contenu masqué jusqu’à cette date.
          </p>
        </div>
        <p v-if="slug === 'pitch' || slug === 'hackathon'" class="admin-note">
          Cette page présente le dispositif. Aucun formulaire de candidature n’est encore activé :
          les modalités et le traitement serveur seront ajoutés dans un lot distinct.
        </p>
        <div class="admin-form-actions">
          <button class="button" type="submit">
            {{ saving ? 'Enregistrement…' : 'Enregistrer la page' }}</button
          ><button class="button button-outline" type="button" @click="load">
            Recharger la version enregistrée
          </button>
        </div>
      </fieldset>
    </form>
  </section>
</template>
