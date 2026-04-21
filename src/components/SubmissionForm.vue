<script setup>
import { ref, computed } from 'vue'
import { add } from '../lib/storage.js'

const emit = defineEmits(['submitted'])

const name = ref('')
const species = ref('')
const why = ref('')
const submitting = ref(false)
const error = ref('')
const justPlanted = ref(false)

const whyCount = computed(() => why.value.length)

const canSubmit = computed(
  () => !submitting.value && species.value.trim().length > 0 && why.value.trim().length >= 4,
)

async function onSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    const res = await add({
      name: name.value,
      species: species.value,
      why: why.value,
    })
    emit('submitted', res)
    species.value = ''
    why.value = ''
    // Leave name filled in — most people submit only once but it's kind if they don't have to retype.
    justPlanted.value = true
    setTimeout(() => (justPlanted.value = false), 2800)
  } catch (e) {
    error.value = e?.message || 'something went wrong. try again?'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="form" @submit.prevent="onSubmit">
    <h2 class="prompt">
      <span class="prompt-line prompt-line--bold">if I were a tree...</span>
      <!-- <span class="prompt-line prompt-line--bold">what would you be</span> -->
      <span class="prompt-line">what would i be, and why?</span>
    </h2>

    <label class="field">
      <span class="label">tree</span>
      <input
        v-model="species"
        type="text"
        placeholder="pine / magnolia / the one outside my house / whatever grows outside"
        maxlength="100"
        required
        autocomplete="off"
      />
    </label>

    <label class="field">
      <span class="label">why</span>
      <textarea
        v-model="why"
        placeholder="a sentence or two. as literal or as strange as you like."
        maxlength="600"
        rows="4"
        required
      />
      <span class="counter">{{ whyCount }} / 600</span>
    </label>

    <label class="field field--inline">
      <span class="label">signed</span>
      <input
        v-model="name"
        type="text"
        placeholder="leave blank to stay anonymous"
        maxlength="60"
        autocomplete="off"
      />
    </label>

    <div class="actions">
      <button class="plant" type="submit" :disabled="!canSubmit">
        {{ submitting ? 'planting...' : 'plant' }}
      </button>
      <span v-if="justPlanted" class="confirm">your tree joined the forest.</span>
      <span v-if="error" class="error">{{ error }}</span>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 520px;
}

.prompt {
  margin: 0;
  display: flex;
  flex-direction: column;
  line-height: 1;
  font-family: var(--serif-display);
  font-weight: 400;
  font-size: clamp(1.6rem, 3.6vw, 2.6rem);
  color: var(--ink-ink);
  mix-blend-mode: multiply;
}
.prompt-line {
  display: inline-block;
}

.prompt-line--bold {
  font-family: var(--display-heavy);
  font-weight: 700;
  font-size: 1.35em;
  letter-spacing: -0.02em;
  color: var(--ink-green);
  transform: translateX(-0.1em);
}
.prompt-line:nth-child(2) {
  align-self: flex-end;
  font-style: italic;
  padding-right: 0.8em;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
}
.field--inline {
  flex-direction: row;
  align-items: baseline;
  gap: 12px;
}
.field--inline .label {
  flex: 0 0 auto;
}
.field--inline input {
  flex: 1;
}

.label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-ink);
  opacity: 0.65;
}

input,
textarea {
  font-family: var(--serif-body);
  font-size: 1.05rem;
  background: transparent;
  border: none;
  border-bottom: 1.5px solid var(--ink-ink);
  padding: 6px 2px;
  color: var(--ink-ink);
  outline: none;
  resize: vertical;
  border-radius: 0;
}
input::placeholder,
textarea::placeholder {
  color: var(--ink-ink);
  opacity: 0.35;
  font-style: italic;
  font-size: 14px;
}
input:focus,
textarea:focus {
  border-bottom-color: var(--ink-red);
}
textarea {
  border: 1.5px solid var(--ink-ink);
  padding: 10px;
  min-height: 110px;
  line-height: 1.45;
}
textarea:focus {
  border-color: var(--ink-red);
}

.counter {
  position: absolute;
  right: 6px;
  bottom: -14px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--ink-ink);
  opacity: 0.5;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
}

.plant {
  font-family: var(--display-heavy);
  font-weight: 700;
  font-size: 1.2rem;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  padding: 10px 22px;
  background: var(--ink-red);
  color: white;
  border: none;
  cursor: pointer;
  transform: rotate(-1.5deg);
  transition: transform 0.15s ease;
}
.plant:hover:not(:disabled) {
  transform: rotate(-1.5deg) translateY(-1px);
}
.plant:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.confirm {
  font-family: var(--serif-display);
  font-style: italic;
  color: var(--ink-green);
  mix-blend-mode: multiply;
}
.error {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-red);
}
</style>
