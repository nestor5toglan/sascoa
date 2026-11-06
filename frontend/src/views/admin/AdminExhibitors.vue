<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useUnsavedChanges } from '../../composables/useUnsavedChanges'
import { useRemote } from '../../composables/useRemote'
import * as api from '../../services/exhibitors'
import { money } from '../../lib/exhibitorValidation'
import type { StandCategory, ExhibitorFile, ExhibitorPayment } from '../../types/exhibitors'
import { exhibitStatuses, paymentMethods } from '../../types/exhibitors'
import { uploadEditorialFile } from '../../services/adminMedia'
import MediaImage from '../../components/ui/MediaImage.vue'
const auth = useAuthStore(),
  salons = ref<Awaited<ReturnType<typeof api.exhibitorSalons>>>([]),
  eventId = ref(''),
  categories = ref<StandCategory[]>([]),
  requests = ref<Awaited<ReturnType<typeof api.exhibitorRequests>>>([]),
  page = ref(1),
  busy = ref(false),
  error = ref(''),
  message = ref(''),
  requestId = ref(''),
  categoryId = ref(''),
  stand = ref(''),
  file = ref<ExhibitorFile | null>(null),
  fileBase = ref('null'),
  cat = ref<Partial<StandCategory> | null>(null),
  catBase = ref('null'),
  payments = ref<ExhibitorPayment[]>([]),
  paymentReady = ref(false),
  amount = ref(0),
  paidOn = ref(new Date().toISOString().slice(0, 10)),
  method = ref('mobile_money'),
  reference = ref(''),
  voidReason = ref('')
const results = useRemote<{ items: ExhibitorFile[]; count: number }>({ items: [], count: 0 })
const dirty = computed(
  () =>
    JSON.stringify(file.value) !== fileBase.value ||
    JSON.stringify(cat.value) !== catBase.value ||
    !!reference.value ||
    !!voidReason.value ||
    !!stand.value,
)
const { confirmDiscard } = useUnsavedChanges(dirty, busy)
const currentPayment = computed(() => payments.value.find((p) => !p.voided_at)),
  pages = computed(() => Math.max(1, Math.ceil(results.data.value.count / 10)))
function explain(e: unknown) {
  const x = e as { code?: string; message?: string }
  if (x.code === '23505')
    return 'Cette demande a déjà un dossier, ce numéro de stand est réservé ou ce nom de catégorie existe. Recharge et vérifie la liste.'
  if (x.code === '42501') return 'Accès refusé : vérifie ta session administrateur.'
  return x.message || 'Opération interrompue. Réessaie.'
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
const loadFiles = () => results.run(() => api.listExhibitorFiles(eventId.value, page.value))
async function loadBase() {
  const [c, r] = await Promise.all([
    api.standCategories(eventId.value),
    api.exhibitorRequests(eventId.value),
  ])
  categories.value = c
  requests.value = r
  await loadFiles()
}
function clearEditors() {
  file.value = null
  fileBase.value = 'null'
  cat.value = null
  catBase.value = 'null'
  payments.value = []
  paymentReady.value = false
  reference.value = ''
  voidReason.value = ''
  stand.value = ''
}
async function changeEvent(event: Event) {
  const input = event.target as HTMLSelectElement
  if (!confirmDiscard()) {
    input.value = eventId.value
    return
  }
  eventId.value = input.value
  clearEditors()
  categories.value = []
  requests.value = []
  results.data.value = { items: [], count: 0 }
  page.value = 1
  if (eventId.value) await action(loadBase)
}
async function reload() {
  if (!confirmDiscard()) return
  clearEditors()
  await action(loadBase)
}
function editCategory(value?: StandCategory) {
  if (!confirmDiscard()) return
  clearEditors()
  cat.value = value
    ? { ...value }
    : {
        event_id: eventId.value,
        name: '',
        price_amount: 50000,
        capacity: 10,
        is_active: true,
        is_demo: true,
      }
  catBase.value = JSON.stringify(cat.value)
}
async function saveCategory() {
  if (!cat.value) return
  await action(async () => {
    const c = cat.value!
    const saved = await api.saveStandCategory({
      ...c,
      event_id: eventId.value,
      name: c.name || '',
      price_amount: c.price_amount!,
      capacity: c.capacity!,
      is_active: !!c.is_active,
      is_demo: !!c.is_demo,
    })
    cat.value = saved
    catBase.value = JSON.stringify(saved)
    await loadBase()
    message.value = 'Catégorie enregistrée. Les tarifs des dossiers existants restent figés.'
  })
}
async function seed() {
  if (!confirmDiscard()) return
  clearEditors()
  await action(async () => {
    const values = [
      ['Standard · test', 50000, 10],
      ['Confort · test', 100000, 5],
      ['Premium · test', 200000, 2],
    ] as const
    try {
      const known = await api.standCategories(eventId.value)
      for (const [name, price, capacity] of values)
        if (!known.some((c) => c.name === name))
          await api.saveStandCategory({
            event_id: eventId.value,
            name,
            price_amount: price,
            capacity,
            is_active: true,
            is_demo: true,
          })
    } finally {
      await loadBase()
    }
    message.value = 'Catégories de démonstration ajoutées. Aucun paiement ou exposant créé.'
  })
}
async function openFile(value: ExhibitorFile) {
  if (!confirmDiscard()) return
  clearEditors()
  file.value = { ...value }
  fileBase.value = JSON.stringify(file.value)
  amount.value = value.quoted_amount
  await action(async () => {
    payments.value = await api.exhibitorPayments(value.id)
    paymentReady.value = true
  })
}
async function create() {
  const request = requests.value.find((r) => r.id === requestId.value)
  if (!request) return
  await action(async () => {
    const saved = await api.createExhibitorFile(request, categoryId.value, stand.value)
    stand.value = ''
    file.value = saved
    fileBase.value = JSON.stringify(saved)
    amount.value = saved.quoted_amount
    payments.value = []
    paymentReady.value = true
    await loadFiles()
    message.value = 'Dossier créé en attente, sans paiement ni publication.'
  })
}
async function saveFile() {
  if (!file.value) return
  await action(async () => {
    const saved = await api.saveExhibitorFile(file.value!)
    file.value = saved
    fileBase.value = JSON.stringify(saved)
    amount.value = saved.quoted_amount
    await loadFiles()
    message.value = 'Dossier enregistré.'
  })
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    image = input.files?.[0]
  input.value = ''
  if (!image || !file.value) return
  await action(async () => {
    const path = await uploadEditorialFile(image, 'exhibitors', 'image')
    if (file.value) file.value.logo_path = path
    message.value = 'Logo ajouté. Enregistre le dossier pour le conserver.'
  })
}
function paymentClean() {
  if (JSON.stringify(file.value) !== fileBase.value) {
    error.value = 'Enregistre d’abord les modifications du dossier.'
    return false
  }
  return true
}
async function pay() {
  if (
    !file.value ||
    !paymentClean() ||
    !window.confirm(
      'Confirmer manuellement la réception du paiement intégral ? Aucun argent ne sera débité par le site.',
    )
  )
    return
  await action(async () => {
    const saved = await api.confirmExhibitorPayment(
      file.value!,
      amount.value,
      paidOn.value,
      method.value,
      reference.value,
    )
    file.value = saved
    fileBase.value = JSON.stringify(saved)
    reference.value = ''
    paymentReady.value = false
    payments.value = await api.exhibitorPayments(saved.id)
    paymentReady.value = true
    await loadFiles()
    message.value = 'Paiement intégral confirmé. Tu peux maintenant admettre l’exposant.'
  })
}
async function voidPayment() {
  if (
    !file.value ||
    !paymentClean() ||
    !window.confirm(
      'Annuler cette confirmation ? L’admission et la publication seront retirées. Cette correction ne rembourse pas le paiement.',
    )
  )
    return
  await action(async () => {
    const saved = await api.voidExhibitorPayment(file.value!, voidReason.value)
    file.value = saved
    fileBase.value = JSON.stringify(saved)
    voidReason.value = ''
    paymentReady.value = false
    payments.value = await api.exhibitorPayments(saved.id)
    paymentReady.value = true
    await loadFiles()
    message.value = 'Confirmation annulée, historique conservé. Aucun remboursement effectué.'
  })
}
function close() {
  if (confirmDiscard()) clearEditors()
}
async function go(n: number) {
  page.value = n
  await loadFiles()
}
const reloadSalons = () =>
  action(async () => {
    salons.value = await api.exhibitorSalons()
  })
onMounted(reloadSalons)
</script>
<template>
  <div>
    <p class="eyebrow">Administration · Salon</p>
    <h2>Exposants et stands</h2>
    <p class="expo-notice">
      Demande → attribution du stand → paiement intégral confirmé manuellement → admission →
      publication avec accord. Aucun débit, email automatique ou remboursement n’est effectué ici.
    </p>
    <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
    <p v-if="message" role="status" class="admin-alert">{{ message }}</p>
    <label
      >Salon à gérer<select :value="eventId" :disabled="busy || auth.busy" @change="changeEvent">
        <option value="">Choisir un salon</option>
        <option v-for="s in salons" :key="s.id" :value="s.id">
          {{ s.title }}{{ s.is_demo ? ' · Démonstration' : '' }}
        </option>
      </select></label
    ><button
      v-if="!salons.length"
      class="button button-outline"
      :disabled="busy"
      @click="reloadSalons"
    >
      Recharger les salons</button
    ><template v-if="eventId"
      ><div class="expo-actions">
        <button class="button button-outline" :disabled="busy" @click="reload">
          Recharger les dossiers</button
        ><button class="button" :disabled="busy" @click="editCategory()">
          Ajouter une catégorie</button
        ><button class="button button-outline" :disabled="busy" @click="seed">
          Ajouter les catégories de test
        </button>
      </div>
      <section class="admin-panel">
        <h3>Catégories et tarifs</h3>
        <p>
          Les dossiers créés réservent une place jusqu’à annulation. Un tarif modifié s’applique aux
          nouveaux dossiers. Les montants sont en FCFA (XOF), sans décimales.
        </p>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Tarif</th>
                <th>Capacité</th>
                <th>État</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in categories" :key="c.id">
                <td>{{ c.name }}<span v-if="c.is_demo"> · Test</span></td>
                <td>{{ money(c.price_amount) }}</td>
                <td>{{ c.capacity }}</td>
                <td>{{ c.is_active ? 'Active' : 'Inactive' }}</td>
                <td>
                  <button class="button button-outline" :disabled="busy" @click="editCategory(c)">
                    Modifier {{ c.name }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!categories.length">
          Aucune catégorie. Ajoute une catégorie ou les données de test.
        </p>
        <form v-if="cat" class="admin-form" @submit.prevent="saveCategory">
          <fieldset
            class="admin-fields expo-form-grid"
            :disabled="busy || auth.busy"
            style="border: 0; padding: 0; min-width: 0"
          >
            <label>Nom de catégorie<input v-model="cat.name" required maxlength="100" /></label
            ><label
              >Tarif intégral en FCFA<input
                v-model.number="cat.price_amount"
                type="number"
                min="1"
                max="1000000000"
                step="1"
                required /></label
            ><label
              >Capacité totale<input
                v-model.number="cat.capacity"
                type="number"
                min="1"
                max="10000"
                step="1"
                required /></label
            ><label class="prereg-consent"
              ><input v-model="cat.is_active" type="checkbox" />Catégorie active</label
            ><label class="prereg-consent"
              ><input v-model="cat.is_demo" type="checkbox" />Tarif de démonstration</label
            ><button class="button">Enregistrer la catégorie</button>
          </fieldset>
        </form>
      </section>
      <section v-if="!file && !cat" class="admin-panel">
        <h3>Créer un dossier depuis une préinscription</h3>
        <form class="admin-form" @submit.prevent="create">
          <fieldset
            class="admin-fields expo-form-grid"
            :disabled="busy || auth.busy"
            style="border: 0; padding: 0; min-width: 0"
          >
            <label class="expo-span"
              >Demande Exposant<select v-model="requestId" required>
                <option value="">Choisir une demande</option>
                <option v-for="r in requests" :key="r.id" :value="r.id">
                  {{ r.reference }} · {{ r.organization || `${r.first_name} ${r.last_name}` }}
                </option>
              </select></label
            ><label
              >Catégorie de stand<select v-model="categoryId" required>
                <option value="">Choisir une catégorie</option>
                <option
                  v-for="c in categories.filter((c) => c.is_active)"
                  :key="c.id"
                  :value="c.id"
                >
                  {{ c.name }} · {{ money(c.price_amount) }}
                </option>
              </select></label
            ><label
              >Numéro de stand<input
                v-model="stand"
                required
                maxlength="40"
                placeholder="Ex. A-01" /></label
            ><button class="button">Créer le dossier exposant</button>
          </fieldset>
        </form>
        <p>
          Seules les demandes Exposant non archivées de ce salon sont proposées. Une demande déjà
          traitée ne peut pas créer un second dossier. Aucune donnée de test personnelle n’est
          ajoutée automatiquement.
        </p>
      </section>
      <section v-if="file" class="admin-panel">
        <h3>Dossier : {{ file.public_name }}</h3>
        <p v-if="file.is_demo" class="demo-badge">
          Dossier de démonstration · aucun paiement réel requis pour les essais
        </p>
        <p>
          Tarif figé : <strong>{{ money(file.quoted_amount) }}</strong
          >. La catégorie peut changer uniquement sans paiement confirmé. Une annulation libère le
          stand mais ne rembourse rien.
        </p>
        <form class="admin-form" @submit.prevent="saveFile">
          <fieldset
            class="admin-fields expo-form-grid"
            :disabled="busy || auth.busy"
            style="border: 0; padding: 0; min-width: 0"
          >
            <label
              >Catégorie attribuée<select
                v-model="file.category_id"
                :disabled="!!currentPayment || !paymentReady"
              >
                <option v-for="c in categories" :key="c.id" :value="c.id">
                  {{ c.name }} · {{ money(c.price_amount) }}{{ !c.is_active ? ' · Inactive' : '' }}
                </option>
              </select></label
            ><label
              >Numéro attribué<input v-model="file.stand_number" maxlength="40" required /></label
            ><label
              >Nom destiné au public<input
                v-model="file.public_name"
                maxlength="200"
                required /></label
            ><label
              >Site web public<input
                v-model="file.public_website"
                type="url"
                placeholder="https://…"
                maxlength="2000" /></label
            ><label class="expo-span"
              >Présentation publique<textarea
                v-model="file.public_description"
                rows="4"
                maxlength="2000"
              /></label
            ><label
              >Logo public (2 Mo maximum)<input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                @change="upload"
            /></label>
            <div v-if="file.logo_path" class="expo-card-logo">
              <MediaImage :path="file.logo_path" :alt="file.public_name" contain /><button
                type="button"
                class="button button-outline"
                @click="file.logo_path = null"
              >
                Retirer le logo
              </button>
            </div>
            <label class="prereg-consent expo-span"
              ><input v-model="file.publication_consent" type="checkbox" />Accord de publication
              obtenu pour ces informations publiques</label
            ><label class="expo-span"
              >Source et date de cet accord (note interne)<input
                v-model="file.consent_note"
                maxlength="500"
                :required="file.publication_consent"
                placeholder="Ex. accord écrit reçu le…" /></label
            ><label
              >Admission<select v-model="file.status">
                <option value="pending">En attente</option>
                <option value="admitted" :disabled="!currentPayment || !paymentReady">
                  Admis · paiement confirmé requis
                </option>
                <option value="cancelled">Annulé</option>
              </select></label
            ><label class="prereg-consent"
              ><input v-model="file.is_public" type="checkbox" />Afficher sur la fiche publique du
              salon</label
            >
            <p class="expo-span">
              La publication exige le statut Admis, un paiement intégral confirmé et l’accord
              consigné. Pour annuler l’admission ou retirer l’accord, décoche aussi l’affichage
              public. Les contacts et références de paiement ne sont jamais publiés.
            </p>
            <button class="button">Enregistrer le dossier</button>
          </fieldset>
        </form>
        <section class="expo-payment">
          <h4>Paiement intégral</h4>
          <p v-if="!paymentReady">
            Historique non chargé. Ferme puis rouvre le dossier pour réessayer.
          </p>
          <template v-else
            ><article v-for="payment in payments" :key="payment.id">
              <p>
                <strong
                  >{{ payment.voided_at ? 'Confirmation annulée' : 'Paiement confirmé' }} ·
                  {{ money(payment.amount) }}</strong
                >
              </p>
              <p>
                {{ payment.paid_on }} ·
                {{ paymentMethods[payment.method as keyof typeof paymentMethods] }} ·
                {{ payment.reference }}
              </p>
              <p v-if="payment.void_reason">Motif : {{ payment.void_reason }}</p>
            </article>
            <form
              v-if="!currentPayment && file.status !== 'cancelled'"
              class="admin-form"
              @submit.prevent="pay"
            >
              <fieldset
                :disabled="busy || auth.busy"
                class="admin-fields"
                style="border: 0; padding: 0; min-width: 0"
              >
                <label
                  >Montant reçu en FCFA<input
                    v-model.number="amount"
                    type="number"
                    min="1"
                    step="1"
                    required /></label
                ><label
                  >Date du paiement<input
                    v-model="paidOn"
                    type="date"
                    :max="new Date().toISOString().slice(0, 10)"
                    required /></label
                ><label
                  >Mode de paiement<select v-model="method">
                    <option v-for="(label, key) in paymentMethods" :key="key" :value="key">
                      {{ label }}
                    </option>
                  </select></label
                ><label
                  >Référence interne du paiement<input
                    v-model="reference"
                    maxlength="200"
                    required /></label
                ><button class="button">Confirmer le paiement intégral</button>
              </fieldset>
            </form>
            <form v-else-if="currentPayment" class="admin-form" @submit.prevent="voidPayment">
              <label
                >Motif de correction (aucun remboursement)<input
                  v-model="voidReason"
                  minlength="5"
                  maxlength="500"
                  required
                  :disabled="busy" /></label
              ><button class="button button-outline" :disabled="busy">
                Annuler la confirmation du paiement
              </button>
            </form></template
          >
        </section>
      </section>
      <button v-if="file || cat" class="button button-outline" :disabled="busy" @click="close">
        Fermer l’éditeur
      </button>
      <section class="admin-panel">
        <h3>Dossiers du salon</h3>
        <p v-if="results.loading.value" role="status">Chargement…</p>
        <div v-else-if="results.error.value" role="alert">
          <p>{{ results.error.value }}</p>
          <button class="button" @click="loadFiles">Réessayer la liste</button>
        </div>
        <template v-else
          ><p>{{ results.data.value.count }} dossier(s)</p>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Nom public</th>
                  <th>Stand</th>
                  <th>Tarif figé</th>
                  <th>Admission</th>
                  <th>Publication</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in results.data.value.items" :key="item.id">
                  <td>{{ item.public_name }}</td>
                  <td>{{ item.stand_number }}</td>
                  <td>{{ money(item.quoted_amount) }}</td>
                  <td>{{ exhibitStatuses[item.status] }}</td>
                  <td>{{ item.is_public ? 'Demandée' : 'Masquée' }}</td>
                  <td>
                    <button class="button button-outline" :disabled="busy" @click="openFile(item)">
                      Gérer {{ item.public_name }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <button
              class="button button-outline"
              :disabled="page <= 1 || busy"
              @click="go(page - 1)"
            >
              Précédent</button
            ><span>Page {{ page }} / {{ pages }}</span
            ><button
              class="button button-outline"
              :disabled="page >= pages || busy"
              @click="go(page + 1)"
            >
              Suivant
            </button>
          </div></template
        >
      </section></template
    >
  </div>
</template>
