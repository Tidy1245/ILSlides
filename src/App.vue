<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { Plus, ArrowLeft, ArrowRight, FolderOpen, Images, X, Pencil, RefreshCw, Trash2, ChevronRight, Expand, Grid2X2 } from 'lucide-vue-next'
import { Folders, loadCollections, sortedPhotos, nextIndex, type Collection, type Photo } from './library'
const collections = ref(loadCollections())
const active = ref<Collection | null>(null)
const photos = ref<Photo[]>([])
const index = ref(0)
const displayed = ref('')
const displayedName = ref('')
const covers = ref<Record<string,string>>({})
const busy = ref(false)
const imageBusy = ref(false)
const error = ref('')
const modal = ref(false)
const editId = ref<string | null>(null)
const name = ref('')
const selectedFolder = ref<{uri:string;name:string} | null>(null)
const controls = ref(true)
const total = computed(() => collections.value.reduce((sum,c) => sum + (c.count || 0), 0))
const current = computed(() => photos.value[index.value])
const cache = new Map<string,string>()
let request = 0
let touchX = 0, touchY = 0
let removeBack: (() => void) | undefined
watch(collections, value => {
  try { localStorage.setItem('ilslides.collections', JSON.stringify(value)) }
  catch { error.value = '儲存空間不足，集合設定無法保存。' }
}, { deep:true })
function message(e: unknown) { return e instanceof Error ? e.message : String(e) }
async function image(uri:string, size=2048) {
  const key = `${uri}:${size}`
  if(cache.has(key)) return cache.get(key)!
  const result = await Folders.image({uri,size})
  // A bounded cache keeps large folders from filling WebView memory.
  if(cache.size >= 14) cache.delete(cache.keys().next().value!)
  cache.set(key,result.data)
  return result.data
}
async function show() {
  const token = ++request
  const photo = current.value
  if(!photo) { displayed.value = ''; return }
  imageBusy.value = true
  try {
    const data = await image(photo.uri)
    // Decode before changing layers so the fade never flashes an empty frame.
    await new Promise<void>((resolve,reject) => { const img = new Image(); img.onload = () => resolve(); img.onerror = () => reject(new Error('圖片無法顯示')); img.src = data })
    if(token !== request) return
    displayedName.value = photo.name; displayed.value = data
    const neighbor = photos.value[nextIndex(index.value,1,photos.value.length)]
    if(neighbor && neighbor.uri !== photo.uri) void image(neighbor.uri).catch(() => {})
  } catch(e) { if(token === request) { displayed.value=''; error.value = `無法讀取「${photo.name}」，請確認檔案仍存在。${message(e)}` } }
  finally { if(token === request) imageBusy.value = false }
}
watch(index, show)
async function cover(c:Collection) {
  try { const {images} = await Folders.list({tree:c.tree}); c.count=images.length; const first=sortedPhotos(images)[0]; if(first) covers.value[c.id]=await image(first.uri,600); else delete covers.value[c.id] }
  catch { /* Collection can be re-authorized from its edit sheet. */ }
}
async function open(c:Collection) {
  if(busy.value) return
  busy.value=true; error.value=''
  try {
    const result=await Folders.list({tree:c.tree})
    cache.clear(); photos.value=sortedPhotos(result.images); c.count=photos.value.length
    index.value=0; displayed.value=''; active.value=c; controls.value=true
    await show()
  } catch(e) { error.value=`無法開啟目錄，請編輯集合並重新選擇目錄。${message(e)}` }
  finally { busy.value=false }
}
function close() { ++request; active.value=null; photos.value=[]; displayed.value=''; imageBusy.value=false }
function step(delta:number) { if(photos.value.length > 1) { error.value=''; index.value=nextIndex(index.value,delta,photos.value.length) } }
function start(e:TouchEvent) { touchX=e.changedTouches[0]!.clientX; touchY=e.changedTouches[0]!.clientY }
function end(e:TouchEvent) { const dx=e.changedTouches[0]!.clientX-touchX,dy=e.changedTouches[0]!.clientY-touchY; if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.3) step(dx<0?1:-1) }
function edit(c?:Collection) { editId.value=c?.id || null; name.value=c?.name || ''; selectedFolder.value=c?{uri:c.tree,name:c.folder}:null; modal.value=true; error.value='' }
async function pick() {
  if(!Capacitor.isNativePlatform()) { error.value='請安裝 Android APK，使用系統目錄選擇器讀取手機圖片。'; return }
  try { const result=await Folders.pick(); if(!result.cancelled) { selectedFolder.value=result; if(!name.value.trim()) name.value=result.name } }
  catch(e) { error.value=`無法選擇目錄：${message(e)}` }
}
async function save() {
  if(!name.value.trim() || !selectedFolder.value || busy.value) return
  busy.value=true; error.value=''
  try {
    const result=await Folders.list({tree:selectedFolder.value.uri})
    const c:Collection={id:editId.value || crypto.randomUUID(),name:name.value.trim(),tree:selectedFolder.value.uri,folder:selectedFolder.value.name,count:result.images.length}
    const pos=collections.value.findIndex(v=>v.id===c.id)
    if(pos<0) collections.value.push(c); else collections.value[pos]=c
    if(active.value?.id===c.id) { active.value=c; photos.value=sortedPhotos(result.images); index.value=0; await show() }
    modal.value=false; void cover(c)
  } catch(e) { error.value=`無法讀取此目錄：${message(e)}` }
  finally { busy.value=false }
}
const deleting = ref(false)
function remove() {
  if(!editId.value) return
  collections.value=collections.value.filter(c=>c.id!==editId.value)
  delete covers.value[editId.value]
  if(active.value?.id===editId.value) close()
  modal.value=false; deleting.value=false
}
watch(modal, () => deleting.value=false)
function keyboard(e:KeyboardEvent) { if(modal.value) { if(e.key==='Escape') modal.value=false; return }; if(active.value) { if(e.key==='ArrowRight') step(1); if(e.key==='ArrowLeft') step(-1); if(e.key==='Escape') close() } }
onMounted(async () => {
  window.addEventListener('keydown',keyboard)
  if(Capacitor.isNativePlatform()) {
    const listener=await NativeApp.addListener('backButton', () => { if(modal.value) modal.value=false; else if(active.value) close(); else void NativeApp.exitApp() })
    removeBack=()=>void listener.remove()
    for(const c of collections.value) await cover(c)
  }
})
onUnmounted(() => { window.removeEventListener('keydown',keyboard); removeBack?.() })
</script>

<template>
  <main v-if="!active" class="library">
    <header class="topbar"><a class="brand" href="#" aria-label="ILSlides 首頁"><span class="brand-icon"><Images :size="21" /></span>ILSlides<span class="brand-dot"></span></a><span class="local-badge">本機相片庫</span></header>
    <section class="intro"><div class="eyebrow">YOUR MOMENTS, TOGETHER</div><h1>收藏每一個<span>值得回看的瞬間。</span></h1><p>把喜歡的照片，整理成你的專屬集合。</p></section>
    <section class="stats"><div><strong>{{ collections.length.toString().padStart(2,'0') }}</strong><span>圖片集合</span></div><div class="stat-divider"></div><div><strong>{{ total.toLocaleString() }}</strong><span>張照片</span></div><span class="offline"><span></span>僅在裝置上讀取</span></section>
    <div class="section-heading"><div><h2>我的集合 <span>{{ collections.length }}</span></h2><p>一個目錄，一段回憶</p></div><button class="add-button" @click="edit()"><Plus :size="18" />新增集合</button></div>
    <section v-if="collections.length" class="collection-grid">
      <article v-for="(c,i) in collections" :key="c.id" class="collection-card">
        <button class="card-open" @click="open(c)" :disabled="busy" :aria-label="`開啟 ${c.name}`"><div class="cover" :class="`cover-${i%3}`"><img v-if="covers[c.id]" :src="covers[c.id]" alt="" /><div v-else class="cover-placeholder"><Images :size="38" :stroke-width="1" /></div><span class="photo-count"><Images :size="13" />{{ c.count }} 張</span><span class="open-indicator"><ChevronRight :size="20" /></span></div><div class="card-copy"><h3>{{ c.name }}</h3><p><FolderOpen :size="13" />{{ c.folder }}</p></div></button>
        <button class="card-edit icon-button" @click="edit(c)" :aria-label="`編輯 ${c.name}`"><Pencil :size="16" /></button>
      </article>
      <button class="new-card" @click="edit()"><span><Plus :size="26" /></span><strong>新的故事</strong><small>新增你的圖片集合</small></button>
    </section>
    <section v-else class="empty-card"><div class="empty-art"><div class="art-frame back"></div><div class="art-frame front"><Images :size="48" :stroke-width="1" /><span class="art-spark">✦</span></div></div><h2>你的回憶，從這裡開始</h2><p>選擇手機上的圖片目錄，<br />建立第一個專屬集合。</p><button class="primary" @click="edit()"><FolderOpen :size="18" />選擇目錄，建立集合</button><span class="empty-note">照片保留在原目錄，無需上傳</span></section>
    <footer><span class="footer-line"></span>留一點空間，給美好的日常<span class="footer-line"></span></footer>
    <div class="bottom-bar"><span><Grid2X2 :size="20" />我的集合</span><span class="version">ILSlides · 1.0.0</span></div>
  </main>
  <main v-else class="viewer" @touchstart.passive="start" @touchend.passive="end">
    <header class="viewer-header" :class="{hidden:!controls}"><button class="icon-button" @click="close()" aria-label="返回集合"><ArrowLeft /></button><div><h2>{{ active.name }}</h2><span>{{ photos.length ? index+1 : 0 }} / {{ photos.length }}</span></div><button class="icon-button" @click="edit(active)" aria-label="編輯集合"><Pencil :size="20" /></button></header>
    <div class="image-stage" @click="controls=!controls"><Transition name="dissolve"><img v-if="displayed" :key="displayed" :src="displayed" :alt="displayedName" class="main-photo" /></Transition><span v-if="imageBusy" class="loading-indicator">讀取中</span><div v-if="!photos.length" class="viewer-empty"><Images :size="40" /><h2>目錄中還沒有圖片</h2><p>加入圖片後，點擊重新讀取。</p><button class="primary" @click.stop="open(active)"><RefreshCw :size="18" />重新讀取</button></div></div>
    <div class="viewer-bottom" :class="{hidden:!controls}"><p class="filename">{{ current?.name }}</p><div class="viewer-actions"><button class="icon-button" @click="step(-1)" :disabled="photos.length<2" aria-label="上一張"><ArrowLeft /></button><div class="swipe-hint">左右滑動瀏覽<span>淡入 · 淡出</span></div><button class="icon-button" @click="step(1)" :disabled="photos.length<2" aria-label="下一張"><ArrowRight /></button></div><div class="viewer-tools"><button @click="open(active)" :disabled="busy"><RefreshCw :size="16" />重新讀取</button><button @click="controls=false"><Expand :size="16" />沉浸瀏覽</button></div></div>
  </main>
  <div v-if="error" class="toast" role="alert"><span>{{ error }}</span><button @click="error=''" aria-label="關閉訊息"><X :size="18" /></button></div>
  <div v-if="modal" class="modal-backdrop" @click.self="modal=false"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-heading"><div><span class="eyebrow">CURATE YOUR COLLECTION</span><h2 id="sheet-title">{{ editId ? '編輯集合' : '建立新的集合' }}</h2></div><button class="icon-button" @click="modal=false" aria-label="關閉"><X :size="21" /></button></div><label class="field-label" for="collection-name">集合名稱</label><input id="collection-name" v-model="name" maxlength="60" placeholder="例如：旅行片刻、日常光影" @keydown.enter="save" /><label class="field-label">圖片來源</label><button class="folder-select" @click="pick" :disabled="busy"><span class="folder-symbol"><FolderOpen :size="23" /></span><span><strong>{{ selectedFolder?.name || '選擇裝置目錄' }}</strong><small>{{ selectedFolder ? '點擊重新選擇目錄' : '讀取此目錄內的圖片' }}</small></span><ChevronRight :size="18" /></button><p class="sheet-note">只讀取所選目錄的圖片，不移動或修改原始檔案。<br />支援 JPG、PNG、WebP、GIF、HEIC 等裝置可解碼格式。</p><button class="primary save-button" :disabled="!name.trim() || !selectedFolder || busy" @click="save">{{ busy ? '讀取目錄中…' : editId ? '儲存變更' : '建立集合' }}<ArrowRight :size="18" /></button><template v-if="editId"><button v-if="!deleting" class="delete-button" @click="deleting=true"><Trash2 :size="16" />移除集合</button><div v-else class="delete-confirm"><p>確定移除集合？原始圖片會保留。</p><button @click="deleting=false">取消</button><button class="danger" @click="remove">確定移除</button></div></template></section></div>
</template>




