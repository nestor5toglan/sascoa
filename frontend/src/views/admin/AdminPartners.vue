<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useRemote } from '../../composables/useRemote'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import { listAdminPartners, savePartner } from '../../services/adminPartners'
import { uploadEditorialFile } from '../../services/adminMedia'
import { adminError } from '../../lib/adminValidation'
import type { AdminPartner, PartnerInput } from '../../types/partners'
import MediaImage from '../../components/ui/MediaImage.vue'
const auth = useAuthStore(),
  results = useRemote<{ items: AdminPartner[]; count: number }>({ items: [], count: 0 }),
  page = ref(1),
  search = ref(''),
  applied = ref(''),
  saving = ref(false),
  uploading = ref(false),
  message = ref(''),
  error = ref(''),
  form = ref<PartnerInput | null>(null),
  original = ref<AdminPartner | undefined>(),
  baseline = ref('null')
const busy = computed(() => saving.value || uploading.value),
  dirty = computed(() => JSON.stringify(form.value) !== baseline.value),
  pages = computed(() => Math.max(1, Math.ceil(results.data.value.count / 10)))
const { confirmDiscard } = useUnsavedChanges(dirty, busy)
const load = () => results.run(() => listAdminPartners(page.value, applied.value))
function filter() {
  applied.value = search.value
  page.value = 1
  void load()
}
function go(value: number) {
  page.value = value
  void load()
}
function edit(item?: AdminPartner) {
  if (!confirmDiscard()) return
  original.value = item ? { ...item } : undefined
  form.value = item
    ? {
        name: item.name,
        category: item.category,
        description: item.description,
        logo_path: item.logo_path,
        website_url: item.website_url,
        display_order: item.display_order,
        is_visible: item.is_visible,
      }
    : {
        name: '',
        category: 'Partenaire',
        description: '',
        logo_path: null,
        website_url: '',
        display_order: 0,
        is_visible: false,
      }
  baseline.value = JSON.stringify(form.value)
  error.value = ''
  message.value = ''
}
function close() {
  if (confirmDiscard()) {
    form.value = null
    baseline.value = 'null'
    original.value = undefined
  }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file || !form.value) return
  uploading.value = true
  error.value = ''
  try {
    const path = await uploadEditorialFile(file, 'partners', 'image')
    if (form.value) form.value.logo_path = path
  } catch (e) {
    error.value = adminError(e)
  } finally {
    uploading.value = false
  }
}
async function save() {
  if (!form.value || busy.value) return
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const result = await savePartner(form.value, original.value)
    original.value = result
    baseline.value = JSON.stringify(form.value)
    message.value = 'Partenaire enregistré. Recharge l’accueil public pour voir la mise à jour.'
    await load()
  } catch (e) {
    error.value = adminError(e)
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<template>
  <div>
    <p class="eyebrow">Administration · Partenaires</p>
    <h2>Partenaires et logos</h2>
    <p>
      Les partenaires visibles apparaissent dans le carrousel de l’accueil, selon leur ordre. Les
      partenaires masqués restent consultables ici.
    </p>
    <button class="button" :disabled="busy" @click="edit()">Ajouter un partenaire</button>
    <p v-if="message" role="status" class="admin-alert">{{ message }}</p>
    <section v-if="form" class="admin-panel">
      <h3>{{ original ? 'Modifier le partenaire' : 'Nouveau partenaire' }}</h3>
      <form class="admin-form" @submit.prevent="save">
        <fieldset
          class="admin-fields"
          :disabled="busy || auth.busy"
          style="border: 0; padding: 0; min-width: 0"
        >
          <label>Nom *<input v-model="form.name" required maxlength="200" /></label
          ><label>Catégorie *<input v-model="form.category" required maxlength="100" /></label
          ><label
            >Site web<input
              v-model="form.website_url"
              type="url"
              maxlength="2000"
              placeholder="https://…" /></label
          ><label
            >Description interne ou de présentation<textarea
              v-model="form.description"
              maxlength="5000"
              rows="3"
            /></label
          ><label
            >Ordre d’affichage<input
              v-model.number="form.display_order"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              required /></label
          ><label
            >Logo (JPEG, PNG ou WebP, 2 Mo maximum)<input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="upload"
          /></label>
          <div v-if="form.logo_path" class="admin-partner-preview">
            <MediaImage
              :path="form.logo_path"
              :alt="form.name || 'Aperçu du logo'"
              contain
            /><button type="button" class="button button-outline" @click="form.logo_path = null">
              Retirer le logo de la fiche
            </button>
          </div>
          <label class="prereg-consent"
            ><input v-model="form.is_visible" type="checkbox" />Afficher sur le site public</label
          >
          <p>
            Un logo est obligatoire pour une nouvelle publication. Masquer le partenaire retire sa
            fiche du carrousel sans effacer ses données. Aucun fichier n’est supprimé lors d’un
            remplacement.
          </p>
          <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
          <button class="button">
            {{
              uploading
                ? 'Ajout du logo…'
                : saving
                  ? 'Enregistrement…'
                  : 'Enregistrer le partenaire'
            }}
          </button>
        </fieldset>
      </form>
      <div class="partner-admin-actions">
        <button class="button button-outline" :disabled="busy" @click="close">
          Fermer l’éditeur
        </button>
      </div>
    </section>
    <section class="admin-panel">
      <form class="admin-form" @submit.prevent="filter">
        <label>Rechercher un partenaire<input v-model="search" type="search" /></label
        ><button class="button">Rechercher</button>
      </form>
      <p v-if="results.loading.value" role="status">Chargement…</p>
      <div v-else-if="results.error.value" role="alert">
        <p>{{ results.error.value }}</p>
        <button class="button" @click="load">Réessayer</button>
      </div>
      <template v-else
        ><p>{{ results.data.value.count }} partenaire(s)</p>
        <p v-if="!results.data.value.items.length">
          Aucun partenaire enregistré pour cette recherche.
        </p>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Ordre</th>
                <th>Visibilité</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in results.data.value.items" :key="item.id">
                <td>{{ item.name }}</td>
                <td>{{ item.category }}</td>
                <td>{{ item.display_order }}</td>
                <td>{{ item.is_visible ? 'Visible' : 'Masqué' }}</td>
                <td>
                  <button class="button button-outline" :disabled="busy" @click="edit(item)">
                    Modifier
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <button
            class="button button-outline"
            :disabled="page <= 1 || results.loading.value"
            @click="go(page - 1)"
          >
            Précédent</button
          ><span>Page {{ page }} / {{ pages }}</span
          ><button
            class="button button-outline"
            :disabled="page >= pages || results.loading.value"
            @click="go(page + 1)"
          >
            Suivant
          </button>
        </div></template
      >
    </section>
  </div>
</template>
