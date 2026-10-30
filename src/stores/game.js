import { defineStore } from 'pinia'

// 🛠️ DEV MODE: desbloquea todos los juegos (solo en desarrollo)
const DEV_MODE = import.meta.env.DEV

export const useGameStore = defineStore('game', {
  state: () => ({
    // Juegos completados: false = bloqueado, true = completado
    games: {
      speed: false,
      fighter: false,
      jump: false,
    },
    // Nombre del cumpleañero (se puede personalizar)
    birthdayPerson: 'Campeón',
  }),
  getters: {
    allGamesCompleted: (state) =>
      DEV_MODE || (state.games.speed && state.games.fighter && state.games.jump),
    completedCount: (state) =>
      Object.values(state.games).filter(Boolean).length,
    // En DEV_MODE todos están desbloqueados
    unlockedGames: (state) => {
      if (DEV_MODE) return { speed: true, fighter: true, jump: true }
      const unlocked = { speed: true, fighter: false, jump: false }
      if (state.games.speed) unlocked.fighter = true
      if (state.games.fighter) unlocked.jump = true
      return unlocked
    },
  },
  actions: {
    completeGame(gameKey) {
      if (Object.prototype.hasOwnProperty.call(this.games, gameKey)) {
        this.games[gameKey] = true
      }
    },
    resetAll() {
      this.games = { speed: false, fighter: false, jump: false }
    },
  },
})
