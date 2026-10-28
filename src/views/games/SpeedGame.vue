<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'

const router = useRouter()
const store = useGameStore()
const canvas = ref(null)
let animFrame = null
let ctx = null

// Game state
const gameState = ref('waiting') // waiting | playing | won | lost
const score = ref(0)
const lives = ref(3)

const CAR_W = 40, CAR_H = 60
const LANE_COUNT = 4
let lanes = []
let carX = 0
let carY = 0
let obstacles = []
let frameCount = 0
let speed = 3

function getLaneX(lane, W) {
  const laneW = W / LANE_COUNT
  return lane * laneW + laneW / 2 - CAR_W / 2
}

function initGame() {
  const W = canvas.value.width
  const H = canvas.value.height
  carX = getLaneX(1, W)
  carY = H - CAR_H - 20
  obstacles = []
  score.value = 0
  lives.value = 3
  frameCount = 0
  speed = 3
  lanes = Array.from({ length: LANE_COUNT }, (_, i) => getLaneX(i, W))
  gameState.value = 'playing'
  loop()
}

let currentLane = 1

function handleKey(e) {
  if (gameState.value !== 'playing') return
  const W = canvas.value.width
  if (e.key === 'ArrowLeft' && currentLane > 0) {
    currentLane--
    carX = getLaneX(currentLane, W)
  }
  if (e.key === 'ArrowRight' && currentLane < LANE_COUNT - 1) {
    currentLane++
    carX = getLaneX(currentLane, W)
  }
}

function spawnObstacle() {
  const W = canvas.value.width
  const lane = Math.floor(Math.random() * LANE_COUNT)
  obstacles.push({ x: getLaneX(lane, W), y: -CAR_H, lane })
}

function checkCollision(obs, W, H) {
  return (
    carX < obs.x + CAR_W - 8 &&
    carX + CAR_W - 8 > obs.x + 8 &&
    carY < obs.y + CAR_H - 8 &&
    carY + CAR_H - 8 > obs.y + 8
  )
}

function draw() {
  const W = canvas.value.width
  const H = canvas.value.height
  ctx.clearRect(0, 0, W, H)

  // Road
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, W, H)

  // Lane lines
  for (let i = 1; i < LANE_COUNT; i++) {
    const x = (W / LANE_COUNT) * i
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.setLineDash([30, 20])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Score
  score.value = Math.floor(frameCount / 2)

  // Obstacles
  frameCount++
  if (frameCount % Math.max(40 - Math.floor(score.value / 80), 18) === 0) spawnObstacle()
  if (score.value % 200 === 0 && score.value > 0) speed = Math.min(speed + 0.5, 10)

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].y += speed
    if (obstacles[i].y > H) {
      obstacles.splice(i, 1)
      continue
    }
    if (checkCollision(obstacles[i])) {
      lives.value--
      obstacles.splice(i, 1)
      if (lives.value <= 0) { gameState.value = 'lost'; cancelAnimationFrame(animFrame); return }
      continue
    }
    // Draw obstacle car (enemy)
    ctx.fillStyle = '#ff2d78'
    ctx.beginPath()
    ctx.roundRect(obstacles[i].x, obstacles[i].y, CAR_W, CAR_H, 6)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,45,120,0.3)'
    ctx.fillRect(obstacles[i].x - 4, obstacles[i].y + 10, 4, 20)
    ctx.fillRect(obstacles[i].x + CAR_W, obstacles[i].y + 10, 4, 20)
  }

  // Player car
  ctx.fillStyle = '#00f5ff'
  ctx.beginPath()
  ctx.roundRect(carX, carY, CAR_W, CAR_H, 6)
  ctx.fill()
  // Glow
  ctx.shadowBlur = 20
  ctx.shadowColor = '#00f5ff'
  ctx.fill()
  ctx.shadowBlur = 0
  // Windshield
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(carX + 6, carY + 8, CAR_W - 12, 14)
  // Wheels
  ctx.fillStyle = '#333'
  ctx.fillRect(carX - 4, carY + 8, 6, 14)
  ctx.fillRect(carX + CAR_W - 2, carY + 8, 6, 14)
  ctx.fillRect(carX - 4, carY + CAR_H - 22, 6, 14)
  ctx.fillRect(carX + CAR_W - 2, carY + CAR_H - 22, 6, 14)

  // Win condition
  if (score.value >= 500) {
    gameState.value = 'won'
    cancelAnimationFrame(animFrame)
    store.completeGame('speed')
    return
  }

  animFrame = requestAnimationFrame(draw)
}

function loop() {
  animFrame = requestAnimationFrame(draw)
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  window.addEventListener('keydown', handleKey)

  // Touch support
  let touchStartX = 0
  canvas.value.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX })
  canvas.value.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX
    if (Math.abs(dx) > 30) handleKey({ key: dx > 0 ? 'ArrowRight' : 'ArrowLeft' })
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  cancelAnimationFrame(animFrame)
})
</script>

<template>
  <div class="game-wrap" id="speed-game">
    <!-- HUD -->
    <div class="hud">
      <button class="back-btn font-pixel" @click="router.push('/arcade')" id="back-to-arcade-speed">← ARCADE</button>
      <div class="hud-center font-pixel">
        <span class="hud-label">SCORE</span>
        <span class="hud-val text-neon-cyan">{{ score }}</span>
        <span class="hud-label">META</span>
        <span class="hud-val">500</span>
      </div>
      <div class="hud-lives font-pixel">
        <span v-for="i in 3" :key="i">{{ i <= lives ? '❤️' : '🖤' }}</span>
      </div>
    </div>

    <!-- Canvas -->
    <canvas ref="canvas" width="400" height="540" class="game-canvas" id="speed-canvas" />

    <!-- Overlay: waiting -->
    <div v-if="gameState === 'waiting'" class="overlay" id="speed-start-overlay">
      <p class="font-pixel text-neon-cyan">SPEED RUN</p>
      <p class="hint">Usa ← → para cambiar de carril</p>
      <p class="hint">En móvil: desliza el dedo</p>
      <p class="hint">Llega a 500 puntos para ganar</p>
      <button class="play-btn font-pixel" @click="initGame" id="speed-play-btn">▶ JUGAR</button>
    </div>

    <!-- Overlay: won -->
    <div v-if="gameState === 'won'" class="overlay won" id="speed-won-overlay">
      <p class="font-pixel text-neon-green" style="font-size:0.8rem">¡NIVEL SUPERADO!</p>
      <p class="hint">Puntuación: {{ score }}</p>
      <p class="unlock">🔓 Fighter desbloqueado</p>
      <button class="play-btn font-pixel" @click="router.push('/arcade')" id="speed-arcade-btn">← VOLVER AL ARCADE</button>
    </div>

    <!-- Overlay: lost -->
    <div v-if="gameState === 'lost'" class="overlay lost" id="speed-lost-overlay">
      <p class="font-pixel text-neon-pink" style="font-size:0.8rem">GAME OVER</p>
      <p class="hint">Puntuación: {{ score }}</p>
      <button class="play-btn font-pixel" @click="initGame" id="speed-retry-btn">↺ REINTENTAR</button>
    </div>
  </div>
</template>

<style scoped>
.game-wrap {
  width: 100vw; height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: radial-gradient(ellipse at top, #001a2e 0%, #0a0a0f 70%);
  position: relative; gap: 12px;
}
.hud {
  display: flex; align-items: center; justify-content: space-between;
  width: 400px; max-width: 95vw; padding: 8px 0;
}
.back-btn {
  background: none; border: 1px solid var(--color-border); color: var(--color-text-muted);
  padding: 6px 12px; font-size: 0.5rem; border-radius: var(--radius-sm); cursor: pointer;
  transition: all var(--transition-fast);
}
.back-btn:hover { border-color: var(--color-neon-cyan); color: var(--color-neon-cyan); }
.hud-center { display: flex; gap: 12px; align-items: center; }
.hud-label { font-size: 0.45rem; color: var(--color-text-muted); letter-spacing: 0.1em; }
.hud-val { font-size: 0.7rem; }
.hud-lives { font-size: 1.1rem; }

.game-canvas {
  border-radius: var(--radius-md); border: 2px solid rgba(0,245,255,0.2);
  box-shadow: 0 0 40px rgba(0, 245, 255, 0.15); max-width: 95vw;
  max-height: calc(100vh - 120px);
}

.overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
}
.overlay p.font-pixel { font-size: 1rem; }
.hint { font-size: 0.85rem; color: var(--color-text-muted); }
.unlock { font-size: 0.95rem; color: var(--color-neon-green); text-shadow: var(--shadow-neon-green); }
.play-btn {
  margin-top: 8px; background: linear-gradient(135deg, #00f5ff, #0088aa);
  color: #000; border: none; border-radius: var(--radius-md);
  padding: 12px 24px; font-size: 0.6rem; cursor: pointer;
  transition: transform var(--transition-fast);
}
.play-btn:hover { transform: scale(1.05); }
.won { background: rgba(0, 20, 10, 0.85); }
.lost { background: rgba(20, 0, 10, 0.85); }
</style>
