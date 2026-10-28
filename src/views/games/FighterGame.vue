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
const playerHP = ref(100)
const bossHP = ref(100)
const combo = ref(0)
const comboTimer = ref(null)
const message = ref('')

// Fighter state
let playerX = 80, bossX = 280
const GROUND = 320
const W = 420, H = 380

const keys = {}
let playerFrame = 0, bossFrame = 0
let frameCount = 0
let bossAttackTimer = 0

function showMessage(msg, color = '#fff') {
  message.value = msg
  setTimeout(() => { message.value = '' }, 800)
}

function attack(power = 1) {
  if (gameState.value !== 'playing') return
  const dmg = (8 + Math.random() * 10) * power
  bossHP.value = Math.max(0, bossHP.value - dmg)
  combo.value++
  showMessage(combo.value >= 3 ? `🔥 COMBO x${combo.value}!` : `HIT! -${Math.floor(dmg)}`)

  clearTimeout(comboTimer.value)
  comboTimer.value = setTimeout(() => { combo.value = 0 }, 1500)

  if (bossHP.value <= 0) {
    gameState.value = 'won'
    store.completeGame('fighter')
    cancelAnimationFrame(animFrame)
  }
}

function handleKey(e) {
  if (gameState.value !== 'playing') return
  keys[e.key] = true
  if (e.key === 'z' || e.key === 'Z' || e.key === 'a' || e.key === 'A') attack(1)
  if (e.key === 'x' || e.key === 'X' || e.key === 's' || e.key === 'S') attack(1.8)
  if (e.key === 'c' || e.key === 'C' || e.key === 'd' || e.key === 'D') attack(2.5)
}
function handleKeyUp(e) { delete keys[e.key] }

function drawFighter(x, y, color, isPlayer) {
  const glowColor = isPlayer ? '#00f5ff' : '#ff2d78'
  ctx.shadowBlur = 16; ctx.shadowColor = glowColor

  // Body
  ctx.fillStyle = color
  ctx.fillRect(x, y - 70, 36, 46)

  // Head
  ctx.beginPath(); ctx.arc(x + 18, y - 82, 16, 0, Math.PI * 2); ctx.fill()

  // Legs
  ctx.fillRect(x + 2, y - 24, 14, 28)
  ctx.fillRect(x + 20, y - 24, 14, 28)

  // Arms (animation)
  const aBob = Math.sin(frameCount * 0.1) * 4
  ctx.fillRect(x - 14, y - 68 + aBob, 14, 10)
  ctx.fillRect(x + 36, y - 68 - aBob, 14, 10)

  ctx.shadowBlur = 0
}

function draw() {
  if (!canvas.value) return
  ctx.clearRect(0, 0, W, H)

  // Background
  ctx.fillStyle = '#0f0f1a'
  ctx.fillRect(0, 0, W, H)

  // Floor
  const grad = ctx.createLinearGradient(0, GROUND, 0, H)
  grad.addColorStop(0, '#1a1040')
  grad.addColorStop(1, '#0a0a0f')
  ctx.fillStyle = grad
  ctx.fillRect(0, GROUND, W, H - GROUND)
  ctx.strokeStyle = 'rgba(180,0,255,0.3)'
  ctx.lineWidth = 2; ctx.beginPath()
  ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke()

  // Grid lines on floor
  for (let i = 0; i < W; i += 40) {
    ctx.strokeStyle = 'rgba(180,0,255,0.1)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(i, GROUND); ctx.lineTo(i + 20, H); ctx.stroke()
  }

  frameCount++

  // Boss AI
  bossAttackTimer++
  if (bossAttackTimer > 120) {
    bossAttackTimer = 0
    const dmg = 8 + Math.random() * 12
    playerHP.value = Math.max(0, playerHP.value - dmg)
    if (playerHP.value <= 0) { gameState.value = 'lost'; cancelAnimationFrame(animFrame); return }
  }

  // Draw fighters
  drawFighter(playerX, GROUND, '#00f5ff', true)
  drawFighter(bossX, GROUND, '#ff2d78', false)

  // VS text
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = 'bold 28px Outfit'; ctx.textAlign = 'center'
  ctx.fillText('VS', W / 2, GROUND - 20)

  animFrame = requestAnimationFrame(draw)
}

function startGame() {
  gameState.value = 'playing'
  playerHP.value = 100; bossHP.value = 100; combo.value = 0; frameCount = 0; bossAttackTimer = 0
  draw()
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  window.addEventListener('keydown', handleKey)
  window.addEventListener('keyup', handleKeyUp)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  window.removeEventListener('keyup', handleKeyUp)
  cancelAnimationFrame(animFrame)
})
</script>

<template>
  <div class="game-wrap" id="fighter-game">
    <!-- HUD bars -->
    <div class="hud-bars">
      <div class="hp-block" id="player-hp-block">
        <span class="hp-label font-pixel">TÚ</span>
        <div class="hp-bar-bg"><div class="hp-bar hp-player" :style="{ width: playerHP + '%' }" /></div>
        <span class="hp-num font-pixel">{{ Math.floor(playerHP) }}</span>
      </div>
      <div class="combo-center font-pixel">
        <span v-if="combo >= 2" class="combo-text text-neon-yellow">x{{ combo }}</span>
        <span v-else>🥊</span>
      </div>
      <div class="hp-block reverse" id="boss-hp-block">
        <span class="hp-num font-pixel">{{ Math.floor(bossHP) }}</span>
        <div class="hp-bar-bg"><div class="hp-bar hp-boss" :style="{ width: bossHP + '%' }" /></div>
        <span class="hp-label font-pixel">BOSS</span>
      </div>
    </div>

    <!-- Canvas -->
    <div class="canvas-wrap">
      <canvas ref="canvas" :width="420" :height="380" class="game-canvas" id="fighter-canvas" />
      <div v-if="message" class="hit-msg font-pixel">{{ message }}</div>
    </div>

    <!-- Controls -->
    <div v-if="gameState === 'playing'" class="controls" id="fighter-controls">
      <button class="atk-btn" @click="attack(1)" id="atk-punch">👊 GOLPE<br/><span class="key">[Z]</span></button>
      <button class="atk-btn special" @click="attack(1.8)" id="atk-kick">🦵 PATADA<br/><span class="key">[X]</span></button>
      <button class="atk-btn ultra" @click="attack(2.5)" id="atk-ultra">💥 ULTRA<br/><span class="key">[C]</span></button>
    </div>

    <!-- Back btn -->
    <button class="back-btn font-pixel" @click="router.push('/arcade')" id="back-to-arcade-fighter" style="position:absolute;top:12px;left:12px;">← ARCADE</button>

    <!-- Overlay: waiting -->
    <div v-if="gameState === 'waiting'" class="overlay" id="fighter-start-overlay">
      <p class="font-pixel text-neon-pink" style="font-size:0.9rem">FIGHTER</p>
      <p class="hint">Z → Golpe &nbsp; X → Patada &nbsp; C → Ultra</p>
      <p class="hint">En móvil: usa los botones en pantalla</p>
      <p class="hint">Reduce la HP del boss a 0 para ganar</p>
      <button class="play-btn font-pixel" @click="startGame" id="fighter-play-btn">▶ PELEAR</button>
    </div>

    <!-- Overlay: won -->
    <div v-if="gameState === 'won'" class="overlay won" id="fighter-won-overlay">
      <p class="font-pixel text-neon-green" style="font-size:0.75rem">¡KO! ¡GANASTE!</p>
      <p class="unlock">🔓 Jump Quest desbloqueado</p>
      <button class="play-btn font-pixel" @click="router.push('/arcade')" id="fighter-arcade-btn">← VOLVER AL ARCADE</button>
    </div>

    <!-- Overlay: lost -->
    <div v-if="gameState === 'lost'" class="overlay lost" id="fighter-lost-overlay">
      <p class="font-pixel text-neon-pink" style="font-size:0.75rem">KO... GAME OVER</p>
      <button class="play-btn font-pixel" @click="startGame" id="fighter-retry-btn">↺ REINTENTAR</button>
    </div>
  </div>
</template>

<style scoped>
.game-wrap {
  width: 100vw; height: 100vh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  background: radial-gradient(ellipse at top, #1a0020 0%, #0a0a0f 70%);
  position: relative;
}
.hud-bars {
  display: flex; align-items: center; gap: 16px; width: 460px; max-width: 95vw;
}
.hp-block { display: flex; align-items: center; gap: 8px; flex: 1; }
.hp-block.reverse { flex-direction: row-reverse; }
.hp-label { font-size: 0.5rem; color: var(--color-text-muted); white-space: nowrap; }
.hp-num { font-size: 0.55rem; min-width: 24px; text-align: center; }
.hp-bar-bg { flex: 1; height: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; }
.hp-bar { height: 100%; border-radius: 5px; transition: width 0.2s ease; }
.hp-player { background: linear-gradient(90deg, #00f5ff, #0088ff); box-shadow: 0 0 8px rgba(0,245,255,0.5); }
.hp-boss   { background: linear-gradient(90deg, #ff8800, #ff2d78); float: right; }
.combo-center { font-size: 1.2rem; min-width: 40px; text-align: center; }
.combo-text { font-size: 0.7rem; animation: pulse-glow 0.3s ease-in-out; }

.canvas-wrap { position: relative; }
.game-canvas {
  border-radius: var(--radius-md); border: 2px solid rgba(180,0,255,0.3);
  box-shadow: 0 0 40px rgba(180,0,255,0.15); max-width: 95vw;
}
.hit-msg {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  font-size: 0.7rem; color: var(--color-neon-yellow);
  text-shadow: var(--shadow-neon-yellow); animation: slide-up 0.3s ease;
  pointer-events: none;
}

.controls {
  display: flex; gap: 12px;
}
.atk-btn {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
  color: var(--color-text); border-radius: var(--radius-md); padding: 10px 20px;
  font-size: 0.9rem; cursor: pointer; transition: all var(--transition-fast);
  line-height: 1.4; text-align: center;
}
.atk-btn .key { font-family: var(--font-pixel); font-size: 0.4rem; color: var(--color-text-muted); }
.atk-btn:hover { background: rgba(0,245,255,0.1); border-color: var(--color-neon-cyan); transform: scale(1.05); }
.atk-btn.special:hover { background: rgba(255,45,120,0.1); border-color: var(--color-neon-pink); }
.atk-btn.ultra { background: rgba(180,0,255,0.1); border-color: rgba(180,0,255,0.3); }
.atk-btn.ultra:hover { box-shadow: var(--shadow-neon-purple); transform: scale(1.08); }

.back-btn {
  background: none; border: 1px solid var(--color-border); color: var(--color-text-muted);
  padding: 6px 12px; font-size: 0.5rem; border-radius: var(--radius-sm); cursor: pointer;
}
.back-btn:hover { border-color: var(--color-neon-pink); color: var(--color-neon-pink); }

.overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 16px;
  background: rgba(0,0,0,0.78); backdrop-filter: blur(4px);
}
.hint { font-size: 0.85rem; color: var(--color-text-muted); }
.unlock { font-size: 0.95rem; color: var(--color-neon-green); text-shadow: var(--shadow-neon-green); }
.play-btn {
  margin-top: 8px; background: linear-gradient(135deg, #ff2d78, #b400ff);
  color: white; border: none; border-radius: var(--radius-md);
  padding: 12px 24px; font-size: 0.6rem; cursor: pointer; transition: transform var(--transition-fast);
}
.play-btn:hover { transform: scale(1.05); }
.won { background: rgba(0,15,5,0.85); }
.lost { background: rgba(20,0,10,0.85); }
</style>
