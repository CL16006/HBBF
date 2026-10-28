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
const bossHP     = ref(100)
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

// ── Hit effects ──────────────────────────────────────────
function spawnHit(x, y, text, color) {
  hitEffects.value.push({ x, y, text, color, life: 50, maxLife: 50 })
}

function screenShake() { shakeTimer.value = 8 }

// ── Attacks ───────────────────────────────────────────────
function doPlayerAttack(type) {
  if (gameState.value !== 'playing') return
  if (['ultra', 'hurt'].includes(player.state)) return

  let dmg = 0, txt = '', color = '#ffff00'
  if (type === 'punch') { dmg = 9 + Math.random()*8;  player.state = 'punch'; player.stateTimer = 28; txt = 'HIT!';  color = '#00f5ff' }
  if (type === 'kick')  { dmg = 16 + Math.random()*10; player.state = 'kick';  player.stateTimer = 32; txt = 'KICK!'; color = '#ff88ff' }
  if (type === 'ultra') { dmg = 30 + Math.random()*18; player.state = 'ultra'; player.stateTimer = 48; txt = '🔥 ULTRA!'; color = '#ffdd00' }

  dmg *= (1 + combo.value * 0.12)
  bossHP.value = Math.max(0, bossHP.value - dmg)
  boss.state = 'hurt'; boss.stateTimer = 18
  screenShake()
  combo.value++
  clearTimeout(comboResetTimer)
  comboResetTimer = setTimeout(() => { combo.value = 0 }, 1800)

  spawnHit(boss.x - 10, boss.y - 160 - Math.random()*40, txt, color)

  if (bossHP.value <= 0) {
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
    player.jumpVY = -16; player.onGround = false; player.state = 'jump'
  }
}
function onKeyUp(e) { delete keys[e.key] }

// ═══════════════════════════════════════════════════════
//  DRAW FIGHTER — Cute Bear sprite 🐻
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

  // Player bear = honey/cream | Boss bear = dark charcoal
  const furMain    = isPlayer ? '#e8c88a'  : '#3a2020'
  const furLight   = isPlayer ? '#f5dfa0'  : '#5a3030'
  const furDark    = isPlayer ? '#c8a060'  : '#250f0f'
  const bellyColor = isPlayer ? '#f7e8c8'  : '#4a2a2a'
  const muzzleC    = isPlayer ? '#f5e0c0'  : '#5a3535'
  const noseColor  = isPlayer ? '#220a0a'  : '#110005'
  const bandColor  = isPlayer ? '#dd2222'  : '#6600cc'
  const scarfColor = isPlayer ? '#1a55cc'  : '#cc1122'
  const gloveC     = isPlayer ? '#dd3311'  : '#1133dd'
  const glowC      = isPlayer ? 'rgba(255,200,60,0.7)' : 'rgba(255,40,80,0.6)'
  const eyeColor   = isPlayer ? '#3a88ff'  : '#ff3333'
  const cheekC     = isPlayer ? 'rgba(255,140,130,0.55)' : 'rgba(200,80,80,0.45)'

  const bob  = isIdle ? Math.sin(fc * 0.06) * 2.5 : 0
  const shk  = isHurt ? (Math.random() * 7 - 3.5) : 0

  ctx.save()
  ctx.translate(px + shk, 0)
  if (f.facing === -1) ctx.scale(-1, 1)

  // Shadow
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath(); ctx.ellipse(0, py + 4, 38, 10, 0, 0, Math.PI * 2); ctx.fill()

  if (isUltra) { ctx.shadowBlur = 50; ctx.shadowColor = glowC }

  // Body positions
  const footY    = py
  const legTopY  = footY - 55
  const bellyBot = footY - 52
  const bellyTop = footY - 145
  const shoulderY = bellyTop + 14
  const headCY   = footY - 185 + bob
  const headR    = 30

  // ── LEGS ──────────────────────────────────────────────
  ctx.shadowBlur = 0
  if (isKick && t > 16) {
    // Planted leg
    ctx.fillStyle = furDark
    ctx.beginPath(); ctx.roundRect(-20, legTopY, 18, 54, [9,9,18,18]); ctx.fill()
    ctx.fillStyle = furMain
    ctx.beginPath(); ctx.roundRect(-18, legTopY, 16, 52, [9,9,16,16]); ctx.fill()
    ctx.fillStyle = furDark
    ctx.beginPath(); ctx.ellipse(-10, footY + 2, 14, 10, 0, 0, Math.PI*2); ctx.fill()
    // Kick leg
    const ext = Math.min((32 - t) / 8, 1)
    ctx.fillStyle = furMain
    ctx.beginPath()
    ctx.moveTo(10, legTopY+2); ctx.lineTo(26, legTopY+2)
    ctx.lineTo(38 + ext*30, legTopY - 16 - ext*9)
    ctx.lineTo(22 + ext*26, legTopY - 20 - ext*9)
    ctx.closePath(); ctx.fill()
    ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(255,180,0,0.6)'
    ctx.fillStyle = furMain
    ctx.beginPath(); ctx.ellipse(44 + ext*32, legTopY - 22 - ext*10, 14, 11, -0.4, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = muzzleC
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(38 + ext*32 + i*6, legTopY - 30 - ext*10, 3, 0, Math.PI*2); ctx.fill()
    }
    ctx.shadowBlur = 0
  } else {
    const wbl = isIdle ? Math.sin(fc * 0.07) * 1 : 0
    for (let leg = -1; leg <= 1; leg += 2) {
      const lx = leg === -1 ? -19 : 3
      const lw = 18
      ctx.fillStyle = leg === -1 ? furDark : furMain
      ctx.beginPath(); ctx.roundRect(lx + wbl*leg, legTopY, lw, 38, [10,10,4,4]); ctx.fill()
      ctx.fillStyle = leg === -1 ? furMain : furDark
      ctx.beginPath(); ctx.roundRect(lx - 1 + wbl*leg, legTopY + 34, lw+2, 22, [4,4,12,12]); ctx.fill()
      ctx.fillStyle = furDark
      ctx.beginPath(); ctx.ellipse(lx + lw/2 + wbl*leg, footY+3, lw/2+4, 8, 0, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = furLight
      ctx.beginPath(); ctx.ellipse(lx + lw/2 + wbl*leg, footY+2, lw/2+2, 6, 0, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = muzzleC
      for (let t2 = 0; t2 < 3; t2++) {
        ctx.beginPath(); ctx.arc(lx+4+t2*5+wbl*leg, footY-2, 2.5, 0, Math.PI*2); ctx.fill()
      }
    }
  }

  // ── BODY (chubby round bear belly) ────────────────────
  ctx.fillStyle = furDark
  ctx.beginPath()
  ctx.ellipse(0, (bellyTop+bellyBot)/2, 36, (bellyBot-bellyTop)/2+6, 0, 0, Math.PI*2)
  ctx.fill()
  const bodyG = ctx.createRadialGradient(-8, bellyTop+20, 5, 0, (bellyTop+bellyBot)/2, 40)
  bodyG.addColorStop(0, furLight); bodyG.addColorStop(0.5, furMain); bodyG.addColorStop(1, furDark)
  ctx.fillStyle = bodyG
  ctx.beginPath()
  ctx.ellipse(0, (bellyTop+bellyBot)/2, 32, (bellyBot-bellyTop)/2+2, 0, 0, Math.PI*2)
  ctx.fill()
  // Belly patch
  const blG = ctx.createRadialGradient(0, bellyBot-28, 2, 0, bellyBot-28, 24)
  blG.addColorStop(0, bellyColor); blG.addColorStop(1, 'rgba(247,232,200,0)')
  ctx.fillStyle = blG
  ctx.beginPath(); ctx.ellipse(0, bellyBot-28, 20, 28, 0, 0, Math.PI*2); ctx.fill()
  // Little scarf/belt
  ctx.fillStyle = scarfColor
  ctx.shadowBlur = 8; ctx.shadowColor = scarfColor
  ctx.beginPath(); ctx.roundRect(-28, bellyBot-18, 56, 11, 5); ctx.fill()
  ctx.fillStyle = isPlayer ? '#2266ff' : '#ff3322'
  ctx.beginPath(); ctx.ellipse(0, bellyBot-13, 9, 7, 0, 0, Math.PI*2); ctx.fill()
  ctx.shadowBlur = 0

  // ── ARMS ──────────────────────────────────────────────
  if (isPunch && t > 10) {
    // Back arm
    ctx.fillStyle = furDark
    ctx.beginPath(); ctx.roundRect(-44, shoulderY, 18, 42, 9); ctx.fill()
    ctx.fillStyle = furMain
    ctx.beginPath(); ctx.roundRect(-42, shoulderY, 16, 40, 9); ctx.fill()
    ctx.fillStyle = gloveC
    ctx.beginPath(); ctx.ellipse(-34, shoulderY+48, 13, 11, 0.3, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath(); ctx.ellipse(-37, shoulderY+44, 5, 4, 0.3, 0, Math.PI*2); ctx.fill()
    // Punch arm
    const ext = Math.min((28-t)/7, 1.0)
    ctx.shadowBlur = 28; ctx.shadowColor = glowC
    ctx.fillStyle = furDark
    ctx.beginPath()
    ctx.moveTo(26,shoulderY); ctx.lineTo(26,shoulderY+18)
    ctx.lineTo(26+56*ext,shoulderY+14); ctx.lineTo(26+56*ext,shoulderY-4)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = furMain
    ctx.beginPath()
    ctx.moveTo(28,shoulderY+2); ctx.lineTo(28,shoulderY+16)
    ctx.lineTo(28+52*ext,shoulderY+12); ctx.lineTo(28+52*ext,shoulderY-2)
    ctx.closePath(); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = gloveC
    ctx.shadowBlur = 22; ctx.shadowColor = glowC
    ctx.beginPath(); ctx.ellipse(30+56*ext, shoulderY+5, 16, 14, 0, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.beginPath(); ctx.ellipse(26+56*ext, shoulderY+1, 6, 5, 0, 0, Math.PI*2); ctx.fill()
    ctx.shadowBlur = 0

  } else if (isUltra) {
    const pulse = Math.sin(fc*0.35)*4
    // Both arms up
    ctx.fillStyle = furDark
    ctx.beginPath(); ctx.roundRect(-46, shoulderY-12, 17, 38, 9); ctx.fill()
    ctx.fillStyle = furMain
    ctx.beginPath(); ctx.roundRect(-44, shoulderY-12, 15, 38, 9); ctx.fill()
    ctx.fillStyle = gloveC; ctx.shadowBlur = 20; ctx.shadowColor = glowC
    ctx.beginPath(); ctx.ellipse(-36, shoulderY-20, 14, 12, -0.4, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furDark
    ctx.beginPath(); ctx.roundRect(29, shoulderY-12, 17, 38, 9); ctx.fill()
    ctx.fillStyle = furMain
    ctx.beginPath(); ctx.roundRect(29, shoulderY-12, 15, 38, 9); ctx.fill()
    ctx.fillStyle = gloveC
    ctx.beginPath(); ctx.ellipse(37, shoulderY-20, 14, 12, 0.4, 0, Math.PI*2); ctx.fill()
    ctx.shadowBlur = 0
    // HONEY BALL ULTRA 🍯✨
    const orbX = 58, orbY = shoulderY-14, orbR = 26+pulse
    ctx.shadowBlur = 60; ctx.shadowColor = isPlayer ? '#ffcc00' : '#ff4466'
    const orbG = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, orbR)
    orbG.addColorStop(0, '#ffffff')
    orbG.addColorStop(0.3, isPlayer ? '#ffee88' : '#ff9944')
    orbG.addColorStop(0.7, isPlayer ? '#ffaa00' : '#ff2244')
    orbG.addColorStop(1, 'rgba(255,140,0,0)')
    ctx.fillStyle = orbG
    ctx.beginPath(); ctx.arc(orbX, orbY, orbR, 0, Math.PI*2); ctx.fill()
    for (let s = 0; s < 5; s++) {
      const ang = (s/5)*Math.PI*2 + fc*0.12
      ctx.strokeStyle = isPlayer ? 'rgba(255,200,0,0.7)' : 'rgba(255,80,80,0.7)'
      ctx.lineWidth = 2.5; ctx.shadowBlur = 0
      ctx.beginPath(); ctx.arc(orbX, orbY, orbR*0.65, ang, ang+0.9); ctx.stroke()
    }
    for (let sp = 0; sp < 4; sp++) {
      const ang = (sp/4)*Math.PI*2 + fc*0.08
      ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 0
      ctx.beginPath(); ctx.arc(orbX+Math.cos(ang)*(orbR+8), orbY+Math.sin(ang)*(orbR+8), 3+Math.sin(fc*0.2+sp)*1.5, 0, Math.PI*2); ctx.fill()
    }
    ctx.shadowBlur = 0

  } else {
    // Idle — cute arms dangling
    const sw = isIdle ? Math.sin(fc*0.06)*3 : 0
    ctx.fillStyle = furDark
    ctx.beginPath(); ctx.roundRect(-43, shoulderY+sw, 16, 38, 9); ctx.fill()
    ctx.fillStyle = furMain
    ctx.beginPath(); ctx.roundRect(-41, shoulderY+sw, 14, 38, 9); ctx.fill()
    ctx.fillStyle = gloveC
    ctx.beginPath(); ctx.ellipse(-34, shoulderY+46+sw, 13, 11, 0.2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.beginPath(); ctx.ellipse(-37, shoulderY+42+sw, 5, 4, 0.2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = furDark
    ctx.beginPath(); ctx.roundRect(27, shoulderY-sw, 16, 38, 9); ctx.fill()
    ctx.fillStyle = furMain
    ctx.beginPath(); ctx.roundRect(27, shoulderY-sw, 14, 38, 9); ctx.fill()
    ctx.fillStyle = gloveC
    ctx.beginPath(); ctx.ellipse(34, shoulderY+46-sw, 13, 11, -0.2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.beginPath(); ctx.ellipse(31, shoulderY+42-sw, 5, 4, -0.2, 0, Math.PI*2); ctx.fill()
  }

  // ── HEAD (big, round, adorable) ───────────────────────
  // Ears
  ctx.fillStyle = furDark
  ctx.beginPath(); ctx.arc(-22, headCY-headR+8, 13, 0, Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.arc(22,  headCY-headR+8, 13, 0, Math.PI*2); ctx.fill()
  ctx.fillStyle = furMain
  ctx.beginPath(); ctx.arc(-22, headCY-headR+8, 11, 0, Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.arc(22,  headCY-headR+8, 11, 0, Math.PI*2); ctx.fill()
  // Inner ear pink
  ctx.fillStyle = isPlayer ? 'rgba(255,140,130,0.85)' : 'rgba(180,80,80,0.75)'
  ctx.beginPath(); ctx.arc(-22, headCY-headR+8, 6, 0, Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.arc(22,  headCY-headR+8, 6, 0, Math.PI*2); ctx.fill()

  if (isUltra) { ctx.shadowBlur = 35; ctx.shadowColor = glowC }

  // Head sphere
  const hG = ctx.createRadialGradient(-8, headCY-10, 4, 0, headCY, headR)
  hG.addColorStop(0, furLight); hG.addColorStop(0.55, furMain); hG.addColorStop(1, furDark)
  ctx.fillStyle = hG
  ctx.beginPath(); ctx.arc(0, headCY, headR, 0, Math.PI*2); ctx.fill()
  ctx.shadowBlur = 0

  // Muzzle snout
  ctx.fillStyle = furDark
  ctx.beginPath(); ctx.ellipse(0, headCY+11, 16, 12, 0, 0, Math.PI*2); ctx.fill()
  ctx.fillStyle = muzzleC
  ctx.beginPath(); ctx.ellipse(0, headCY+10, 15, 11, 0, 0, Math.PI*2); ctx.fill()

  // Button nose
  ctx.fillStyle = noseColor
  ctx.beginPath()
  ctx.arc(-3, headCY+5, 4, Math.PI, 0)
  ctx.arc(3,  headCY+5, 4, Math.PI, 0)
  ctx.lineTo(0, headCY+11); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath(); ctx.ellipse(-2, headCY+3, 2, 1.5, 0, 0, Math.PI*2); ctx.fill()

  // Mouth
  ctx.strokeStyle = furDark; ctx.lineWidth = 2; ctx.lineCap = 'round'
  if (isUltra) {
    ctx.beginPath(); ctx.arc(0, headCY+16, 7, 0.15, Math.PI-0.15)
    ctx.fillStyle = '#220000'; ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#ff6688'
    ctx.beginPath(); ctx.ellipse(0, headCY+21, 5, 3.5, 0, 0, Math.PI*2); ctx.fill()
  } else if (isHurt) {
    ctx.beginPath()
    ctx.moveTo(-6, headCY+20); ctx.quadraticCurveTo(0, headCY+17, 6, headCY+20); ctx.stroke()
  } else {
    // Cute W mouth ✿
    ctx.beginPath()
    ctx.moveTo(-7, headCY+16)
    ctx.quadraticCurveTo(-3.5, headCY+21, 0, headCY+17)
    ctx.quadraticCurveTo(3.5, headCY+21, 7, headCY+16)
    ctx.stroke()
  }

  // Eyes
  const eyeY  = headCY - 4
  const eyeLX = -11, eyeRX = 11
  if (isHurt) {
    ctx.strokeStyle = eyeColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    for (const [ex, ey] of [[eyeLX, eyeY], [eyeRX, eyeY]]) {
      ctx.beginPath(); ctx.moveTo(ex-5, ey-5); ctx.lineTo(ex+5, ey+5); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(ex+5, ey-5); ctx.lineTo(ex-5, ey+5); ctx.stroke()
    }
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.ellipse(eyeLX, eyeY, 8, 8, 0, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(eyeRX, eyeY, 8, 8, 0, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = eyeColor
    ctx.beginPath(); ctx.arc(eyeLX, eyeY, 5.5, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeRX, eyeY, 5.5, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#000014'
    ctx.beginPath(); ctx.arc(eyeLX+0.5, eyeY+0.5, 3, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeRX+0.5, eyeY+0.5, 3, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath(); ctx.arc(eyeLX+2.5, eyeY-2.5, 2, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeLX-1.5, eyeY+2, 1, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeRX+2.5, eyeY-2.5, 2, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeRX-1.5, eyeY+2, 1, 0, Math.PI*2); ctx.fill()
    // Lashes
    ctx.strokeStyle = '#33114a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'
    for (const [ex, ey2] of [[eyeLX, eyeY], [eyeRX, eyeY]]) {
      for (let l = -1; l <= 1; l++) {
        ctx.beginPath(); ctx.moveTo(ex+l*5, ey2-7); ctx.lineTo(ex+l*6.5, ey2-11); ctx.stroke()
      }
    }
  }

  // Eyebrows
  ctx.strokeStyle = furDark; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
  const bl = isUltra ? -3 : isHurt ? 3 : 0
  ctx.beginPath()
  ctx.moveTo(eyeLX-8, eyeY-11+bl); ctx.quadraticCurveTo(eyeLX, eyeY-14+bl, eyeLX+8, eyeY-11+bl); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(eyeRX-8, eyeY-11+bl); ctx.quadraticCurveTo(eyeRX, eyeY-14+bl, eyeRX+8, eyeY-11+bl); ctx.stroke()

  // Rosy cheeks 🌸
  ctx.fillStyle = cheekC
  ctx.beginPath(); ctx.ellipse(eyeLX-12, eyeY+7, 9, 6, 0, 0, Math.PI*2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(eyeRX+12, eyeY+7, 9, 6, 0, 0, Math.PI*2); ctx.fill()

  // Bow on head 🎀
  const bowY = headCY - headR - 2
  ctx.fillStyle = bandColor
  ctx.shadowBlur = 10; ctx.shadowColor = bandColor
  ctx.beginPath()
  ctx.moveTo(-4, bowY); ctx.quadraticCurveTo(-20, bowY-10, -24, bowY-2)
  ctx.quadraticCurveTo(-20, bowY+10, -4, bowY+6); ctx.closePath(); ctx.fill()
  ctx.beginPath()
  ctx.moveTo(4, bowY); ctx.quadraticCurveTo(20, bowY-10, 24, bowY-2)
  ctx.quadraticCurveTo(20, bowY+10, 4, bowY+6); ctx.closePath(); ctx.fill()
  ctx.fillStyle = isPlayer ? '#ff3355' : '#7700dd'
  ctx.beginPath(); ctx.ellipse(0, bowY+3, 6, 5, 0, 0, Math.PI*2); ctx.fill()
  ctx.shadowBlur = 0

  // Hurt flash + stars
  if (isHurt) {
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#ff2200'
    ctx.beginPath()
    ctx.ellipse(0, (bellyTop+bellyBot)/2, 42, (bellyBot-bellyTop)/2+35, 0, 0, Math.PI*2)
    ctx.fill()
    ctx.globalAlpha = 1
    for (let s2 = 0; s2 < 3; s2++) {
      const ang = (s2/3)*Math.PI*2 + fc*0.15
      ctx.font = '14px serif'; ctx.textAlign = 'center'
      ctx.fillText('⭐', Math.cos(ang)*40, headCY-headR-18+Math.sin(ang)*10)
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

  // Boss AI
  if (boss.state === 'idle' && gameState.value === 'playing') {
    boss.attackCooldown = (boss.attackCooldown ?? 90) - 1
    if (boss.attackCooldown <= 0) {
      const r = Math.random()
      const dist = Math.abs(boss.x - player.x)
      if (r < 0.2 && dist > 120) {
        boss.x = Math.max(player.x + 80, boss.x - 4)
      } else if (r < 0.55 && dist < 200) {
        const type = Math.random() < 0.5 ? 'punch' : 'kick'
        const dmg = type === 'punch' ? (7 + Math.random() * 9) : (12 + Math.random() * 11)
        playerHP.value = Math.max(0, playerHP.value - dmg)
        boss.state = type; boss.stateTimer = type === 'punch' ? 28 : 32
        spawnHit(player.x + 10, player.y - 140 - Math.random() * 30, `-${Math.floor(dmg)}`, '#ff4444')
        screenShake()
        if (playerHP.value <= 0) { gameState.value = 'lost'; cancelAnimationFrame(animFrame) }
      } else if (r < 0.7 && boss.onGround) {
        boss.jumpVY = -13; boss.onGround = false; boss.state = 'jump'
      }
      boss.attackCooldown = 55 + Math.floor(Math.random() * 60)
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
  playerHP.value = 100; bossHP.value = 100; combo.value = 0
  frameCount = 0; hitEffects.value = []
  player = makeChar(110, GROUND, 1)
  boss   = makeChar(600, GROUND, -1)
  boss.attackCooldown = 90
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

const playerHPPct  = computed(() => Math.max(0, playerHP.value))
const bossHPPct    = computed(() => Math.max(0, bossHP.value))
const playerHPBg   = computed(() => playerHP.value > 50 ? 'linear-gradient(90deg,#00c8ff,#0055ff)' : playerHP.value > 25 ? 'linear-gradient(90deg,#ffcc00,#ff7700)' : 'linear-gradient(90deg,#ff2200,#ff0055)')
const bossHPBg     = computed(() => bossHP.value   > 50 ? 'linear-gradient(90deg,#ff7700,#ff1060)' : bossHP.value   > 25 ? 'linear-gradient(90deg,#ffcc00,#ff5500)' : 'linear-gradient(90deg,#ff0000,#880000)')
</script>

<template>
  <div class="fw" id="fighter-game">
    <button class="bk font-pixel" @click="router.push('/arcade')" id="back-arcade">← ARCADE</button>

    <!-- HUD -->
    <div class="hud" id="fighter-hud">
      <div class="hp-side" id="player-hp">
        <span class="fname font-pixel pname">TÚ</span>
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
          <div class="cp"><div class="cs">🥷</div><span class="cl font-pixel">TÚ</span></div>
          <span class="vs font-pixel">VS</span>
          <div class="cp"><div class="cs bs">💀</div><span class="cl font-pixel">BOSS</span></div>
        </div>
        <h2 class="ot font-pixel text-neon-pink">STREET FIGHTER</h2>
        <p class="os">Inspirado en el personaje Ryu</p>
        <div class="cg">
          <div class="ci"><kbd class="ky">Z</kbd><span>Golpe</span></div>
          <div class="ci"><kbd class="ky">X</kbd><span>Patada</span></div>
          <div class="ci"><kbd class="ky">C</kbd><span>ULTRA / Hadouken</span></div>
          <div class="ci"><kbd class="ky">W</kbd><span>Saltar</span></div>
          <div class="ci"><kbd class="ky">A / D</kbd><span>Moverse</span></div>
          <div class="ci goal"><span class="font-pixel" style="color:#ffdd00;font-size:0.45rem">HP boss = 0 → GANAS</span></div>
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
</style>
