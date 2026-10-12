<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { X, RotateCcw } from 'lucide-vue-next'
import { Folders, type Photo } from './library'
import { drawCover, cropRect, type CoverSettings } from './cover'
import PhotoThumb from './PhotoThumb.vue'
const props=defineProps<{photos:Photo[];initial?:CoverSettings}>()
const emit=defineEmits<{close:[];save:[CoverSettings]}>()
const settings=ref<CoverSettings>({...props.initial || {uri:props.photos[0]!.uri,x:.5,y:.5,zoom:1}})
const canvas=ref<HTMLCanvasElement>(),ready=ref(false),error=ref('')
let loaded:HTMLImageElement | null=null,request=0,lastX=0,lastY=0,dragging=false
async function load(uri:string) {
 const token=++request; ready.value=false; error.value=''
 try {
  const result=await Folders.image({uri,size:1600})
  const img=new Image(); img.src=result.data
  await img.decode()
  if(token!==request) return
  loaded=img; ready.value=true; draw()
 } catch { if(token===request) error.value='此圖片無法讀取，請改選其他圖片。' }
}
function draw() { if(canvas.value && loaded && ready.value) drawCover(canvas.value,loaded,settings.value) }
function choose(uri:string) { settings.value={uri,x:.5,y:.5,zoom:1}; void load(uri) }
function down(e:PointerEvent) { if(!ready.value) return; dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.value?.setPointerCapture(e.pointerId) }
function move(e:PointerEvent) {
 if(!dragging || !loaded || !canvas.value) return
 const rect=canvas.value.getBoundingClientRect(),crop=cropRect(loaded.naturalWidth,loaded.naturalHeight,settings.value)
 const overflowX=rect.width*(loaded.naturalWidth/crop.width-1),overflowY=rect.height*(loaded.naturalHeight/crop.height-1)
 if(overflowX>0) settings.value.x=Math.max(0,Math.min(1,settings.value.x-(e.clientX-lastX)/overflowX))
 if(overflowY>0) settings.value.y=Math.max(0,Math.min(1,settings.value.y-(e.clientY-lastY)/overflowY))
 lastX=e.clientX;lastY=e.clientY
}
watch(settings,draw,{deep:true})
onMounted(()=>void load(settings.value.uri))
</script>
<template><div class="crop-backdrop"><section class="sheet crop-sheet" role="dialog" aria-modal="true" aria-labelledby="crop-title"><div class="sheet-heading"><div><span class="eyebrow">COLLECTION COVER</span><h2 id="crop-title">調整集合封面</h2></div><button class="icon-button" @click="emit('close')" aria-label="取消封面調整"><X :size="20" /></button></div><div class="crop-window"><canvas ref="canvas" aria-label="封面裁切視窗" @pointerdown="down" @pointermove="move" @pointerup="dragging=false" @pointercancel="dragging=false" /><span v-if="!ready">{{ error || '讀取圖片中…' }}</span><div class="crop-guides"></div></div><p class="sheet-note">拖曳圖片調整位置，使用縮放調整封面範圍。</p><div class="zoom-row"><label for="cover-zoom">縮放 {{ Number(settings.zoom).toFixed(1) }}×</label><button @click="settings.x=.5;settings.y=.5;settings.zoom=1"><RotateCcw :size="14" />重設位置</button></div><input id="cover-zoom" v-model.number="settings.zoom" type="range" min="1" max="3" step="0.05" :disabled="!ready" /><label class="field-label">從集合中選擇封面</label><div class="cover-options"><button v-for="p in photos" :key="p.uri" :class="{chosen:settings.uri===p.uri}" :aria-label="`以 ${p.name} 作為封面`" :aria-pressed="settings.uri===p.uri" @click="choose(p.uri)"><PhotoThumb :uri="p.uri" :name="p.name" /><span>{{ p.name }}</span></button></div><button class="primary save-button" :disabled="!ready" @click="emit('save',{...settings})">使用此封面</button></section></div></template>
