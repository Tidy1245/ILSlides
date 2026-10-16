<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import PhotoThumb from './PhotoThumb.vue'
import { movePhoto } from './photo-picker'
import type { Photo } from './library'
const props=defineProps<{photos:Photo[]}>()
const emit=defineEmits<{reorder:[photos:Photo[]];remove:[photo:Photo]}>()
const root=ref<HTMLElement>(),preview=ref<Photo[]>([]),dragging=ref(''),ghost=ref({x:0,y:0,width:66,height:80,offsetX:0,offsetY:0,src:'',name:''})
type Gesture={id:number;uri:string;x:number;y:number;lastX:number;lastY:number;scrollLeft:number;scrollTop:number;scroll?:HTMLElement;moved:boolean}
let gesture:Gesture | undefined,timer:ReturnType<typeof setTimeout> | undefined,animation=0
const contacts=new Set<number>()
function cancel() {
 const wasActive=!!gesture
 clearTimeout(timer);cancelAnimationFrame(animation);gesture=undefined;dragging.value='';preview.value=[]
 return wasActive
}
function reorderAt(x:number) {
 if(!root.value || !dragging.value) return
 const buttons=[...root.value.querySelectorAll<HTMLElement>('[data-photo-uri]')]
 let target=0,best=Infinity
 buttons.forEach((button,index)=>{const rect=button.getBoundingClientRect(),delta=Math.abs(x-(rect.left+rect.width/2));if(delta<best) {target=index;best=delta}})
 const from=preview.value.findIndex(p=>p.uri===dragging.value)
 if(from!==target) preview.value=movePhoto(preview.value,from,target)
}
function tick() {
 if(!gesture || !dragging.value || !root.value) return
 const rect=root.value.getBoundingClientRect(),x=gesture.lastX
 const speed=x<rect.left+32 ? -Math.min(12,(rect.left+32-x)*.4) : x>rect.right-32 ? Math.min(12,(x-rect.right+32)*.4) : 0
 if(speed) {root.value.scrollLeft+=speed;reorderAt(x)}
 animation=requestAnimationFrame(tick)
}
function down(e:PointerEvent) {
 if(e.button!==0 || !root.value) return
 const button=(e.target as HTMLElement).closest<HTMLElement>('[data-photo-uri]')
 if(!button && !contacts.size) return
 root.value.setPointerCapture(e.pointerId)
 contacts.add(e.pointerId)
 if(contacts.size>1) {cancel();return}
 if(!button) return
 const uri=button.dataset.photoUri!,rect=button.getBoundingClientRect(),scroll=root.value.closest<HTMLElement>('.editor-scroll') || undefined
 gesture={id:e.pointerId,uri,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,scrollLeft:root.value.scrollLeft,scrollTop:scroll?.scrollTop || 0,scroll,moved:false}
 ghost.value={x:rect.left,y:rect.top,width:rect.width,height:rect.height,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,src:button.querySelector('img')?.src || '',name:props.photos.find(p=>p.uri===uri)?.name || ''}
 timer=setTimeout(()=>{
  if(!gesture || gesture.moved || contacts.size!==1) return
  preview.value=[...props.photos];dragging.value=uri
  animation=requestAnimationFrame(tick)
 },450)
}
function move(e:PointerEvent) {
 if(!gesture || gesture.id!==e.pointerId || !root.value) return
 const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y
 gesture.lastX=e.clientX;gesture.lastY=e.clientY
 if(dragging.value) {
  ghost.value.x=e.clientX-ghost.value.offsetX;ghost.value.y=e.clientY-ghost.value.offsetY
  reorderAt(e.clientX)
 } else if(Math.hypot(dx,dy)>10) {
  clearTimeout(timer);gesture.moved=true
  if(Math.abs(dx)>=Math.abs(dy)) root.value.scrollLeft=gesture.scrollLeft-dx
  else if(gesture.scroll) gesture.scroll.scrollTop=gesture.scrollTop-dy
 }
}
function up(e:PointerEvent) {
 contacts.delete(e.pointerId)
 if(!gesture || gesture.id!==e.pointerId) return
 const current=gesture,isDrag=!!dragging.value,order=[...preview.value],rect=root.value?.getBoundingClientRect()
 cancel()
 if(isDrag) {
  if(rect && e.clientY>=rect.top-50 && e.clientY<=rect.bottom+50) emit('reorder',order)
 } else if(!current.moved && Math.hypot(e.clientX-current.x,e.clientY-current.y)<=10) {
  const photo=props.photos.find(p=>p.uri===current.uri);if(photo) emit('remove',photo)
 }
}
function canceled(e:PointerEvent) {contacts.delete(e.pointerId);if(gesture?.id===e.pointerId) cancel()}
function click(e:MouseEvent,photo:Photo) {if(e.detail===0) emit('remove',photo)}
watch(()=>props.photos,()=>cancel())
onUnmounted(()=>{cancel();contacts.clear()})
defineExpose({cancel})
</script>
<template>
 <div ref="root" class="selected-strip reorder-strip" :class="{reordering:!!dragging}" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="canceled" @lostpointercapture="canceled" @contextmenu.prevent @dragstart.prevent>
  <button v-for="p in dragging ? preview : photos" :key="p.uri" :data-photo-uri="p.uri" :class="{'drag-origin':dragging===p.uri}" :aria-label="`移除已選 ${p.name}`" @click.stop.prevent="click($event,p)"><PhotoThumb :uri="p.uri" :name="p.name" /><span>{{ p.name }}</span><X :size="13" /></button>
 </div>
 <span class="reorder-status" role="status">{{ dragging ? '拖曳調整中，放開完成排序' : '長按圖片可拖曳排序；點擊可移除' }}</span>
 <Teleport to="body"><div v-if="dragging" class="photo-drag-ghost" :style="{left:ghost.x+'px',top:ghost.y+'px',width:ghost.width+'px',height:ghost.height+'px'}" aria-hidden="true"><img v-if="ghost.src" :src="ghost.src" alt="" /><span>{{ ghost.name }}</span></div></Teleport>
</template>
