<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'

const router = useRouter()
const store = useGameStore()
const canvas = ref(null)
let animFrame = null
let ctx = null

const gameState  = ref('waiting')
const stars      = ref(0)
const totalStars = 5

// Physics
const W = 420, H = 380
const GRAVITY    = 0.5
const JUMP_FORCE = -12
const MOVE_SPEED = 4

let player     = { x: 60, y: 200, vx: 0, vy: 0, onGround: false, w: 32, h: 32 }
let coins      = []
let platforms  = []
let frameCount = 0
let cameraX    = 0
const WORLD_W  = 1800

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

  // Cakes scattered on platforms
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

  // Fall — simple respawn
  if (player.y > H + 60) {
    player.x = 60; player.y = 270; player.vx = 0; player.vy = 0
  }

  // Clamp
  player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x))

  // Cake collection
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

  // Update physics every frame
  if (gameState.value === 'playing') updatePlayer()

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

  // Cakes 🎂
  for (const c of coins) {
    if (c.collected) continue
    const bob = Math.sin(frameCount * 0.1 + c.x) * 3
    ctx.font = '22px serif'
    ctx.textAlign = 'center'
    ctx.shadowBlur = 18; ctx.shadowColor = '#ff88cc'
    ctx.fillText('🎂', c.x + 10, c.y + bob + 16)
    ctx.shadowBlur = 0
  }

  // ── CAT PLAYER 🐱 ─────────────────────────────────────
  const px = player.x, py = player.y
  const isJumping = !player.onGround
  const isMoving  = Math.abs(player.vx) > 0.5

  // Walking cycle
  const walk  = player.onGround && isMoving ? Math.sin(frameCount * 0.25) : 0
  // Tail wag
  const tail  = Math.sin(frameCount * 0.12) * 0.5
  // Squish/stretch on jump
  const scaleY = isJumping ? 1.15 : (player.onGround && Math.abs(player.vy) < 1 ? 0.88 : 1)
  const scaleX = isJumping ? 0.88 : (player.onGround && Math.abs(player.vy) < 1 ? 1.12 : 1)

  const cx = px + player.w / 2   // center X
  const by = py + player.h        // bottom Y

  ctx.save()
  ctx.translate(cx, by)
  ctx.scale(scaleX * (player.vx < -0.5 ? -1 : 1), scaleY)

  // ── TAIL ─────────────────────────────────────────────
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 4; ctx.lineCap = 'round'
  ctx.shadowBlur = 6; ctx.shadowColor = '#ff8800'
  ctx.beginPath()
  ctx.moveTo(-10, -8)
  ctx.bezierCurveTo(-26 + tail * 10, -18, -28 + tail * 8, -36, -18 + tail * 14, -42 + tail * 8)
  ctx.stroke()
  ctx.shadowBlur = 0

  // ── BODY ─────────────────────────────────────────────
  const bodyGrad = ctx.createRadialGradient(-2, -18, 2, 0, -16, 18)
  bodyGrad.addColorStop(0, '#ffe0b0')
  bodyGrad.addColorStop(0.6, '#ffb347')
  bodyGrad.addColorStop(1, '#cc7a20')
  ctx.fillStyle = bodyGrad
  ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(255,165,50,0.5)'
  ctx.beginPath(); ctx.ellipse(0, -16, 13, 16, 0, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0

  // Belly patch
  const bellyG = ctx.createRadialGradient(0, -14, 1, 0, -14, 9)
  bellyG.addColorStop(0, '#fff5e0'); bellyG.addColorStop(1, 'rgba(255,240,200,0)')
  ctx.fillStyle = bellyG
  ctx.beginPath(); ctx.ellipse(0, -14, 7, 9, 0, 0, Math.PI * 2); ctx.fill()

  // ── LEGS ─────────────────────────────────────────────
  const legColor = '#cc7a20'
  const pawColor = '#ffb347'
  if (isJumping) {
    // Legs tucked up
    ctx.fillStyle = legColor
    ctx.beginPath(); ctx.ellipse(-7, -3, 5, 4, -0.5, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(7, -3, 5, 4, 0.5, 0, Math.PI*2); ctx.fill()
  } else {
    // Left leg
    ctx.fillStyle = legColor
    ctx.beginPath(); ctx.roundRect(-11, -8 + walk * 3, 8, 10, 4); ctx.fill()
    ctx.fillStyle = pawColor
    ctx.beginPath(); ctx.ellipse(-7, 2 + walk * 3, 5, 3, 0, 0, Math.PI*2); ctx.fill()
    // Right leg
    ctx.fillStyle = legColor
    ctx.beginPath(); ctx.roundRect(3, -8 - walk * 3, 8, 10, 4); ctx.fill()
    ctx.fillStyle = pawColor
    ctx.beginPath(); ctx.ellipse(7, 2 - walk * 3, 5, 3, 0, 0, Math.PI*2); ctx.fill()
    // Toe beans
    ctx.fillStyle = 'rgba(200,80,80,0.5)'
    for (let t2 = -1; t2 <= 1; t2++) {
      ctx.beginPath(); ctx.arc(-7 + t2 * 3, 4 + walk*3, 1.2, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(7 + t2 * 3, 4 - walk*3, 1.2, 0, Math.PI*2); ctx.fill()
    }
  }

  // ── HEAD ─────────────────────────────────────────────
  const headY = -30
  const headR = 13
  // Head shadow
  ctx.fillStyle = '#cc7a20'
  ctx.beginPath(); ctx.arc(0, headY, headR + 1, 0, Math.PI * 2); ctx.fill()
  // Head main
  const headG = ctx.createRadialGradient(-3, headY - 4, 2, 0, headY, headR)
  headG.addColorStop(0, '#ffe0b0'); headG.addColorStop(0.6, '#ffb347'); headG.addColorStop(1, '#cc7a20')
  ctx.fillStyle = headG
  ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fill()

  // ── EARS ─────────────────────────────────────────────
  // Left ear
  ctx.fillStyle = '#cc7a20'
  ctx.beginPath()
  ctx.moveTo(-headR + 2, headY - 7)
  ctx.lineTo(-headR - 5, headY - 20)
  ctx.lineTo(-headR + 10, headY - 13)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,150,150,0.7)'
  ctx.beginPath()
  ctx.moveTo(-headR + 3, headY - 8)
  ctx.lineTo(-headR - 2, headY - 17)
  ctx.lineTo(-headR + 8, headY - 13)
  ctx.closePath(); ctx.fill()
  // Right ear
  ctx.fillStyle = '#cc7a20'
  ctx.beginPath()
  ctx.moveTo(headR - 2, headY - 7)
  ctx.lineTo(headR + 5, headY - 20)
  ctx.lineTo(headR - 10, headY - 13)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,150,150,0.7)'
  ctx.beginPath()
  ctx.moveTo(headR - 3, headY - 8)
  ctx.lineTo(headR + 2, headY - 17)
  ctx.lineTo(headR - 8, headY - 13)
  ctx.closePath(); ctx.fill()

  // ── FACE ─────────────────────────────────────────────
  // Eyes
  const eyeY = headY - 2
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.ellipse(-5, eyeY, 4.5, 5, 0, 0, Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(5, eyeY, 4.5, 5, 0, 0, Math.PI*2); ctx.fill()
  // Pupils (look slightly forward)
  ctx.fillStyle = '#1a0a00'
  ctx.beginPath(); ctx.ellipse(-4.5, eyeY + 0.5, isJumping ? 2 : 3, isJumping ? 4 : 3.5, 0, 0, Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(5.5, eyeY + 0.5, isJumping ? 2 : 3, isJumping ? 4 : 3.5, 0, 0, Math.PI*2); ctx.fill()
  // Eye shines
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath(); ctx.arc(-3.5, eyeY - 1.5, 1.5, 0, Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.arc(6.5, eyeY - 1.5, 1.5, 0, Math.PI*2); ctx.fill()
  // Sleepy/happy half-lids when idle
  if (!isJumping && !isMoving) {
    ctx.fillStyle = '#cc7a20'
    ctx.beginPath(); ctx.ellipse(-5, eyeY - 3, 5, 2.5, 0, 0, Math.PI); ctx.fill()
    ctx.beginPath(); ctx.ellipse(5, eyeY - 3, 5, 2.5, 0, 0, Math.PI); ctx.fill()
  }

  // Nose
  ctx.fillStyle = '#ff6688'
  ctx.beginPath()
  ctx.moveTo(-2, headY + 4); ctx.lineTo(2, headY + 4); ctx.lineTo(0, headY + 6)
  ctx.closePath(); ctx.fill()
  // Mouth
  ctx.strokeStyle = '#cc4455'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, headY + 6)
  ctx.quadraticCurveTo(-4, headY + 10, -5, headY + 9); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, headY + 6)
  ctx.quadraticCurveTo(4, headY + 10, 5, headY + 9); ctx.stroke()

  // Whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1; ctx.lineCap = 'round'
  for (let w2 = 0; w2 < 3; w2++) {
    const wy = headY + 5 + w2 * 2.5 - 2.5
    ctx.beginPath(); ctx.moveTo(-6, wy); ctx.lineTo(-headR - 5, wy - w2 + 1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(6, wy);  ctx.lineTo(headR + 5, wy - w2 + 1);  ctx.stroke()
  }

  ctx.restore()

  ctx.restore()
  frameCount++

  animFrame = requestAnimationFrame(draw)
}

function startGame() {
  cancelAnimationFrame(animFrame)
  buildWorld(); stars.value = 0; gameState.value = 'playing'; frameCount = 0
  animFrame = requestAnimationFrame(draw)
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
        <span>🎂 {{ stars }} / {{ totalStars }}</span>
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
      <p class="hint">¡Recolecta los {{ totalStars }} pasteles! 🎂</p>
      <button class="play-btn font-pixel" @click="startGame" id="jump-play-btn">▶ SALTAR</button>
    </div>

    <!-- Overlay: won -->
    <div v-if="gameState === 'won'" class="overlay won" id="jump-won-overlay">
      <p class="font-pixel text-neon-green" style="font-size:0.7rem">¡TODOS LOS PASTELES!</p>
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
.lives { font-size: 1rem; letter-spacing: 2px; min-width: 70px; text-align: right; }
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
