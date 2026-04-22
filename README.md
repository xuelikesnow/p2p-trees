# do you think trees remember us?
[ifiwereatree.vercel.app](https://ifiwereatree.vercel.app)

An interactive companion website to a set of riso prints — a Vue 3 SPA where visitors
answer "_if you were a tree, what would you be and why?_" and watch their
response take root in a shared forest.

Each submission becomes a node in a [mycorrhizal network](https://en.wikipedia.org/wiki/Mycorrhizal_network).
Responses that share a tree species or a meaningful word sprout roots between
them, making visible the quiet entanglements of how we understand ourselves: how we wish to be seen, how we relate to others, and how we imagine our place in the world.

## Stack

- **Vue 3** (Composition API, `<script setup>`)
- **Vite** for dev/build
- **d3-force** for the network physics
- **Supabase** for data storage
