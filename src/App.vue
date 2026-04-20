<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Forest from './components/Forest.vue'
import PlantDrawer from './components/PlantDrawer.vue'
import flower from './assets/flower.png'

const route = useRoute()
const router = useRouter()

// Drawer visibility is derived from the route so the URL reflects app
// state — shareable /plant links open the drawer on load, and the browser
// back button closes it cleanly.
const drawerOpen = computed(() => route.name === 'plant')

function openDrawer() {
  if (route.name !== 'plant') router.push({ name: 'plant' })
}
function closeDrawer() {
  if (route.name === 'plant') router.push({ name: 'forest' })
}

// About panel is purely local UI state (not URL-reflected) since it's
// transient info rather than a destination.
const showAbout = ref(false)

// Canvas sizing — the Forest component wants explicit width/height so its
// SVG viewBox matches the viewport. We observe the shell and feed in the
// measurements, debounced to a frame to avoid ResizeObserver loop warnings.
const shellRef = ref(null)
const canvasSize = ref({ w: 1200, h: 800 })
let ro = null
let raf = 0

function measure() {
  if (!shellRef.value) return
  const rect = shellRef.value.getBoundingClientRect()
  const next = { w: Math.round(rect.width), h: Math.round(rect.height) }
  if (next.w === canvasSize.value.w && next.h === canvasSize.value.h) return
  canvasSize.value = next
}

onMounted(() => {
  measure()
  ro = new ResizeObserver(() => {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      measure()
    })
  })
  if (shellRef.value) ro.observe(shellRef.value)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div ref="shellRef" class="shell">
    <!-- Full-bleed canvas. Sits beneath every other element. -->
    <Forest class="canvas" :width="canvasSize.w" :height="canvasSize.h" />

    <!-- Pinned title. Painted over the forest with multiply so nodes and
         roots behind it still show through. Non-interactive so drag-to-pan
         passes through. -->
    <header class="chrome chrome--title">
      <h1 class="title">
        <span class="title-line title-line--italic">do you think</span>
        <div class="heavy-container title-line title-line--heavy">
          <img :src="flower" alt="icon of a magnolia flower" />
          <span>trees</span>
        </div>
        <span class="title-line title-line--italic">remember us?</span>
      </h1>
    </header>

    <!-- Top-right chrome cluster: about + plant CTA. -->
    <div class="chrome chrome--top-right">
      <button
        class="about-toggle"
        type="button"
        :aria-expanded="showAbout"
        @click="showAbout = !showAbout"
      >
        {{ showAbout ? 'close' : 'about' }}
      </button>
      <button class="plant-btn" type="button" @click="openDrawer">
        plant a tree <span aria-hidden="true">→</span>
      </button>
    </div>

    <!-- About card slides out from the top-right just below the chrome. -->
    <transition name="fade">
      <section v-if="showAbout" class="about" role="complementary">
        <p>
          <em>Do You Think Trees Remember Us?</em> began with handwritten answers to one question:
          <strong>if you were a tree, what would you be and why?</strong>
        </p>
        <p>
          This forest gathers those answers online. Each response is a node; roots appear between
          responses that share a species or a meaningful word, making visible the quiet
          entanglements of how we describe ourselves. Drag to wander, scroll to zoom in and out of
          the canopy.
        </p>
        <p class="fine">Inspired by "Wood Wide Webs" by James Bridle.</p>
      </section>
    </transition>

    <!-- Colophon at the bottom-right corner. -->
    <footer class="chrome chrome--colophon">
      <span>Xue Jiang * April 2026</span>
    </footer>

    <!-- The submission drawer. Floats over the canvas with a backdrop. -->
    <PlantDrawer :open="drawerOpen" @close="closeDrawer" />
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Every chrome element lives in its own fixed slot on top of the canvas.
   `pointer-events: none` by default so drag/zoom passes through; individual
   interactive children re-enable it via `pointer-events: auto`. */
.chrome {
  position: absolute;
  z-index: 10;
  pointer-events: none;
}

.chrome > button,
.chrome a {
  pointer-events: auto;
}

/* --- title (top-left) ---------------------------------------------------- */

.chrome--title {
  top: clamp(14px, 2.5vh, 28px);
  left: clamp(16px, 3vw, 40px);
}

.title {
  margin: 0;
  font-family: var(--serif-display);
  font-weight: 400;
  line-height: 0.85;
  display: flex;
  flex-direction: column;
  mix-blend-mode: multiply;
  color: var(--ink-pink);
  font-size: clamp(1.5rem, min(4.5vw, 7vh), 3.25rem);
  user-select: none;
}
.title-line {
  display: inline-block;
}
.title-line--italic {
  font-weight: 700;
  font-style: italic;
  padding-left: 0.6em;
}
.title-line--heavy {
  font-family: var(--display-heavy);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ink-green);
  font-size: 1.8em;
  line-height: 0.85;
  transform: translateX(-0.05em);
}
.heavy-container {
  display: flex;
  align-items: center;
  gap: 0.1em;
}
.heavy-container img {
  width: auto;
  height: 1em;
  max-height: 10vh;
  mix-blend-mode: multiply;
}

/* --- top-right cluster --------------------------------------------------- */

.chrome--top-right {
  top: clamp(14px, 2.5vh, 28px);
  right: clamp(16px, 3vw, 40px);
  display: flex;
  align-items: center;
  gap: 12px;
}

.about-toggle {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  background: var(--paper);
  border: 1px solid var(--ink-ink);
  color: var(--ink-ink);
  padding: 7px 14px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.about-toggle:hover {
  background: var(--ink-ink);
  color: var(--paper);
}

.plant-btn {
  font-family: var(--display-heavy);
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  padding: 9px 20px;
  background: var(--ink-red);
  color: white;
  border: none;
  cursor: pointer;
  transform: rotate(-1.2deg);
  transition: transform 0.15s ease;
  box-shadow: 2px 3px 0 rgba(26, 31, 28, 0.1);
}
.plant-btn:hover {
  transform: rotate(-1.2deg) translateY(-2px);
}

/* --- about card ---------------------------------------------------------- */

.about {
  position: absolute;
  z-index: 9;
  top: clamp(68px, 9vh, 90px);
  right: clamp(16px, 3vw, 40px);
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100dvh - 140px);
  overflow-y: auto;
  pointer-events: auto;
  font-family: var(--serif-body);
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--ink-ink);
  padding: 16px 18px;
  border: 1.5px solid var(--ink-ink);
  border-left: 3px solid var(--ink-green);
  background: var(--paper);
  box-shadow: 3px 4px 0 rgba(26, 31, 28, 0.08);
}
.about p {
  margin: 0 0 10px;
}
.about p:last-child {
  margin-bottom: 0;
}
.about .fine {
  font-size: 0.82rem;
  font-style: italic;
  opacity: 0.7;
}

/* --- colophon (bottom-right) -------------------------------------------- */

.chrome--colophon {
  bottom: clamp(10px, 2vh, 20px);
  right: clamp(16px, 3vw, 40px);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-ink);
  opacity: 0.7;
  display: flex;
  gap: 10px;
  mix-blend-mode: multiply;
  user-select: none;
}
.sep {
  opacity: 0.7;
}

/* --- transitions --------------------------------------------------------- */

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
