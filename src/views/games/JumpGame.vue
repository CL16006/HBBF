<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'

const router = useRouter()
const store = useGameStore()
const canvas = ref(null)
let animFrame = null
let ctx = null

const gameState = ref('waiting')
const stars = ref(0)
const totalStars = 5

// Physics
const W = 420, H = 380
const GRAVITY = 0.5
const JUMP_FORCE = -12
const MOVE_SPEED = 4

let player = { x: 60, y: 200, vx: 0, vy: 0, onGround: false, w: 32, h: 32 }
let coins = []
let platforms = []
let frameCount = 0
let cameraX = 0
const WORLD_W = 1800

function buildWorld() {
  platforms = [
    { x: 0,    y: 320, w: 300, h: 20 },
    { x: 340,  y: 280, w: 120, h: 20 },
    { x: 500,  y: 230, w: 100, h: 20 },
    { x: 640,  y: 260, w: 140, h: 20 },
    { x: 820,  y: 200, w: 120, h: 20 },
    { x: 980,  y: 240, w: 100, h: 20 },
    { x: 1120, y: 200, w: 130, h: 20 },
    { x: 1300, y: 240, w: 100, h: 20 },
    { x: 1450, y: 280, w: 120, h: 20 },
    { x: 1600, y: 300, w: 220, h: 20 },
  ]

  // Stars scattered on platforms
  coins = [
    { x: 380, y: 250, collected: false },
    { x: 540, y: 200, collected: false },
    { x: 700, y: 230, collected: false },
    { x: 860, y: 170, collected: false },
    { x: 1350, y: 210, collected: false },
  ]

  player = { x: 60, y: 270, vx: 0, vy: 0, onGround: false, w: 32, h: 32 }
  cameraX = 0
}

const keys = {}

function handleKey(e) {
  if (gameState.value !== 'playing') return
  keys[e.key] = true
  if ((e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') && player.onGround) {
    player.vy = JUMP_FORCE
    player.onGround = false
  }
}
function handleKeyUp(e) { delete keys[e.key] }

function touchJump() {
  if (player.onGround) { player.vy = JUMP_FORCE; player.onGround = false }
}

function updatePlayer() {
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.vx = -MOVE_SPEED
  else if (keys['ArrowRight'] || keys['d'] || keys['D']) player.vx = MOVE_SPEED
  else player.vx *= 0.8

  player.vy += GRAVITY
  player.x += player.vx
  player.y += player.vy
  player.onGround = false

  // Platform collisions
  for (const p of platforms) {
    if (
      player.x + player.w > p.x && player.x < p.x + p.w &&
      player.y + player.h > p.y && player.y + player.h < p.y + p.h + player.vy + 1 &&
      player.vy >= 0
    ) {
      player.y = p.y - player.h
      player.vy = 0
      player.onGround = true
    }
  }

  // Fall death
  if (player.y > H + 100) {
    player.x = 60; player.y = 270; player.vx = 0; player.vy = 0
  }

  // Clamp
  player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x))

  // Star collection
  for (const c of coins) {
    if (!c.collected &&
      player.x < c.x + 20 && player.x + player.w > c.x &&
      player.y < c.y + 20 && player.y + player.h > c.y) {
      c.collected = true
      stars.value++
      if (stars.value >= totalStars) {
        gameState.value = 'won'
        store.completeGame('jump')
        cancelAnimationFrame(animFrame)
      }
    }
  }

  // Camera
  cameraX = Math.max(0, Math.min(player.x - W / 3, WORLD_W - W))
}

function draw() {
  if (!canvas.value) return
  ctx.clearRect(0, 0, W, H)

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H)
  skyGrad.addColorStop(0, '#0a001a'); skyGrad.addColorStop(1, '#0f0f2e')
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H)

  // Parallax stars
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137 + cameraX * 0.1) % W + W) % W
    const sy = (i * 73) % (H * 0.7)
    ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.1})`
    ctx.fillRect(sx, sy, 2, 2)
  }

  ctx.save()
  ctx.translate(-cameraX, 0)

  // Platforms
  for (const p of platforms) {
    const pGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
    pGrad.addColorStop(0, '#00ff88'); pGrad.addColorStop(1, '#006633')
    ctx.fillStyle = pGrad
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 4); ctx.fill()
    ctx.shadowBlur = 10; ctx.shadowColor = '#00ff88'; ctx.fill(); ctx.shadowBlur = 0
  }

  // Stars / coins
  for (const c of coins) {
    if (c.collected) continue
    const bob = Math.sin(frameCount * 0.1 + c.x) * 3
    ctx.font = '20px serif'
    ctx.textAlign = 'center'
    ctx.shadowBlur = 15; ctx.shadowColor = '#ffe600'
    ctx.fillText('⭐', c.x + 10, c.y + bob + 16)
    ctx.shadowBlur = 0
  }

  // Player
  const px = player.x, py = player.y
  const bob = player.onGround ? 0 : Math.sin(frameCount * 0.3) * 2

  // Body
  ctx.fillStyle = '#00f5ff'
  ctx.shadowBlur = 16; ctx.shadowColor = '#00f5ff'
  ctx.beginPath(); ctx.roundRect(px, py, player.w, player.h, 6); ctx.fill()
  ctx.shadowBlur = 0

  // Face
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(px + player.w / 2, py + 10, 9, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.arc(px + player.w / 2 - 3, py + 8, 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(px + player.w / 2 + 3, py + 8, 2.5, 0, Math.PI * 2); ctx.fill()

  // Legs
  if (player.onGround) {
    ctx.fillStyle = '#0088aa'
    ctx.fillRect(px + 4, py + player.h, 10, 6)
    ctx.fillRect(px + player.w - 14, py + player.h, 10, 6)
  }

  ctx.restore()
  frameCount++

  animFrame = requestAnimationFrame(draw)
}

function startGame() {
  buildWorld(); stars.value = 0; gameState.value = 'playing'; frameCount = 0
  draw()
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  window.addEventListener('keydown', handleKey)
  window.addEventListener('keyup', handleKeyUp)

  // Touch
  let touchStartX = 0
  canvas.value.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX
    touchJump()
  })
  canvas.value.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const dx = e.touches[0].clientX - touchStartX
    if (dx > 20) { keys['ArrowRight'] = true; keys['ArrowLeft'] = false }
    else if (dx < -20) { keys['ArrowLeft'] = true; keys['ArrowRight'] = false }
  }, { passive: false })
  canvas.value.addEventListener('touchend', () => {
    delete keys['ArrowRight']; delete keys['ArrowLeft']
  })
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  window.removeEventListener('keyup', handleKeyUp)
  cancelAnimationFrame(animFrame)
})
</script>

<template>
  <div class="game-wrap" id="jump-game">
    <!-- HUD -->
    <div class="hud">
      <button class="back-btn font-pixel" @click="router.push('/arcade')" id="back-to-arcade-jump">← ARCADE</button>
      <div class="hud-center font-pixel">
        <span>⭐ {{ stars }} / {{ totalStars }}</span>
      </div>
      <div style="width:80px" />
    </div>

    <!-- Canvas -->
    <canvas ref="canvas" :width="420" :height="380" class="game-canvas" id="jump-canvas" />

    <!-- Controls hint -->
    <div v-if="gameState === 'playing'" class="controls-hint font-pixel">
      ← → mover &nbsp;|&nbsp; ↑ / Espacio saltar
    </div>

    <!-- Overlay: waiting -->
    <div v-if="gameState === 'waiting'" class="overlay" id="jump-start-overlay">
      <p class="font-pixel text-neon-yellow" style="font-size:0.9rem">JUMP QUEST</p>
      <p class="hint">← → mover &nbsp; ↑ o Espacio saltar</p>
      <p class="hint">En móvil: toca para saltar, desliza para moverte</p>
      <p class="hint">¡Recolecta las {{ totalStars }} estrellas! ⭐</p>
      <button class="play-btn font-pixel" @click="startGame" id="jump-play-btn">▶ SALTAR</button>
    </div>

    <!-- Overlay: won -->
    <div v-if="gameState === 'won'" class="overlay won" id="jump-won-overlay">
      <p class="font-pixel text-neon-green" style="font-size:0.7rem">¡TODAS LAS ESTRELLAS!</p>
      <p style="font-size:2rem">🎉🎊🎮</p>
      <p class="unlock">🔓 ¡Mensaje final desbloqueado!</p>
      <button class="play-btn font-pixel" @click="router.push('/arcade')" id="jump-arcade-btn">← VOLVER AL ARCADE</button>
    </div>
  </div>
</template>

<style scoped>
.game-wrap {
  width: 100vw; height: 100vh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  background: radial-gradient(ellipse at top, #0a001f 0%, #0a0a0f 70%);
  position: relative;
}
.hud {
  display: flex; align-items: center; justify-content: space-between;
  width: 420px; max-width: 95vw;
}
.hud-center { font-size: 0.7rem; color: var(--color-neon-yellow); text-shadow: var(--shadow-neon-yellow); }
.back-btn {
  background: none; border: 1px solid var(--color-border); color: var(--color-text-muted);
  padding: 6px 12px; font-size: 0.5rem; border-radius: var(--radius-sm); cursor: pointer;
}
.back-btn:hover { border-color: var(--color-neon-yellow); color: var(--color-neon-yellow); }

.game-canvas {
  border-radius: var(--radius-md); border: 2px solid rgba(255,230,0,0.2);
  box-shadow: 0 0 40px rgba(255,230,0,0.1); max-width: 95vw;
}
.controls-hint {
  font-size: 0.45rem; color: var(--color-text-muted); letter-spacing: 0.08em;
}

.overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 16px;
  background: rgba(0,0,0,0.78); backdrop-filter: blur(4px);
}
.hint { font-size: 0.85rem; color: var(--color-text-muted); }
.unlock { font-size: 0.95rem; color: var(--color-neon-green); text-shadow: var(--shadow-neon-green); }
.play-btn {
  margin-top: 8px; background: linear-gradient(135deg, #ffe600, #ff8800);
  color: #000; border: none; border-radius: var(--radius-md);
  padding: 12px 24px; font-size: 0.6rem; cursor: pointer; transition: transform var(--transition-fast);
}
.play-btn:hover { transform: scale(1.05); }
.won { background: rgba(0,15,5,0.85); }
</style>
