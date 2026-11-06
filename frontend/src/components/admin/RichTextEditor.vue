<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { safeRichHtml, plainText } from '../../lib/richText'
import { uploadEditorialFile } from '../../services/adminMedia'
import { supabase } from '../../lib/supabase'
const props = withDefaults(
  defineProps<{
    modelValue: string | null
    inputId: string
    label: string
    disabled?: boolean
    maxLength?: number
  }>(),
  { disabled: false, maxLength: 50000 },
)
const emit = defineEmits<{ 'update:modelValue': [value: string]; busy: [value: boolean] }>(),
  fileInput = ref<HTMLInputElement | null>(null),
  error = ref(''),
  uploading = ref(false),
  linkUrl = ref(''),
  showLink = ref(false)
let lastEmitted = '',
  loadVersion = 0,
  disposed = false
const MediaImage = Image.extend({
  parseHTML() {
    return [{ tag: 'img[data-media-path]' }]
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaPath: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-media-path'),
        renderHTML: (attrs) => (attrs.mediaPath ? { 'data-media-path': attrs.mediaPath } : {}),
      },
    }
  },
})
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      code: false,
      link: { openOnClick: false, protocols: ['https', 'http', 'mailto', 'tel'] },
    }),
    MediaImage.configure({ allowBase64: false }),
  ],
  content: safeRichHtml(props.modelValue),
  editable: !props.disabled,
  editorProps: {
    attributes: {
      id: props.inputId,
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': props.label,
    },
    transformPastedHTML: (html) => safeRichHtml(html),
  },
  onUpdate: ({ editor }) => {
    loadVersion++
    const value = safeRichHtml(editor.getHTML())
    lastEmitted = value
    emit('update:modelValue', value)
  },
})
async function hydrate(value: string | null) {
  const current = ++loadVersion
  const doc = new DOMParser().parseFromString(safeRichHtml(value), 'text/html')
  await Promise.all(
    Array.from(doc.querySelectorAll('img[data-media-path]')).map(async (img) => {
      try {
        const { data } = await supabase.storage
          .from('sascoa-media')
          .createSignedUrl(img.getAttribute('data-media-path')!, 3600)
        if (data?.signedUrl) img.setAttribute('src', data.signedUrl)
      } catch {}
    }),
  )
  if (!disposed && current === loadVersion && editor.value) {
    editor.value.commands.setContent(doc.body.innerHTML, { emitUpdate: false })
  }
}
watch(
  () => props.modelValue,
  (value) => {
    if (value !== lastEmitted) void hydrate(value)
  },
  { immediate: true },
)
watch(
  () => props.disabled,
  (value) => editor.value?.setEditable(!value),
)
async function addImage(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file || props.disabled || uploading.value) return
  uploading.value = true
  emit('busy', true)
  error.value = ''
  try {
    const path = await uploadEditorialFile(file, 'rich', 'image')
    const { data, error: signError } = await supabase.storage
      .from('sascoa-media')
      .createSignedUrl(path, 3600)
    if (signError || !data?.signedUrl) throw new Error('Aperçu indisponible. Réessaie.')
    if (!disposed && editor.value) {
      const alt =
        window.prompt(
          'Description courte de cette image (texte alternatif) :',
          file.name.replace(/\.[^.]+$/, ''),
        ) || 'Illustration'
      editor.value
        .chain()
        .focus()
        .insertContent({ type: 'image', attrs: { src: data.signedUrl, alt, mediaPath: path } })
        .run()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Image non ajoutée.'
  } finally {
    uploading.value = false
    emit('busy', false)
  }
}
function applyLink() {
  if (!editor.value) return
  const url = linkUrl.value.trim()
  if (url && !/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
    error.value = 'Utilise une adresse https://, http://, mailto: ou tel:.'
    return
  }
  if (url) editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  else editor.value.chain().focus().unsetLink().run()
  showLink.value = false
  error.value = ''
}
onBeforeUnmount(() => {
  disposed = true
  loadVersion++
  editor.value?.destroy()
})
</script>
<template>
  <div class="rich-editor">
    <div v-if="editor" class="rich-toolbar" role="toolbar" :aria-label="`Mise en forme : ${label}`">
      <button
        type="button"
        :disabled="disabled"
        :aria-pressed="editor.isActive('bold')"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <strong>Gras</strong></button
      ><button
        type="button"
        :disabled="disabled"
        :aria-pressed="editor.isActive('italic')"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <em>Italique</em></button
      ><button
        type="button"
        :disabled="disabled"
        @click="editor.chain().focus().setParagraph().run()"
      >
        Texte</button
      ><button
        type="button"
        :disabled="disabled"
        :aria-pressed="editor.isActive('heading', { level: 2 })"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        Titre 2</button
      ><button
        type="button"
        :disabled="disabled"
        :aria-pressed="editor.isActive('heading', { level: 3 })"
        @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      >
        Titre 3</button
      ><button
        type="button"
        :disabled="disabled"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        Liste</button
      ><button
        type="button"
        :disabled="disabled"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        Liste numérotée</button
      ><button type="button" :disabled="disabled" @click="showLink = !showLink">Lien</button
      ><button type="button" :disabled="disabled || uploading" @click="fileInput?.click()">
        {{ uploading ? 'Ajout…' : 'Image' }}</button
      ><button
        type="button"
        :disabled="disabled || !editor.can().undo()"
        @click="editor.chain().focus().undo().run()"
      >
        Annuler</button
      ><button
        type="button"
        :disabled="disabled || !editor.can().redo()"
        @click="editor.chain().focus().redo().run()"
      >
        Rétablir
      </button>
    </div>
    <div v-if="showLink" class="rich-link">
      <label :for="`${inputId}-link`">Adresse du lien</label
      ><input :id="`${inputId}-link`" v-model="linkUrl" placeholder="https://…" /><button
        type="button"
        @click="applyLink"
      >
        Appliquer
      </button>
    </div>
    <EditorContent :editor="editor" /><input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="sr-only"
      :disabled="disabled || uploading"
      :aria-label="`Image pour ${label}`"
      @change="addImage"
    />
    <p class="admin-help">
      {{ plainText(modelValue).length }} caractères de texte · {{ (modelValue || '').length }} /
      {{ maxLength }} caractères enregistrés, mise en forme comprise. Images JPEG, PNG ou WebP, 2 Mo
      maximum.
    </p>
    <p v-if="(modelValue || '').length > maxLength" class="admin-alert" role="alert">
      Ce contenu est trop long pour ce champ. Réduis-le avant d’enregistrer.
    </p>
    <p v-if="error" role="alert" class="admin-alert">{{ error }}</p>
  </div>
</template>
