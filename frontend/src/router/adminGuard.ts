import type { RouteLocationNormalized } from 'vue-router'
import type { useAuthStore } from '../stores/auth'
import { safeAdminRedirect } from '../lib/adminValidation'
export async function adminNavigationGuard(
  to: Pick<RouteLocationNormalized, 'meta' | 'path' | 'query'>,
  auth: ReturnType<typeof useAuthStore>,
) {
  if (!to.meta.requiresAdmin && to.path !== '/administration/connexion') return true
  await auth.initialize()
  const allowed = await auth.verifyAccess()
  if (to.meta.requiresAdmin && !allowed)
    return { path: '/administration/connexion', query: { redirect: safeAdminRedirect(to.path) } }
  if (to.path === '/administration/connexion' && allowed)
    return safeAdminRedirect(to.query.redirect)
  return true
}
