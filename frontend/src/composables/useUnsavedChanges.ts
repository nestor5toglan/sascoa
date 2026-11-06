import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useAuthStore } from '../stores/auth'
export function useUnsavedChanges(dirty: Ref<boolean>, busy: Ref<boolean>) {
  const auth = useAuthStore()
  function confirmDiscard() {
    if (!auth.isAdmin) return true // Ne pas bloquer une révocation de session.
    if (busy.value) return false
    return !dirty.value || window.confirm('Quitter sans enregistrer les modifications ?')
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value && !busy.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  onBeforeRouteLeave(confirmDiscard)
  onBeforeRouteUpdate((to, from) => to.path === from.path || confirmDiscard())
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  return { confirmDiscard }
}
