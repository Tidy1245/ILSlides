<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Folders } from './library'
const props=defineProps<{uri:string;name:string}>()
const data=ref(''), failed=ref(false), root=ref<HTMLElement>()
let observer:IntersectionObserver | undefined, token=0
async function load() {
  const id=++token
  try { const value=await Folders.image({uri:props.uri,size:320}); if(id===token) data.value=value.data }
  catch { if(id===token) failed.value=true }
}
onMounted(() => {
  observer=new IntersectionObserver(entries => { if(entries.some(e=>e.isIntersecting)) { observer?.disconnect(); void load() } },{rootMargin:'100px'})
  if(root.value) observer.observe(root.value)
})
watch(() => props.uri, () => { data.value=''; failed.value=false; void load() })
onUnmounted(() => { ++token; observer?.disconnect() })
</script>
<template><span ref="root" class="photo-thumb"><img v-if="data" :src="data" alt="" /><span v-else>{{ failed ? '無法讀取' : '載入中' }}</span></span></template>
