// Storage abstraction for responses.
//
// Default implementation: localStorage (single-browser, zero config).
// To share the forest across visitors for the exhibition, swap the
// implementation at the bottom of this file — see ./supabase.js for a
// drop-in replacement using Supabase Postgres + realtime.
//
// The contract any implementation must satisfy:
//   list()          -> Promise<Response[]>
//   add(input)      -> Promise<Response>
//   subscribe(cb)   -> () => void   (cb called with the full list on changes)

import { reactive, readonly } from 'vue'

const STORAGE_KEY = 'p2p-trees/responses/v1'

const state = reactive({ responses: [], loaded: false })
const subscribers = new Set()

function readFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeToStorage(responses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(responses))
  } catch {
    // Quota exceeded or disabled — silently ignore; session-only mode.
  }
}

function notify() {
  for (const cb of subscribers) cb(state.responses)
}

// Cross-tab sync so multiple windows on the same machine stay in step.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    state.responses = readFromStorage()
    notify()
  })
}

function ensureLoaded() {
  if (state.loaded) return
  state.responses = readFromStorage()
  state.loaded = true
}

export async function list() {
  ensureLoaded()
  return state.responses
}

export async function add({ name, species, why }) {
  ensureLoaded()
  const response = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name ?? '').trim().slice(0, 60) || 'anonymous',
    species: (species ?? '').trim().slice(0, 80),
    why: (why ?? '').trim().slice(0, 600),
    createdAt: Date.now(),
  }
  state.responses = [...state.responses, response]
  writeToStorage(state.responses)
  notify()
  return response
}

export function subscribe(cb) {
  ensureLoaded()
  subscribers.add(cb)
  cb(state.responses)
  return () => subscribers.delete(cb)
}

// Read-only reactive handle for components that want to render directly
// from the store without managing a subscription themselves.
export const responsesRef = readonly(state)

// Dev convenience: seed a handful of example responses if the store is empty.
// Call from the browser console: `window.__seedForest()`.
if (typeof window !== 'undefined') {
  window.__seedForest = async () => {
    const samples = [
      {
        name: 'V',
        species: 'pine',
        why: 'I would be a pine tree covered in snow in a deciduous forest because I am pointed but seek community.',
      },
      {
        name: 'M',
        species: 'weeping willow',
        why: 'I would be a weeping willow tree on the edge of a pond. My branches would be looming arches that children can play under.',
      },
      {
        name: 'S',
        species: 'maple',
        why: 'I would be a maple tree in the snow in Canada. My tree would provide maple for maple syrup and then you pour my syrup into the snow & make snow candy & its yummy.',
      },
      {
        name: 'A',
        species: 'whomping willow',
        why: 'I would be the whomping willow in harry potter because I enjoy causing torment to passerby, and I hold secrets...',
      },
      {
        name: 'A',
        species: 'asian pear',
        why: 'I would be a pear tree because my dad planted a pear tree when I was born. Asian pear tree specifically. So yummy.',
      },
      {
        name: 'Y',
        species: 'persimmon',
        why: 'I would be a persimmon tree because in my old house in Tennessee, my mom and I would pick the ripe persimmons off our tree. She would prepare them as little snacks for me when studying :)',
      },
      {
        name: 'H',
        species: 'apple',
        why: 'I would be an apple tree that you can climb and play in + eat the apples + make pie out of.',
      },
      {
        name: 'B',
        species: 'aspen',
        why: 'If I were a tree I would be an Aspen because I have great memories associated with them!',
      },
      {
        name: 'D',
        species: 'mandarin',
        why: "If I were a tree, I'd be a mandarin tree — Asian, fruity, and aspiring to be beneficial to the public good.",
      },
      {
        name: 'K',
        species: 'eucalyptus',
        why: "If I were a tree, I would be an Eucalyptus tree! I noticed them for the first time in a line, atop a mountain, in the distance. I hope I could embody a tree that exudes a sense of earth's beauty and share that with those atop the world.",
      },
    ]
    for (const s of samples) await add(s)
    console.log('seeded', samples.length, 'responses')
  }
}
