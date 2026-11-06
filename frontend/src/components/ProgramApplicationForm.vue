<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import type { Program, ApplicationInput, ApplicationConfig } from '../types/applications'
import { useRemote } from '../composables/useRemote'
import { getApplicationConfig, submitApplication } from '../services/applications'
import { encodePdf, inspectApplicationPdf, validateApplication } from '../lib/applicationValidation'
import TurnstileChallenge from './TurnstileChallenge.vue'
const props = defineProps<{ program: Program }>(),
  config = useRemote<ApplicationConfig | null>(null),
  busy = ref(false),
  checkingPdf = ref(false),
  error = ref(''),
  receipt = ref(''),
  token = ref(''),
  pdf = ref<File | null>(null),
  fileInput = ref<HTMLInputElement | null>(null),
  challenge = ref<InstanceType<typeof TurnstileChallenge> | null>(null)
const form = reactive<ApplicationInput>({
  full_name: '',
  email: '',
  phone: '',
  organization: '',
  project_name: '',
  description: '',
  objective: '',
  skills: '',
  participation_mode: 'individual',
  team_name: '',
  members: [],
  members_authorized: false,
  consent: false,
})
let key = crypto.randomUUID(),
  lastHash = '',
  selectionVersion = 0
const dirty = computed(
  () =>
    !receipt.value &&
    (!!form.full_name ||
      !!form.email ||
      !!form.project_name ||
      !!form.description ||
      !!form.skills ||
      form.members.length > 0 ||
      !!pdf.value),
)
const load = () => {
  token.value = ''
  return config.run(() => getApplicationConfig(props.program))
}
watch(
  () => config.data.value?.notice_version,
  (current, previous) => {
    if (previous && current !== previous) form.consent = false
  },
)
watch(
  () => form.participation_mode,
  (mode) => {
    if (mode === 'individual') {
      form.team_name = ''
      form.members = []
      form.members_authorized = false
    } else if (!form.members.length) form.members = [{ full_name: '', skills: '' }]
  },
)
function addMember() {
  if (config.data.value && form.members.length + 1 < config.data.value.team_max_size)
    form.members.push({ full_name: '', skills: '' })
}
async function selectPdf(event: Event) {
  const current = ++selectionVersion
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  error.value = ''
  pdf.value = null
  if (!file) {
    checkingPdf.value = false
    return
  }
  checkingPdf.value = true
  try {
    await inspectApplicationPdf(file)
    if (current === selectionVersion) pdf.value = file
  } catch (e) {
    if (current === selectionVersion)
      error.value = e instanceof Error ? e.message : 'Document non reconnu.'
  } finally {
    if (current === selectionVersion) checkingPdf.value = false
  }
}
function removePdf() {
  selectionVersion++
  pdf.value = null
  checkingPdf.value = false
}

async function submit() {
  if (!config.data.value || busy.value || checkingPdf.value) return
  error.value = validateApplication(props.program, form, config.data.value.team_max_size)
  if (error.value) return
  if (!token.value) {
    error.value = 'Terminez la vérification anti-robot.'
    return
  }
  busy.value = true
  try {
    const document = pdf.value ? await encodePdf(pdf.value) : null
    const base = {
      program: props.program,
      notice_version: config.data.value.notice_version,
      ...JSON.parse(JSON.stringify(form)),
      document,
    }
    const bytes = new TextEncoder().encode(JSON.stringify(base))
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
    if (lastHash && hash !== lastHash) key = crypto.randomUUID()
    lastHash = hash
    receipt.value = await submitApplication({ ...base, submission_key: key, token: token.value })
    pdf.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Envoi interrompu. Réessayez.'
    challenge.value?.reset()
  } finally {
    busy.value = false
  }
}
function leave() {
  return (
    !busy.value &&
    !checkingPdf.value &&
    (!dirty.value || window.confirm('Quitter ce formulaire sans envoyer la candidature ?'))
  )
}
function unload(event: BeforeUnloadEvent) {
  if (!dirty.value && !busy.value && !checkingPdf.value) return
  event.preventDefault()
  event.returnValue = ''
}
onBeforeRouteLeave(leave)
onBeforeRouteUpdate(leave)
onMounted(() => {
  void load()
  window.addEventListener('beforeunload', unload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', unload))
</script>
<template>
  <section
    class="program-form-section"
    :aria-label="`Candidature ${program === 'pitch' ? 'Pitch' : 'Hackathon'}`"
  >
    <div class="program-form-intro">
      <p class="eyebrow">Passer à l’action</p>
      <h2>{{ program === 'pitch' ? 'Présentez votre projet' : 'Rejoignez le Hackathon' }}</h2>
      <p>
        Une candidature sans création de compte, étudiée par l’organisation. L’envoi ne vaut pas
        acceptation.
      </p>
    </div>
    <p v-if="config.loading.value" role="status">Chargement du formulaire…</p>
    <div v-else-if="config.error.value" role="alert">
      <p>Le formulaire est momentanément indisponible.</p>
      <button class="button button-outline" @click="load">Réessayer le formulaire</button>
    </div>
    <p v-else-if="!config.data.value">
      Les candidatures ne sont pas ouvertes pour le moment. Les modalités seront annoncées par
      l’organisation.
    </p>
    <template v-else
      ><button
        v-if="!receipt"
        type="button"
        class="text-link"
        :disabled="busy || checkingPdf"
        @click="load"
      >
        Actualiser les règles du formulaire
      </button>
      <p>
        Salon concerné : <strong>{{ config.data.value.event_title }}</strong>
      </p>
      <p v-if="config.data.value.deadline">
        Clôture : {{ new Date(config.data.value.deadline).toLocaleString('fr-FR') }}
      </p>
      <p v-if="receipt" class="program-receipt" role="status">
        Votre candidature est enregistrée. Référence : <strong>{{ receipt }}</strong
        >. L’organisation pourra vous contacter à l’adresse indiquée. Aucun email automatique n’est
        envoyé.
      </p>
      <form v-else @submit.prevent="submit">
        <p>Les champs marqués * sont obligatoires.</p>
        <fieldset
          class="program-fields"
          :disabled="busy"
          style="border: 0; padding: 0; min-width: 0"
        >
          <label v-if="program === 'hackathon'"
            >Participation *<select v-model="form.participation_mode">
              <option value="individual">Individuelle</option>
              <option value="team">En équipe</option>
            </select></label
          ><label
            >{{ form.participation_mode === 'team' ? 'Nom du responsable *' : 'Nom et prénom *'
            }}<input v-model="form.full_name" autocomplete="name" maxlength="200" required /></label
          ><label
            >Email de contact *<input
              v-model="form.email"
              type="email"
              autocomplete="email"
              maxlength="254"
              required /></label
          ><label
            >Téléphone (facultatif)<input
              v-model="form.phone"
              type="tel"
              autocomplete="tel"
              maxlength="60" /></label
          ><label
            >Organisation (facultatif)<input
              v-model="form.organization"
              autocomplete="organization"
              maxlength="200" /></label
          ><label
            >{{ program === 'pitch' ? 'Nom du projet *' : 'Nom de l’idée ou du projet (facultatif)'
            }}<input
              v-model="form.project_name"
              :required="program === 'pitch'"
              maxlength="200" /></label
          ><label class="program-wide"
            >{{
              program === 'pitch'
                ? 'Présentation du projet *'
                : 'Présentation de l’idée (facultative)'
            }}<textarea
              v-model="form.description"
              :required="program === 'pitch'"
              maxlength="5000"
              rows="5"
            /></label
          ><label v-if="program === 'pitch'" class="program-wide"
            >Objectif et besoins *<textarea
              v-model="form.objective"
              required
              maxlength="3000"
              rows="4"
            /></label
          ><label v-if="program === 'hackathon'" class="program-wide"
            >{{
              form.participation_mode === 'team'
                ? 'Compétences du responsable *'
                : 'Vos compétences *'
            }}<textarea v-model="form.skills" required maxlength="1000" rows="3" /></label
          ><template v-if="form.participation_mode === 'team'"
            ><label class="program-wide"
              >Nom de l’équipe *<input v-model="form.team_name" required maxlength="120"
            /></label>
            <div class="program-wide">
              <p>
                Maximum {{ config.data.value.team_max_size }} personnes, responsable inclus. Ajoutez
                ici les autres membres.
              </p>
              <div v-for="(member, index) in form.members" :key="index" class="program-member">
                <label
                  >Nom du membre {{ index + 1 }} *<input
                    v-model="member.full_name"
                    maxlength="100"
                    required /></label
                ><label
                  >Compétences du membre {{ index + 1
                  }}<input v-model="member.skills" maxlength="500" /></label
                ><button
                  type="button"
                  class="button button-outline"
                  @click="form.members.splice(index, 1)"
                >
                  Retirer le membre {{ index + 1 }}
                </button>
              </div>
              <button
                type="button"
                class="button button-outline"
                :disabled="form.members.length + 1 >= config.data.value.team_max_size"
                @click="addMember"
              >
                Ajouter un membre
              </button>
            </div>
            <label class="program-wide prereg-consent"
              ><input v-model="form.members_authorized" type="checkbox" required />Je suis autorisé
              à transmettre les noms et compétences des membres pour cette candidature.</label
            ></template
          ><label class="program-wide"
            >Présentation en PDF (facultative, 5 Mo maximum)<input
              ref="fileInput"
              type="file"
              accept="application/pdf,.pdf"
              @change="selectPdf"
          /></label>
          <div v-if="pdf" class="program-wide">
            <p>Document sélectionné : {{ pdf.name }}</p>
            <button type="button" class="text-link" @click="removePdf">Retirer le PDF</button>
          </div>
          <p class="program-wide prereg-notice">{{ config.data.value.notice }}</p>
          <label class="program-wide prereg-consent"
            ><input v-model="form.consent" type="checkbox" required />J’ai pris connaissance de
            l’utilisation des informations et du document transmis pour l’étude de cette
            candidature.</label
          >
          <div class="program-wide">
            <TurnstileChallenge
              ref="challenge"
              action="program-application"
              @token="(value) => (token = value)"
            />
          </div>
          <p v-if="error" role="alert" class="program-wide admin-alert">{{ error }}</p>
          <button class="button program-wide" :disabled="!token || checkingPdf">
            {{ busy ? 'Envoi de la candidature…' : 'Envoyer ma candidature' }}
          </button>
        </fieldset>
      </form></template
    >
  </section>
</template>
