<script setup lang="ts">
defineProps<{settingId:string;title:string;open:boolean}>()
const emit=defineEmits<{toggle:[]}>()
</script>
<template>
  <section class="setting-card setting-section">
    <div class="setting-section-header">
      <h2><button :id="`setting-${settingId}`" :aria-expanded="open" :aria-controls="`setting-content-${settingId}`" @click="emit('toggle')">{{ title }}</button></h2>
      <slot name="control" />
    </div>
    <div v-show="open" :id="`setting-content-${settingId}`" class="setting-section-content" role="region" :aria-labelledby="`setting-${settingId}`"><slot /></div>
  </section>
</template>
