<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game.js'

const router = useRouter()
const store = useGameStore()
const visible = ref(false)
const showMessage = ref(false)

onMounted(() => {
  setTimeout(() => { visible.value = true }, 200)
  setTimeout(() => { showMessage.value = true }, 800)
})

const particles = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  size: Math.random() * 20 + 10,
  delay: Math.random() * 3,
  duration: Math.random() * 3 + 4,
  emoji: ['🎉', '🎊', '🎮', '⭐', '🏆', '🎂', '🥳', '💜', '🕹️'][Math.floor(Math.random() * 9)],
}))
</script>

<template>
  <div class="final-wrap" id="final-screen">
    <!-- Falling confetti/particles -->
    <div class="particles">
      <span
        v-for="p in particles"
        :key="p.id"
        class="particle"
        :style="{
          left: p.x + '%',
          fontSize: p.size + 'px',
          animationDelay: p.delay + 's',
          animationDuration: p.duration + 's',
        }"
      >{{ p.emoji }}</span>
    </div>

    <!-- Card -->
    <div class="card" :class="{ visible }" id="final-card">
      <!-- Trophy -->
      <div class="trophy">🏆</div>

      <!-- Title -->
      <h1 class="title font-pixel text-neon-yellow">
        ¡FELIZ<br/>CUMPLEAÑOS!
      </h1>

      <!-- Message -->
      <Transition name="page">
        <div v-if="showMessage" class="message-block">
          <p class="msg-text">
            Superaste los 3 niveles del arcade. 🎮<br/><br/>
            Eso dice mucho de ti —<br/>
            que no te rindes, que juegas hasta ganar.<br/><br/>
            Espero que este día sea tan épico<br/>
            como tú lo eres. ✨
          </p>

          <div class="stats font-pixel">
            <div class="stat-item">
              <span class="stat-label">JUEGOS</span>
              <span class="stat-val text-neon-cyan">3 / 3</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">NIVEL</span>
              <span class="stat-val text-neon-green">LEYENDA</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">RANGO</span>
              <span class="stat-val text-neon-pink">S+</span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Actions -->
      <div class="actions">
        <button class="replay-btn font-pixel" @click="store.resetAll(); router.push('/arcade')" id="replay-btn">
          🔄 JUGAR DE NUEVO
        </button>
        <button class="home-btn font-pixel" @click="router.push('/')" id="home-btn">
          🏠 INICIO
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.final-wrap {
  width: 100vw; height: 100vh; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, #1a0030 0%, #0a0a0f 70%);
  position: relative;
}

/* Particles */
.particles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.particle {
  position: absolute;
  top: -60px;
  animation: fall linear infinite;
  opacity: 0.85;
  filter: drop-shadow(0 0 8px rgba(255,230,0,0.5));
}
@keyframes fall {
  0%   { transform: translateY(-60px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(105vh) rotate(360deg); opacity: 0.5; }
}

/* Card */
.card {
  position: relative; z-index: 1;
  background: linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,230,0,0.2);
  border-radius: var(--radius-lg);
  padding: 40px 48px;
  max-width: 540px; width: 90%;
  display: flex; flex-direction: column; align-items: center; gap: 24px;
  box-shadow: 0 0 60px rgba(255,230,0,0.1), 0 0 120px rgba(180,0,255,0.1);
  opacity: 0; transform: scale(0.9);
  transition: opacity 0.8s ease, transform 0.8s ease;
  backdrop-filter: blur(12px);
}
.card.visible { opacity: 1; transform: scale(1); }

/* Trophy */
.trophy {
  font-size: 4rem;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 0 24px rgba(255,230,0,0.8));
}

/* Title */
.title {
  font-size: clamp(1rem, 4vw, 1.6rem);
  text-align: center;
  line-height: 1.5;
  letter-spacing: 0.08em;
  animation: flicker 6s ease-in-out infinite;
}

/* Message */
.message-block {
  display: flex; flex-direction: column; gap: 20px; width: 100%;
}
.msg-text {
  font-size: clamp(0.85rem, 2vw, 1rem);
  color: var(--color-text-muted);
  line-height: 1.8;
  text-align: center;
}

/* Stats */
.stats {
  display: flex; justify-content: center; gap: 24px;
  background: rgba(0,0,0,0.3); border-radius: var(--radius-md);
  padding: 16px; border: 1px solid rgba(255,255,255,0.06);
}
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-label { font-size: 0.4rem; color: var(--color-text-muted); letter-spacing: 0.1em; }
.stat-val { font-size: 0.65rem; }

/* Actions */
.actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.replay-btn, .home-btn {
  border: none; border-radius: var(--radius-md); padding: 10px 20px;
  font-size: 0.55rem; letter-spacing: 0.06em; cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.replay-btn {
  background: linear-gradient(135deg, var(--color-neon-purple), var(--color-neon-pink));
  color: white; box-shadow: var(--shadow-neon-purple);
}
.replay-btn:hover { transform: scale(1.05); }
.home-btn {
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
  color: var(--color-text-muted);
}
.home-btn:hover { background: rgba(255,255,255,0.14); color: var(--color-text); }
</style>
