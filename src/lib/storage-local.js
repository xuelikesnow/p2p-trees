// localStorage-backed implementation of the storage contract. Used when no
// Supabase env vars are configured — single browser, zero backend, good for
// kiosk mode or local development.
//
// Contract:
//   list()          -> Promise<Response[]>
//   add(input)      -> Promise<Response>
//   subscribe(cb)   -> () => void
//   responsesRef    -> readonly reactive handle

import { reactive, readonly } from 'vue'
import { learnSpecies } from './text.js'

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
  // Teach the system this species (normalized: "A Chestnut Tree" -> "chestnut")
  // so future submissions of the same plant connect by species rather than
  // dropping to a weaker word-level link.
  learnSpecies(response.species)
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

// Read-only reactive handle for components that want to render directly.
export const responsesRef = readonly(state)

// Admin: clear every submission. Exposed on window as __resetForest() so you
// can wipe before the opening without touching code or dev tools sources.
export async function resetForest() {
  state.responses = []
  writeToStorage(state.responses)
  notify()
}
