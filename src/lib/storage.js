// Storage facade. Picks an implementation at build time based on env vars:
//
//   - If VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, use the
//     Supabase-backed store (shared forest across every visitor).
//   - Otherwise, fall back to the localStorage-backed store
//     (single-browser, kiosk / dev mode).
//
// Downstream imports stay the same (`import { list, add, subscribe } from
// './lib/storage.js'`); the implementation switches via environment only.

// Accept either key-name convention so you can copy-paste whichever your
// Supabase dashboard is showing you:
//   - VITE_SUPABASE_PUBLISHABLE_KEY  (new: sb_publishable_...)
//   - VITE_SUPABASE_ANON_KEY         (legacy: long JWT)
// Both are "low-privilege, safe to expose on the web" and behave identically
// for this app's read/insert needs.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
const useSupabase = Boolean(supabaseUrl && supabaseKey)

// Using static imports of both files would bundle both code paths; we use
// top-level await on a dynamic import so the unused backend is tree-shaken.
const impl = await (useSupabase
  ? import('./storage-supabase.js')
  : import('./storage-local.js'))

export const list = impl.list
export const add = impl.add
export const subscribe = impl.subscribe
export const responsesRef = impl.responsesRef
export const resetForest = impl.resetForest

if (typeof window !== 'undefined') {
  // Which backend are we on? Handy for sanity-checks before the opening.
  // Open devtools → console → `__storageMode` should print 'supabase' in prod.
  window.__storageMode = useSupabase ? 'supabase' : 'local'

  // Admin: wipe every submission. Call from the browser console:
  //   await window.__resetForest()
  // On the Supabase backend this requires the "delete any" RLS policy.
  window.__resetForest = () => impl.resetForest()

  // Dev convenience: seed a handful of example responses if the store is
  // empty. Call from the browser console: `await window.__seedForest()`.
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
    for (const s of samples) await impl.add(s)
    console.log('seeded', samples.length, 'responses')
  }
}
