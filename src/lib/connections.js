// Computes "mycorrhizal" links between responses.
//
// Two responses are connected when they share either:
//   - A tree species (strong link), or
//   - A meaningful word (weak link).
//
// Links carry a `kind` (species | word) and `strength` (0..1) so the
// visualization can draw them differently (thicker roots for species
// matches, thin hyphae for word matches).

import { extractSpecies, meaningfulWords } from './text.js'

// How many shared-word links to allow per response before we stop adding
// more. Prevents hub-and-spoke dominance when one response is long.
const MAX_WORD_LINKS_PER_NODE = 4

export function enrichResponse(response) {
  const species = extractSpecies(response)
  const words = new Set(meaningfulWords(response.why))
  return { ...response, _species: species, _words: words }
}

export function computeLinks(responses) {
  const enriched = responses.map(enrichResponse)
  const links = []
  const wordLinkCount = new Map()

  const bump = (id) => {
    wordLinkCount.set(id, (wordLinkCount.get(id) ?? 0) + 1)
  }

  for (let i = 0; i < enriched.length; i++) {
    for (let j = i + 1; j < enriched.length; j++) {
      const a = enriched[i]
      const b = enriched[j]

      const sharedSpecies = a._species.filter((s) => b._species.includes(s))
      if (sharedSpecies.length > 0) {
        links.push({
          source: a.id,
          target: b.id,
          kind: 'species',
          strength: 0.9,
          shared: sharedSpecies
        })
        continue
      }

      const overBudget =
        (wordLinkCount.get(a.id) ?? 0) >= MAX_WORD_LINKS_PER_NODE ||
        (wordLinkCount.get(b.id) ?? 0) >= MAX_WORD_LINKS_PER_NODE
      if (overBudget) continue

      const sharedWords = [...a._words].filter((w) => b._words.has(w))
      if (sharedWords.length >= 1) {
        links.push({
          source: a.id,
          target: b.id,
          kind: 'word',
          strength: Math.min(0.6, 0.25 + sharedWords.length * 0.12),
          shared: sharedWords.slice(0, 3)
        })
        bump(a.id)
        bump(b.id)
      }
    }
  }
  return links
}
