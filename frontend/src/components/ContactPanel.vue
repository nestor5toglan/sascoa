<script setup lang="ts">
import ContactIcon from './ui/ContactIcon.vue'
import PageArtwork from './PageArtwork.vue'
import { onMounted, reactive, ref } from 'vue'
import { getContactSettings, sendContact } from '../services/contact'
import { useRemote } from '../composables/useRemote'
import { safeHttpUrl, phoneLink } from '../lib/presentation'
import type { ContactSettings } from '../types/contact'
import TurnstileChallenge from './TurnstileChallenge.vue'
const remote = useRemote<ContactSettings | null>(null),
  busy = ref(false),
  error = ref(''),
  receipt = ref(''),
  token = ref(''),
  challenge = ref<InstanceType<typeof TurnstileChallenge> | null>(null)
const form = reactive({
  full_name: '',
  email: '',
  phone: '',
  organization: '',
  subject: '',
  message: '',
  consent: false,
})
let key = crypto.randomUUID(),
  lastPayload = ''
const load = () => remote.run(getContactSettings)
onMounted(load)
async function submit() {
  if (!remote.data.value || busy.value) return
  if (!token.value) {
    error.value = 'Termine la vérification anti-robot.'
    return
  }
  const payload = JSON.stringify({ ...form, notice_version: remote.data.value.notice_version })
  if (lastPayload && payload !== lastPayload) key = crypto.randomUUID()
  lastPayload = payload
  busy.value = true
  error.value = ''
  try {
    receipt.value = await sendContact({
      ...form,
      submission_key: key,
      notice_version: remote.data.value.notice_version,
      token: token.value,
    })
    Object.assign(form, {
      full_name: '',
      email: '',
      phone: '',
      organization: '',
      subject: '',
      message: '',
      consent: false,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Envoi interrompu. Réessaie.'
    challenge.value?.reset()
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="contact-panel" aria-label="Contacter SASCOA">
    <p v-if="remote.loading.value" role="status">Chargement des coordonnées…</p>
    <div v-else-if="remote.error.value" role="alert">
      <p>Impossible de charger les coordonnées.</p>
      <button class="button" @click="load">Réessayer</button>
    </div>
    <template v-else-if="remote.data.value"
      ><div class="contact-side">
        <aside class="contact-card">
          <p class="eyebrow">La rencontre commence ici</p>
          <h2>Parlons de votre projet.</h2>
          <dl>
            <dt>Email</dt>
            <dd>
              <a :href="`mailto:${remote.data.value.email}`"
                ><ContactIcon kind="email" /><span>{{ remote.data.value.email }}</span></a
              >
            </dd>
            <dt>Téléphone</dt>
            <dd
              v-for="phone in [
                remote.data.value.phone_primary,
                remote.data.value.phone_secondary,
              ].filter(Boolean)"
              :key="phone"
            >
              <a v-if="phoneLink(phone)" :href="phoneLink(phone)!"
                ><ContactIcon kind="phone" /><span>{{ phone }}</span></a
              ><span v-else>{{ phone }}</span>
            </dd>
            <dt>Localisation</dt>
            <dd class="contact-line">
              <ContactIcon kind="location" /><span>{{ remote.data.value.location }}</span>
            </dd>
          </dl>
          <a
            v-if="safeHttpUrl(remote.data.value.facebook_url)"
            :href="safeHttpUrl(remote.data.value.facebook_url)!"
            target="_blank"
            rel="noopener noreferrer"
            ><ContactIcon kind="facebook" /><span>SASCOA sur Facebook ↗</span></a
          >
        </aside>
        <PageArtwork variant="contact" compact />
      </div>
      <div class="contact-write">
        <h2>Écrivez-nous</h2>
        <p v-if="receipt" role="status">
          Votre message est enregistré. Référence : <strong>{{ receipt }}</strong
          >. L’organisation pourra vous répondre à l’adresse indiquée.
        </p>
        <p v-else-if="!remote.data.value.form_enabled">
          Vous pouvez joindre l’organisation par téléphone ou par email aux coordonnées ci-contre.
        </p>
        <form v-else class="prereg-form" @submit.prevent="submit">
          <p>Les champs marqués * sont obligatoires.</p>
          <fieldset :disabled="busy" class="contact-fields">
            <label
              >Nom et prénom *<input
                v-model="form.full_name"
                autocomplete="name"
                maxlength="200"
                required /></label
            ><label
              >Email *<input
                v-model="form.email"
                autocomplete="email"
                type="email"
                maxlength="254"
                required /></label
            ><label
              >Téléphone (facultatif)<input
                v-model="form.phone"
                autocomplete="tel"
                type="tel"
                maxlength="50" /></label
            ><label
              >Organisation (facultatif)<input
                v-model="form.organization"
                autocomplete="organization"
                maxlength="200" /></label
            ><label>Objet *<input v-model="form.subject" maxlength="250" required /></label
            ><label
              >Message *<textarea v-model="form.message" rows="6" maxlength="10000" required />
            </label>
            <p class="prereg-notice">{{ remote.data.value.notice }}</p>
            <label class="prereg-consent"
              ><input v-model="form.consent" required type="checkbox" /><span
                >J’ai pris connaissance de cette utilisation de mes coordonnées. *</span
              ></label
            ><TurnstileChallenge
              ref="challenge"
              action="contact-message"
              @token="(value) => (token = value)"
            />
            <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
            <button class="button" :disabled="!token">
              {{ busy ? 'Envoi en cours…' : 'Envoyer mon message' }}
            </button>
          </fieldset>
        </form>
      </div></template
    >
  </section>
</template>
