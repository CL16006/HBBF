import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'intro',
      component: () => import('../views/IntroView.vue'),
    },
    {
      path: '/arcade',
      name: 'arcade',
      component: () => import('../views/ArcadeView.vue'),
    },
    {
      path: '/game/speed',
      name: 'speed',
      component: () => import('../views/games/SpeedGame.vue'),
    },
    {
      path: '/game/fighter',
      name: 'fighter',
      component: () => import('../views/games/FighterGame.vue'),
    },
    {
      path: '/game/jump',
      name: 'jump',
      component: () => import('../views/games/JumpGame.vue'),
    },
    {
      path: '/final',
      name: 'final',
      component: () => import('../views/FinalView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
