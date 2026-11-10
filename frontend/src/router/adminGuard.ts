import type { RouteLocationNormalized } from 'vue-router'
import type { useAuthStore } from '../stores/auth'
import { safeAdminRedirect } from '../lib/adminValidation'
export async function adminNavigationGuard(
  to: Pick<RouteLocationNormalized, 'meta' | 'path' | 'query'>,
  auth: ReturnType<typeof useAuthStore>,
) {
  const path = to.path.replace(/\/$/, '')
  if (!to.meta.requiresAdmin && path !== '/administration/connexion') return true
  await auth.initialize()
  const allowed = await auth.verifyAccess()
  if (to.meta.requiresAdmin && !allowed)
    return { path: '/administration/connexion', query: { redirect: safeAdminRedirect(path) } }
  if (path === '/administration/connexion' && allowed) return safeAdminRedirect(to.query.redirect)
  return true
}
