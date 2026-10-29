<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'

const router = useRouter()
const store = useGameStore()
const canvas = ref(null)
let animFrame = null
let ctx = null

const gameState = ref('waiting') // waiting | playing | won | lost
const score = ref(0)
const lives = ref(3)
const bestScore = ref(parseInt(localStorage.getItem('speed-best') || '0'))
const speedLevel = ref(1)

// Canvas size — fills viewport properly
const CANVAS_W = 520
const CANVAS_H = 600
const LANE_COUNT = 4
const CAR_W = 44, CAR_H = 68

let carX = 0
let obstacles = []
let frameCount = 0
let speed = 3
let currentLane = 1
let hitFlash = 0

function getLaneX(lane) {
  const laneW = CANVAS_W / LANE_COUNT
  return lane * laneW + laneW / 2 - CAR_W / 2
}

function initGame() {
  carX = getLaneX(1)
  currentLane = 1
  obstacles = []
  score.value = 0
  lives.value = 3
  frameCount = 0
  speed = 3
  speedLevel.value = 1
  hitFlash = 0
  gameState.value = 'playing'
  requestAnimationFrame(draw)
}

function handleKey(e) {
  if (gameState.value !== 'playing') return
  if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && currentLane > 0) {
    currentLane--
    carX = getLaneX(currentLane)
  }
  if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && currentLane < LANE_COUNT - 1) {
    currentLane++
    carX = getLaneX(currentLane)
  }
}

function spawnObstacle() {
  const laneGroup = Math.floor(Math.random() * LANE_COUNT)
  // Sometimes spawn 2 obstacles to force lane change
  obstacles.push({ x: getLaneX(laneGroup), y: -CAR_H - Math.random() * 60 })
  if (Math.random() > 0.6 && obstacles.length < 6) {
    const otherLane = (laneGroup + 1 + Math.floor(Math.random() * 3)) % LANE_COUNT
    obstacles.push({ x: getLaneX(otherLane), y: -CAR_H - 30 - Math.random() * 40 })
  }
}

function checkCollision(obs) {
  return (
    carX + 6 < obs.x + CAR_W - 6 &&
    carX + CAR_W - 6 > obs.x + 6 &&
    CANVAS_H - CAR_H - 28 < obs.y + CAR_H - 6 &&
    CANVAS_H - CAR_H - 28 + CAR_H - 6 > obs.y + 6
  )
}

function drawRoad() {
  // Road base
  const roadGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  roadGrad.addColorStop(0, '#0a0a18')
  roadGrad.addColorStop(1, '#0e0e22')
  ctx.fillStyle = roadGrad
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Moving road lines (dashes scroll with frame)
  const dashH = 50, dashGap = 40, totalH = dashH + dashGap
  const offset = (frameCount * speed * 0.8) % totalH

  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const x = (CANVAS_W / LANE_COUNT) * lane
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.setLineDash([dashH, dashGap])
    ctx.lineDashOffset = -offset
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke()
  }
  ctx.setLineDash([])

  // Road edges
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.25)'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2, CANVAS_H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(CANVAS_W - 2, 0); ctx.lineTo(CANVAS_W - 2, CANVAS_H); ctx.stroke()

  // Speed lines (parallax effect)
  if (speed > 5) {
    const alpha = Math.min((speed - 5) / 5, 0.3)
    for (let i = 0; i < 8; i++) {
      const sx = (i * 67 + frameCount * 2) % CANVAS_W
      ctx.strokeStyle = `rgba(0, 245, 255, ${alpha})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx - 20, CANVAS_H); ctx.stroke()
    }
  }
}

function drawCar(x, y, isPlayer) {
  const W = CAR_W
  const H = CAR_H
  const cx = x + W / 2

  ctx.save()

  // Outer glow
  ctx.shadowBlur  = hitFlash > 0 && isPlayer ? 40 : 20
  ctx.shadowColor = hitFlash > 0 && isPlayer ? '#ff2d78'
                  : isPlayer ? '#00f5ff' : '#ff2d78'

  // Body gradient
  const bodyGrad = ctx.createLinearGradient(x, y, x + W, y + H)
  if (isPlayer) {
    bodyGrad.addColorStop(0,   hitFlash > 0 ? '#ff6090' : '#00e8f5')
    bodyGrad.addColorStop(0.4, hitFlash > 0 ? '#cc1050' : '#007aaa')
    bodyGrad.addColorStop(1,   hitFlash > 0 ? '#880030' : '#004466')
  } else {
    bodyGrad.addColorStop(0,   '#ff5090')
    bodyGrad.addColorStop(0.4, '#cc1050')
    bodyGrad.addColorStop(1,   '#660020')
  }

  // Aerodynamic body path
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.moveTo(x + 6,      y + H)
  ctx.lineTo(x,          y + H - 12)
  ctx.lineTo(x + 2,      y + H * 0.55)
  ctx.lineTo(x + 5,      y + H * 0.32)
  ctx.lineTo(x + 10,     y + H * 0.18)
  ctx.lineTo(cx,         y + 4)
  ctx.lineTo(x + W - 10, y + H * 0.18)
  ctx.lineTo(x + W - 5,  y + H * 0.32)
  ctx.lineTo(x + W - 2,  y + H * 0.55)
  ctx.lineTo(x + W,      y + H - 12)
  ctx.lineTo(x + W - 6,  y + H)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  // Cabin
  ctx.fillStyle = isPlayer ? '#001a22' : '#1a0008'
  ctx.beginPath()
  ctx.moveTo(x + 12,     y + H * 0.55)
  ctx.lineTo(x + 9,      y + H * 0.32)
  ctx.lineTo(x + 13,     y + H * 0.20)
  ctx.lineTo(x + W - 13, y + H * 0.20)
  ctx.lineTo(x + W - 9,  y + H * 0.32)
  ctx.lineTo(x + W - 12, y + H * 0.55)
  ctx.closePath()
  ctx.fill()

  // Windshield
  const wsGrad = ctx.createLinearGradient(cx, y + H * 0.21, cx, y + H * 0.40)
  wsGrad.addColorStop(0,   'rgba(150,240,255,0.30)')
  wsGrad.addColorStop(0.5, 'rgba(100,200,240,0.12)')
  wsGrad.addColorStop(1,   'rgba(0,0,0,0.25)')
  ctx.fillStyle = wsGrad
  ctx.beginPath()
  ctx.moveTo(x + 13,     y + H * 0.215)
  ctx.lineTo(x + W - 13, y + H * 0.215)
  ctx.lineTo(x + W - 11, y + H * 0.38)
  ctx.lineTo(x + 11,     y + H * 0.38)
  ctx.closePath()
  ctx.fill()
  // Reflection streak
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(x + 15, y + H * 0.225)
  ctx.lineTo(x + 20, y + H * 0.225)
  ctx.lineTo(x + 14, y + H * 0.365)
  ctx.lineTo(x + 12, y + H * 0.365)
  ctx.closePath()
  ctx.fill()

  // Rear window
  const rwGrad = ctx.createLinearGradient(cx, y + H * 0.40, cx, y + H * 0.54)
  rwGrad.addColorStop(0, 'rgba(0,0,0,0.35)')
  rwGrad.addColorStop(1, 'rgba(80,160,180,0.15)')
  ctx.fillStyle = rwGrad
  ctx.beginPath()
  ctx.moveTo(x + 11,     y + H * 0.405)
  ctx.lineTo(x + W - 11, y + H * 0.405)
  ctx.lineTo(x + W - 12, y + H * 0.535)
  ctx.lineTo(x + 12,     y + H * 0.535)
  ctx.closePath()
  ctx.fill()

  // Side stripe
  ctx.fillStyle = isPlayer ? 'rgba(0,245,255,0.22)' : 'rgba(255,45,120,0.22)'
  ctx.fillRect(x + 3, y + H * 0.565, W - 6, H * 0.065)

  // Hood air scoop
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath(); ctx.roundRect(cx - 6, y + H * 0.10, 12, 7, 2); ctx.fill()
  ctx.fillStyle = isPlayer ? 'rgba(0,245,255,0.35)' : 'rgba(255,45,120,0.35)'
  ctx.beginPath(); ctx.roundRect(cx - 4, y + H * 0.115, 8, 3, 1); ctx.fill()

  // Wheels
  const wheelDefs = [
    { wx: x - 7,     wy: y + H * 0.14 },
    { wx: x + W + 1, wy: y + H * 0.14 },
    { wx: x - 7,     wy: y + H * 0.65 },
    { wx: x + W + 1, wy: y + H * 0.65 },
  ]
  const wW = 8, wH = 20
  wheelDefs.forEach(function(wd) {
    const wx = wd.wx, wy = wd.wy
    ctx.fillStyle = '#0e0e0e'
    ctx.beginPath(); ctx.roundRect(wx, wy, wW, wH, 3); ctx.fill()
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.roundRect(wx + 0.5, wy + 0.5, wW - 1, wH - 1, 3); ctx.stroke()
    const rimGrad = ctx.createLinearGradient(wx, wy, wx + wW, wy + wH)
    rimGrad.addColorStop(0, '#8a8a9a'); rimGrad.addColorStop(0.5, '#d0d0e0'); rimGrad.addColorStop(1, '#4a4a5a')
    ctx.fillStyle = rimGrad
    ctx.beginPath(); ctx.roundRect(wx + 1.5, wy + 2.5, wW - 3, wH - 5, 2); ctx.fill()
    ctx.fillStyle = isPlayer ? '#00b8cc' : '#cc1040'
    ctx.beginPath(); ctx.arc(wx + wW / 2, wy + wH / 2, 2.5, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.8
    const rcx = wx + wW / 2, rcy = wy + wH / 2
    for (let s = 0; s < 4; s++) {
      const ang = (s / 4) * Math.PI * 2 + frameCount * 0.1
      ctx.beginPath(); ctx.moveTo(rcx, rcy); ctx.lineTo(rcx + Math.cos(ang) * 3, rcy + Math.sin(ang) * 5); ctx.stroke()
    }
  })

  // Lights & details
  if (isPlayer) {
    ctx.fillStyle = '#334455'
    ctx.beginPath(); ctx.roundRect(x + 3,      y + 3, 12, 7, 2); ctx.fill()
    ctx.beginPath(); ctx.roundRect(x + W - 15, y + 3, 12, 7, 2); ctx.fill()
    ctx.fillStyle = '#ffffee'; ctx.shadowBlur = 12; ctx.shadowColor = '#ffffff'
    ctx.beginPath(); ctx.roundRect(x + 4,      y + 4, 10, 5, 2); ctx.fill()
    ctx.beginPath(); ctx.roundRect(x + W - 14, y + 4, 10, 5, 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(200,240,255,0.5)'; ctx.fillRect(x + 14, y + 5, W - 28, 2)
    ctx.fillStyle = '#660000'
    ctx.beginPath(); ctx.roundRect(x + 4,      y + H - 9, 11, 5, 2); ctx.fill()
    ctx.beginPath(); ctx.roundRect(x + W - 15, y + H - 9, 11, 5, 2); ctx.fill()
    ctx.fillStyle = '#ff3300'; ctx.shadowBlur = 8; ctx.shadowColor = '#ff2200'
    ctx.beginPath(); ctx.roundRect(x + 5,      y + H - 8, 8, 3, 1); ctx.fill()
    ctx.beginPath(); ctx.roundRect(x + W - 13, y + H - 8, 8, 3, 1); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#007088'; ctx.beginPath(); ctx.roundRect(x - 2, y + H - 4, W + 4, 4, 2); ctx.fill()
    ctx.fillStyle = 'rgba(0,245,255,0.25)'; ctx.fillRect(x + 2, y + H - 3, W - 4, 2)
    if (speed > 5) {
      const alpha = Math.min((speed - 5) / 8, 0.5)
      ctx.strokeStyle = 'rgba(0,245,255,' + alpha + ')'; ctx.lineWidth = 1.5
      var pairs = [[x + 8, x + 4], [x + W - 8, x + W - 4]]
      pairs.forEach(function(p) {
        for (let i = 0; i < 3; i++) {
          const sy = y + H + 3 + i * 7 + (frameCount * 3 % 14)
          ctx.beginPath(); ctx.moveTo(p[0], sy); ctx.lineTo(p[1], sy); ctx.stroke()
        }
      })
    }
  } else {
    ctx.fillStyle = '#554433'
    ctx.beginPath(); ctx.roundRect(x + 3,      y + H - 10, 12, 7, 2); ctx.fill()
    ctx.beginPath(); ctx.roundRect(x + W - 15, y + H - 10, 12, 7, 2); ctx.fill()
    ctx.fillStyle = '#ffaa22'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff8800'
    ctx.beginPath(); ctx.roundRect(x + 4,      y + H - 9, 10, 5, 2); ctx.fill()
    ctx.beginPath(); ctx.roundRect(x + W - 14, y + H - 9, 10, 5, 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#440000'
    ctx.beginPath(); ctx.roundRect(x + 4,      y + 4, 10, 5, 2); ctx.fill()
    ctx.beginPath(); ctx.roundRect(x + W - 14, y + 4, 10, 5, 2); ctx.fill()
    ctx.fillStyle = '#880020'; ctx.beginPath(); ctx.roundRect(x - 2, y, W + 4, 4, 2); ctx.fill()
    const fb1 = 0.4 + Math.sin(frameCount * 0.3) * 0.3
    const fb2 = 0.3 + Math.sin(frameCount * 0.5) * 0.2
    ctx.fillStyle = 'rgba(255,100,0,' + fb1 + ')'
    ctx.beginPath(); ctx.ellipse(x + 12,     y - 5, 5, 7, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(x + W - 12, y - 5, 5, 7, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,220,0,' + fb2 + ')'
    ctx.beginPath(); ctx.ellipse(x + 12,     y - 3, 3, 4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(x + W - 12, y - 3, 3, 4, 0, 0, Math.PI * 2); ctx.fill()
  }

  ctx.restore()
}

function draw() {
  if (!canvas.value || gameState.value !== 'playing') return

  drawRoad()

  frameCount++
  score.value = Math.floor(frameCount / 2)

  // Update speed — level sube cada 200 pts, incremento más suave
  const newLevel = Math.floor(score.value / 300) + 1
  if (newLevel !== speedLevel.value) { speedLevel.value = newLevel }
  speed = Math.min(3 + (speedLevel.value - 1) * 0.4, 10)

  // Spawn — más gradual
  const spawnRate = Math.max(65 - speedLevel.value * 3, 30)
  if (frameCount % spawnRate === 0) spawnObstacle()

  // Update & draw obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].y += speed
    if (obstacles[i].y > CANVAS_H + 20) { obstacles.splice(i, 1); continue }
    if (checkCollision(obstacles[i])) {
      lives.value--
      hitFlash = 12
      obstacles.splice(i, 1)
      if (lives.value <= 0) {
        gameState.value = 'lost'
        if (score.value > bestScore.value) {
          bestScore.value = score.value
          localStorage.setItem('speed-best', score.value)
        }
        cancelAnimationFrame(animFrame)
        return
      }
      continue
    }
    drawCar(obstacles[i].x, obstacles[i].y, false)
  }

  if (hitFlash > 0) hitFlash--

  // Player car (fixed at bottom)
  const carY = CANVAS_H - CAR_H - 28
  drawCar(carX, carY, true)

  // Win
  if (score.value >= 1500) {
    gameState.value = 'won'
    store.completeGame('speed')
    if (score.value > bestScore.value) {
      bestScore.value = score.value
      localStorage.setItem('speed-best', score.value)
    }
    cancelAnimationFrame(animFrame)
    return
  }

  animFrame = requestAnimationFrame(draw)
}

// Touch swipe
let touchStartX = 0

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  window.addEventListener('keydown', handleKey)
  canvas.value.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX }, { passive: true })
  canvas.value.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX
    if (Math.abs(dx) > 25) handleKey({ key: dx > 0 ? 'ArrowRight' : 'ArrowLeft' })
  })
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  cancelAnimationFrame(animFrame)
})

const progressPct = computed(() => Math.min((score.value / 1500) * 100, 100))
</script>

<template>
  <div class="speed-wrap" id="speed-game">

    <!-- Back button -->
    <button class="back-btn font-pixel" @click="router.push('/arcade')" id="back-to-arcade-speed" aria-label="Volver al arcade">
      ← ARCADE
    </button>

    <!-- Main game area -->
    <div class="game-area">

      <!-- Left panel: info -->
      <aside class="side-panel left-panel">
        <div class="panel-card" id="score-panel">
          <span class="panel-label font-pixel">SCORE</span>
          <span class="panel-value font-pixel text-neon-cyan">{{ score }}</span>
        </div>
        <div class="panel-card" id="best-panel">
          <span class="panel-label font-pixel">BEST</span>
          <span class="panel-value font-pixel" style="color: var(--color-neon-yellow)">{{ bestScore }}</span>
        </div>
        <div class="panel-card" id="speed-panel">
          <span class="panel-label font-pixel">SPEED</span>
          <div class="speed-pips">
            <span
              v-for="i in 5" :key="i"
              class="pip"
              :class="{ active: i <= speedLevel }"
            />
          </div>
        </div>
      </aside>

      <!-- Canvas wrapper -->
      <div class="canvas-container">
        <!-- Progress bar at top of road -->
        <div class="road-progress" aria-label="Progreso al 1500">
          <div class="road-progress-fill" :style="{ height: progressPct + '%' }" />
          <span class="road-progress-label font-pixel">META</span>
        </div>

        <canvas
          ref="canvas"
          :width="CANVAS_W"
          :height="CANVAS_H"
          class="game-canvas"
          id="speed-canvas"
          aria-label="Área de juego Speed Run"
        />
      </div>

      <!-- Right panel: lives + controls -->
      <aside class="side-panel right-panel">
        <div class="panel-card" id="lives-panel">
          <span class="panel-label font-pixel">VIDAS</span>
          <div class="lives-row">
            <span
              v-for="i in 3" :key="i"
              class="life-icon"
              :class="{ lost: i > lives }"
            >❤️</span>
          </div>
        </div>
        <div class="panel-card controls-card" id="controls-panel">
          <span class="panel-label font-pixel">CONTROLS</span>
          <div class="key-row">
            <kbd class="key">A</kbd>
            <span class="key-desc">Izquierda</span>
          </div>
          <div class="key-row">
            <kbd class="key">D</kbd>
            <span class="key-desc">Derecha</span>
          </div>
          <div class="divider" />
          <div class="key-row">
            <span class="key-desc" style="font-size:0.7rem">📱 Desliza</span>
          </div>
        </div>
      </aside>
    </div>

    <!-- ─── OVERLAY: Waiting ─── -->
    <Transition name="page">
      <div v-if="gameState === 'waiting'" class="overlay" id="speed-start-overlay" role="dialog" aria-modal="true" aria-label="Pantalla de inicio Speed Run">
        <div class="overlay-card">
          <div class="overlay-icon">🏎️</div>
          <h2 class="overlay-title font-pixel text-neon-cyan">SPEED RUN</h2>
          <p class="overlay-subtitle">Inspirado en Need for Speed</p>

          <div class="instruction-grid">
            <div class="instr-item">
              <div class="instr-keys font-pixel">← A / D →</div>
              <div class="instr-text">Cambiar carril</div>
            </div>
            <div class="instr-item">
              <div class="instr-keys font-pixel">👆 Desliza</div>
              <div class="instr-text">En móvil</div>
            </div>
            <div class="instr-item goal-item">
              <div class="instr-keys font-pixel text-neon-yellow">1500 pts</div>
              <div class="instr-text">Para ganar</div>
            </div>
          </div>

          <button class="action-btn primary font-pixel" @click="initGame" id="speed-play-btn">
            ▶ &nbsp; JUGAR
          </button>
        </div>
      </div>
    </Transition>

    <!-- ─── OVERLAY: Won ─── -->
    <Transition name="page">
      <div v-if="gameState === 'won'" class="overlay" id="speed-won-overlay" role="dialog" aria-modal="true">
        <div class="overlay-card won-card">
          <div class="overlay-icon" style="animation: star-spin 2s linear infinite">🏆</div>
          <h2 class="overlay-title font-pixel text-neon-green">¡NIVEL<br/>SUPERADO!</h2>
          <div class="result-row font-pixel">
            <span class="result-label">PUNTUACIÓN</span>
            <span class="result-val text-neon-cyan">{{ score }}</span>
          </div>
          <div v-if="score >= bestScore && score > 0" class="new-best font-pixel">
            ⭐ NUEVO RÉCORD
          </div>
          <p class="unlock-text">🔓 Fighter desbloqueado</p>
          <div class="btn-row">
            <button class="action-btn secondary font-pixel" @click="initGame" id="speed-retry-won-btn">↺ JUGAR DE NUEVO</button>
            <button class="action-btn primary font-pixel" @click="router.push('/arcade')" id="speed-arcade-btn">← VOLVER</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ─── OVERLAY: Lost ─── -->
    <Transition name="page">
      <div v-if="gameState === 'lost'" class="overlay" id="speed-lost-overlay" role="dialog" aria-modal="true">
        <div class="overlay-card lost-card">
          <div class="overlay-icon">💥</div>
          <h2 class="overlay-title font-pixel text-neon-pink">GAME OVER</h2>
          <div class="result-row font-pixel">
            <span class="result-label">PUNTUACIÓN</span>
            <span class="result-val text-neon-cyan">{{ score }}</span>
          </div>
          <div class="result-row font-pixel">
            <span class="result-label">MEJOR</span>
            <span class="result-val" style="color:var(--color-neon-yellow)">{{ bestScore }}</span>
          </div>
          <div class="btn-row">
            <button class="action-btn primary font-pixel" @click="initGame" id="speed-retry-btn">↺ REINTENTAR</button>
            <button class="action-btn secondary font-pixel" @click="router.push('/arcade')" id="speed-back-btn">← ARCADE</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.speed-wrap {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at top left, rgba(0,245,255,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(0,100,140,0.08) 0%, transparent 50%),
    #080810;
  position: relative;
  overflow: hidden;
}

/* Back button */
.back-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(0,245,255,0.2);
  color: var(--color-neon-cyan);
  padding: 7px 14px;
  font-size: 0.45rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  letter-spacing: 0.08em;
  transition: all var(--transition-fast);
  z-index: 10;
}
.back-btn:hover {
  background: rgba(0,245,255,0.1);
  box-shadow: 0 0 12px rgba(0,245,255,0.2);
}

/* Game area: [left panel] [canvas] [right panel] */
.game-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  flex: 1;
  width: 100%;
  overflow: hidden;
  padding: 0 24px;
}

/* Side panels */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 130px;
  flex-shrink: 0;
}

.panel-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(0,245,255,0.12);
  border-radius: var(--radius-md);
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.panel-label {
  font-size: 0.4rem;
  color: var(--color-text-muted);
  letter-spacing: 0.12em;
}

.panel-value {
  font-size: 1rem;
  letter-spacing: 0.05em;
}

/* Speed pips */
.speed-pips {
  display: flex;
  gap: 5px;
}
.pip {
  width: 14px;
  height: 8px;
  border-radius: 2px;
  background: rgba(255,255,255,0.1);
  transition: all 0.3s ease;
}
.pip.active {
  background: var(--color-neon-cyan);
  box-shadow: 0 0 6px rgba(0,245,255,0.6);
}

/* Lives */
.lives-row {
  display: flex;
  gap: 4px;
}
.life-icon {
  font-size: 1.1rem;
  transition: all 0.3s ease;
  filter: drop-shadow(0 0 4px rgba(255,60,60,0.6));
}
.life-icon.lost {
  filter: grayscale(1);
  opacity: 0.25;
}

/* Controls card */
.controls-card {
  align-items: flex-start;
  gap: 6px;
}
.key-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
kbd.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.2);
  border-bottom: 2px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  padding: 2px 7px;
  font-family: var(--font-pixel);
  font-size: 0.55rem;
  color: var(--color-neon-cyan);
  min-width: 26px;
  text-align: center;
}
.key-desc {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
.divider {
  width: 100%;
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 2px 0;
}

/* Canvas area */
.canvas-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.road-progress {
  width: 8px;
  height: min(600px, calc(100vh - 60px));
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.road-progress-fill {
  background: linear-gradient(0deg, var(--color-neon-cyan), var(--color-neon-green));
  border-radius: 4px;
  width: 100%;
  transition: height 0.3s ease;
  box-shadow: 0 0 8px rgba(0,245,255,0.5);
}
.road-progress-label {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.35rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  letter-spacing: 0.05em;
}

.game-canvas {
  border-radius: var(--radius-md);
  border: 1px solid rgba(0, 245, 255, 0.2);
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.4),
    0 0 40px rgba(0, 245, 255, 0.1),
    inset 0 0 60px rgba(0,0,0,0.3);
  height: auto;
  max-height: min(600px, calc(100vh - 60px));
  width: auto;
  max-width: min(520px, 55vw);
  aspect-ratio: 520 / 600;
  display: block;
}

/* ── Overlays ── */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 4, 12, 0.88);
  backdrop-filter: blur(8px);
  z-index: 20;
}

.overlay-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(0,245,255,0.2);
  border-radius: var(--radius-lg);
  padding: 36px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 380px;
  width: 90%;
  box-shadow: 0 0 60px rgba(0,245,255,0.08), 0 0 120px rgba(0,0,0,0.5);
  animation: zoom-in 0.35s ease;
}
.won-card  { border-color: rgba(0,255,136,0.3); box-shadow: 0 0 60px rgba(0,255,136,0.08); }
.lost-card { border-color: rgba(255,45,120,0.3); box-shadow: 0 0 60px rgba(255,45,120,0.08); }

.overlay-icon {
  font-size: 3.5rem;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(0,245,255,0.5));
}
.overlay-title {
  font-size: clamp(0.8rem, 2.5vw, 1.1rem);
  letter-spacing: 0.1em;
  text-align: center;
  line-height: 1.6;
}
.overlay-subtitle {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-style: italic;
  margin-top: -12px;
}

/* Instruction grid */
.instruction-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}
.instr-item {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.goal-item {
  grid-column: 1 / -1;
  border-color: rgba(255,230,0,0.2);
  background: rgba(255,230,0,0.05);
}
.instr-keys {
  font-size: 0.55rem;
  letter-spacing: 0.06em;
}
.instr-text {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

/* Result rows */
.result-row {
  display: flex;
  gap: 16px;
  align-items: center;
}
.result-label {
  font-size: 0.45rem;
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
}
.result-val { font-size: 0.9rem; }

.new-best {
  font-size: 0.55rem;
  color: var(--color-neon-yellow);
  text-shadow: var(--shadow-neon-yellow);
  animation: pulse-glow 1s ease-in-out infinite;
  letter-spacing: 0.1em;
}

.unlock-text {
  font-size: 0.88rem;
  color: var(--color-neon-green);
  text-shadow: var(--shadow-neon-green);
}

/* Buttons */
.btn-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  border: none;
  border-radius: var(--radius-md);
  padding: 12px 22px;
  font-size: 0.55rem;
  letter-spacing: 0.07em;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.action-btn.primary {
  background: linear-gradient(135deg, #00c8e0, #00f5ff);
  color: #000;
  box-shadow: 0 0 20px rgba(0,245,255,0.3);
}
.action-btn.primary:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(0,245,255,0.5);
}
.action-btn.secondary {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.15);
  color: var(--color-text-muted);
}
.action-btn.secondary:hover {
  background: rgba(255,255,255,0.12);
  color: var(--color-text);
}

/* ── Responsive ── */
@media (max-width: 780px) {
  .side-panel { display: none; }
  .road-progress { display: none; }
  .game-area { padding: 8px; }
  .game-canvas { max-height: calc(100vh - 80px); max-width: 100vw; }
}
</style>
