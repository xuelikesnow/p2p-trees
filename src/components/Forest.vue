<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch, computed, shallowRef } from 'vue'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force'
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
// We render nodes as HTML in a sibling layer (not <foreignObject>) because
// iOS Safari does not reproject foreignObject contents when the parent
// <svg>'s viewBox changes. layerRef gives us a DOM root to query for node
// sizing via measureNodes().
const layerRef = ref(null)
// True until the first storage callback fires. With the Supabase backend
// that happens after the initial network fetch; with localStorage it flips
// synchronously on mount. Drives the themed loading animation.
const loading = ref(true)

// Outer bounds of the foreignObject each node is rendered into. Must be
// large enough to contain the longest responses; collision is computed from
// actual rendered content size (see measureNodes) rather than this box.
const NODE_BOX_W = 340
const NODE_BOX_H = 200

let simulation = null

// Custom d3-force: push each node away from any edge it isn't an endpoint of.
// d3-force's built-in forceCollide handles node↔node overlap but can't see
// edges, so without this, unrelated responses can drift directly on top of a
// root line and visually "cross" another pair's connection.
//
// For each (node, edge) pair we compute the node's nearest-point distance to
// the straight segment A→B (our curves are a fairly gentle quadratic wobble
// on that segment — a straight-line approximation keeps the math O(N*E) and
// fast, and any residual overlap from the curve itself is small). If the
// node is within (radius + margin), we shove it perpendicular to the edge,
// away from it.
function makeEdgeAvoidForce({ margin = 18, strength = 0.7 } = {}) {
  let ns = []
  function force(alpha) {
    const ls = links.value
    if (!ls || ls.length === 0 || ns.length === 0) return
    for (let li = 0; li < ls.length; li++) {
      const link = ls[li]
      const a = link.source
      const b = link.target
      // d3-force replaces id strings with node objects after the first tick;
      // before that, skip.
      if (typeof a !== 'object' || typeof b !== 'object') continue
      const ax = a.x ?? 0
      const ay = a.y ?? 0
      const ex = (b.x ?? 0) - ax
      const ey = (b.y ?? 0) - ay
      const len2 = ex * ex + ey * ey
      if (len2 < 1) continue
      for (let ni = 0; ni < ns.length; ni++) {
        const n = ns[ni]
        if (n === a || n === b) continue
        if (n.fx != null || n.fy != null) continue
        const r = (n._radius ?? 80) + margin
        // Parameter t of the closest point on segment AB to node n, clamped
        // to [0, 1] so the closest point lives inside the segment and not
        // out past its endpoints.
        const nx = (n.x ?? 0) - ax
        const ny = (n.y ?? 0) - ay
        let t = (nx * ex + ny * ey) / len2
        if (t < 0) t = 0
        else if (t > 1) t = 1
        const cx = ax + t * ex
        const cy = ay + t * ey
        const dx = (n.x ?? 0) - cx
        const dy = (n.y ?? 0) - cy
        const d2 = dx * dx + dy * dy
        if (d2 >= r * r) continue
        let d = Math.sqrt(d2)
        let ux, uy
        if (d < 0.01) {
          // Node sits essentially on the edge — push it perpendicular to AB
          // in a deterministic direction (the edge's left-hand normal).
          const invLen = 1 / Math.sqrt(len2)
          ux = -ey * invLen
          uy = ex * invLen
          d = 0.01
        } else {
          ux = dx / d
          uy = dy / d
        }
        const push = (r - d) * strength * alpha
        n.vx += ux * push
        n.vy += uy * push
      }
    }
  }
  force.initialize = (_ns) => {
    ns = _ns
  }
  return force
}

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
  if (!layerRef.value || !simulation) return
  const slots = layerRef.value.querySelectorAll('.node-slot')
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
    // Gentle gravity toward the origin on both axes. Unlike `forceCenter`
    // (which only shifts the mean), these pull each individual node back
    // so disconnected responses don't drift off to the periphery.
    .force('x', forceX(0).strength(0.08))
    .force('y', forceY(0).strength(0.08))
    // Per-node radius driven by measured content size; strength 1 for hard
    // non-overlap (nodes will push each other apart rather than gently repel).
    .force(
      'collide',
      forceCollide()
        .radius((d) => d._radius ?? 90)
        .strength(1)
        .iterations(3),
    )
    // Keep nodes off of edges they aren't endpoints of, so roots don't
    // thread visibly under unrelated responses.
    .force('edgeAvoid', makeEdgeAvoidForce({ margin: 18, strength: 0.7 }))
    .alphaDecay(0.025)
    // Keep the simulation lightly simmering forever instead of decaying to
    // zero. Combined with the velocity noise below, nodes breathe/drift
    // organically rather than freezing at a static equilibrium.
    .alphaTarget(0.02)
    .alphaMin(0.001)
    .velocityDecay(0.55)
    .on('tick', () => {
      // Tiny Brownian-style nudge per tick. Skip nodes that are fixed
      // (fx/fy set) so future drag interactions will pin correctly. The
      // gravity + collision forces above bound how far any one nudge can
      // carry a node, so the whole forest wanders gently without escaping.
      const ns = nodes.value
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i]
        if (n.fx != null || n.fy != null) continue
        n.vx = (n.vx || 0) + (Math.random() - 0.5) * 0.12
        n.vy = (n.vy || 0) + (Math.random() - 0.5) * 0.12
      }
      tick.value++
    })

  const unsubscribe = subscribe((responses) => {
    loading.value = false
    rebuildGraph(responses)
  })

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
//
// We pan/zoom by animating the SVG's *viewBox* rather than a <g transform>.
// That matters on iOS Safari: a transform on a <g> containing <foreignObject>
// does not repaint the HTML inside the foreignObject reliably during touch
// gestures, so nodes appear frozen while edges follow the transform. viewBox
// animation reprojects the whole SVG, which repaints foreignObjects correctly
// on every browser we care about.
//
// pan.{x,y} is the screen-pixel offset of the world origin inside the SVG.
// A world point (x, y) appears at screen pixel (pan.x + zoom*x, pan.y + zoom*y).
// That relationship matches the previous transform-based math, so everything
// downstream (d3-force coordinates, link paths, node x/y) stays untouched.

const pan = ref({ x: 0, y: 0 })
const zoom = ref(1)
const isPanning = ref(false)
let panStart = null

const viewBox = computed(() => {
  const w = Math.max(1, props.width) / zoom.value
  const h = Math.max(1, props.height) / zoom.value
  const vx = -pan.value.x / zoom.value
  const vy = -pan.value.y / zoom.value
  return `${vx} ${vy} ${w} ${h}`
})

// CSS transform applied to the HTML nodes layer. Produces the same world→
// screen mapping as the SVG viewBox above: a world point (x, y) ends up at
// screen pixel (pan.x + zoom*x, pan.y + zoom*y). transform-origin: 0 0 is
// set in CSS so translate+scale compose predictably.
const layerTransform = computed(
  () => `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})`,
)

// Active pointers indexed by pointerId. Lets us differentiate single-finger
// drag (pan) from two-finger gesture (pinch zoom) without needing the older
// gesture* events, which are Safari-only.
const pointers = new Map()
// Snapshot captured at the moment a two-finger gesture begins, used to
// compute zoom factor + keep the pinch midpoint stable in world space.
let pinchStart = null

function localPoint(e) {
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return { x: e.clientX, y: e.clientY }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function beginPinch() {
  if (pointers.size < 2) return
  const [p1, p2] = [...pointers.values()]
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  pinchStart = {
    distance: Math.max(1, Math.hypot(dx, dy)),
    midX: (p1.x + p2.x) / 2,
    midY: (p1.y + p2.y) / 2,
    zoom: zoom.value,
    pan: { ...pan.value },
  }
  // A running pan must not fight the pinch.
  isPanning.value = false
  panStart = null
}

function onPointerDown(e) {
  // Accept touch + pen + mouse-left. Mouse-right/middle still get skipped.
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const p = localPoint(e)
  pointers.set(e.pointerId, p)
  e.currentTarget.setPointerCapture?.(e.pointerId)

  if (pointers.size >= 2) {
    beginPinch()
  } else {
    isPanning.value = true
    panStart = { x: p.x - pan.value.x, y: p.y - pan.value.y }
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return
  const p = localPoint(e)
  pointers.set(e.pointerId, p)

  if (pointers.size >= 2 && pinchStart) {
    const [p1, p2] = [...pointers.values()]
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const dist = Math.hypot(dx, dy)
    const scale = dist / pinchStart.distance
    const nextZoom = Math.min(2.5, Math.max(0.25, pinchStart.zoom * scale))
    const effK = nextZoom / pinchStart.zoom
    // Keep the pinch anchor (the midpoint at the start of the gesture) fixed
    // to the same world-space point it was over when the gesture began.
    pan.value = {
      x: pinchStart.midX - (pinchStart.midX - pinchStart.pan.x) * effK,
      y: pinchStart.midY - (pinchStart.midY - pinchStart.pan.y) * effK,
    }
    zoom.value = nextZoom
    return
  }

  if (isPanning.value && panStart) {
    pan.value = { x: p.x - panStart.x, y: p.y - panStart.y }
  }
}

function onPointerUp(e) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchStart = null
  if (pointers.size === 0) {
    isPanning.value = false
    panStart = null
    return
  }
  // When lifting one finger of a pinch, hand control to the remaining
  // finger so panning continues smoothly instead of snapping.
  if (pointers.size === 1) {
    const [p] = [...pointers.values()]
    panStart = { x: p.x - pan.value.x, y: p.y - pan.value.y }
    isPanning.value = true
  }
}

function onWheel(e) {
  e.preventDefault()
  const delta = -e.deltaY * 0.0015
  const next = Math.min(2.5, Math.max(0.25, zoom.value * (1 + delta)))
  const { x: cx, y: cy } = localPoint(e)
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
// const WORD_INK_VARS = ['--ink-red', '--ink-pink', '--ink-orange']

function linkStroke(link) {
  return 'var(--ink-edge)'
  // if (link.kind === 'species') return 'var(--ink-green)'
  // const h = Math.abs(hashPair(link.source.id ?? link.source, link.target.id ?? link.target))
  // return `var(${WORD_INK_VARS[h % WORD_INK_VARS.length]})`
}

// Expose tick in template via _tickDep so reactive template recalculates on each frame.
// (computed values above depend on props, not on tick — we reference tick directly
// inside the template for paths/positions.)
// eslint-disable-next-line no-unused-vars
const _tickDep = computed(() => tick.value)
</script>

<template>
  <!-- Pinned title. Painted over the forest with multiply so nodes and
         roots behind it still show through. Non-interactive so drag-to-pan
         passes through. -->

  <div class="forest-wrap">
    <svg
      ref="svgRef"
      class="forest"
      :viewBox="viewBox"
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

      <!-- Roots (links). Rendered in SVG so they benefit from feTurbulence
           and stroke-dasharray; pan/zoom is applied via the SVG's viewBox
           so paths reproject correctly on every browser. -->
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
    </svg>

    <!-- Nodes live in an HTML layer stacked over the SVG instead of inside
         a <foreignObject>. iOS Safari does not reposition foreignObject
         HTML content when the parent viewBox or transform changes during
         touch gestures, which would leave nodes frozen while edges pan.
         A CSS-transformed HTML layer sidesteps the bug entirely. The layer
         itself has pointer-events: none so drag-to-pan passes through to
         the SVG underneath. -->
    <div
      ref="layerRef"
      class="nodes-layer"
      :data-tick="tick"
      :style="{ transform: layerTransform }"
    >
      <div
        v-for="node in nodes"
        :key="node.id"
        :data-node-id="node.id"
        class="node-slot"
        :style="{
          transform: `translate(${(node.x ?? 0) - NODE_BOX_W / 2}px, ${(node.y ?? 0) - NODE_BOX_H / 2}px)`,
          width: NODE_BOX_W + 'px',
          height: NODE_BOX_H + 'px',
        }"
      >
        <ResponseNode :response="node" />
      </div>
    </div>

    <div class="forest-controls">
      <button type="button" @click="recenter">recenter</button>
      <span class="hint">drag to pan * scroll to zoom</span>
    </div>

    <div v-if="loading" class="loading-state" aria-live="polite">
      <svg
        class="loading-sprout"
        viewBox="0 0 40 52"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <!-- Stem drawing in from the ground up -->
        <path class="sprout-stem" d="M20 50 C 20 40 20 32 20 22" stroke-width="1.6" />
        <!-- Two leaves unfurling on either side of the stem -->
        <path class="sprout-leaf sprout-leaf--left" d="M20 30 C 12 28 8 22 10 16" stroke-width="1.4" />
        <path class="sprout-leaf sprout-leaf--right" d="M20 26 C 28 24 32 18 30 12" stroke-width="1.4" />
      </svg>
      <p class="loading-text">
        listening for the forest<span class="dot">.</span><span class="dot">.</span><span
          class="dot"
          >.</span
        >
      </p>
    </div>

    <p v-else-if="nodes.length === 0" class="empty-state">
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
  /* Dragging to pan should never start a text selection across the nodes.
     Also suppress the iOS/Android long-press callout / tap highlight. */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

.forest {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  background:
    radial-gradient(circle at 25% 18%, rgba(112, 192, 127, 0.2), transparent 55%),
    radial-gradient(circle at 78% 30%, rgba(241, 118, 163, 0.2), transparent 55%),
    radial-gradient(circle at 60% 85%, rgba(248, 158, 110, 0.2), transparent 55%),
    radial-gradient(circle at 15% 78%, rgba(226, 74, 57, 0.2), transparent 55%);
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
  stroke-width: 2.4;
  stroke-dasharray: 4 4 1 4;
}

/* HTML nodes layer. Stacked above the SVG and pans/zooms via CSS transform.
   pointer-events: none so the SVG below still receives drag-to-pan; we don't
   have per-node interactions to preserve. transform-origin: 0 0 keeps the
   translate+scale math aligned with the SVG viewBox math. */
.nodes-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transform-origin: 0 0;
  will-change: transform;
}
.node-slot {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: 0 0;
  will-change: transform;
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

/* On narrow viewports, the hint ("drag to pan * scroll to zoom") collides
   with the colophon in the opposite corner. The wording is also misleading
   on touch devices — so we just drop it below 640px and keep only the
   recenter button, which is the only actionable control anyway. */
@media (max-width: 640px) {
  .forest-controls {
    gap: 8px;
    font-size: 10px;
  }
  .forest-controls .hint {
    display: none;
  }
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

/* --- loading state --------------------------------------------------------
   A small sprouting-seedling SVG with an ellipsis that pulses, echoing the
   "planting" metaphor. The stem and leaves draw themselves in using CSS
   dash animations, then the whole thing loops softly. */
.loading-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-align: center;
  color: var(--ink-green);
  opacity: 0.7;
  mix-blend-mode: multiply;
}
.loading-sprout {
  width: clamp(36px, 6vw, 56px);
  height: auto;
  color: var(--ink-green);
}
.loading-sprout .sprout-stem,
.loading-sprout .sprout-leaf {
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: sprout-grow 2.4s ease-in-out infinite;
}
.loading-sprout .sprout-leaf--left {
  animation-delay: 0.6s;
}
.loading-sprout .sprout-leaf--right {
  animation-delay: 1s;
}
@keyframes sprout-grow {
  0% {
    stroke-dashoffset: 60;
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  60%,
  80% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}
.loading-text {
  margin: 0;
  font-family: var(--serif-display);
  font-size: clamp(1rem, 1.8vw, 1.4rem);
  font-style: italic;
}
.loading-text .dot {
  display: inline-block;
  opacity: 0;
  animation: loading-dot 1.5s ease-in-out infinite;
}
.loading-text .dot:nth-child(1) {
  animation-delay: 0s;
}
.loading-text .dot:nth-child(2) {
  animation-delay: 0.25s;
}
.loading-text .dot:nth-child(3) {
  animation-delay: 0.5s;
}
@keyframes loading-dot {
  0%,
  60%,
  100% {
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
}
</style>
