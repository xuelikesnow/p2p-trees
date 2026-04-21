// Text utilities: tokenization, stopword filtering, species detection.
// Used by the connection logic to find semantic overlaps between responses.

const STOPWORDS = new Set([
  'the',
  'and',
  'that',
  'this',
  'with',
  'would',
  'could',
  'because',
  'have',
  'been',
  'from',
  'they',
  'them',
  'their',
  'there',
  'these',
  'those',
  'what',
  'when',
  'where',
  'which',
  'while',
  'your',
  'yours',
  'about',
  'into',
  'over',
  'than',
  'then',
  'some',
  'such',
  'just',
  'very',
  'also',
  'like',
  'only',
  'even',
  'more',
  'most',
  'much',
  'many',
  'make',
  'made',
  'take',
  'tree',
  'trees',
  'being',
  'really',
  'feel',
  'feels',
  'think',
  'thinks',
  'know',
  'knows',
  'want',
  'wants',
  'will',
  'were',
  'ever',
  'never',
  'always',
  'sometimes',
  'something',
  'nothing',
  'everyone',
  'anyone',
  'someone',
  'myself',
  'herself',
  'himself',
  'itself',
  'through',
  'though',
  'still',
  'again',
  'other',
  'others',
  'another',
  'same',
  'both',
  'each',
  'every',
  'here',
  'both',
])

// Baseline list of species. This is just a seed — the system also *learns*
// new species over time (see learnSpecies below), persisted in localStorage
// so novel submissions ("mother tree", "hemlock") become shared vocabulary.
export const KNOWN_SPECIES = [
  'oak',
  'willow',
  'weeping willow',
  'maple',
  'pine',
  'spruce',
  'fir',
  'redwood',
  'sequoia',
  'birch',
  'cedar',
  'cypress',
  'elm',
  'ash',
  'beech',
  'aspen',
  'poplar',
  'cottonwood',
  'sycamore',
  'ginkgo',
  'magnolia',
  'dogwood',
  'cherry',
  'apple',
  'pear',
  'peach',
  'plum',
  'olive',
  'fig',
  'palm',
  'bamboo',
  'baobab',
  'banyan',
  'mangrove',
  'eucalyptus',
  'acacia',
  'hemlock',
  'juniper',
  'yew',
  'hazel',
  'hawthorn',
  'holly',
  'larch',
  'linden',
  'locust',
  'mahogany',
  'walnut',
  'pecan',
  'chestnut',
  'buckeye',
  'catalpa',
  'persimmon',
  'mulberry',
  'sassafras',
  'tulip',
  'bristlecone',
  'joshua',
  'banana',
  'lemon',
  'orange',
  'mandarin',
  'avocado',
  'coconut',
  'rubber',
  'teak',
  'rowan',
  'alder',
  'pawpaw',
  'cacao',
  'coffee',
  'tea',
]

// --- species normalization & learning ---------------------------------------

// Collapse the many ways someone might write a species into a single canonical
// form, so "A Chestnut Tree", "chestnut tree", "  chestnut ", and "Chestnut"
// all become the same key "chestnut".
//
// Rules:
//   1. lowercase + trim
//   2. strip leading article (a / an / the)
//   3. strip trailing "tree" / "trees"
//   4. strip surrounding punctuation and collapse internal whitespace
export function normalizeSpecies(raw) {
  if (!raw) return ''
  let s = String(raw).toLowerCase().trim()
  // Strip wrapping punctuation we commonly see from handwriting transcription
  s = s.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '')
  // "a pine tree" -> "pine tree"
  s = s.replace(/^(a|an|the)\s+/, '')
  // "pine tree" / "pine trees" -> "pine"; but "tree" alone stays empty later
  s = s.replace(/\s+trees?$/, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

// Whether a normalized species string looks like a real species name we're
// willing to *learn* (add to our shared vocabulary). Filters out pure
// prose ("whatever is outside my window") and one-letter noise.
function isLearnableSpecies(normalized) {
  if (!normalized) return false
  if (normalized.length < 2 || normalized.length > 30) return false
  if (!/\p{L}/u.test(normalized)) return false
  // Accept 1–3 words. Longer strings are almost always prose, not species.
  const words = normalized.split(/\s+/)
  if (words.length > 3) return false
  return true
}

const LEARNED_KEY = 'p2p-trees/species/v1'

// Species the system has seen submitted. Starts empty, grows over the life
// of the exhibition. Persisted in localStorage so a reload keeps the shared
// vocabulary; cross-tab sync mirrors the pattern in storage.js.
const learnedSpecies = new Set()
let learnedLoaded = false

function loadLearned() {
  if (learnedLoaded) return
  learnedLoaded = true
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(LEARNED_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      for (const s of parsed) {
        if (typeof s === 'string') learnedSpecies.add(s)
      }
    }
  } catch {
    // localStorage disabled / quota exceeded — fall back to session-only.
  }
}

function persistLearned() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify([...learnedSpecies]))
  } catch {
    // ignore
  }
}

// Cross-tab sync: another window learned a new species, pull it in.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== LEARNED_KEY) return
    learnedSpecies.clear()
    learnedLoaded = false
    loadLearned()
  })
}

// Return the full working vocabulary: built-in list + anything the system
// has learned. Callers iterate this; insertion order ensures longer/more
// specific terms ("weeping willow") win over their shorter substrings
// when we check matches, but since the loop collects all matches and the
// result is a set, ordering only matters for deterministic iteration.
export function allKnownSpecies() {
  loadLearned()
  const out = [...KNOWN_SPECIES]
  for (const s of learnedSpecies) {
    if (!KNOWN_SPECIES.includes(s)) out.push(s)
  }
  return out
}

// Teach the system a new species. Safe to call with raw user input — we
// normalize first and reject anything that doesn't look like a species
// name. Returns the normalized form (or '' if rejected) so callers can
// feed the canonical value back into their own data.
export function learnSpecies(raw) {
  loadLearned()
  const normalized = normalizeSpecies(raw)
  if (!isLearnableSpecies(normalized)) return ''
  if (KNOWN_SPECIES.includes(normalized) || learnedSpecies.has(normalized)) {
    return normalized
  }
  learnedSpecies.add(normalized)
  persistLearned()
  return normalized
}

// --- tokenization -----------------------------------------------------------

export function tokenize(text) {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function meaningfulWords(text) {
  return tokenize(text).filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

// --- species extraction -----------------------------------------------------

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Extract the species mentioned in a response. We check the dedicated
// species field first, then scan the "why" text as a fallback.
//
// IMPORTANT: we match on word boundaries (not plain substring). Short species
// names like "fir", "ash", "elm", "yew" otherwise trigger false positives —
// e.g. "fir" matching "first", or "ash" matching "share" / "smash" — which
// would draw phantom "same species" links between unrelated responses.
// Multi-word entries ("weeping willow", "asian pear") still work because
// whitespace is itself a word boundary.
export function extractSpecies({ species = '', why = '' } = {}) {
  const haystack = `${species} ${why}`.toLowerCase()
  const found = new Set()
  for (const s of allKnownSpecies()) {
    const pattern = new RegExp(`\\b${escapeRegex(s)}\\b`)
    if (pattern.test(haystack)) found.add(s)
  }
  // Also keep the normalized raw species string as a fallback token so novel
  // species still connect to themselves / to later submissions of the same
  // name (e.g. two people both writing "mother tree" → "mother").
  const raw = normalizeSpecies(species)
  if (raw) found.add(raw)
  return [...found]
}
