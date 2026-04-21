<script setup>
import { computed } from 'vue'

const props = defineProps({
  response: { type: Object, required: true },
})

// Deterministic pseudo-randomness keyed off the response id so every render
// of the same node looks identical but each node looks distinct.
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

// Body-text pool for "wild" / default shapes.
const FONTS = [
  { family: '"degular-display", serif', style: 'normal', weight: 400 },
  { family: '"degular-display", serif', style: 'italic', weight: 400 },
  { family: '"degular-display", serif', style: 'normal', weight: 700 },
  { family: '"degular-display", serif', style: 'italic', weight: 700 },
  { family: '"Space Mono", monospace', style: 'normal', weight: 400 },
  { family: '"Space Mono", monospace', style: 'italic', weight: 400 },
  { family: '"louvette-pixel", sans-serif', style: 'normal', weight: 400 },
]

// Species pool. Heavier, display-forward.
const SPECIES_FONTS = [
  { family: '"louvette-pixel", sans-serif', style: 'normal', weight: 700 },
  { family: '"louvette-pixel", sans-serif', style: 'normal', weight: 700 },
  { family: '"degular-display", serif', style: 'normal', weight: 700 },
  { family: '"degular-display", serif', style: 'italic', weight: 700 },
  { family: '"Space Mono", monospace', style: 'normal', weight: 700 },
]

// All five spot inks — one ink per node so each submission reads as a
// single voice, echoing a 4+1 color riso pass.
const INKS = [
  'var(--ink-blue)',
  'var(--ink-green)',
  'var(--ink-red)',
  'var(--ink-pink)',
  'var(--ink-orange)',
]

// Species → typographic archetype. Longer, more-specific keys first so e.g.
// "weeping willow" resolves before a generic fallback.
const SHAPE_MAP = [
  ['droop', ['weeping willow', 'whomping willow', 'willow']],
  ['grove', ['aspen', 'cottonwood', 'poplar', 'birch']],
  [
    'tall',
    [
      'bristlecone',
      'redwood',
      'sequoia',
      'cypress',
      'eucalyptus',
      'cedar',
      'hemlock',
      'juniper',
      'bamboo',
      'spruce',
      'pine',
      'fir',
      'yew',
      'palm',
    ],
  ],
  [
    'stout',
    [
      'baobab',
      'banyan',
      'sycamore',
      'mahogany',
      'chestnut',
      'walnut',
      'ginkgo',
      'beech',
      'linden',
      'maple',
      'elm',
      'oak',
    ],
  ],
  ['petal', ['magnolia', 'dogwood', 'cherry blossom', 'cherry', 'plum blossom', 'plum']],
  [
    'orb',
    [
      'persimmon',
      'mandarin',
      'avocado',
      'coconut',
      'mulberry',
      'asian pear',
      'apple',
      'pear',
      'peach',
      'fig',
      'lemon',
      'orange',
      'olive',
    ],
  ],
]

function classifyShape(species) {
  const lc = (species || '').toLowerCase()
  for (const [shape, keys] of SHAPE_MAP) {
    for (const key of keys) {
      if (lc.includes(key)) return shape
    }
  }
  return 'default'
}

// Shapes whose species word does letter-level work.
const PER_LETTER_SHAPES = new Set(['droop', 'grove', 'petal', 'orb'])

// Per-letter style for the species word, based on its archetype.
function letterStyle(shape, i) {
  switch (shape) {
    case 'droop': {
      const dy = i * 1.3 + Math.sin(i * 1.1) * 1.6
      return { transform: `translateY(${dy.toFixed(2)}px)` }
    }
    case 'grove': {
      const dy = Math.sin(i * 0.9 + 0.4) * 3.2
      return { transform: `translateY(${dy.toFixed(2)}px)` }
    }
    case 'petal': {
      const r = ((i * 53) % 25) - 12 // -12..12 degrees — scattered blossoms
      return { transform: `rotate(${r}deg)` }
    }
    case 'orb': {
      const dy = Math.sin(i * 1.2) * 2.2
      return { transform: `translateY(${dy.toFixed(2)}px)` }
    }
    default:
      return {}
  }
}

// --- body-text layout helpers (the tree silhouette) -------------------------

// Spire / tall: each line has more words than the previous, forming an
// upward-expanding triangle. Line N holds N words, clamped so the widest
// line doesn't blow past the foreignObject.
function spireLines(text, maxWordsPerLine = 7) {
  const words = (text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let i = 0
  let n = 1
  while (i < words.length) {
    const take = Math.min(n, maxWordsPerLine, words.length - i)
    lines.push(words.slice(i, i + take).join(' '))
    i += take
    n = Math.min(n + 1, maxWordsPerLine)
  }
  return lines
}

// Droop / willow: split on natural punctuation into phrases, then fall back
// to word-chunking if there isn't enough punctuation to make a visible
// cascade. Returned phrases are rendered one per line, each indented further
// right so they drape diagonally like willow branches.
function droopPhrases(text) {
  if (!text) return []
  const raw = text
    .split(/(?<=[.,;:—!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (raw.length >= 3) return raw.slice(0, 9)
  const words = text.split(/\s+/).filter(Boolean)
  const target = Math.max(2, Math.ceil(words.length / 5))
  const chunks = []
  for (let i = 0; i < words.length; i += target) {
    chunks.push(words.slice(i, i + target).join(' '))
  }
  return chunks
}

// Petal: each word gets a deterministic micro-rotation, scattering across
// the block like blossoms on a branch.
function petalWords(text) {
  if (!text) return []
  return text.split(/(\s+)/).map((tok, i) => ({
    tok,
    space: /^\s+$/.test(tok),
    r: ((i * 31) % 19) - 9, // -9..9 degrees — each word shaken loose
  }))
}

const look = computed(() => {
  const h = hash(props.response.id || String(Math.random()))
  const pick = (arr, salt = 0) => arr[(h + salt) % arr.length]
  const sign = (salt) => (((h >> salt) & 1) === 0 ? -1 : 1)
  const range = (min, max, salt) => min + (((h >> salt) & 0xff) / 255) * (max - min)

  const whyFont = pick(FONTS, 1)
  const speciesFont = pick(SPECIES_FONTS, 2)
  const ink = pick(INKS, 4)

  return {
    rotation: sign(3) * range(0, 4.5, 5), // degrees
    whyFontFamily: whyFont.family,
    whyFontStyle: whyFont.style,
    whyFontWeight: whyFont.weight,
    speciesFontFamily: speciesFont.family,
    speciesFontStyle: speciesFont.style,
    speciesFontWeight: speciesFont.weight,
    ink,
    speciesSize: range(1.25, 2.0, 11).toFixed(2),
    whySize: range(0.82, 1.02, 13).toFixed(2),
    whyLetterSpacing: range(-0.01, 0.04, 17).toFixed(3),
    whyLineHeight: range(1.15, 1.45, 19).toFixed(2),
    offsetX: sign(23) * range(0, 10, 21),
    offsetY: sign(27) * range(0, 8, 25),
    showQuoteMark: (h & 0b100) !== 0,
  }
})

const shape = computed(() => classifyShape(props.response.species))

// Word-grouped letters for per-letter species treatments.
const speciesSegments = computed(() => {
  const s = props.response.species || '—'
  const tokens = s.split(/(\s+)/)
  let li = 0
  return tokens.map((tok) => {
    if (/^\s+$/.test(tok)) return { space: true, text: tok }
    const chars = Array.from(tok).map((ch) => {
      const entry = { ch, style: letterStyle(shape.value, li) }
      li++
      return entry
    })
    return { space: false, chars }
  })
})

// Shape-specific body-text breakdowns. All four run cheaply; only the one
// matching the current shape is actually rendered by the template.
const tallLines = computed(() => (shape.value === 'tall' ? spireLines(props.response.why) : []))
const droopLines = computed(() => (shape.value === 'droop' ? droopPhrases(props.response.why) : []))
const petalTokens = computed(() => (shape.value === 'petal' ? petalWords(props.response.why) : []))
</script>

<template>
  <div
    class="response"
    :class="`shape--${shape}`"
    :style="{
      transform: `translate(${look.offsetX}px, ${look.offsetY}px) rotate(${look.rotation}deg)`,
      color: look.ink,
    }"
  >
    <!-- Species word. Per-letter shapes render individual <span class="letter">
         so transforms don't reflow the baseline. -->
    <div
      class="species"
      :class="`species--${shape}`"
      :style="{
        fontFamily: look.speciesFontFamily,
        fontStyle: look.speciesFontStyle,
        fontWeight: look.speciesFontWeight,
        fontSize: look.speciesSize + 'rem',
      }"
    >
      <span v-if="look.showQuoteMark" class="mark" aria-hidden="true">“</span
      ><template v-if="PER_LETTER_SHAPES.has(shape)"
        ><template v-for="(seg, si) in speciesSegments" :key="si"
          ><template v-if="seg.space">{{ seg.text }}</template
          ><span v-else class="word"
            ><span v-for="(c, ci) in seg.chars" :key="ci" class="letter" :style="c.style">{{
              c.ch
            }}</span></span
          ></template
        ></template
      ><template v-else>{{ response.species || '—' }}</template>
    </div>

    <!-- Body text. Each archetype re-flows it into a tree silhouette. -->
    <div
      class="why"
      :class="`why--${shape}`"
      :style="{
        fontFamily: look.whyFontFamily,
        fontStyle: look.whyFontStyle,
        fontWeight: look.whyFontWeight,
        fontSize: look.whySize + 'rem',
        letterSpacing: look.whyLetterSpacing + 'em',
        lineHeight: look.whyLineHeight,
      }"
    >
      <!-- TALL / SPIRE — expanding triangle, line N has N words -->
      <template v-if="shape === 'tall'">
        <span v-for="(line, i) in tallLines" :key="i" class="tall-line">{{ line }}</span>
      </template>

      <!-- DROOP — cascading phrases, each indented further right -->
      <template v-else-if="shape === 'droop'">
        <span
          v-for="(line, i) in droopLines"
          :key="i"
          class="droop-line"
          :style="{ marginLeft: (i * 1.3).toFixed(2) + 'em' }"
          >{{ line }}</span
        >
      </template>

      <!-- ORB — soft round halo behind centered body text -->
      <template v-else-if="shape === 'orb'">
        <span class="orb-halo" aria-hidden="true"></span>
        <span class="orb-text">{{ response.why }}</span>
      </template>

      <!-- GROVE — single column + vertical “bark strip” (reads as many trunks;
           works for short answers where CSS columns never split). -->
      <template v-else-if="shape === 'grove'">
        <div class="grove-wrap">
          <span class="grove-bark" aria-hidden="true"></span>
          <p class="grove-body">{{ response.why }}</p>
        </div>
      </template>

      <!-- PETAL — words scattered with deterministic micro-rotations -->
      <template v-else-if="shape === 'petal'">
        <template v-for="(w, wi) in petalTokens" :key="wi"
          ><template v-if="w.space">{{ w.tok }}</template
          ><span v-else class="petal-word" :style="{ transform: `rotate(${w.r}deg)` }">{{
            w.tok
          }}</span></template
        >
      </template>

      <!-- STOUT & DEFAULT — flowing paragraph (stout gets CSS-only styling) -->
      <template v-else>{{ response.why }}</template>
    </div>

    <div v-if="response.name && response.name !== 'anonymous'" class="byline">
      — {{ response.name }}
    </div>
  </div>
</template>

<style scoped>
.response {
  /* fit-content so Forest's getBoundingClientRect() lands on the actual
     text extent — that's what drives per-node collision radii. */
  width: fit-content;
  max-width: 320px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  mix-blend-mode: multiply;
  transform-origin: center;
}
.species {
  font-weight: 700;
  line-height: 1;
  text-transform: lowercase;
  letter-spacing: -0.01em;
  overflow-wrap: break-word;
  max-width: 280px;
}
.species .mark {
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: 1.4em;
  line-height: 0.5;
  vertical-align: top;
  margin-right: 2px;
  opacity: 0.5;
}
.species .word {
  display: inline-block;
  white-space: nowrap;
}
.species .letter {
  display: inline-block;
}

/* -- TALL / SPIRE -- pine, redwood, cypress, eucalyptus, bamboo, etc.
   Species stretches tall (the spire top); body text forms an upward-
   expanding triangle, mono so line widths stay proportional. */
.species--tall {
  display: inline-block;
  transform: scaleY(1.55);
  transform-origin: left bottom;
  letter-spacing: -0.015em;
  line-height: 1;
  margin-bottom: 0.45em;
  align-self: center;
}
.why--tall {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 280px;
  font-family: 'Space Mono', monospace;
  line-height: 1.15;
  letter-spacing: 0;
  gap: 1px;
}
.why--tall .tall-line {
  display: block;
  white-space: nowrap;
}
.shape--tall .byline {
  align-self: center;
}

/* -- STOUT -- oak, maple, baobab, sycamore, etc.
   Horizontally stretched species, heavy centered body: a dense canopy. */
.species--stout {
  display: inline-block;
  transform: scaleX(1.2);
  transform-origin: left center;
  letter-spacing: -0.035em;
}
.why--stout {
  max-width: 280px;
  text-align: center;
  line-height: 1.3;
  font-weight: 700 !important;
  letter-spacing: -0.005em;
}
.shape--stout .byline {
  align-self: center;
}

/* -- DROOP -- willow, weeping willow, whomping willow.
   Species letters already cascade inline. Body text splits into phrases,
   each line indented further right so the block drapes diagonally. */
.why--droop {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 300px;
  font-style: italic;
  line-height: 1.2;
}
.why--droop .droop-line {
  display: block;
  white-space: normal;
}

/* -- ORB -- fruit trees (apple, pear, persimmon, mandarin, fig, etc.).
   Species letters bounce along a sine wave. Body sits inside a soft round
   halo of the node's ink — the fruit's crown. */
.why--orb {
  position: relative;
  isolation: isolate;
  align-self: center;
  max-width: 190px;
  padding: 16px 22px;
  text-align: center;
  line-height: 1.3;
}
.why--orb .orb-halo {
  position: absolute;
  inset: -2px;
  background: currentColor;
  opacity: 0.14;
  border-radius: 50%;
  z-index: -1;
}
.why--orb .orb-text {
  position: relative;
}
.shape--orb .species {
  align-self: center;
  text-align: center;
}
.shape--orb .byline {
  align-self: center;
}

/* -- GROVE -- aspen, cottonwood, poplar, birch.
   Species letters sit at staggered baselines (many trunks). Body is one
   readable column beside a vertical bark strip (stripes + faint “eyes”)
   so short answers still read as a grove, not a broken column layout. */
.why--grove {
  max-width: 280px;
  font-family: 'Space Mono', monospace;
  font-size: 0.82em !important;
  line-height: 1.42;
  letter-spacing: 0 !important;
}
.why--grove .grove-wrap {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 12px;
}
.why--grove .grove-bark {
  flex: 0 0 14px;
  align-self: stretch;
  min-height: 2.6em;
  border-radius: 2px;
  /* Vertical striations — birch / aspen bark rhythm */
  background:
    radial-gradient(circle at 30% 22%, currentColor 0.55px, transparent 0.65px),
    radial-gradient(circle at 70% 48%, currentColor 0.45px, transparent 0.55px),
    radial-gradient(circle at 45% 78%, currentColor 0.5px, transparent 0.6px),
    repeating-linear-gradient(
      90deg,
      currentColor 0,
      currentColor 1.5px,
      transparent 1.5px,
      transparent 4.5px
    );
  opacity: 0.28;
  mix-blend-mode: multiply;
}
.why--grove .grove-body {
  flex: 1;
  min-width: 0;
  margin: 0;
}

/* -- PETAL -- magnolia, cherry, dogwood, plum.
   Species letters rotate individually (scattered petals). Body words
   each get a small deterministic rotation, as if the text were shaken
   loose from the branch. */
.why--petal {
  position: relative;
  max-width: 240px;
  padding: 6px 8px;
  text-align: center;
  align-self: center;
  line-height: 1.5;
}
/* Five blossom dots scattered around the text block — riso-print polka of
   fallen petals. Positions are fixed (not random) so they never land on a
   word. The dots are drawn as radial-gradient spots on a full-cover layer
   behind the text. */
.why--petal::before {
  content: '';
  position: absolute;
  inset: -6px;
  background:
    radial-gradient(circle at 6% 14%, currentColor 1.6px, transparent 2.1px),
    radial-gradient(circle at 94% 26%, currentColor 2.1px, transparent 2.6px),
    radial-gradient(circle at 14% 78%, currentColor 2.3px, transparent 2.8px),
    radial-gradient(circle at 88% 84%, currentColor 1.8px, transparent 2.3px),
    radial-gradient(circle at 50% 4%, currentColor 1.2px, transparent 1.7px);
  opacity: 0.38;
  mix-blend-mode: multiply;
  z-index: -1;
  pointer-events: none;
}
.why--petal .petal-word {
  display: inline-block;
}
.shape--petal .species {
  align-self: center;
  text-align: center;
}
.shape--petal .byline {
  align-self: center;
}
/* -- DEFAULT / WILD -- everything unclassified.
   Keeps the randomized font / size / rotation from `look`, reading as a
   collaged scrap pinned into the forest. */
.why {
  max-width: 300px;
  overflow-wrap: break-word;
  hyphens: auto;
}
.byline {
  align-self: flex-end;
  margin-top: 2px;
  font-family: var(--mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-ink);
  opacity: 0.7;
}
</style>
