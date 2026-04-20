// Drop-in replacement for ./storage.js using Supabase.
//
// To use:
//   1. npm install @supabase/supabase-js
//   2. Create a Supabase project (free tier is fine) and a table:
//
//        create table responses (
//          id          text primary key,
//          name        text,
//          species     text,
//          why         text,
//          created_at  bigint
//        );
//        alter table responses enable row level security;
//        create policy "read all"   on responses for select using (true);
//        create policy "insert any" on responses for insert with check (true);
//
//      (Tighten the insert policy before the show if you expect abuse.)
//
//   3. Add to an `.env` file at the project root:
//        VITE_SUPABASE_URL=...
//        VITE_SUPABASE_ANON_KEY=...
//
//   4. In src/App.vue (or wherever you import storage), swap:
//        import { list, add, subscribe } from './lib/storage.js'
//      for:
//        import { list, add, subscribe } from './lib/supabase.js'
//
// The contract is identical to storage.js.

/* eslint-disable no-unused-vars */
// import { createClient } from '@supabase/supabase-js'
// import { reactive } from 'vue'

// const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_ANON_KEY
// )

// const state = reactive({ responses: [] })
// const subscribers = new Set()

// function notify() {
//   for (const cb of subscribers) cb(state.responses)
// }

// async function refresh() {
//   const { data, error } = await supabase
//     .from('responses')
//     .select('*')
//     .order('created_at', { ascending: true })
//   if (error) {
//     console.error('[supabase] list failed', error)
//     return
//   }
//   state.responses = (data ?? []).map((row) => ({
//     id: row.id,
//     name: row.name,
//     species: row.species,
//     why: row.why,
//     createdAt: row.created_at
//   }))
//   notify()
// }

// supabase
//   .channel('responses-stream')
//   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses' }, refresh)
//   .subscribe()

// export async function list() {
//   if (state.responses.length === 0) await refresh()
//   return state.responses
// }

// export async function add({ name, species, why }) {
//   const response = {
//     id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
//     name: (name ?? '').trim().slice(0, 60) || 'anonymous',
//     species: (species ?? '').trim().slice(0, 80),
//     why: (why ?? '').trim().slice(0, 600),
//     created_at: Date.now()
//   }
//   const { error } = await supabase.from('responses').insert(response)
//   if (error) throw error
//   await refresh()
//   return { ...response, createdAt: response.created_at }
// }

// export function subscribe(cb) {
//   subscribers.add(cb)
//   if (state.responses.length === 0) refresh()
//   else cb(state.responses)
//   return () => subscribers.delete(cb)
// }

throw new Error(
  'supabase.js is a stub — uncomment the implementation and install @supabase/supabase-js to use it.'
)
