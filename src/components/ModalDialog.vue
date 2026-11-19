<script setup>
import { useTemplateRef, watchEffect } from 'vue'

const props = defineProps({
  open: Boolean,
  label: { type: String, required: true }
})
const emit = defineEmits(['close'])
const dialog = useTemplateRef('dialog')

watchEffect(() => {
  const element = dialog.value
  if (!element || element.open === props.open) return
  if (props.open) element.showModal()
  else element.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="modal-panel"
    :aria-label="label"
    @cancel.prevent="emit('close')"
    @click.self="emit('close')"
  >
    <div class="modal-content">
      <slot />
    </div>
  </dialog>
</template>
