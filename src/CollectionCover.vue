<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Images } from 'lucide-vue-next'
import { coverKey, coverLoader } from './cover-cache'
import type { Collection } from './library'
const props=defineProps<{collection:Collection}>()
const root=ref<HTMLElement>(),src=ref('')
let observer:IntersectionObserver | undefined,unsubscribe:(()=>void) | undefined,retried=false
function load() {
  unsubscribe?.()
  unsubscribe=coverLoader.request(props.collection,value=>{src.value=value})
}
async function failed() {
  src.value=''
  if(retried) return
  retried=true; unsubscribe?.()
  await coverLoader.remove(coverKey(props.collection)).catch(()=>{})
  if(root.value?.isConnected) load()
}
onMounted(()=>{
  observer=new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting)) load()
    else { unsubscribe?.(); unsubscribe=undefined }
  },{rootMargin:'120px'})
  if(root.value) observer.observe(root.value)
})
watch(()=>[coverKey(props.collection),props.collection.photos.map(p=>p.uri).join('\n')],()=>{ src.value=''; retried=false; unsubscribe?.(); if(root.value) {observer?.unobserve(root.value);observer?.observe(root.value)} })
onUnmounted(()=>{unsubscribe?.();observer?.disconnect()})
</script>
<template><div ref="root" class="cover"><img v-if="src" :src="src" alt="" @error="failed" /><div v-else class="cover-placeholder"><Images :size="38" :stroke-width="1" /></div><slot /></div></template>
