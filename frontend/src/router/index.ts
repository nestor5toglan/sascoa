import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { adminNavigationGuard } from './adminGuard'

const router = createRouter({
  // Fonctionne aussi sur GitHub Pages sans réécriture côté serveur.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/contact',
      name: 'contact',
      component: () => import('../views/EditorialView.vue'),
      props: { slug: 'contact' },
      meta: { title: 'Contact' },
    },
    {
      path: '/a-propos',
      name: 'about',
      component: () => import('../views/EditorialView.vue'),
      props: { slug: 'a-propos' },
      meta: { title: 'À propos' },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { title: 'Accueil' },
    },
    {
      path: '/annuaire',
      name: 'directory',
      component: () => import('../views/DirectoryView.vue'),
      meta: { title: 'Annuaire des entreprises' },
    },
    {
      path: '/evenements',
      alias: '/salons',
      name: 'events',
      component: () => import('../views/EventsView.vue'),
      meta: { title: 'Autres événements' },
    },
    {
      path: '/salon',
      name: 'salon',
      component: () => import('../views/SalonView.vue'),
      meta: { title: 'Salon SASCOA' },
    },
    {
      path: '/pitch',
      name: 'pitch',
      component: () => import('../views/EditorialView.vue'),
      props: { slug: 'pitch' },
      meta: { title: 'Pitch' },
    },
    {
      path: '/hackathon',
      name: 'hackathon',
      component: () => import('../views/EditorialView.vue'),
      props: { slug: 'hackathon' },
      meta: { title: 'Hackathon' },
    },
    {
      path: '/administration/connexion',
      name: 'admin-login',
      component: () => import('../components/AdminAccess.vue'),
      meta: { title: 'Connexion administrateur' },
    },
    {
      path: '/administration',
      component: () => import('../views/admin/AdminLayout.vue'),
      meta: { requiresAdmin: true },
      children: [
        {
          path: 'candidatures/pitch',
          component: () => import('../views/admin/AdminApplications.vue'),
          props: { program: 'pitch' },
          meta: { title: 'Candidatures Pitch' },
        },
        {
          path: 'candidatures/hackathon',
          component: () => import('../views/admin/AdminApplications.vue'),
          props: { program: 'hackathon' },
          meta: { title: 'Candidatures Hackathon' },
        },
        {
          path: 'exposants',
          name: 'admin-exhibitors',
          component: () => import('../views/admin/AdminExhibitors.vue'),
          meta: { title: 'Exposants et stands' },
        },
        {
          path: 'partenaires',
          name: 'admin-partners',
          component: () => import('../views/admin/AdminPartners.vue'),
          meta: { title: 'Gestion des partenaires' },
        },
        {
          path: 'preinscriptions',
          name: 'admin-preregistrations',
          component: () => import('../views/admin/AdminPreregistrations.vue'),
          meta: { title: 'Préinscriptions au salon' },
        },
        {
          path: 'pages/contact',
          name: 'admin-contact',
          component: () => import('../views/admin/AdminEditorial.vue'),
          props: { slug: 'contact' },
          meta: { title: 'Page Contact' },
        },
        {
          path: 'pages/a-propos',
          name: 'admin-about',
          component: () => import('../views/admin/AdminEditorial.vue'),
          props: { slug: 'a-propos' },
          meta: { title: 'Page À propos' },
        },
        {
          path: 'messages',
          name: 'admin-messages',
          component: () => import('../views/admin/AdminContactMessages.vue'),
          meta: { title: 'Messages de contact' },
        },
        { path: '', redirect: '/administration/tableau-de-bord' },
        {
          path: 'tableau-de-bord',
          name: 'admin-home',
          component: () => import('../views/admin/AdminDashboard.vue'),
          meta: { title: 'Administration' },
        },
        {
          path: 'secteurs',
          name: 'admin-sectors',
          component: () => import('../views/admin/AdminSectors.vue'),
          meta: { title: 'Gestion des secteurs' },
        },
        {
          path: 'entreprises',
          name: 'admin-companies',
          component: () => import('../views/admin/AdminCompanies.vue'),
          meta: { title: 'Gestion des entreprises' },
        },
        {
          path: 'evenements',
          name: 'admin-events',
          component: () => import('../views/admin/AdminEvents.vue'),
          meta: { title: 'Gestion des événements' },
        },
        {
          path: 'pages/pitch',
          name: 'admin-pitch',
          component: () => import('../views/admin/AdminEditorial.vue'),
          props: { slug: 'pitch' },
          meta: { title: 'Page Pitch' },
        },
        {
          path: 'pages/hackathon',
          name: 'admin-hackathon',
          component: () => import('../views/admin/AdminEditorial.vue'),
          props: { slug: 'hackathon' },
          meta: { title: 'Page Hackathon' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: { title: 'Page introuvable' },
    },
  ],
  scrollBehavior(to, from, saved) {
    if (to.path === from.path && to.query.evenement !== from.query.evenement) return false
    return saved ?? { top: 0 }
  },
})

router.beforeEach((to) => adminNavigationGuard(to, useAuthStore()))

router.afterEach((to) => {
  document.title = `${String(to.meta.title || 'Accueil')} · SASCOA`
})

export default router
