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

// Body-text pool. We vary family + style (regular / italic) so each response
// reads as its own hand-set block of text while staying within the two-face
// system (degular-display + space mono + louvette-pixel).
const FONTS = [
  { family: '"degular-display", serif', style: 'normal', weight: 400 },
  { family: '"degular-display", serif', style: 'italic', weight: 400 },
  { family: '"degular-display", serif', style: 'normal', weight: 700 },
  { family: '"degular-display", serif', style: 'italic', weight: 700 },
  { family: '"Space Mono", monospace', style: 'normal', weight: 400 },
  { family: '"Space Mono", monospace', style: 'italic', weight: 400 },
  { family: '"louvette-pixel", sans-serif', style: 'normal', weight: 400 },
]

// Species pool. Heavier, display-forward. louvette-pixel bold dominates,
// with louder degular-display bold as a contrast voice.
const SPECIES_FONTS = [
  { family: '"louvette-pixel", sans-serif', style: 'normal', weight: 700 },
  { family: '"louvette-pixel", sans-serif', style: 'normal', weight: 700 },
  { family: '"degular-display", serif', style: 'normal', weight: 700 },
  { family: '"degular-display", serif', style: 'italic', weight: 700 },
  { family: '"Space Mono", monospace', style: 'normal', weight: 700 },
]

// All five spot inks in the palette. The dark `--ink-ink` acts as the anchor
// (most legible) while the four bright hues — green / red / pink / orange —
// each carry equal weight, echoing a 4-color riso pass.
const INKS = [
  'var(--ink-ink)',
  'var(--ink-green)',
  'var(--ink-red)',
  'var(--ink-pink)',
  'var(--ink-orange)',
]

// Species → typographic shape. Longer/more-specific keys appear first within
// each group so e.g. "weeping willow" is matched before "willow" wouldn't
// accidentally match a different category.
const SHAPE_MAP = [
  ['droop', ['weeping willow', 'whomping willow', 'willow']],
  ['grove', ['aspen', 'cottonwood', 'poplar']],
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

// Shapes that do their work by styling each letter individually.
const PER_LETTER_SHAPES = new Set(['droop', 'grove', 'petal', 'orb'])

// Returns an inline style for a single letter based on the shape & position.
// Kept as a plain function (not CSS vars) so all math is up-front and we
// don't depend on newer CSS trig support.
function letterStyle(shape, i) {
  switch (shape) {
    case 'droop': {
      // Progressive downward drift with a gentle wobble — like a willow frond.
      const dy = i * 1.3 + Math.sin(i * 1.1) * 1.6
      return { transform: `translateY(${dy.toFixed(2)}px)` }
    }
    case 'grove': {
      // Letters at different baselines, evoking a stand of trunks.
      const dy = Math.sin(i * 0.9 + 0.4) * 3.2
      return { transform: `translateY(${dy.toFixed(2)}px)` }
    }
    case 'petal': {
      // Small deterministic rotations — scattered blossoms.
      const r = ((i * 53) % 9) - 4 // -4..4 degrees
      return { transform: `rotate(${r}deg)` }
    }
    case 'orb': {
      // Gentle sinusoidal bounce — fruits along a branch.
      const dy = Math.sin(i * 1.2) * 2.2
      return { transform: `translateY(${dy.toFixed(2)}px)` }
    }
    default:
      return {}
  }
}

const look = computed(() => {
  const h = hash(props.response.id || String(Math.random()))
  const pick = (arr, salt = 0) => arr[(h + salt) % arr.length]
  const sign = (salt) => (((h >> salt) & 1) === 0 ? -1 : 1)
  const range = (min, max, salt) => min + (((h >> salt) & 0xff) / 255) * (max - min)

  const whyFont = pick(FONTS, 1)
  const speciesFont = pick(SPECIES_FONTS, 2)
  // One ink per node — the species and why share a color so each submission
  // reads as a single voice rather than a collaged scrap.
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

// Word-grouped letters for shapes that want per-letter treatment. Grouping by
// word lets us keep `white-space: nowrap` within a word while still allowing
// the species to wrap between words if it's long ("weeping willow").
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

// Word-level splitting for the "why" body when shape === 'droop' — so we can
// cascade words gently downward across the block without breaking reading.
const whyWords = computed(() => {
  if (shape.value !== 'droop') return []
  const w = props.response.why || ''
  return w.split(/(\s+)/).map((tok, i) => ({
    tok,
    space: /^\s+$/.test(tok),
    dy: (i * 0.35).toFixed(2),
  }))
})
</script>

<template>
  <div
    class="response"
    :class="`shape--${shape}`"
    :style="{
      transform: `translate(${look.offsetX}px, ${look.offsetY}px) rotate(${look.rotation}deg)`,
    }"
  >
    <div
      class="species"
      :class="`species--${shape}`"
      :style="{
        fontFamily: look.speciesFontFamily,
        fontStyle: look.speciesFontStyle,
        fontWeight: look.speciesFontWeight,
        color: look.ink,
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
    <div
      class="why"
      :class="`why--${shape}`"
      :style="{
        fontFamily: look.whyFontFamily,
        fontStyle: look.whyFontStyle,
        fontWeight: look.whyFontWeight,
        color: look.ink,
        fontSize: look.whySize + 'rem',
        letterSpacing: look.whyLetterSpacing + 'em',
        lineHeight: look.whyLineHeight,
      }"
    >
      <template v-if="shape === 'droop'"
        ><template v-for="(w, wi) in whyWords" :key="wi"
          ><template v-if="w.space">{{ w.tok }}</template
          ><span v-else class="word" :style="{ transform: `translateY(${w.dy}px)` }">{{
            w.tok
          }}</span></template
        ></template
      ><template v-else>{{ response.why }}</template>
    </div>
    <div v-if="response.name && response.name !== 'anonymous'" class="byline">
      — {{ response.name }}
    </div>
  </div>
</template>

<style scoped>
.response {
  /* Fit-content makes the bounding box match the actual text extent, which
     is what Forest.vue measures to compute per-node collision radii. */
  width: fit-content;
  max-width: 300px;
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

/* Per-letter shapes: each word stays unbreakable, letters sit as
   inline-blocks so transforms apply without re-flowing the baseline. */
.species .word {
  display: inline-block;
  white-space: nowrap;
}
.species .letter {
  display: inline-block;
}

/* TALL — pine, redwood, cypress, eucalyptus, bamboo, etc.
   Stretch the species vertically; trim the "why" to a narrower column so it
   reads like a trunk. */
.species--tall {
  display: inline-block;
  transform: scaleY(1.55);
  transform-origin: left bottom;
  letter-spacing: -0.015em;
  line-height: 1;
  margin-bottom: 0.45em;
}
.why--tall {
  max-width: 170px;
}

/* STOUT — oak, maple, baobab, sycamore, etc.
   Horizontally stretched, tightened, heavy. A dense canopy. */
.species--stout {
  display: inline-block;
  transform: scaleX(1.2);
  transform-origin: left center;
  letter-spacing: -0.035em;
}

/* GROVE — aspen, poplar, cottonwood (many trunks of varying heights).
   Per-letter offsets are set inline via letterStyle(). */

/* PETAL — magnolia, cherry, dogwood, plum. Per-letter rotations inline. */

/* ORB — fruit trees. Per-letter sine-wave bounce inline. */

/* DROOP — willow, weeping willow. Per-letter cascade inline + body words
   drift progressively downward for a subtle "melting" legible effect. */
.why--droop .word {
  display: inline-block;
}

.why {
  max-width: 260px;
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
