<script setup lang="ts">
import { reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import PhotoLayer from './PhotoLayer.vue'
import { initialView, ViewerGestures, type ImageFrame } from './viewer-gestures'
const props=defineProps<{src:string;name:string;doubleScale:number;enabled:boolean}>()
const emit=defineEmits<{tap:[];step:[delta:number]}>()
const root=ref<HTMLElement>(),size=reactive({width:0,height:0}),natural=reactive({src:'',width:0,height:0})
const view=reactive(initialView())
let observer:ResizeObserver | undefined
function frame():ImageFrame | undefined {
  if(!size.width || !size.height || natural.src!==props.src || !natural.width || !natural.height) return
  return {width:size.width,height:size.height,imageWidth:natural.width,imageHeight:natural.height}
}
const gestures=new ViewerGestures({frame,view:()=>view,change:value=>Object.assign(view,value),tap:()=>emit('tap'),step:delta=>emit('step',delta),doubleScale:()=>props.doubleScale})
function point(e:PointerEvent) {const rect=root.value!.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top}}
function down(e:PointerEvent) {
  if(!props.enabled || !frame() || e.button!==0 || (e.target as HTMLElement).closest('button,input,select,a')) return
  root.value?.setPointerCapture(e.pointerId);gestures.down(e.pointerId,point(e),e.timeStamp)
}
function ready(src:string,width:number,height:number) {if(src===props.src) Object.assign(natural,{src,width,height})}
watch(()=>props.src,()=>gestures.abort())
watch(()=>props.enabled,enabled=>{if(!enabled) gestures.abort()})
onMounted(()=>{
  observer=new ResizeObserver(entries=>{
    const rect=entries[0]?.contentRect
    if(rect && (rect.width!==size.width || rect.height!==size.height)) {
      gestures.abort();size.width=rect.width;size.height=rect.height
    }
  })
  if(root.value) observer.observe(root.value)
})
onUnmounted(()=>{observer?.disconnect();gestures.dispose()})
defineExpose({cancel:()=>gestures.abort()})
</script>
<template>
 <div ref="root" class="image-stage" :style="{'--zoom-scale':view.scale,'--zoom-x':view.x,'--zoom-y':view.y}" :data-scale="view.scale" :data-focus-x="view.x" :data-focus-y="view.y" @pointerdown="down" @pointermove="gestures.move($event.pointerId,point($event))" @pointerup="gestures.up($event.pointerId,point($event),$event.timeStamp)" @pointercancel="gestures.cancelPointer($event.pointerId)" @lostpointercapture="gestures.cancelPointer($event.pointerId)" @click.stop.prevent @dblclick.stop.prevent @contextmenu.prevent>
  <Transition name="dissolve"><PhotoLayer v-if="src" :key="src" :src="src" :name="name" :width="size.width" :height="size.height" @ready="ready" /></Transition>
  <slot />
 </div>
</template>
