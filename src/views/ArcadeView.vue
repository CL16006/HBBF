<script setup>
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game.js'
import { computed } from 'vue'

const router = useRouter()
const store = useGameStore()

const cabinets = [
  {
    key: 'speed',
    title: 'SPEED RUN',
    icon: '🏎️',
    desc: 'Esquiva obstáculos\ny llega a la meta',
    color: 'cyan',
    route: 'speed',
    inspiracion: 'Need for Speed',
  },
  {
    key: 'fighter',
    title: 'FIGHTER',
    icon: '🥊',
    desc: 'Vence al boss\ncon tus combos',
    color: 'pink',
    route: 'fighter',
    inspiracion: 'Street Fighter',
  },
  {
    key: 'jump',
    title: 'JUMP QUEST',
    icon: '🍄',
    desc: 'Salta, corre\ny recolecta estrellas',
    color: 'yellow',
    route: 'jump',
    inspiracion: 'Mario Bros',
  },
]

function goToGame(cabinet) {
  const unlocked = store.unlockedGames
  if (!unlocked[cabinet.key]) return
  router.push(`/game/${cabinet.route}`)
}

function isUnlocked(key) {
  return store.unlockedGames[key]
}

function isCompleted(key) {
  return store.games[key]
}
</script>

<template>
  <div class="arcade-room" id="arcade-room">
    <!-- Ceiling lights -->
    <div class="ceiling-lights">
      <div v-for="i in 8" :key="i" class="ceiling-light" :style="{ animationDelay: (i * 0.15) + 's' }" />
    </div>

    <!-- Header -->
    <header class="arcade-header">
      <h1 class="room-title font-pixel text-neon-cyan">🎮 THE BIRTHDAY ARCADE</h1>
      <p class="room-subtitle">{{ store.completedCount }} / 3 juegos completados</p>
      <div class="progress-bar-wrap">
        <div class="progress-bar" :style="{ width: (store.completedCount / 3 * 100) + '%' }" />
      </div>
    </header>

    <!-- Cabinet grid -->
    <main class="cabinets-grid">
      <article
        v-for="cabinet in cabinets"
        :key="cabinet.key"
        class="cabinet"
        :class="[
          `cabinet--${cabinet.color}`,
          { 'cabinet--locked': !isUnlocked(cabinet.key) },
          { 'cabinet--done': isCompleted(cabinet.key) },
        ]"
        :id="`cabinet-${cabinet.key}`"
        @click="goToGame(cabinet)"
        @keydown.enter="goToGame(cabinet)"
        :tabindex="isUnlocked(cabinet.key) ? 0 : -1"
        :aria-label="`Juego ${cabinet.title}: ${isCompleted(cabinet.key) ? 'completado' : isUnlocked(cabinet.key) ? 'disponible' : 'bloqueado'}`"
        role="button"
      >
        <!-- Cabinet body -->
        <div class="cabinet-screen">
          <div class="cabinet-icon">{{ cabinet.icon }}</div>
          <div v-if="isCompleted(cabinet.key)" class="done-badge font-pixel">✓ DONE</div>
          <div v-else-if="!isUnlocked(cabinet.key)" class="lock-overlay">
            <span class="lock-icon">🔒</span>
            <span class="lock-text font-pixel">LOCKED</span>
          </div>
        </div>

        <div class="cabinet-panel">
          <h2 class="cabinet-title font-pixel">{{ cabinet.title }}</h2>
          <p class="cabinet-desc">{{ cabinet.desc }}</p>
          <span class="cabinet-inspo">Inspirado en {{ cabinet.inspiracion }}</span>
        </div>

        <!-- Glow line at bottom -->
        <div class="cabinet-glow-line" />

        <!-- Insert coin text -->
        <div v-if="isUnlocked(cabinet.key) && !isCompleted(cabinet.key)" class="insert-coin font-pixel">
          INSERT COIN
        </div>
      </article>
    </main>

    <!-- Final CTA when all done -->
    <Transition name="page">
      <div v-if="store.allGamesCompleted" class="all-done-banner" id="all-done-banner">
        <p class="font-pixel text-neon-pink">🎉 ¡MISIÓN COMPLETADA!</p>
        <button class="cta-btn font-pixel" @click="router.push('/final')" id="final-btn">
          VER EL MENSAJE FINAL ▶
        </button>
      </div>
    </Transition>

    <!-- Floor reflection -->
    <div class="floor" />
  </div>
</template>

<style scoped>
.arcade-room {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px 24px;
  overflow-y: auto;
  overflow-x: hidden;
  background:
    radial-gradient(ellipse at top, #1a0030 0%, transparent 60%),
    linear-gradient(180deg, #0a0010 0%, #0a0a0f 100%);
  position: relative;
}

/* Ceiling lights */
.ceiling-lights {
  display: flex;
  gap: 80px;
  padding-top: 0;
  margin-bottom: -10px;
  position: relative;
  z-index: 1;
}
.ceiling-light {
  width: 40px;
  height: 16px;
  background: var(--color-neon-cyan);
  border-radius: 0 0 20px 20px;
  box-shadow: 0 0 20px 8px rgba(0, 245, 255, 0.4), 0 20px 60px 10px rgba(0, 245, 255, 0.15);
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Header */
.arcade-header {
  text-align: center;
  padding: 20px 0 16px;
  width: 100%;
  max-width: 900px;
}
.room-title {
  font-size: clamp(0.7rem, 2.5vw, 1.1rem);
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}
.room-subtitle {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  margin-bottom: 8px;
}
.progress-bar-wrap {
  width: 200px;
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  margin: 0 auto;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-neon-cyan), var(--color-neon-pink));
  border-radius: 3px;
  transition: width 0.6s ease;
  box-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
}

/* Cabinet grid */
.cabinets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  width: 100%;
  max-width: 960px;
  flex: 1;
  align-items: center;
}

/* Cabinet base */
.cabinet {
  position: relative;
  border-radius: var(--radius-lg);
  background: linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: transform var(--transition-base), box-shadow var(--transition-base);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  user-select: none;
  animation: slide-up 0.5s ease both;
}
.cabinet:nth-child(2) { animation-delay: 0.1s; }
.cabinet:nth-child(3) { animation-delay: 0.2s; }

/* Color variants */
.cabinet--cyan  { border-color: rgba(0, 245, 255, 0.25); }
.cabinet--pink  { border-color: rgba(255, 45, 120, 0.25); }
.cabinet--yellow{ border-color: rgba(255, 230, 0, 0.25); }

.cabinet--cyan:hover:not(.cabinet--locked)   { transform: translateY(-8px) scale(1.02); box-shadow: var(--shadow-neon-cyan); }
.cabinet--pink:hover:not(.cabinet--locked)   { transform: translateY(-8px) scale(1.02); box-shadow: var(--shadow-neon-pink); }
.cabinet--yellow:hover:not(.cabinet--locked) { transform: translateY(-8px) scale(1.02); box-shadow: var(--shadow-neon-yellow); }

.cabinet--locked {
  cursor: not-allowed;
  filter: brightness(0.5) saturate(0.3);
}
.cabinet--done {
  filter: brightness(0.8);
}
.cabinet--done::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 255, 136, 0.05);
  pointer-events: none;
}

/* Screen */
.cabinet-screen {
  aspect-ratio: 4/3;
  background: #000;
  margin: 16px 16px 0;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 2px solid rgba(255,255,255,0.08);
}
.cabinet--cyan .cabinet-screen   { background: radial-gradient(ellipse, #001a1f, #000); }
.cabinet--pink .cabinet-screen   { background: radial-gradient(ellipse, #1f0010, #000); }
.cabinet--yellow .cabinet-screen { background: radial-gradient(ellipse, #1f1a00, #000); }

.cabinet-icon {
  font-size: clamp(2.5rem, 5vw, 4rem);
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(255,255,255,0.3));
}

/* Done badge */
.done-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--color-neon-green);
  color: #000;
  font-size: 0.45rem;
  padding: 4px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

/* Lock overlay */
.lock-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0,0,0,0.5);
}
.lock-icon { font-size: 2rem; }
.lock-text  { font-size: 0.5rem; color: var(--color-text-muted); letter-spacing: 0.1em; }

/* Panel */
.cabinet-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.cabinet-title {
  font-size: clamp(0.55rem, 1.5vw, 0.75rem);
  letter-spacing: 0.08em;
}
.cabinet--cyan .cabinet-title   { color: var(--color-neon-cyan);   text-shadow: var(--shadow-neon-cyan); }
.cabinet--pink .cabinet-title   { color: var(--color-neon-pink);   text-shadow: var(--shadow-neon-pink); }
.cabinet--yellow .cabinet-title { color: var(--color-neon-yellow); text-shadow: var(--shadow-neon-yellow); }

.cabinet-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  white-space: pre-line;
  line-height: 1.5;
}
.cabinet-inspo {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;
}

/* Glow line */
.cabinet-glow-line {
  height: 3px;
  margin: 0 16px 16px;
  border-radius: 2px;
}
.cabinet--cyan .cabinet-glow-line   { background: var(--color-neon-cyan);   box-shadow: var(--shadow-neon-cyan); }
.cabinet--pink .cabinet-glow-line   { background: var(--color-neon-pink);   box-shadow: var(--shadow-neon-pink); }
.cabinet--yellow .cabinet-glow-line { background: var(--color-neon-yellow); box-shadow: var(--shadow-neon-yellow); }

/* Insert coin */
.insert-coin {
  position: absolute;
  bottom: 52px;
  left: 0; right: 0;
  text-align: center;
  font-size: 0.4rem;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  animation: pulse-glow 1.2s ease-in-out infinite;
}

/* All done banner */
.all-done-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  margin-top: 8px;
  animation: slide-up 0.5s ease;
}
.all-done-banner p {
  font-size: clamp(0.6rem, 1.5vw, 0.8rem);
  letter-spacing: 0.08em;
  animation: pulse-glow 1s ease-in-out infinite;
}
.cta-btn {
  background: linear-gradient(135deg, var(--color-neon-pink), var(--color-neon-purple));
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 14px 28px;
  font-size: clamp(0.5rem, 1.5vw, 0.7rem);
  letter-spacing: 0.08em;
  cursor: pointer;
  box-shadow: var(--shadow-neon-pink);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.cta-btn:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-neon-pink), var(--shadow-neon-purple);
}

/* Floor */
.floor {
  position: fixed;
  bottom: 0;
  left: 0; right: 0;
  height: 80px;
  background: linear-gradient(180deg, transparent, rgba(0, 245, 255, 0.03));
  pointer-events: none;
}

/* Responsive */
@media (max-width: 700px) {
  .cabinets-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .ceiling-lights { gap: 40px; }
}
</style>
