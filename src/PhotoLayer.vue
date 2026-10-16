<script setup lang="ts">
import { computed, ref } from 'vue'
import { imageBox, initialView } from './viewer-gestures'
const props=defineProps<{src:string;name:string;width:number;height:number}>()
const emit=defineEmits<{ready:[src:string,width:number,height:number]}>()
const natural=ref({width:0,height:0})
const style=computed(()=>{
  if(!natural.value.width || !props.width || !props.height) return {visibility:'hidden' as const}
  const box=imageBox(initialView(),{width:props.width,height:props.height,imageWidth:natural.value.width,imageHeight:natural.value.height})
  const offset=(length:number,space:number,axis:string)=>{
    const edge=`max(0px, calc((${length}px * var(--zoom-scale) - ${space}px) / 2))`
    return `clamp(calc(-1 * ${edge}), calc((0.5 - var(--zoom-${axis})) * ${length}px * var(--zoom-scale)), ${edge})`
  }
  // Inherited variables also update the leaving DOM after Vue stops its component effects.
  return {width:box.width+'px',height:box.height+'px',left:(props.width-box.width)/2+'px',top:(props.height-box.height)/2+'px',transform:`translate(${offset(box.width,props.width,'x')}, ${offset(box.height,props.height,'y')}) scale(var(--zoom-scale))`}
})
function loaded(event:Event) {
  const img=event.target as HTMLImageElement
  natural.value={width:img.naturalWidth,height:img.naturalHeight}
  emit('ready',props.src,img.naturalWidth,img.naturalHeight)
}
</script>
<template><img :src="src" :alt="name" :style="style" class="main-photo" draggable="false" @load="loaded" /></template>
