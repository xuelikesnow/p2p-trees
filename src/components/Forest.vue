<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch, computed, shallowRef } from 'vue'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import ResponseNode from './ResponseNode.vue'
import { subscribe } from '../lib/storage.js'
import { computeLinks } from '../lib/connections.js'

const props = defineProps({
  width: { type: Number, default: 1200 },
  height: { type: Number, default: 800 },
})

// --- data layer -------------------------------------------------------------

// We keep nodes as plain mutable objects because d3-force mutates x/y/vx/vy
// in place; wrapping them in Vue's proxy would be slow. We use shallowRef +
// a manual "tick" counter to nudge re-renders on each simulation step.
const nodes = shallowRef([])
const links = shallowRef([])
const tick = ref(0)
const svgRef = ref(null)

// Outer bounds of the foreignObject each node is rendered into. Must be
// large enough to contain the longest responses; collision is computed from
// actual rendered content size (see measureNodes) rather than this box.
const NODE_BOX_W = 340
const NODE_BOX_H = 200

let simulation = null

// Rough-estimate a starting radius from text length before the DOM has had
// a chance to render. measureNodes() refines this with real bounding boxes
// once layout has happened.
function estimateRadius(response) {
  const whyLen = (response.why ?? '').length
  const speciesLen = (response.species ?? '').length
  const charsPerLine = 32 // conservative for mixed fonts
  const whyLines = Math.max(1, Math.ceil(whyLen / charsPerLine))
  const w = Math.min(NODE_BOX_W - 40, Math.max(speciesLen * 14, whyLen * 6.5))
  const h = 42 + whyLines * 22
  return Math.hypot(w, h) / 2 + 8
}

function rebuildGraph(responses) {
  const nextNodes = responses.map((r) => {
    const existing = nodes.value.find((n) => n.id === r.id)
    if (existing)
      return Object.assign(existing, r, { _radius: existing._radius ?? estimateRadius(r) })
    // Seed new nodes near the center with a small scatter so the simulation
    // doesn't start with everything stacked on one pixel.
    return {
      ...r,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
      _radius: estimateRadius(r),
    }
  })
  const nextLinks = computeLinks(responses)
  nodes.value = nextNodes
  links.value = nextLinks

  if (simulation) {
    simulation.nodes(nextNodes)
    simulation.force('link').links(nextLinks)
    simulation.alpha(1).restart()
  }
  // After Vue flushes and the browser paints, measure each node's actual
  // rendered size and update its collision radius for a tighter fit.
  nextTick(() => requestAnimationFrame(measureNodes))
}

// Read the real bounding box of every .response element and store a tight
// collision radius on the corresponding node. Called after renders.
function measureNodes() {
  if (!svgRef.value || !simulation) return
  const slots = svgRef.value.querySelectorAll('.node-slot')
  const scale = zoom.value || 1
  let changed = false
  slots.forEach((slot) => {
    const id = slot.getAttribute('data-node-id')
    const node = nodes.value.find((n) => n.id === id)
    if (!node) return
    const content = slot.querySelector('.response')
    if (!content) return
    const rect = content.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const w = rect.width / scale
    const h = rect.height / scale
    const next = Math.hypot(w, h) / 2 + 10
    if (Math.abs((node._radius ?? 0) - next) > 2) {
      node._radius = next
      changed = true
    }
  })
  if (changed) simulation.alpha(0.4).restart()
}

onMounted(() => {
  simulation = forceSimulation()
    .force(
      'link',
      forceLink()
        .id((d) => d.id)
        .distance((l) => (l.kind === 'species' ? 170 : 240))
        .strength((l) => l.strength * 0.55),
    )
    .force('charge', forceManyBody().strength(-500))
    .force('center', forceCenter(0, 0))
    // Per-node radius driven by measured content size; strength 1 for hard
    // non-overlap (nodes will push each other apart rather than gently repel).
    .force(
      'collide',
      forceCollide()
        .radius((d) => d._radius ?? 90)
        .strength(1)
        .iterations(3),
    )
    .alphaDecay(0.025)
    .on('tick', () => {
      tick.value++
    })

  const unsubscribe = subscribe((responses) => rebuildGraph(responses))

  // Re-measure once web fonts finish loading — initial measurements taken
  // before Typekit resolves will be slightly off, and font-load can shift
  // widths enough to cause overlap. Safe on browsers without document.fonts.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      requestAnimationFrame(measureNodes)
    })
  }

  onBeforeUnmount(() => {
    unsubscribe()
    simulation?.stop()
    simulation = null
  })
})

// --- pan / zoom -------------------------------------------------------------

const pan = ref({ x: 0, y: 0 })
const zoom = ref(1)
const isPanning = ref(false)
let panStart = null

const viewTransform = computed(
  () => `translate(${pan.value.x} ${pan.value.y}) scale(${zoom.value})`,
)

function onPointerDown(e) {
  if (e.button !== 0) return
  isPanning.value = true
  panStart = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y }
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onPointerMove(e) {
  if (!isPanning.value || !panStart) return
  pan.value = { x: e.clientX - panStart.x, y: e.clientY - panStart.y }
}
function onPointerUp() {
  isPanning.value = false
  panStart = null
}
function onWheel(e) {
  e.preventDefault()
  const delta = -e.deltaY * 0.0015
  const next = Math.min(2.5, Math.max(0.25, zoom.value * (1 + delta)))
  // Zoom toward the cursor so panning+zooming feels coherent.
  const rect = e.currentTarget.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const k = next / zoom.value
  pan.value = { x: cx - (cx - pan.value.x) * k, y: cy - (cy - pan.value.y) * k }
  zoom.value = next
}

function recenter() {
  pan.value = { x: props.width / 2, y: props.height / 2 }
  zoom.value = 1
}
watch(
  () => [props.width, props.height],
  () => {
    // Only auto-center on first size or if user hasn't panned.
    if (pan.value.x === 0 && pan.value.y === 0) recenter()
  },
  { immediate: true },
)

// --- link rendering ---------------------------------------------------------

// A link is drawn as a quadratic Bezier curve with a deterministic wobble
// derived from node ids, giving each root a unique, organic path.
function hashPair(a, b) {
  const s = a + '|' + b
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function linkPath(link) {
  // After forceSimulation ticks once, source/target are the node objects.
  const a = typeof link.source === 'object' ? link.source : null
  const b = typeof link.target === 'object' ? link.target : null
  if (!a || !b) return ''
  const h = hashPair(link.source.id ?? link.source, link.target.id ?? link.target)
  const wobble = ((h % 100) - 50) / 50 // -1..1
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // Perpendicular offset for the control point.
  const offset = 0.22 * len * wobble
  const cx = mx + (-dy / len) * offset
  const cy = my + (dx / len) * offset
  return `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`
}

// Word-links rotate through the warm palette (red / pink / orange) based on
// a stable hash of the link endpoints, so each root keeps the same color
// across renders but the forest reads as polychromatic. Species-links stay
// green as the "living" backbone of the network.
const WORD_INK_VARS = ['--ink-red', '--ink-pink', '--ink-orange']

function linkStroke(link) {
  if (link.kind === 'species') return 'var(--ink-green)'
  const h = Math.abs(hashPair(link.source.id ?? link.source, link.target.id ?? link.target))
  return `var(${WORD_INK_VARS[h % WORD_INK_VARS.length]})`
}

// Expose tick in template via _tickDep so reactive template recalculates on each frame.
// (computed values above depend on props, not on tick — we reference tick directly
// inside the template for paths/positions.)
// eslint-disable-next-line no-unused-vars
const _tickDep = computed(() => tick.value)
</script>

<template>
  <div class="forest-wrap">
    <svg
      ref="svgRef"
      class="forest"
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
      :class="{ panning: isPanning }"
    >
      <defs>
        <filter id="rough" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="2" />
        </filter>
      </defs>

      <g :transform="viewTransform">
        <!-- Roots (links) render behind nodes -->
        <g class="roots" :data-tick="tick">
          <path
            v-for="link in links"
            :key="(link.source.id ?? link.source) + '-' + (link.target.id ?? link.target)"
            :d="linkPath(link)"
            :class="['root', `root--${link.kind}`]"
            :style="{
              opacity: 0.4 + link.strength * 0.5,
              stroke: linkStroke(link),
            }"
          />
        </g>

        <!-- Nodes (responses) -->
        <g class="nodes" :data-tick="tick">
          <foreignObject
            v-for="node in nodes"
            :key="node.id"
            :data-node-id="node.id"
            :x="(node.x ?? 0) - NODE_BOX_W / 2"
            :y="(node.y ?? 0) - NODE_BOX_H / 2"
            :width="NODE_BOX_W"
            :height="NODE_BOX_H"
            class="node-slot"
          >
            <div xmlns="http://www.w3.org/1999/xhtml" class="node-slot-inner">
              <ResponseNode :response="node" />
            </div>
          </foreignObject>
        </g>
      </g>
    </svg>

    <div class="forest-controls">
      <button type="button" @click="recenter">recenter</button>
      <span class="hint">drag to pan * scroll to zoom</span>
    </div>

    <p v-if="nodes.length === 0" class="empty-state">
      the forest is empty.<br />
      plant the first tree.
    </p>
  </div>
</template>

<style scoped>
.forest-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.forest {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  background:
    radial-gradient(circle at 25% 18%, rgba(112, 192, 127, 0.1), transparent 60%),
    radial-gradient(circle at 78% 30%, rgba(241, 118, 163, 0.07), transparent 55%),
    radial-gradient(circle at 60% 85%, rgba(248, 158, 110, 0.08), transparent 55%),
    radial-gradient(circle at 15% 78%, rgba(226, 74, 57, 0.05), transparent 55%);
  touch-action: none;
}
.forest.panning {
  cursor: grabbing;
}

.root {
  fill: none;
  stroke-linecap: round;
  mix-blend-mode: multiply;
  pointer-events: none;
}
.root--species {
  /* stroke color is set inline (per-link) — here we just control weight/dash */
  stroke-width: 2.4;
  stroke-dasharray: none;
}
.root--word {
  stroke-width: 1.2;
  stroke-dasharray: 2 4;
}

.node-slot {
  overflow: visible;
}
.node-slot-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.forest-controls {
  position: absolute;
  left: 16px;
  bottom: 14px;
  display: flex;
  gap: 14px;
  align-items: center;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-green);
}
.forest-controls button {
  font: inherit;
  background: var(--paper);
  border: 1px solid currentColor;
  color: inherit;
  padding: 4px 10px;
  cursor: pointer;
  letter-spacing: inherit;
  text-transform: inherit;
}
.forest-controls button:hover {
  background: var(--ink-green);
  color: var(--paper);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  text-align: center;
  font-family: var(--serif-display);
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  font-style: italic;
  color: var(--ink-green);
  opacity: 0.55;
  mix-blend-mode: multiply;
}
</style>
