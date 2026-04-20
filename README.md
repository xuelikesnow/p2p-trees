# do you think trees remember us?

An interactive companion to a set of riso prints — a Vue 3 SPA where visitors
answer "*if you were a tree, what would you be and why?*" and watch their
response take root in a shared forest.

Each submission becomes a node in a [mycorrhizal network](https://en.wikipedia.org/wiki/Mycorrhizal_network).
Responses that share a tree species or a meaningful word sprout roots between
them, making visible the quiet entanglements of how we describe ourselves.

## Stack

- **Vue 3** (Composition API, `<script setup>`)
- **Vite** for dev/build
- **d3-force** for the network physics
- **localStorage** for persistence — single-browser by default; see below for
  the exhibition-ready multi-visitor setup.

## Local development

```sh
npm install
npm run dev
```

Open the URL Vite prints. The forest is empty on first visit. Either submit a
few responses yourself, or seed example data from the browser console:

```js
window.__seedForest()
```

## Shared forest for the exhibition

`localStorage` is per-browser — every visitor sees only their own submissions.
For the gallery show you want a single shared forest that everyone plants into.

1. Install the client:
   ```sh
   npm install @supabase/supabase-js
   ```
2. Create a free Supabase project and a `responses` table (SQL at the top of
   [`src/lib/supabase.js`](src/lib/supabase.js)).
3. Add a `.env` file at the project root:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxxxxxx
   ```
4. Uncomment the implementation in `src/lib/supabase.js`.
5. In any file that currently imports from `./lib/storage.js`, swap the path
   to `./lib/supabase.js`. The function signatures are identical, so nothing
   else has to change.

Supabase realtime will push new submissions to every open browser, so the
forest grows live during the opening.

## Project shape

```
src/
├── App.vue                    — layout, masthead, about
├── main.js                    — entry
├── assets/
│   └── main.css               — riso palette, fonts, paper texture
├── components/
│   ├── SubmissionForm.vue     — the prompt + input fields
│   ├── Forest.vue             — d3-force simulation, SVG canvas, pan/zoom
│   └── ResponseNode.vue       — one response rendered with randomized typography
└── lib/
    ├── text.js                — tokenization, stopwords, known species
    ├── connections.js         — computes links between shared species / shared words
    ├── storage.js             — localStorage-backed store (default)
    └── supabase.js            — drop-in Supabase alternative (stubbed)
```

## Customizing the aesthetic

- **Palette**: edit the CSS custom properties at the top of `src/assets/main.css`.
  The whole site recolors from those three variables (paper + two inks).
- **Typography pool**: `ResponseNode.vue` picks fonts at random from two
  arrays (`FONTS`, `SPECIES_FONTS`). Add or remove entries to change the feel.
- **Root styling**: see `.root--species` and `.root--word` in `Forest.vue`.
- **Connection rules**: tune `MAX_WORD_LINKS_PER_NODE` and the matching logic
  in `src/lib/connections.js`. Stopwords and recognized species live in
  `src/lib/text.js`.

## Build & deploy

```sh
npm run build
```

Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages, Cloudflare
Pages). If you're using the Supabase path, make sure `VITE_SUPABASE_*` env
vars are configured on the host.

## Credits

Concept and design: the artist.
Conceptual reference: James Bridle, *Ways of Being* / wood wide webs.
