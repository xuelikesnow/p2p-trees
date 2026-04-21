// Supabase-backed implementation of the storage contract. Active whenever
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build time — every
// visitor talks to the same Postgres table and sees the same forest.
//
// Required schema (run once in the Supabase SQL editor):
//
//   create table responses (
//     id          text primary key,
//     name        text,
//     species     text,
//     why         text,
//     created_at  bigint
//   );
//   alter table responses enable row level security;
//   create policy "read all"   on responses for select using (true);
//   create policy "insert any" on responses for insert with check (true);
//   -- Optional: allow the gallery curator to wipe the forest before the show.
//   -- create policy "delete any" on responses for delete using (true);
//
// Also in the Supabase dashboard: Database → Replication → turn "Realtime" ON
// for the `responses` table, so inserts broadcast to every open tab.

import { createClient } from '@supabase/supabase-js'
import { reactive, readonly } from 'vue'
import { learnSpecies } from './text.js'

// Normalize the URL: strip a trailing slash and warn loudly if the value
// appears to already include a REST path segment. Supabase-js appends
// /rest/v1/... and /realtime/v1/... internally, so any extra path here
// produces cryptic "PGRST125 Invalid path" errors and broken WebSockets.
const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const SUPABASE_URL = rawUrl.replace(/\/+$/, '')
if (/\/rest\/|\/auth\/|\/realtime\//.test(SUPABASE_URL)) {
  console.error(
    '[supabase] VITE_SUPABASE_URL should be the bare project origin ' +
      '(https://xxxxx.supabase.co) — remove any /rest/v1 or similar path.',
  )
}

// Accept either the new publishable-key naming or the legacy anon-key naming.
// See src/lib/storage.js for the same fallback on the facade side.
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const state = reactive({ responses: [], loaded: false })
const subscribers = new Set()
let pendingRefresh = null

function notify() {
  for (const cb of subscribers) cb(state.responses)
}

function rowToResponse(row) {
  return {
    id: row.id,
    name: row.name ?? 'anonymous',
    species: row.species ?? '',
    why: row.why ?? '',
    createdAt: Number(row.created_at ?? 0),
  }
}

// Pull the full list from the server. Debounced by reusing an in-flight
// promise so rapid-fire realtime events don't cause N round-trips.
async function refresh() {
  if (pendingRefresh) return pendingRefresh
  pendingRefresh = (async () => {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      // Mark as loaded and notify anyway so the UI exits the loading state
      // rather than hanging forever behind a silent network error. The error
      // is surfaced in the console so you can debug keys / RLS / connection.
      console.error('[supabase] list failed', error)
      state.loaded = true
      notify()
      return
    }
    const rows = (data ?? []).map(rowToResponse)
    // Seed the learned-species vocabulary from every known submission so all
    // clients share the same matching dictionary, not just whichever ones
    // happened to be submitted locally.
    for (const r of rows) learnSpecies(r.species)
    state.responses = rows
    state.loaded = true
    notify()
  })().finally(() => {
    pendingRefresh = null
  })
  return pendingRefresh
}

// Subscribe to realtime inserts so the forest updates as new submissions
// arrive from other visitors' devices. Also handle deletes for "reset
// forest" operations run from the curator's console.
if (typeof window !== 'undefined') {
  supabase
    .channel('responses-stream')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'responses' },
      refresh,
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'responses' },
      refresh,
    )
    .subscribe()
}

export async function list() {
  if (!state.loaded) await refresh()
  return state.responses
}

export async function add({ name, species, why }) {
  const response = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name ?? '').trim().slice(0, 60) || 'anonymous',
    species: (species ?? '').trim().slice(0, 80),
    why: (why ?? '').trim().slice(0, 600),
    created_at: Date.now(),
  }
  const { error } = await supabase.from('responses').insert(response)
  if (error) {
    console.error('[supabase] insert failed', error)
    throw error
  }
  learnSpecies(response.species)
  await refresh()
  return rowToResponse(response)
}

export function subscribe(cb) {
  subscribers.add(cb)
  if (!state.loaded) refresh()
  else cb(state.responses)
  return () => subscribers.delete(cb)
}

export const responsesRef = readonly(state)

// Admin: wipe every submission. Relies on the (optional) "delete any" policy
// above being enabled. Exposed on window as __resetForest() so you can wipe
// before the opening without touching code.
export async function resetForest() {
  const { error } = await supabase.from('responses').delete().neq('id', '')
  if (error) {
    console.error('[supabase] reset failed', error)
    throw error
  }
  await refresh()
}
