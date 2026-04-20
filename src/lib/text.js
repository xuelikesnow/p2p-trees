// Text utilities: tokenization, stopword filtering, species detection.
// Used by the connection logic to find semantic overlaps between responses.

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'would', 'could', 'because',
  'have', 'been', 'from', 'they', 'them', 'their', 'there', 'these',
  'those', 'what', 'when', 'where', 'which', 'while', 'your', 'yours',
  'about', 'into', 'over', 'than', 'then', 'some', 'such', 'just',
  'very', 'also', 'like', 'only', 'even', 'more', 'most', 'much',
  'many', 'make', 'made', 'take', 'tree', 'trees', 'being', 'really',
  'feel', 'feels', 'think', 'thinks', 'know', 'knows', 'want', 'wants',
  'will', 'were', 'ever', 'never', 'always', 'sometimes', 'something',
  'nothing', 'everyone', 'anyone', 'someone', 'myself', 'herself',
  'himself', 'itself', 'through', 'though', 'still', 'again', 'other',
  'others', 'another', 'same', 'both', 'each', 'every', 'here', 'both'
])

// Words we recognize as tree species, used to connect by shared species.
// Extend freely — this is just a convenience list for stronger matches.
export const KNOWN_SPECIES = [
  'oak', 'willow', 'weeping willow', 'maple', 'pine', 'spruce', 'fir',
  'redwood', 'sequoia', 'birch', 'cedar', 'cypress', 'elm', 'ash',
  'beech', 'aspen', 'poplar', 'cottonwood', 'sycamore', 'ginkgo',
  'magnolia', 'dogwood', 'cherry', 'apple', 'pear', 'peach', 'plum',
  'olive', 'fig', 'palm', 'bamboo', 'baobab', 'banyan', 'mangrove',
  'eucalyptus', 'acacia', 'hemlock', 'juniper', 'yew', 'hazel',
  'hawthorn', 'holly', 'larch', 'linden', 'locust', 'mahogany',
  'walnut', 'pecan', 'chestnut', 'buckeye', 'catalpa', 'persimmon',
  'mulberry', 'sassafras', 'tulip tree', 'bristlecone', 'joshua',
  'banana', 'lemon', 'orange', 'mandarin', 'avocado', 'coconut', 'rubber',
  'teak', 'rowan', 'alder', 'pawpaw', 'cacao', 'coffee', 'tea'
]

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

// Extract the species mentioned in a response. We check the dedicated
// species field first, then scan the "why" text as a fallback.
export function extractSpecies({ species = '', why = '' } = {}) {
  const haystack = `${species} ${why}`.toLowerCase()
  const found = new Set()
  for (const s of KNOWN_SPECIES) {
    if (haystack.includes(s)) found.add(s)
  }
  // Also keep the raw species string as a fallback token so novel species
  // ("mother tree", "whatever is outside my window") still connect to themselves.
  const raw = species.trim().toLowerCase()
  if (raw) found.add(raw)
  return [...found]
}
