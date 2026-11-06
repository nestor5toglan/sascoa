<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { getPreregConfig, submitPreregistration } from '../services/preregistration'
import { preregInterests } from '../types/preregistration'
import type { PreregConfig } from '../types/preregistration'
import TurnstileChallenge from './TurnstileChallenge.vue'
const route = useRoute(),
  isPublic = computed(() => !route.path.startsWith('/administration'))
const dialog = ref<HTMLDialogElement | null>(null),
  config = ref<PreregConfig | null>(null),
  loading = ref(false),
  loadError = ref(''),
  sendError = ref(''),
  busy = ref(false),
  receipt = ref(''),
  token = ref(''),
  challenge = ref<InstanceType<typeof TurnstileChallenge> | null>(null),
  opened = ref(false)
const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  organization: '',
  interest: 'visitor',
  message: '',
  consent: false,
})
let lastPayload = '',
  key = crypto.randomUUID(),
  priorFocus: HTMLElement | null = null,
  overflow = '',
  timer: ReturnType<typeof setTimeout> | undefined,
  observer: MutationObserver | undefined,
  ready = false,
  due = false,
  disposed = false,
  generation = 0
const sessionKey = 'sascoa-prereg-popup-v37'
let seen = false
try {
  seen = sessionStorage.getItem(sessionKey) === '1'
} catch {
  /* Mode privé sans stockage : mémoire seulement. */
}
function markSeen() {
  seen = true
  try {
    sessionStorage.setItem(sessionKey, '1')
  } catch {
    /* Pas de donnée personnelle. */
  }
}
function show() {
  if (!isPublic.value || opened.value || document.querySelector('dialog[open]')) return
  markSeen()
  opened.value = true
  priorFocus = document.activeElement as HTMLElement | null
  overflow = document.body.style.overflow
  void nextTick(() => {
    if (opened.value && isPublic.value) {
      dialog.value?.showModal()
      document.body.style.overflow = 'hidden'
    }
  })
}
function auto() {
  if (ready && due && !seen && config.value && isPublic.value) show()
}
async function load() {
  const version = ++generation
  loading.value = true
  loadError.value = ''
  try {
    const value = await getPreregConfig()
    if (!disposed && version === generation) {
      config.value = value
      ready = true
      auto()
    }
  } catch {
    if (!disposed && version === generation)
      loadError.value = 'Impossible de charger les préinscriptions. Réessaie.'
  } finally {
    if (!disposed && version === generation) loading.value = false
  }
}
function manual() {
  show()
  void load()
}
function close() {
  opened.value = false
  dialog.value?.close()
  document.body.style.overflow = overflow
  priorFocus?.focus()
}
async function submit() {
  if (!config.value || busy.value) return
  if (!token.value) {
    sendError.value = 'Termine la vérification anti-robot.'
    return
  }
  const payload = JSON.stringify({
    ...form,
    event_id: config.value.event_id,
    notice_version: config.value.notice_version,
  })
  if (lastPayload && lastPayload !== payload) key = crypto.randomUUID()
  lastPayload = payload
  busy.value = true
  sendError.value = ''
  try {
    receipt.value = await submitPreregistration({
      ...form,
      submission_key: key,
      event_id: config.value.event_id,
      notice_version: config.value.notice_version,
      token: token.value,
    })
    Object.assign(form, {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      organization: '',
      interest: 'visitor',
      message: '',
      consent: false,
    })
    key = crypto.randomUUID()
  } catch (cause) {
    sendError.value = cause instanceof Error ? cause.message : 'Envoi interrompu. Réessaie.'
    challenge.value?.reset()
  } finally {
    busy.value = false
  }
}
watch(
  () => route.path,
  () => {
    if (!isPublic.value && opened.value) close()
    else if (isPublic.value) {
      if (!ready) void load()
      auto()
    }
  },
)
onMounted(() => {
  timer = setTimeout(() => {
    due = true
    auto()
  }, 3000)
  if (isPublic.value) void load()
  observer = new MutationObserver(auto)
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
})
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(timer)
  observer?.disconnect()
  if (opened.value) close()
})
</script>
<template>
  <button
    v-if="isPublic"
    class="button prereg-launch"
    type="button"
    aria-haspopup="dialog"
    @click="manual"
  >
    Préinscription au salon <span aria-hidden="true">↗</span>
  </button>
  <dialog
    ref="dialog"
    class="detail-dialog prereg-dialog"
    aria-labelledby="prereg-title"
    @cancel.prevent="close"
    @click="
      (event) => {
        if (event.target === dialog) close()
      }
    "
  >
    <div class="dialog-inner">
      <div class="dialog-top">
        <p class="eyebrow">SASCOA · Faisons connaissance</p>
        <button
          class="icon-button"
          type="button"
          aria-label="Fermer la préinscription"
          autofocus
          @click="close"
        >
          ✕
        </button>
      </div>
      <h2 id="prereg-title">Préinscription au salon</h2>
      <p v-if="receipt" role="status">
        Ta demande a bien été enregistrée. Référence : <strong>{{ receipt }}</strong
        >. L’organisation pourra te recontacter. Cette préinscription ne vaut ni confirmation de
        participation ni paiement.
      </p>
      <template v-else>
        <p v-if="loading" role="status">Chargement du formulaire…</p>
        <div v-else-if="loadError" role="alert">
          <p>{{ loadError }}</p>
          <button class="button" @click="load">Réessayer</button>
        </div>
        <p v-else-if="!config">
          Les préinscriptions ne sont pas ouvertes actuellement. Les dates et modalités seront
          annoncées ici.
        </p>
        <form v-else class="admin-form prereg-form" @submit.prevent="submit">
          <p>
            <strong>{{ config.title }}</strong
            ><br />Sans création de compte. Les champs marqués * sont obligatoires.
          </p>
          <fieldset :disabled="busy">
            <div class="prereg-grid">
              <label
                >Prénom *<input
                  v-model="form.first_name"
                  autocomplete="given-name"
                  required
                  maxlength="100"
              /></label>
              <label
                >Nom *<input
                  v-model="form.last_name"
                  autocomplete="family-name"
                  required
                  maxlength="100"
              /></label>
            </div>
            <label
              >Email *<input
                v-model="form.email"
                type="email"
                autocomplete="email"
                required
                maxlength="254"
            /></label>
            <label
              >Téléphone <span>(facultatif)</span
              ><input v-model="form.phone" type="tel" autocomplete="tel" maxlength="60"
            /></label>
            <label
              >Organisation <span>(facultatif)</span
              ><input v-model="form.organization" autocomplete="organization" maxlength="200"
            /></label>
            <label
              >Je souhaite participer comme *<select v-model="form.interest">
                <option v-for="(label, value) in preregInterests" :key="value" :value="value">
                  {{ label }}
                </option>
              </select></label
            >
            <label
              >Message <span>(facultatif)</span
              ><textarea v-model="form.message" rows="3" maxlength="2000" />
            </label>
            <p class="prereg-notice">{{ config.notice }}</p>
            <label class="prereg-consent"
              ><input v-model="form.consent" type="checkbox" required /><span
                >J’ai pris connaissance de cette utilisation de mes coordonnées. *</span
              ></label
            >
            <TurnstileChallenge v-if="opened" ref="challenge" @token="(value) => (token = value)" />
            <p v-if="sendError" class="admin-alert" role="alert">{{ sendError }}</p>
            <button class="button" :disabled="!token" type="submit">
              {{ busy ? 'Envoi en cours…' : 'Envoyer ma préinscription' }}
            </button>
          </fieldset>
          <p>
            Aucune place ni aucun stand n’est réservé automatiquement. Aucun paiement n’est demandé
            ici.
          </p>
        </form>
      </template>
      <button class="button button-outline dialog-bottom" type="button" @click="close">
        Fermer
      </button>
    </div>
  </dialog>
</template>
