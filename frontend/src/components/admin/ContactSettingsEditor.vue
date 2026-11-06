<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getContactSettings, saveContactSettings } from '../../services/contact'
import type { ContactSettings } from '../../types/contact'
import { useAuthStore } from '../../stores/auth'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import { adminError } from '../../lib/adminValidation'
const auth = useAuthStore(),
  form = ref<ContactSettings | null>(null),
  baseline = ref('null'),
  busy = ref(false),
  error = ref(''),
  success = ref('')
const dirty = computed(() => JSON.stringify(form.value) !== baseline.value)
const { confirmDiscard } = useUnsavedChanges(dirty, busy)
async function load() {
  if (!confirmDiscard()) return
  error.value = ''
  try {
    await auth.requireAdmin()
    form.value = await getContactSettings()
    baseline.value = JSON.stringify(form.value)
  } catch (e) {
    error.value = adminError(e)
  }
}
async function save() {
  if (!form.value || busy.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    form.value = await saveContactSettings(form.value)
    baseline.value = JSON.stringify(form.value)
    success.value = 'Coordonnées enregistrées.'
  } catch (e) {
    error.value = adminError(e)
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>
<template>
  <section class="admin-panel contact-settings">
    <h3>Coordonnées et formulaire</h3>
    <p>
      Ces coordonnées sont publiques. Le contenu de la page se rédige dans l’éditeur situé dessous.
    </p>
    <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
    <p v-if="success" role="status" class="admin-success">{{ success }}</p>
    <form v-if="form" @submit.prevent="save">
      <fieldset class="admin-fields" :disabled="busy || auth.busy">
        <div class="field">
          <label for="contact-email">Email de contact *</label
          ><input id="contact-email" v-model="form.email" type="email" required maxlength="254" />
        </div>
        <div class="admin-form-grid">
          <div class="field">
            <label for="contact-phone1">Téléphone principal</label
            ><input id="contact-phone1" v-model="form.phone_primary" maxlength="60" />
          </div>
          <div class="field">
            <label for="contact-phone2">Second téléphone</label
            ><input id="contact-phone2" v-model="form.phone_secondary" maxlength="60" />
          </div>
        </div>
        <div class="field">
          <label for="contact-location">Adresse ou localisation</label
          ><input id="contact-location" v-model="form.location" maxlength="500" />
        </div>
        <div class="field">
          <label for="contact-website">Site web *</label
          ><input
            id="contact-website"
            v-model="form.website_url"
            type="url"
            required
            maxlength="2048"
          />
        </div>
        <div class="field">
          <label for="contact-facebook">Lien Facebook *</label
          ><input
            id="contact-facebook"
            v-model="form.facebook_url"
            type="url"
            required
            maxlength="2048"
          />
        </div>
        <div class="field">
          <label for="contact-notice">Notice d’utilisation des coordonnées *</label
          ><textarea
            id="contact-notice"
            v-model="form.notice"
            minlength="30"
            maxlength="3000"
            required
            rows="3"
          />
        </div>
        <label class="admin-check"
          ><input v-model="form.form_enabled" type="checkbox" /><span
            >Activer l’envoi des messages depuis la page Contact publiée</span
          ></label
        >
        <p class="admin-note">
          Activer après déploiement de la fonction contact-message. Les demandes arrivent dans
          Messages reçus ; aucun email automatique n’est envoyé.
        </p>
        <div class="admin-form-actions">
          <button class="button">
            {{ busy ? 'Enregistrement…' : 'Enregistrer les coordonnées' }}</button
          ><button class="button button-outline" type="button" @click="load">
            Recharger les coordonnées
          </button>
        </div>
      </fieldset>
    </form>
    <button v-else class="button" @click="load">Réessayer</button>
  </section>
</template>
