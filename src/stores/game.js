import { defineStore } from 'pinia'

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
      state.games.speed && state.games.fighter && state.games.jump,
    completedCount: (state) =>
      Object.values(state.games).filter(Boolean).length,
    // Cuántos juegos están desbloqueados (el siguiente después del completado)
    unlockedGames: (state) => {
      const unlocked = { speed: true, fighter: false, jump: false }
      if (state.games.speed) unlocked.fighter = true
      if (state.games.fighter) unlocked.jump = true
      return unlocked
    },
  },
  actions: {
    completeGame(gameKey) {
      if (this.games.hasOwnProperty(gameKey)) {
        this.games[gameKey] = true
      }
    },
    resetAll() {
      this.games = { speed: false, fighter: false, jump: false }
    },
  },
})
