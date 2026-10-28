<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showPress = ref(false)
const titleVisible = ref(false)

onMounted(() => {
  setTimeout(() => { titleVisible.value = true }, 300)
  setTimeout(() => { showPress.value = true }, 1200)
})

function enter() {
  router.push('/arcade')
}
</script>

<template>
  <div class="intro" @click="enter" @keydown.enter="enter" @keydown.space="enter" tabindex="0" id="intro-screen">
    <!-- Stars background -->
    <div class="stars">
      <span v-for="i in 80" :key="i" class="star" :style="{
        left: Math.random() * 100 + '%',
        top: Math.random() * 100 + '%',
        width: (Math.random() * 3 + 1) + 'px',
        height: (Math.random() * 3 + 1) + 'px',
        animationDelay: (Math.random() * 3) + 's',
        animationDuration: (Math.random() * 2 + 2) + 's',
      }" />
    </div>

    <!-- Floating coin icon -->
    <div class="coin" :class="{ visible: titleVisible }">🪙</div>

    <!-- Title -->
    <div class="title-wrap" :class="{ visible: titleVisible }">
      <h1 class="main-title font-pixel text-neon-cyan">THE</h1>
      <h1 class="main-title big font-pixel text-neon-pink">BIRTHDAY</h1>
      <h1 class="main-title font-pixel text-neon-yellow">ARCADE</h1>
    </div>

    <!-- Subtitle -->
    <p class="subtitle" :class="{ visible: titleVisible }">
      Un lugar especial creado para ti 🎮
    </p>

    <!-- Press start -->
    <div class="press-start font-pixel" :class="{ visible: showPress }" id="press-start-btn">
      PRESS START
    </div>

    <!-- Bottom credits -->
    <p class="credits" :class="{ visible: showPress }">
      INSERT COIN TO PLAY
    </p>
  </div>
</template>

<style scoped>
.intro {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  cursor: pointer;
  outline: none;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at center, #0d0025 0%, #0a0a0f 70%);
}

/* Stars */
.stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.star {
  position: absolute;
  border-radius: 50%;
  background: white;
  animation: pulse-glow var(--duration, 2s) ease-in-out infinite;
  opacity: 0.7;
}

/* Coin */
.coin {
  font-size: 3rem;
  opacity: 0;
  transform: translateY(-20px);
  transition: all 0.6s ease;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 0 16px rgba(255, 230, 0, 0.8));
}
.coin.visible { opacity: 1; transform: translateY(0); }

/* Title */
.title-wrap {
  text-align: center;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.8s ease 0.2s;
}
.title-wrap.visible { opacity: 1; transform: translateY(0); }

.main-title {
  font-size: clamp(1rem, 4vw, 2rem);
  letter-spacing: 0.1em;
  line-height: 1.4;
  animation: flicker 5s ease-in-out infinite;
}
.main-title.big {
  font-size: clamp(1.6rem, 7vw, 3.5rem);
  animation-delay: 0.3s;
}

/* Subtitle */
.subtitle {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
  opacity: 0;
  transition: opacity 0.6s ease 0.4s;
}
.subtitle.visible { opacity: 1; }

/* Press start */
.press-start {
  margin-top: 24px;
  font-size: clamp(0.6rem, 2vw, 0.85rem);
  color: var(--color-neon-green);
  text-shadow: var(--shadow-neon-green);
  letter-spacing: 0.12em;
  opacity: 0;
  transition: opacity 0.6s ease;
  animation: pulse-glow 1s ease-in-out infinite;
}
.press-start.visible { opacity: 1; }

/* Credits */
.credits {
  position: absolute;
  bottom: 24px;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  letter-spacing: 0.3em;
  font-family: var(--font-pixel);
  opacity: 0;
  transition: opacity 0.6s ease 0.2s;
}
.credits.visible { opacity: 0.5; }
</style>
