<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'

const router = useRouter()
const store  = useGameStore()
const canvas = ref(null)
let animFrame = null
let ctx = null

// ── Dimensions ───────────────────────────────────────────
const W = 760, H = 440
const GROUND = 350

// ── State ────────────────────────────────────────────────
const gameState  = ref('waiting')
const playerHP   = ref(100)
const bossHP     = ref(150)   // boss más resistente
const combo      = ref(0)
const countdownVal = ref(3)
const hitEffects = ref([])
const shakeTimer = ref(0)

let player = makeChar(110, GROUND, 1)
let boss   = makeChar(600, GROUND, -1)
let frameCount = 0
let comboResetTimer = null
let countdownInterval = null

function makeChar(x, y, facing) {
  return { x, y, facing, state: 'idle', stateTimer: 0,
           jumpVY: 0, onGround: true, attackTrail: [] }
}

// ══════════════════════════════════════════════════════════
//  #3 SONIDOS KAWAII — Web Audio API (sin dependencias)
// ══════════════════════════════════════════════════════════
let audioCtx = null
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playSound(type) {
  try {
    const a = getAudio()
    const t = a.currentTime
    const note = (freq, start, dur, vol = 0.25, wave = 'sine') => {
      const o = a.createOscillator()
      const g = a.createGain()
      o.connect(g); g.connect(a.destination)
      o.type = wave
      o.frequency.setValueAtTime(freq, t + start)
      g.gain.setValueAtTime(vol, t + start)
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur)
      o.start(t + start); o.stop(t + start + dur + 0.01)
    }
    switch (type) {
      case 'punch':
        note(320, 0,    0.08, 0.28, 'square')
        note(120, 0.05, 0.12, 0.18, 'sawtooth')
        break
      case 'kick':
        note(200, 0,    0.05, 0.35, 'sawtooth')
        note(80,  0.04, 0.18, 0.22, 'sine')
        break
      case 'ultra':
        // Acorde ascendente ✨
        note(440, 0,    0.25, 0.22, 'sine')
        note(660, 0.08, 0.25, 0.22, 'sine')
        note(880, 0.16, 0.35, 0.28, 'sine')
        note(1320, 0.24, 0.4, 0.22, 'triangle')
        break
      case 'hurt':
        note(180, 0, 0.06, 0.20, 'square')
        note(90,  0.05, 0.22, 0.15, 'sawtooth')
        break
      case 'miss':
        note(200, 0, 0.06, 0.08, 'sine')
        note(160, 0.05, 0.08, 0.06, 'sine')
        break
      case 'boss_hurt':
        note(260, 0, 0.05, 0.18, 'square')
        note(130, 0.04, 0.15, 0.12, 'sawtooth')
        break
      case 'win':
        // Fanfarria kawaii 🎉
        [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i*0.14, 0.28, 0.22, 'triangle'))
        note(1047, 0.8, 0.6, 0.18, 'sine')
        break
      case 'lose':
        note(330, 0,    0.15, 0.20, 'sawtooth')
        note(220, 0.15, 0.25, 0.18, 'sawtooth')
        note(110, 0.38, 0.55, 0.18, 'sawtooth')
        break
      case 'jump':
        note(300, 0, 0.04, 0.12, 'sine')
        note(480, 0.03, 0.12, 0.10, 'sine')
        break
    }
  } catch (e) { /* audio no disponible */ }
}

// ══════════════════════════════════════════════════════════
//  #1 MENSAJES DEL BOSS — burbujas de texto en canvas
// ══════════════════════════════════════════════════════════
const MSGS = {
  idle: [
    '¡Feliz cumpleaños! 🎂',
    '¡Hoy es tu día! 🎉',
    '¡Pelea, cumpleañera!',
    '¡Ven aquí! 🐾',
    '¡Vamos, vamos! 💪',
    '¡Te tengo! 🤎',
    '¡Soy el mejor! 😤',
    '¡Jeje... 😏',
  ],
  phase2: [
    '¡Ahora sí me enojo! 😤',
    '¡MODO FURIOSO! 🔥',
    '¡No me rindo!',
    '¡Aaaargh! 🐻',
  ],
  phase3: [
    '¡BERSERKER! 💥',
    '¡TODO POR TI! 🔥',
    '¡ÚLTIMA OPORTUNIDAD!',
    '¡No puedes ganarme! 😤',
  ],
  hit: [
    '¡Auch! 😖',
    '¡Eso dolió!',
    '¡Oye! 😤',
    '¡Trampa! 😱',
  ],
  attack: [
    '¡Toma! 👊',
    '¡Ja! 😏',
    '¡Sorpresa! 🐾',
    '¡Rin rin! 🛎️',
  ],
}

let bossBubble = null   // { text, life, maxLife }
let bubbleCooldown = 0

function showBubble(category) {
  const pool = MSGS[category]
  const text = pool[Math.floor(Math.random() * pool.length)]
  bossBubble = { text, life: 160, maxLife: 160 }
}

function drawBossBubble() {
  if (!bossBubble || bossBubble.life <= 0) return
  bossBubble.life--
  const p = bossBubble.life / bossBubble.maxLife
  if (p <= 0) return

  const alpha = p > 0.85 ? 1 : p > 0.15 ? 1 : p / 0.15
  const bx = boss.x + (boss.facing === -1 ? -20 : 20)
  const by = boss.y - 230

  ctx.save()
  ctx.globalAlpha = alpha

  // Medir texto
  ctx.font = "bold 13px 'Segoe UI Emoji', Arial, sans-serif"
  const tw = ctx.measureText(bossBubble.text).width
  const pw = tw + 22, ph = 32
  const rx = bx - pw / 2, ry = by - ph / 2

  // Burbuja redondeada
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.strokeStyle = '#1a1008'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(rx, ry, pw, ph, 10)
  ctx.fill(); ctx.stroke()

  // Rabito de la burbuja apuntando al boss
  ctx.beginPath()
  ctx.moveTo(bx - 6, ry + ph - 1)
  ctx.lineTo(bx,     ry + ph + 10)
  ctx.lineTo(bx + 6, ry + ph - 1)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill()
  ctx.strokeStyle = '#1a1008'; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(bx - 6, ry + ph)
  ctx.lineTo(bx,     ry + ph + 10)
  ctx.lineTo(bx + 6, ry + ph); ctx.stroke()

  // Texto
  ctx.fillStyle = '#1a1008'
  ctx.textAlign = 'center'
  ctx.fillText(bossBubble.text, bx, ry + ph/2 + 5)

  ctx.restore()
}

// ── Hit effects ──────────────────────────────────────────
function spawnHit(x, y, text, color) {
  hitEffects.value.push({ x, y, text, color, life: 50, maxLife: 50 })
}

function screenShake() { shakeTimer.value = 8 }

// ── Attacks ───────────────────────────────────────────────
function doPlayerAttack(type) {
  if (gameState.value !== 'playing') return
  if (['ultra', 'hurt'].includes(player.state)) return

  // Rango máximo de cada ataque (en píxeles de distancia horizontal)
  const RANGE = { punch: 130, kick: 160, ultra: 220 }
  const dist = Math.abs(boss.x - player.x)

  // Siempre se activa la animación del ataque
  if (type === 'punch') { player.state = 'punch'; player.stateTimer = 28 }
  if (type === 'kick')  { player.state = 'kick';  player.stateTimer = 32 }
  if (type === 'ultra') { player.state = 'ultra'; player.stateTimer = 48 }

  // Solo hace daño si el boss está al alcance
  if (dist > RANGE[type]) {
    playSound('miss')
    spawnHit(player.x + (player.facing * 60), player.y - 120, '¡MISS!', 'rgba(255,255,255,0.5)')
    return
  }

  let dmg = 0, txt = '', color = '#ffff00'
  if (type === 'punch') { dmg = 6 + Math.random()*6;   txt = 'HIT!';      color = '#00f5ff' }
  if (type === 'kick')  { dmg = 10 + Math.random()*8;  txt = 'KICK!';     color = '#ff88ff' }
  if (type === 'ultra') { dmg = 18 + Math.random()*12; txt = '🔥 ULTRA!'; color = '#ffdd00' }

  // Bonus de combo pero con límite para no hacer el juego trivial
  dmg *= (1 + Math.min(combo.value, 5) * 0.08)
  bossHP.value = Math.max(0, bossHP.value - dmg)
  boss.state = 'hurt'; boss.stateTimer = 18
  playSound(type)
  screenShake()
  combo.value++
  clearTimeout(comboResetTimer)
  comboResetTimer = setTimeout(() => { combo.value = 0 }, 1800)

  spawnHit(boss.x - 10, boss.y - 160 - Math.random()*40, txt, color)
  if (Math.random() < 0.6) showBubble('hit')

  if (bossHP.value <= 0) {
    playSound('win')
    gameState.value = 'won'
    store.completeGame('fighter')
    cancelAnimationFrame(animFrame)
  }
}

const keys = {}
function onKey(e) {
  if (gameState.value !== 'playing') return
  keys[e.key] = true
  const k = e.key.toLowerCase()
  if (k === 'z') doPlayerAttack('punch')
  if (k === 'x') doPlayerAttack('kick')
  if (k === 'c') doPlayerAttack('ultra')
  if ((k === 'w' || k === 'arrowup' || e.key === ' ') && player.onGround) {
    playSound('jump')
    player.jumpVY = -16; player.onGround = false; player.state = 'jump'
  }
}
function onKeyUp(e) { delete keys[e.key] }

// ── helpers ──────────────────────────────────────────────
function heart(cx, cy, size) {
  ctx.beginPath()
  ctx.moveTo(cx, cy + size * 0.4)
  ctx.bezierCurveTo(cx, cy, cx - size, cy, cx - size, cy - size * 0.35)
  ctx.bezierCurveTo(cx - size, cy - size * 0.9, cx, cy - size * 0.75, cx, cy - size * 0.35)
  ctx.bezierCurveTo(cx, cy - size * 0.75, cx + size, cy - size * 0.9, cx + size, cy - size * 0.35)
  ctx.bezierCurveTo(cx + size, cy, cx, cy, cx, cy + size * 0.4)
  ctx.closePath()
}

// ═══════════════════════════════════════════════════════
//  DRAW FIGHTER — Milk & Mocha Bears 🤍🤎
//  Proporciones fieles: cabeza enorme, cuerpo pequeñito,
//  contorno negro grueso, estilo kawaii limpio.
// ═══════════════════════════════════════════════════════
function drawFighter(f, isPlayer) {
  const fc  = frameCount
  const st  = f.state
  const t   = f.stateTimer
  const px  = f.x
  const py  = f.y

  const isHurt  = st === 'hurt'
  const isPunch = st === 'punch'
  const isKick  = st === 'kick'
  const isUltra = st === 'ultra'
  const isIdle  = st === 'idle' || st === 'walk'

  // ── Paleta Milk & Mocha ───────────────────────────────
  // Milk = oso blanco puro con contorno negro fino
  // Mocha = oso café cálido con contorno negro fino
  const OL       = '#1a1008'                   // outline negro (igual para los dos)
  const furFill  = isPlayer ? '#ffffff' : '#c8823c'   // blanco / café
  const furShade = isPlayer ? '#e8e0d8' : '#a06020'   // sombra suave
  const muzzle   = isPlayer ? '#f5f0ea' : '#e8c080'   // hocico
  const earIn    = '#f0a0b0'                   // interior oreja rosa (igual)
  const cheekC   = 'rgba(240,120,130,0.50)'   // mofletes rosa
  const glowC    = isPlayer ? 'rgba(255,200,220,0.9)' : 'rgba(255,180,60,0.9)'
  const heartC   = isPlayer ? '#ff6688' : '#ffaa22'   // color corazón ultra

  const bob = isIdle ? Math.sin(fc * 0.07) * 2.5 : 0
  const shk = isHurt ? (Math.random() * 5 - 2.5)  : 0

  ctx.save()
  ctx.translate(px + shk, 0)
  if (f.facing === -1) ctx.scale(-1, 1)

  // ── Proporciones Milk & Mocha reales ─────────────────
  // Cabeza ~55% de la altura total, cuerpo mini, piernas cortas
  const GY  = f.y               // nivel del suelo
  const HR  = 52                // radio cabeza (grande!)
  const hcy = GY - 88 - HR + bob // centro de cabeza
  const BCX = 0,  BCY = GY - 52  // centro cuerpo
  const BRX = 30, BRY = 30      // radios cuerpo (pequeño)
  const SY  = BCY - BRY + 6    // nivel hombro (donde salen los brazos)

  // ── Sombra en el suelo ───────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.beginPath(); ctx.ellipse(0, GY + 4, 40, 8, 0, 0, Math.PI*2); ctx.fill()

  // ══════════════════════════════════════════════════════
  //  PIERNAS — cortas y redondeadas como en las imágenes
  // ══════════════════════════════════════════════════════
  ctx.shadowBlur = 0

  if (isKick && t > 16) {
    // pierna izq plantada
    const ext = Math.min((32 - t) / 8, 1)
    // outline pierna plantada
    ctx.fillStyle = OL
    ctx.beginPath(); ctx.roundRect(-24, GY - 38, 20, 38, [8,8,14,14]); ctx.fill()
    ctx.fillStyle = furFill
    ctx.beginPath(); ctx.roundRect(-22, GY - 36, 18, 36, [8,8,12,12]); ctx.fill()
    // patita izq
    ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(-14, GY + 2, 16, 10, 0, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.ellipse(-14, GY + 1, 14, 8, 0, 0, Math.PI*2); ctx.fill()
    // pierna derecha pateando
    const kx = 18 + ext * 52, ky = GY - 28 - ext * 22
    ctx.fillStyle = OL
    ctx.beginPath(); ctx.roundRect(4, GY - 36, 18, 26, 8); ctx.fill()
    ctx.fillStyle = furFill
    ctx.beginPath(); ctx.roundRect(6, GY - 34, 16, 24, 8); ctx.fill()
    // patita pateando
    ctx.fillStyle = OL; ctx.shadowBlur = 14; ctx.shadowColor = glowC
    ctx.beginPath(); ctx.ellipse(kx, ky, 16, 12, -0.5, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill; ctx.shadowBlur = 0
    ctx.beginPath(); ctx.ellipse(kx, ky, 14, 10, -0.5, 0, Math.PI*2); ctx.fill()
  } else {
    const wb = isIdle ? Math.sin(fc * 0.08) * 1.5 : 0
    // Dos piernitas juntas y cortas (postura sentado/de pie kawaii)
    for (const [lx, side] of [[-22, -1], [2, 1]]) {
      const lw = 18, lh = 36
      ctx.fillStyle = OL
      ctx.beginPath(); ctx.roundRect(lx + wb * side, GY - lh, lw, lh, [8,8,12,12]); ctx.fill()
      ctx.fillStyle = furFill
      ctx.beginPath(); ctx.roundRect(lx + 1 + wb * side, GY - lh + 1, lw - 2, lh - 2, [7,7,11,11]); ctx.fill()
      // patita redonda
      ctx.fillStyle = OL
      ctx.beginPath(); ctx.ellipse(lx + lw/2 + wb*side, GY + 3, lw/2 + 4, 9, 0, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = furFill
      ctx.beginPath(); ctx.ellipse(lx + lw/2 + wb*side, GY + 2, lw/2 + 2, 7, 0, 0, Math.PI*2); ctx.fill()
    }
  }

  // ══════════════════════════════════════════════════════
  //  CUERPO — redondito y pequeño
  // ══════════════════════════════════════════════════════
  ctx.fillStyle = OL
  ctx.beginPath(); ctx.ellipse(BCX, BCY, BRX + 3, BRY + 3, 0, 0, Math.PI*2); ctx.fill()
  ctx.fillStyle = furFill
  ctx.beginPath(); ctx.ellipse(BCX, BCY, BRX, BRY, 0, 0, Math.PI*2); ctx.fill()
  // pancita más clara
  ctx.fillStyle = isPlayer ? 'rgba(250,245,240,0.8)' : 'rgba(232,200,130,0.6)'
  ctx.beginPath(); ctx.ellipse(BCX, BCY + 8, BRX * 0.6, BRY * 0.6, 0, 0, Math.PI*2); ctx.fill()

  // ══════════════════════════════════════════════════════
  //  BRAZOS — regordetos y cortos
  // ══════════════════════════════════════════════════════
  if (isPunch && t > 10) {
    const ext = Math.min((28 - t) / 7, 1.0)
    // brazo de atrás (quieto)
    ctx.fillStyle = OL; ctx.beginPath(); ctx.roundRect(-46, SY, 18, 32, 9); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.roundRect(-44, SY + 1, 16, 30, 9); ctx.fill()
    ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(-36, SY + 36, 13, 11, 0, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.ellipse(-36, SY + 35, 11, 9, 0, 0, Math.PI*2); ctx.fill()
    // brazo que golpea — se extiende
    ctx.shadowBlur = 22; ctx.shadowColor = glowC
    ctx.fillStyle = OL
    ctx.beginPath()
    ctx.moveTo(28, SY); ctx.lineTo(28, SY + 20)
    ctx.lineTo(28 + 52 * ext, SY + 17); ctx.lineTo(28 + 52 * ext, SY - 3)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = furFill
    ctx.beginPath()
    ctx.moveTo(30, SY + 2); ctx.lineTo(30, SY + 18)
    ctx.lineTo(30 + 48 * ext, SY + 15); ctx.lineTo(30 + 48 * ext, SY - 1)
    ctx.closePath(); ctx.fill()
    ctx.shadowBlur = 0
    // manita golpeando — puño redondo kawaii
    ctx.fillStyle = OL; ctx.shadowBlur = 20; ctx.shadowColor = glowC
    ctx.beginPath(); ctx.ellipse(32 + 52 * ext, SY + 8, 16, 13, 0, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill; ctx.shadowBlur = 0
    ctx.beginPath(); ctx.ellipse(32 + 52 * ext, SY + 7, 14, 11, 0, 0, Math.PI*2); ctx.fill()
    // ✨ estrellitas impacto
    if (ext > 0.65) {
      ctx.fillStyle = isPlayer ? '#ffd6e8' : '#ffe0a0'
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + fc * 0.25
        ctx.beginPath(); ctx.arc(32 + 52*ext + Math.cos(a)*20, SY + 8 + Math.sin(a)*15, 3.5, 0, Math.PI*2); ctx.fill()
      }
    }

  } else if (isUltra) {
    // Brazos levantados — postura ultra kawaii
    const pulse = Math.sin(fc * 0.3) * 3
    // brazo izq arriba
    ctx.fillStyle = OL; ctx.beginPath(); ctx.roundRect(-44, SY - 20, 18, 36, 9); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.roundRect(-42, SY - 19, 16, 34, 9); ctx.fill()
    ctx.fillStyle = OL; ctx.shadowBlur = 14; ctx.shadowColor = glowC
    ctx.beginPath(); ctx.ellipse(-34, SY - 26, 14, 12, -0.4, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill; ctx.shadowBlur = 0
    ctx.beginPath(); ctx.ellipse(-34, SY - 26, 12, 10, -0.4, 0, Math.PI*2); ctx.fill()
    // brazo der arriba
    ctx.fillStyle = OL; ctx.beginPath(); ctx.roundRect(26, SY - 20, 18, 36, 9); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.roundRect(26, SY - 19, 16, 34, 9); ctx.fill()
    ctx.fillStyle = OL; ctx.shadowBlur = 14; ctx.shadowColor = glowC
    ctx.beginPath(); ctx.ellipse(34, SY - 26, 14, 12, 0.4, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill; ctx.shadowBlur = 0
    ctx.beginPath(); ctx.ellipse(34, SY - 26, 12, 10, 0.4, 0, Math.PI*2); ctx.fill()
    // 💖 CORAZÓN gigante — como en las fotos de Milk & Mocha
    const hcx = 60, hcy = SY - 24, hs = 22 + pulse
    ctx.shadowBlur = 50; ctx.shadowColor = heartC
    // outline corazón
    ctx.fillStyle = OL
    heart(hcx, hcy, hs + 3); ctx.fill()
    // relleno corazón
    ctx.fillStyle = heartC
    heart(hcx, hcy, hs); ctx.fill()
    // brillo corazón
    ctx.fillStyle = 'rgba(255,255,255,0.50)'
    ctx.beginPath(); ctx.ellipse(hcx - hs * 0.3, hcy - hs * 0.3, hs * 0.25, hs * 0.16, -0.4, 0, Math.PI*2); ctx.fill()
    ctx.shadowBlur = 0
    // corazoncitos orbitando
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + fc * 0.07
      const mx = hcx + Math.cos(a) * (hs + 16), my = hcy + Math.sin(a) * (hs + 12)
      const ms = 8 + Math.sin(fc * 0.2 + i) * 2
      ctx.fillStyle = isPlayer ? 'rgba(255,100,150,0.85)' : 'rgba(255,190,60,0.85)'
      heart(mx, my, ms); ctx.fill()
    }

  } else {
    // Idle — bracitos colgando kawaii con balanceo suave
    const sw = isIdle ? Math.sin(fc * 0.07) * 4 : 0
    // brazo izq
    ctx.fillStyle = OL; ctx.beginPath(); ctx.roundRect(-44, SY + sw, 18, 32, 9); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.roundRect(-42, SY + sw + 1, 16, 30, 9); ctx.fill()
    ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(-34, SY + sw + 36, 13, 11, 0.2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.ellipse(-34, SY + sw + 35, 11, 9, 0.2, 0, Math.PI*2); ctx.fill()
    // brazo der
    ctx.fillStyle = OL; ctx.beginPath(); ctx.roundRect(26, SY - sw, 18, 32, 9); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.roundRect(26, SY - sw + 1, 16, 30, 9); ctx.fill()
    ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(34, SY - sw + 36, 13, 11, -0.2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill; ctx.beginPath(); ctx.ellipse(34, SY - sw + 35, 11, 9, -0.2, 0, Math.PI*2); ctx.fill()
  }

  // ══════════════════════════════════════════════════════
  //  CABEZA — enorme y redonda, rasgo más icónico
  // ══════════════════════════════════════════════════════

  // Orejas (detrás de la cabeza)
  for (const ex of [-(HR - 8), HR - 8]) {
    ctx.fillStyle = OL
    ctx.beginPath(); ctx.arc(ex, hcy - HR + 12, 17, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furFill
    ctx.beginPath(); ctx.arc(ex, hcy - HR + 12, 14, 0, Math.PI*2); ctx.fill()
    // interior oreja rosa
    ctx.fillStyle = earIn
    ctx.beginPath(); ctx.arc(ex, hcy - HR + 12, 8, 0, Math.PI*2); ctx.fill()
  }

  if (isUltra) { ctx.shadowBlur = 28; ctx.shadowColor = glowC }

  // cabeza — outline grueso
  ctx.fillStyle = OL
  ctx.beginPath(); ctx.arc(0, hcy, HR + 3, 0, Math.PI*2); ctx.fill()
  // cabeza — relleno
  ctx.fillStyle = furFill
  ctx.beginPath(); ctx.arc(0, hcy, HR, 0, Math.PI*2); ctx.fill()
  // sombra sutil en la parte inferior
  const headShade = ctx.createRadialGradient(8, hcy - 14, 4, 0, hcy, HR)
  headShade.addColorStop(0, isPlayer ? 'rgba(255,255,255,0)' : 'rgba(210,160,80,0)')
  headShade.addColorStop(1, isPlayer ? 'rgba(200,190,180,0.35)' : 'rgba(120,60,10,0.35)')
  ctx.fillStyle = headShade
  ctx.beginPath(); ctx.arc(0, hcy, HR, 0, Math.PI*2); ctx.fill()
  ctx.shadowBlur = 0

  // ── HOCICO (muzzle) ───────────────────────────────────
  // outline hocico
  ctx.fillStyle = OL
  ctx.beginPath(); ctx.ellipse(0, hcy + 22, 22, 17, 0, 0, Math.PI*2); ctx.fill()
  // relleno hocico — color más claro que el cuerpo
  ctx.fillStyle = muzzle
  ctx.beginPath(); ctx.ellipse(0, hcy + 21, 20, 15, 0, 0, Math.PI*2); ctx.fill()

  // nariz — oval pequeña oscura (estilo Milk & Mocha)
  ctx.fillStyle = OL
  ctx.beginPath()
  ctx.arc(-3, hcy + 13, 4.5, Math.PI, 0)
  ctx.arc(3,  hcy + 13, 4.5, Math.PI, 0)
  ctx.lineTo(0, hcy + 20); ctx.closePath(); ctx.fill()
  // brillito nariz
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath(); ctx.ellipse(-2, hcy + 11, 2.5, 1.8, 0, 0, Math.PI*2); ctx.fill()

  // boca kawaii — W suave
  ctx.strokeStyle = OL; ctx.lineWidth = 2.2; ctx.lineCap = 'round'
  if (isUltra) {
    ctx.beginPath(); ctx.arc(0, hcy + 28, 7, 0.1, Math.PI - 0.1)
    ctx.fillStyle = '#1a0808'; ctx.fill(); ctx.stroke()
  } else if (isHurt) {
    ctx.beginPath()
    ctx.moveTo(-6, hcy + 30); ctx.quadraticCurveTo(0, hcy + 26, 6, hcy + 30); ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(-8, hcy + 24)
    ctx.quadraticCurveTo(-4, hcy + 30, 0, hcy + 25)
    ctx.quadraticCurveTo(4,  hcy + 30, 8, hcy + 24)
    ctx.stroke()
  }

  // ── OJOS — estilo Milk & Mocha: negros grandes con punto blanco ──
  const eyeY = hcy - 4
  const eL = -16, eR = 16

  if (isHurt) {
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round'
    for (const ex of [eL, eR]) {
      ctx.beginPath(); ctx.moveTo(ex - 7, eyeY - 7); ctx.lineTo(ex + 7, eyeY + 7); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(ex + 7, eyeY - 7); ctx.lineTo(ex - 7, eyeY + 7); ctx.stroke()
    }
    // lágrima gota kawaii
    ctx.fillStyle = 'rgba(100,180,255,0.90)'
    ctx.beginPath(); ctx.ellipse(eL - 2, eyeY + 14, 4, 7, 0.2, 0, Math.PI*2); ctx.fill()
  } else {
    for (const ex of [eL, eR]) {
      // ojo negro grande (sin esclerótica blanca — estilo más fiel)
      ctx.fillStyle = OL
      ctx.beginPath(); ctx.arc(ex, eyeY, 10, 0, Math.PI*2); ctx.fill()
      // brillo blanco — característica clave de Milk & Mocha
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(ex + 4, eyeY - 4, 4, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(ex - 3, eyeY + 3, 2, 0, Math.PI*2); ctx.fill()
    }
    // pestañas delicadas solo para Milk
    if (isPlayer) {
      ctx.strokeStyle = OL; ctx.lineWidth = 1.8; ctx.lineCap = 'round'
      for (const ex of [eL, eR]) {
        ctx.beginPath(); ctx.moveTo(ex - 7, eyeY - 8); ctx.lineTo(ex - 9, eyeY - 13); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(ex,     eyeY - 10); ctx.lineTo(ex,    eyeY - 15); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(ex + 7, eyeY - 8); ctx.lineTo(ex + 9, eyeY - 13); ctx.stroke()
      }
    }
  }

  // ── MOFLETES — óvalos rosas redondos, signo más icónico ──
  ctx.fillStyle = cheekC
  ctx.beginPath(); ctx.ellipse(eL - 16, eyeY + 12, 14, 9, 0, 0, Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(eR + 16, eyeY + 12, 14, 9, 0, 0, Math.PI*2); ctx.fill()

  // ── CEJAS expresivas ─────────────────────────────────
  ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round'
  const brow = isUltra ? -5 : isHurt ? 5 : 0
  ctx.beginPath()
  ctx.moveTo(eL - 10, eyeY - 14 + brow)
  ctx.quadraticCurveTo(eL, eyeY - 19 + brow, eL + 10, eyeY - 14 + brow)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(eR - 10, eyeY - 14 + brow)
  ctx.quadraticCurveTo(eR, eyeY - 19 + brow, eR + 10, eyeY - 14 + brow)
  ctx.stroke()

  // ── LACITO en la cabeza 🎀 (igual que en los stickers) ──
  const bwx = 0, bwy = hcy - HR - 2
  ctx.shadowBlur = 6; ctx.shadowColor = isPlayer ? '#f090a8' : '#70b8d8'
  ctx.fillStyle = isPlayer ? '#f4a0b8' : '#80c4e0'
  // ala izq
  ctx.beginPath()
  ctx.moveTo(bwx - 2, bwy + 4)
  ctx.quadraticCurveTo(bwx - 20, bwy - 14, bwx - 24, bwy - 2)
  ctx.quadraticCurveTo(bwx - 20, bwy + 14, bwx - 2, bwy + 8)
  ctx.closePath(); ctx.fill()
  // ala der
  ctx.beginPath()
  ctx.moveTo(bwx + 2, bwy + 4)
  ctx.quadraticCurveTo(bwx + 20, bwy - 14, bwx + 24, bwy - 2)
  ctx.quadraticCurveTo(bwx + 20, bwy + 14, bwx + 2, bwy + 8)
  ctx.closePath(); ctx.fill()
  // nudo central
  ctx.fillStyle = isPlayer ? '#ee6888' : '#50a8cc'
  ctx.beginPath(); ctx.ellipse(bwx, bwy + 5, 8, 7, 0, 0, Math.PI*2); ctx.fill()
  ctx.shadowBlur = 0

  // ── EFECTO DE DAÑO ───────────────────────────────────
  if (isHurt) {
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#ff3366'
    ctx.beginPath(); ctx.ellipse(0, hcy, HR + 10, HR + 40, 0, 0, Math.PI*2); ctx.fill()
    ctx.globalAlpha = 1
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI*2 + fc * 0.15
      ctx.font = '14px serif'; ctx.textAlign = 'center'
      ctx.fillText('💫', Math.cos(a) * 44, hcy - HR - 18 + Math.sin(a) * 10)
    }
  }

  ctx.restore()
}

// ── Draw hit effects ──────────────────────────────────────
function drawHitFX() {
  hitEffects.value.forEach(e => {
    const p = e.life / e.maxLife
    const dy = (1 - p) * 50
    ctx.save()
    ctx.globalAlpha = p
    ctx.font = `bold ${Math.round(13 + (1 - p) * 6)}px 'Press Start 2P', monospace`
    ctx.fillStyle = e.color
    ctx.shadowBlur = 25; ctx.shadowColor = e.color
    ctx.textAlign = 'center'
    ctx.fillText(e.text, e.x, e.y - dy)
    ctx.restore()
    e.life--
  })
  hitEffects.value = hitEffects.value.filter(e => e.life > 0)
}

// ── Background: neon city stage ────────────────────────────
const bg = { buildings: [], midBuildings: [] }
function initBg() {
  // Mutate in-place so forEach references never break
  bg.buildings.length = 0
  for (let i = 0; i < 9; i++) bg.buildings.push({ x: i * 100 - 50, w: 70 + Math.random() * 50, h: 100 + Math.random() * 120 })
  bg.midBuildings.length = 0
  for (let i = 0; i < 7; i++) bg.midBuildings.push({ x: i * 115, w: 55 + Math.random() * 40, h: 80 + Math.random() * 90 })
}

function drawBg() {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
  sky.addColorStop(0, '#060010')
  sky.addColorStop(0.7, '#130022')
  sky.addColorStop(1, '#1a0035')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GROUND)

  // Moon
  ctx.shadowBlur = 35; ctx.shadowColor = 'rgba(255,240,200,0.4)'
  ctx.fillStyle = 'rgba(255,245,210,0.92)'
  ctx.beginPath(); ctx.arc(W - 80, 55, 32, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#060010'
  ctx.beginPath(); ctx.arc(W - 66, 48, 28, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0

  // Stars
  const starSeeds = [23,61,97,131,173,199,241,277,313,347,389,421,457,491]
  for (let i = 0; i < starSeeds.length; i++) {
    const s = starSeeds[i]
    const sx = (s * 47) % W, sy = (s * 29) % 110
    ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(frameCount * 0.035 + i) * 0.5})`
    ctx.fillRect(sx, sy, 1.5, 1.5)
  }

  // Far buildings
  for (let bi = 0; bi < bg.buildings.length; bi++) {
    const b = bg.buildings[bi]
    if (!b) continue
    const g = ctx.createLinearGradient(b.x, GROUND - b.h, b.x, GROUND)
    g.addColorStop(0, '#180a28'); g.addColorStop(1, '#0e0618')
    ctx.fillStyle = g; ctx.fillRect(b.x, GROUND - b.h, b.w, b.h)
    for (let wy = GROUND - b.h + 10; wy < GROUND - 8; wy += 16) {
      for (let wx = b.x + 5; wx < b.x + b.w - 8; wx += 13) {
        const lit = Math.sin(wx * 0.4 + wy * 0.15 + frameCount * 0.008) > 0.5
        ctx.fillStyle = lit ? 'rgba(255,220,100,0.85)' : 'rgba(60,40,100,0.35)'
        ctx.fillRect(wx, wy, 8, 10)
      }
    }
    if (b.w > 80) {
      ctx.fillStyle = `rgba(180,0,255,${0.15 + Math.sin(frameCount * 0.025) * 0.08})`
      ctx.fillRect(b.x + b.w/2 - 18, GROUND - b.h + 6, 36, 4)
    }
  }

  // Mid buildings
  for (let bi = 0; bi < bg.midBuildings.length; bi++) {
    const b = bg.midBuildings[bi]
    if (!b) continue
    const g = ctx.createLinearGradient(b.x, GROUND - b.h, b.x, GROUND)
    g.addColorStop(0, '#241040'); g.addColorStop(1, '#160c30')
    ctx.fillStyle = g; ctx.fillRect(b.x, GROUND - b.h, b.w, b.h)
    for (let wy = GROUND - b.h + 8; wy < GROUND - 5; wy += 14) {
      for (let wx = b.x + 5; wx < b.x + b.w - 6; wx += 11) {
        const lit = Math.sin(wx * 0.3 + wy * 0.18 + frameCount * 0.006) > 0.3
        ctx.fillStyle = lit ? 'rgba(80,200,255,0.7)' : 'rgba(30,20,70,0.3)'
        ctx.fillRect(wx, wy, 7, 9)
      }
    }
  }

  // Ground platform
  const gGrad = ctx.createLinearGradient(0, GROUND, 0, H)
  gGrad.addColorStop(0, '#1e0840')
  gGrad.addColorStop(0.3, '#120620')
  gGrad.addColorStop(1, '#08040f')
  ctx.fillStyle = gGrad; ctx.fillRect(0, GROUND, W, H - GROUND)

  // Ground tiles (perspective grid)
  ctx.strokeStyle = 'rgba(180,0,255,0.16)'; ctx.lineWidth = 1
  for (let d = 0; d < 6; d++) {
    const gy = GROUND + d * 18
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
  }
  const vx = W / 2
  for (let i = 0; i <= 12; i++) {
    const gx = (W / 12) * i
    ctx.beginPath(); ctx.moveTo(gx, GROUND); ctx.lineTo(vx + (gx - vx) * 3.5, H + 50); ctx.stroke()
  }

  // Ground glow line
  ctx.strokeStyle = 'rgba(180,0,255,0.6)'; ctx.lineWidth = 2.5
  ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(180,0,255,0.9)'
  ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke()
  ctx.shadowBlur = 0
}

// ── Update ────────────────────────────────────────────────
function update() {
  // Player jump
  if (!player.onGround) {
    player.jumpVY += 1.0
    player.y += player.jumpVY
    if (player.y >= GROUND) { player.y = GROUND; player.jumpVY = 0; player.onGround = true; if (player.state === 'jump') player.state = 'idle' }
  }
  // Move
  if ((keys['ArrowLeft'] || keys['a']) && gameState.value === 'playing')
    { player.x = Math.max(50, player.x - 5); if (player.onGround && player.state === 'idle') player.state = 'walk' }
  if ((keys['ArrowRight'] || keys['d']) && gameState.value === 'playing')
    { player.x = Math.min(boss.x - 80, player.x + 5); if (player.onGround && player.state === 'idle') player.state = 'walk' }
  if (player.state === 'walk' && !keys['ArrowLeft'] && !keys['a'] && !keys['ArrowRight'] && !keys['d']) player.state = 'idle'

  // State timers
  if (player.stateTimer > 0) { player.stateTimer--; if (player.stateTimer === 0 && player.state !== 'jump') player.state = 'idle' }
  if (boss.stateTimer > 0)   { boss.stateTimer--;   if (boss.stateTimer === 0) boss.state = 'idle' }

  // Facing
  player.facing = boss.x > player.x ? 1 : -1
  boss.facing   = player.x < boss.x ? -1 : 1

  // Boss jump physics
  if (!boss.onGround) {
    boss.jumpVY += 1.0; boss.y += boss.jumpVY
    if (boss.y >= GROUND) { boss.y = GROUND; boss.jumpVY = 0; boss.onGround = true; if (boss.state === 'jump') boss.state = 'idle' }
  }

  // Boss AI — comportamiento agresivo por fases según HP
  if (boss.state === 'idle' && gameState.value === 'playing') {
    boss.attackCooldown = (boss.attackCooldown ?? 50) - 1

    // Fase 2: boss < 60% HP → se pone agresivo
    // Fase 3: boss < 30% HP → modo BERSERKER
    const bossRatio = bossHP.value / 100
    const phase = bossRatio < 0.3 ? 3 : bossRatio < 0.6 ? 2 : 1

    if (boss.attackCooldown <= 0) {
      const r = Math.random()
      const dist = Math.abs(boss.x - player.x)

      // PERSECUCIÓN: el boss siempre intenta acercarse al jugador
      if (dist > 110) {
        const speed = phase === 3 ? 6 : phase === 2 ? 5 : 3
        boss.x = Math.max(player.x + 75, boss.x - speed)
      }

      // ATAQUES — frecuencia y daño escalan con la fase
      const attackChance = phase === 3 ? 0.82 : phase === 2 ? 0.68 : 0.50
      if (r < attackChance && dist < 190) {
        // En fase 3 el boss puede hacer ultra
        const roll = Math.random()
        let type, dmg
        if (phase === 3 && roll < 0.25) {
          type = 'ultra'
          dmg = 22 + Math.random() * 14   // ultra del boss: 22-36
        } else if (roll < 0.45) {
          type = 'kick'
          dmg = phase === 3 ? (20 + Math.random() * 14)   // fase 3: 20-34
              : phase === 2 ? (16 + Math.random() * 12)   // fase 2: 16-28
              :               (11 + Math.random() * 9)    // fase 1: 11-20
        } else {
          type = 'punch'
          dmg = phase === 3 ? (13 + Math.random() * 10)   // fase 3: 13-23
              : phase === 2 ? (10 + Math.random() * 9)    // fase 2: 10-19
              :               (7  + Math.random() * 7)    // fase 1:  7-14
        }

        // Bloqueo del jugador: si está en animación de ataque recibe 30% menos
        if (['punch','kick','ultra'].includes(player.state)) dmg *= 0.7

        playerHP.value = Math.max(0, playerHP.value - dmg)
        boss.state = type
        boss.stateTimer = type === 'ultra' ? 48 : type === 'kick' ? 32 : 28
        spawnHit(player.x + 10, player.y - 140 - Math.random() * 30, `-${Math.floor(dmg)}`, '#ff4444')
        screenShake()
        playSound('hurt')
        if (Math.random() < 0.55) showBubble('attack')
        if (playerHP.value <= 0) { playSound('lose'); gameState.value = 'lost'; cancelAnimationFrame(animFrame) }

      } else if (dist > 190 || r > attackChance) {
        // Salto evasivo ocasional (más frecuente en fases altas)
        const jumpChance = phase === 3 ? 0.45 : phase === 2 ? 0.30 : 0.18
        if (Math.random() < jumpChance && boss.onGround) {
          boss.jumpVY = phase === 3 ? -15 : -13
          boss.onGround = false; boss.state = 'jump'
        }
      }

      // Cooldown más corto en fases avanzadas
      const minCd = phase === 3 ? 18 : phase === 2 ? 28 : 40
      const maxCd = phase === 3 ? 35 : phase === 2 ? 50 : 70
      boss.attackCooldown = minCd + Math.floor(Math.random() * (maxCd - minCd))

      // Aviso visual de fase (solo una vez por fase)
      if (phase === 2 && !boss._phase2warned) {
        boss._phase2warned = true
        spawnHit(boss.x, boss.y - 200, '😤 FURIOSO', '#ff8800')
        showBubble('phase2')
      }
      if (phase === 3 && !boss._phase3warned) {
        boss._phase3warned = true
        spawnHit(boss.x, boss.y - 200, '🔥 BERSERKER!', '#ff2200')
        showBubble('phase3')
      }

      // Burbujas idle periódicas
      bubbleCooldown--
      if (bubbleCooldown <= 0 && boss.state === 'idle') {
        showBubble('idle')
        bubbleCooldown = 180 + Math.floor(Math.random() * 120)
      }
    }
  }

  if (shakeTimer.value > 0) shakeTimer.value--
}

// ── Main loop ─────────────────────────────────────────────
function draw() {
  if (!canvas.value) return
  frameCount++

  const shk = shakeTimer.value > 0 ? (Math.random() * 6 - 3) : 0
  ctx.save()
  if (shk !== 0) ctx.translate(shk, shk * 0.5)

  ctx.clearRect(-10, -10, W + 20, H + 20)
  update()
  drawBg()
  drawFighter(player, true)
  drawFighter(boss, false)
  drawHitFX()
  drawBossBubble()

  // FIGHT! intro text
  if (frameCount < 70) {
    const a = Math.max(0, 1 - frameCount / 70)
    const sc = 1 + (1 - frameCount / 70) * 0.3
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(W / 2, H / 2 - 20)
    ctx.scale(sc, sc)
    ctx.font = "bold 56px 'Press Start 2P', monospace"
    ctx.fillStyle = '#ffdd00'
    ctx.shadowBlur = 50; ctx.shadowColor = '#ff8800'
    ctx.textAlign = 'center'
    ctx.fillText('FIGHT!', 0, 0)
    ctx.restore()
  }

  ctx.restore()
  animFrame = requestAnimationFrame(draw)
}

// ── Start game ────────────────────────────────────────────
function startGame() {
  playerHP.value = 100; bossHP.value = 150; combo.value = 0
  frameCount = 0; hitEffects.value = []
  player = makeChar(110, GROUND, 1)
  boss   = makeChar(600, GROUND, -1)
  boss.attackCooldown = 50   // empieza a atacar más rápido
  countdownVal.value = 3
  gameState.value = 'countdown'
  initBg()

  // Draw loop during countdown
  const drawCd = () => {
    try {
      frameCount++
      if (ctx) { ctx.clearRect(0,0,W,H); drawBg() }
      if (ctx) { drawFighter(player, true); drawFighter(boss, false) }
    } catch(err) { console.error('[drawCd error]', err) }
    if (gameState.value === 'countdown') requestAnimationFrame(drawCd)
  }
  requestAnimationFrame(drawCd)

  countdownInterval = setInterval(() => {
    countdownVal.value--
    if (countdownVal.value <= 0) {
      clearInterval(countdownInterval)
      frameCount = 0
      gameState.value = 'playing'
      draw()
    }
  }, 1000)
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  initBg()
  frameCount = 0
  drawBg()
  drawFighter(player, true)
  drawFighter(boss, false)
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
  clearInterval(countdownInterval)
  cancelAnimationFrame(animFrame)
})

const BOSS_MAX_HP  = 150
const playerHPPct  = computed(() => Math.max(0, playerHP.value))
const bossHPPct    = computed(() => Math.max(0, bossHP.value / BOSS_MAX_HP * 100))
const playerHPBg   = computed(() => playerHP.value > 50 ? 'linear-gradient(90deg,#00c8ff,#0055ff)' : playerHP.value > 25 ? 'linear-gradient(90deg,#ffcc00,#ff7700)' : 'linear-gradient(90deg,#ff2200,#ff0055)')
const bossHPBg     = computed(() => bossHP.value > 90  ? 'linear-gradient(90deg,#ff7700,#ff1060)' : bossHP.value > 45  ? 'linear-gradient(90deg,#ffcc00,#ff5500)' : 'linear-gradient(90deg,#ff0000,#880000)')
</script>

<template>
  <div class="fw" id="fighter-game">
    <button class="bk font-pixel" @click="router.push('/arcade')" id="back-arcade">← ARCADE</button>

    <!-- HUD -->
    <div class="hud" id="fighter-hud">
      <div class="hp-side" id="player-hp">
        <span class="fname font-pixel pname">{{ store.birthdayPerson || 'TÚ' }}</span>
        <div class="hptrack"><div class="hpfill" :style="{ width: playerHPPct+'%', background: playerHPBg }"/></div>
        <span class="hpnum font-pixel">{{ Math.ceil(playerHP) }}</span>
      </div>
      <div class="hud-mid">
        <div class="r1 font-pixel">R1</div>
        <Transition name="cb">
          <div v-if="combo >= 2" class="combo font-pixel" :key="combo">x{{ combo }} COMBO</div>
        </Transition>
      </div>
      <div class="hp-side rev" id="boss-hp">
        <span class="hpnum font-pixel">{{ Math.ceil(bossHP) }}</span>
        <div class="hptrack"><div class="hpfill bfill" :style="{ width: bossHPPct+'%', background: bossHPBg }"/></div>
        <span class="fname font-pixel bname">BOSS</span>
      </div>
    </div>

    <!-- Stage -->
    <div class="sw" id="fighter-stage">
      <canvas ref="canvas" :width="W" :height="H" id="fighter-canvas" class="sc"/>
      <Transition name="page">
        <div v-if="gameState === 'countdown'" class="cdov" aria-live="assertive">
          <span class="cdnum font-pixel" :key="countdownVal">{{ countdownVal }}</span>
        </div>
      </Transition>
    </div>

    <!-- Buttons -->
    <div v-if="['playing','countdown'].includes(gameState)" class="mp" id="fighter-controls">
      <button class="mb" @click="doPlayerAttack('punch')" id="btn-punch"><span class="mi">👊</span><span class="mn font-pixel">GOLPE</span><kbd class="mk">Z</kbd></button>
      <button class="mb sp" @click="doPlayerAttack('kick')"  id="btn-kick" ><span class="mi">🦵</span><span class="mn font-pixel">PATADA</span><kbd class="mk">X</kbd></button>
      <button class="mb ul" @click="doPlayerAttack('ultra')" id="btn-ultra"><span class="mi">💥</span><span class="mn font-pixel">ULTRA</span><kbd class="mk">C</kbd></button>
      <button class="mb jb" @click="() => { if(player.onGround){ player.jumpVY=-16; player.onGround=false; player.state='jump' }}" id="btn-jump"><span class="mi">⬆️</span><span class="mn font-pixel">SALTAR</span><kbd class="mk">W</kbd></button>
    </div>

    <!-- WAITING overlay -->
    <Transition name="page">
    <div v-if="gameState === 'waiting'" class="ov" id="fighter-start-ov" role="dialog" aria-modal="true">
      <div class="oc fc">
        <div class="vsb">
          <div class="cp"><div class="cs">🤍</div><span class="cl font-pixel">{{ store.birthdayPerson || 'TÚ' }}</span></div>
          <span class="vs font-pixel">VS</span>
          <div class="cp"><div class="cs bs">🤎</div><span class="cl font-pixel">BOSS</span></div>
        </div>
        <h2 class="ot font-pixel text-neon-pink">OSO FIGHTERS 🐻</h2>
        <p class="os">Milk 🤍 vs Mocha 🤎</p>
        <div class="cg">
          <div class="ci"><kbd class="ky">Z</kbd><span>Golpe</span></div>
          <div class="ci"><kbd class="ky">X</kbd><span>Patada</span></div>
          <div class="ci"><kbd class="ky">C</kbd><span>ULTRA / Hadouken</span></div>
          <div class="ci"><kbd class="ky">W</kbd><span>Saltar</span></div>
          <div class="ci"><kbd class="ky">A / D</kbd><span>Moverse</span></div>
          <div class="ci goal"><span class="font-pixel" style="color:#ffdd00;font-size:0.45rem">HP boss = 0 → GANAS</span></div>
        </div>
        <div class="name-row">
          <label class="font-pixel name-lbl">¿Cómo te llamas? 🐾</label>
          <input class="name-inp" v-model="store.birthdayPerson" maxlength="12" placeholder="Tu nombre" />
        </div>
        <button class="fb font-pixel" @click="startGame" id="fighter-play-btn">⚔️ PELEAR</button>
      </div>
    </div>
    </Transition>

    <!-- WON overlay -->
    <Transition name="page">
    <div v-if="gameState === 'won'" class="ov" id="fighter-won" role="dialog" aria-modal="true">
      <div class="oc wc">
        <div class="ko font-pixel text-neon-yellow">K.O.</div>
        <h2 class="ot font-pixel text-neon-green">¡GANASTE!</h2>
        <p class="ul font-pixel">🔓 Jump Quest desbloqueado</p>
        <div class="br">
          <button class="fb sec font-pixel" @click="startGame" id="fighter-retry-w">↺ REVANCHA</button>
          <button class="fb font-pixel" @click="router.push('/arcade')" id="fighter-arc">← ARCADE</button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- LOST overlay -->
    <Transition name="page">
    <div v-if="gameState === 'lost'" class="ov" id="fighter-lost" role="dialog" aria-modal="true">
      <div class="oc lc">
        <div class="ko font-pixel text-neon-pink">K.O.!</div>
        <h2 class="ot font-pixel" style="color:#ff6688">GAME OVER</h2>
        <div class="br">
          <button class="fb font-pixel" @click="startGame" id="fighter-retry">↺ REINTENTAR</button>
          <button class="fb sec font-pixel" @click="router.push('/arcade')" id="fighter-back">← ARCADE</button>
        </div>
      </div>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.fw{width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(ellipse at top,rgba(100,0,160,0.15)0%,transparent 55%),#070710;position:relative;overflow:hidden}
.bk{position:absolute;top:14px;left:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(180,0,255,0.2);color:rgba(200,150,255,0.7);padding:7px 14px;font-size:0.42rem;border-radius:6px;cursor:pointer;transition:.2s;z-index:10}
.bk:hover{background:rgba(180,0,255,0.1);color:#cc88ff}

/* HUD */
.hud{display:flex;align-items:center;gap:12px;width:min(760px,95vw);padding:8px 14px;background:rgba(0,0,0,0.65);border:1px solid rgba(180,0,255,0.2);border-radius:8px;backdrop-filter:blur(10px)}
.hp-side{display:flex;align-items:center;gap:8px;flex:1}
.rev{flex-direction:row-reverse}
.fname{font-size:0.4rem;white-space:nowrap}
.pname{color:#00c8ff;text-shadow:0 0 10px rgba(0,200,255,.8)}
.bname{color:#ff2060;text-shadow:0 0 10px rgba(255,32,96,.8)}
.hpnum{font-size:0.5rem;min-width:28px;text-align:center;color:rgba(255,255,255,.7)}
.hptrack{flex:1;height:16px;background:rgba(255,255,255,.07);border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.07)}
.hpfill{height:100%;border-radius:8px;transition:width .12s ease;box-shadow:0 0 12px rgba(0,200,255,.35)}
.bfill{float:right;box-shadow:0 0 12px rgba(255,60,80,.35)}
.hud-mid{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:60px}
.r1{font-size:0.45rem;color:rgba(255,255,255,.5);background:rgba(180,0,255,.18);border:1px solid rgba(180,0,255,.25);border-radius:4px;padding:2px 7px}
.combo{font-size:0.55rem;color:#ffdd00;text-shadow:0 0 14px rgba(255,220,0,.8);animation:pulse-glow .3s ease;white-space:nowrap}

/* Stage */
.sw{position:relative;border-radius:8px;overflow:hidden;border:2px solid rgba(180,0,255,.35);box-shadow:0 0 60px rgba(100,0,180,.2)}
.sc{display:block;max-width:95vw;max-height:calc(100vh - 230px)}
.cdov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.28);pointer-events:none}
.cdnum{font-size:clamp(3rem,10vw,5.5rem);color:#ffdd00;text-shadow:0 0 50px rgba(255,220,0,.9),0 0 100px rgba(255,100,0,.5);animation:zoom-in .4s ease}

/* Attack buttons */
.mp{display:flex;gap:10px}
.mb{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 18px;cursor:pointer;transition:.15s;min-width:72px}
.mb:hover,.mb:active{transform:scale(1.06);background:rgba(0,200,255,.1);border-color:rgba(0,200,255,.4);box-shadow:0 0 18px rgba(0,200,255,.25)}
.mb.sp:hover{background:rgba(180,0,255,.1);border-color:rgba(180,0,255,.4);box-shadow:0 0 18px rgba(180,0,255,.25)}
.mb.ul{background:rgba(180,0,255,.07);border-color:rgba(180,0,255,.22)}
.mb.ul:hover{background:rgba(180,0,255,.18);border-color:rgba(255,100,255,.55);box-shadow:0 0 24px rgba(180,0,255,.4)}
.mb.jb:hover{background:rgba(0,255,136,.07);border-color:rgba(0,255,136,.28)}
.mi{font-size:1.25rem}.mn{font-size:0.35rem;color:rgba(255,255,255,.65)}.mk{font-family:var(--font-pixel);font-size:0.35rem;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);border-bottom:2px solid rgba(255,255,255,.25);border-radius:3px;padding:1px 5px;color:rgba(255,255,255,.45)}

/* Overlays */
.ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,4,14,.87);backdrop-filter:blur(12px);z-index:20}
.oc{background:rgba(255,255,255,.04);border:1px solid rgba(180,0,255,.28);border-radius:16px;padding:30px 38px;display:flex;flex-direction:column;align-items:center;gap:16px;max-width:430px;width:92%;box-shadow:0 0 80px rgba(100,0,180,.12);animation:zoom-in .3s ease}
.fc{border-color:rgba(255,32,96,.28)}.wc{border-color:rgba(0,255,136,.28);box-shadow:0 0 60px rgba(0,255,136,.07)}.lc{border-color:rgba(255,32,96,.38)}
.vsb{display:flex;align-items:center;gap:20px;justify-content:center;width:100%}
.cp{display:flex;flex-direction:column;align-items:center;gap:4px}.cs{font-size:3rem;animation:float 3s ease-in-out infinite}.bs{animation-delay:-1.5s}.cl{font-size:0.4rem;color:rgba(255,255,255,.55);letter-spacing:.1em}
.vs{font-size:1.1rem;color:#ffdd00;text-shadow:0 0 20px rgba(255,220,0,.8)}
.ot{font-size:clamp(.65rem,2.5vw,.9rem);letter-spacing:.1em;text-align:center}
.os{font-size:.75rem;color:var(--color-text-muted);font-style:italic;margin-top:-8px}
.cg{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
.ci{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:8px 6px}
.ci span{font-size:.7rem;color:var(--color-text-muted);text-align:center}
.ci.goal{grid-column:1/-1;border-color:rgba(255,220,0,.15);background:rgba(255,220,0,.05)}
.ky{font-family:var(--font-pixel);font-size:.45rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-bottom:2px solid rgba(255,255,255,.28);border-radius:4px;padding:2px 8px;color:#00c8ff}
.ko{font-size:clamp(2rem,7vw,3rem);letter-spacing:.15em;animation:zoom-in .4s ease}
.ul{font-size:.55rem;color:var(--color-neon-green);text-shadow:var(--shadow-neon-green);letter-spacing:.06em}
.br{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.fb{border:none;border-radius:8px;padding:12px 24px;font-size:.55rem;letter-spacing:.08em;cursor:pointer;background:linear-gradient(135deg,#cc0055,#8800cc);color:#fff;box-shadow:0 0 24px rgba(180,0,255,.28);transition:.15s}
.fb:hover{transform:scale(1.05);box-shadow:0 0 40px rgba(180,0,255,.45)}
.fb.sec{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:var(--color-text-muted);box-shadow:none}
.fb.sec:hover{background:rgba(255,255,255,.12);color:var(--color-text);box-shadow:none}

/* combo enter */
.cb-enter-active{animation:zoom-in .2s ease}

/* Name input */
.name-row{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%}
.name-lbl{font-size:0.4rem;color:rgba(255,255,255,.55);letter-spacing:.06em}
.name-inp{background:rgba(255,255,255,.07);border:1px solid rgba(0,200,255,.25);border-radius:8px;color:#fff;font-family:inherit;font-size:0.9rem;padding:8px 14px;text-align:center;width:180px;outline:none;transition:.2s}
.name-inp:focus{border-color:rgba(0,200,255,.6);box-shadow:0 0 14px rgba(0,200,255,.2);background:rgba(255,255,255,.1)}
.name-inp::placeholder{color:rgba(255,255,255,.25)}
</style>
