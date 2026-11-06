import { onScopeDispose, ref, shallowRef } from 'vue'
import { errorText } from '../lib/presentation'

// Une réponse ancienne ne doit jamais écraser une recherche plus récente.
export function useRemote<T>(initial: T) {
  const data = shallowRef<T>(initial)
  const loading = ref(false)
  const error = ref('')
  let version = 0
  onScopeDispose(() => {
    version += 1
  })
  async function run(load: () => Promise<T>) {
    const current = ++version
    loading.value = true
    error.value = ''
    try {
      const result = await load()
      if (current === version) data.value = result
    } catch (cause) {
      if (current === version) {
        data.value = initial
        error.value = errorText(cause)
      }
    } finally {
      if (current === version) loading.value = false
    }
  }
  return { data, loading, error, run }
}
