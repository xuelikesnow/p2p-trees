<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import SubmissionForm from './SubmissionForm.vue'

const props = defineProps({
  open: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const planted = ref(null)
const panelRef = ref(null)

// Reset the confirmation state whenever the drawer closes so it starts
// fresh on the next open.
watch(
  () => props.open,
  (open) => {
    if (!open) {
      // Delay the reset until the close transition finishes so the user
      // doesn't see the form flash back in on the way out.
      setTimeout(() => {
        planted.value = null
      }, 260)
    } else {
      // Move focus to the drawer so keyboard users land inside it.
      nextTick(() => {
        panelRef.value?.querySelector('input, textarea, button')?.focus()
      })
    }
  }
)

function handleSubmitted(response) {
  planted.value = response
}

function handleClose() {
  emit('close')
}

function handleBackdrop(e) {
  // Only close if the click is directly on the backdrop, not bubbled from
  // inside the panel.
  if (e.target === e.currentTarget) handleClose()
}

function handleKeydown(e) {
  if (e.key === 'Escape' && props.open) handleClose()
}
window.addEventListener('keydown', handleKeydown)
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <transition name="backdrop">
    <div v-if="open" class="backdrop" @mousedown="handleBackdrop" aria-hidden="true" />
  </transition>
  <transition name="panel">
    <aside
      v-if="open"
      ref="panelRef"
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-label="Plant a tree"
    >
      <button
        class="close"
        type="button"
        aria-label="Close"
        @click="handleClose"
      >
        <span aria-hidden="true">×</span>
      </button>

      <div class="panel-inner">
        <SubmissionForm v-if="!planted" @submitted="handleSubmitted" />

        <div v-else class="confirm">
          <p class="confirm-headline">
            <em>your tree joined the forest.</em>
          </p>
          <p class="confirm-body">
            <span class="swatch">{{ planted.species }}</span>
            <br />
            <span class="why">“{{ planted.why }}”</span>
            <br />
            <span
              v-if="planted.name && planted.name !== 'anonymous'"
              class="byline"
            >
              — {{ planted.name }}
            </span>
          </p>
          <div class="confirm-actions">
            <button class="cta" type="button" @click="handleClose">
              see the forest →
            </button>
            <button
              class="secondary"
              type="button"
              @click="planted = null"
            >
              plant another
            </button>
          </div>
        </div>
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(26, 31, 28, 0.18);
  backdrop-filter: blur(1.5px);
  -webkit-backdrop-filter: blur(1.5px);
}

.panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  width: min(480px, 100vw);
  background: var(--paper);
  border-left: 1.5px solid var(--ink-ink);
  box-shadow: -10px 0 40px rgba(26, 31, 28, 0.08);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

.panel-inner {
  padding: 56px 32px 32px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.close {
  position: absolute;
  top: 12px;
  right: 14px;
  width: 34px;
  height: 34px;
  border: 1px solid var(--ink-ink);
  background: transparent;
  color: var(--ink-ink);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.close:hover {
  background: var(--ink-ink);
  color: var(--paper);
}

.confirm {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 12px;
}
.confirm-headline {
  margin: 0;
  font-family: var(--serif-display);
  font-size: clamp(1.5rem, 3.5vw, 2rem);
  color: var(--ink-green);
  mix-blend-mode: multiply;
  font-style: italic;
  line-height: 1.1;
}
.confirm-body {
  margin: 0;
  font-family: var(--serif-body);
  color: var(--ink-ink);
  line-height: 1.5;
}
.swatch {
  font-family: var(--display-heavy);
  font-weight: 700;
  font-size: 1.35rem;
  text-transform: lowercase;
  color: var(--ink-red);
  letter-spacing: -0.01em;
}
.why {
  display: inline-block;
  margin: 8px 0;
  font-style: italic;
}
.byline {
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  opacity: 0.7;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.cta {
  font-family: var(--display-heavy);
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  padding: 10px 20px;
  background: var(--ink-red);
  color: var(--paper);
  border: none;
  cursor: pointer;
  transform: rotate(-1.2deg);
  transition: transform 0.15s ease;
}
.cta:hover {
  transform: rotate(-1.2deg) translateY(-2px);
}
.secondary {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--ink-ink);
  color: var(--ink-ink);
  cursor: pointer;
}
.secondary:hover {
  background: var(--ink-ink);
  color: var(--paper);
}

/* Transitions */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

.panel-enter-active,
.panel-leave-active {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-enter-from,
.panel-leave-to {
  transform: translateX(100%);
}
</style>
