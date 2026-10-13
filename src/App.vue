<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { Plus, ArrowLeft, ArrowRight, FolderOpen, Images, X, Pencil, Trash2, ChevronRight, ArrowUp, Grid2X2, Check, Search, Settings, Home, ArrowUpDown } from 'lucide-vue-next'
import { Folders, loadCollections, loadFolders, uniquePhotos, sortedPhotos, nextIndex, type Collection, type Photo, type SourceFolder } from './library'
import PhotoThumb from './PhotoThumb.vue'
import CoverEditor from './CoverEditor.vue'
import { drawCover, type CoverSettings } from './cover'
import { version } from '../package.json'
import { sortCollections, loadPreferences, transitionTime } from './preferences'
const folders = ref(loadFolders())
const collections = ref(loadCollections())
const active = ref<Collection | null>(null)
const photos = ref<Photo[]>([])
const index = ref(0)
const displayed = ref('')
const displayedName = ref('')
const covers = ref<Record<string,string>>({})
type Page='home'|'collections'|'settings'
function hashPage():Page { const route=location.hash.slice(2); return route==='collections' || route==='settings' ? route : 'home' }
const page = ref<Page>(hashPage())
let settingsReturn:Page='home'
function navigate(next:Page) { if(next==='settings' && page.value!=='settings') settingsReturn=page.value; page.value=next; location.hash='/'+next; window.scrollTo(0,0) }
function changedHash() { page.value=hashPage(); window.scrollTo(0,0) }
const preferences = ref(loadPreferences())
watch(preferences,value=>{ try {localStorage.setItem('ilslides.preferences',JSON.stringify(value))} catch {error.value='設定無法保存。'} },{deep:true})
const query = ref('')
const filteredCollections = computed(() => sortCollections(collections.value.filter(c => c.name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())),preferences.value.sortKey,preferences.value.sortDirection))
const visibleCollections = computed(() => page.value==='home' ? sortCollections(collections.value,'updatedAt','desc').slice(0,4) : filteredCollections.value)
function dateLabel(value?:number) { return value ? new Date(value).toLocaleDateString('zh-TW') : '未記錄' }
const draftCover = ref<CoverSettings>()
const coverEditor = ref(false)
const busy = ref(false)
const imageBusy = ref(false)
const error = ref('')
const modal = ref(false)
const editorScroll = ref<HTMLElement>()
const editorScrolled = ref(false)
function editorTop() { editorScroll.value?.scrollTo({top:0,behavior:'smooth'}) }
function updateEditorScroll() { editorScrolled.value=(editorScroll.value?.scrollTop || 0)>1 }
const editId = ref<string | null>(null)
const name = ref('')
const selectedFolder = ref<SourceFolder | null>(null)
const folderPhotos = ref<Photo[]>([])
const draftPhotos = ref<Photo[]>([])
const folderBusy = ref(false)
let folderRequest = 0
const controls = ref(true)
const total = computed(() => collections.value.reduce((sum,c) => sum + c.photos.length, 0))
const current = computed(() => photos.value[index.value])
const cache = new Map<string,string>()
let request = 0
let touchX = 0, touchY = 0
let swiped = false
let removeBack: (() => void) | undefined
watch(collections, value => {
  try { localStorage.setItem('ilslides.collections', JSON.stringify(value)) }
  catch { error.value = '儲存空間不足，集合設定無法保存。' }
}, { deep:true })
watch(folders, value => {
  try { localStorage.setItem('ilslides.folders', JSON.stringify(value)) } catch { error.value='資料夾捷徑無法保存。' }
}, {deep:true, immediate:true})
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
  delete covers.value[c.id]
  if(c.cover && c.photos.some(p=>p.uri===c.cover?.uri)) {
    try {
      const data=await image(c.cover.uri,1600), img=new Image(); img.src=data; await img.decode()
      const canvas=document.createElement('canvas'); drawCover(canvas,img,c.cover)
      covers.value[c.id]=canvas.toDataURL('image/webp',.88); return
    } catch { /* Fall back if the chosen source file is unavailable. */ }
  }
  for(const p of c.photos) {
    try { covers.value[c.id]=await image(p.uri,600); return } catch { /* Try the next selected image. */ }
  }
}
async function open(c:Collection) {
  if(busy.value) return
  if(c.legacyTree) { error.value='舊集合尚未完成轉換，請編輯並選取要保留的圖片。'; return }
  busy.value=true; error.value=''
  cache.clear(); photos.value=[...c.photos]
  index.value=0; displayed.value=''; active.value=c; controls.value=true
  try { await show() } finally { busy.value=false }
}
function close() { ++request; active.value=null; photos.value=[]; displayed.value=''; imageBusy.value=false }
function step(delta:number) { if(photos.value.length > 1) { error.value=''; index.value=nextIndex(index.value,delta,photos.value.length) } }
function toggleControls() { if(swiped) {swiped=false;return}; controls.value=!controls.value }
function start(e:TouchEvent) { swiped=false; touchX=e.changedTouches[0]!.clientX; touchY=e.changedTouches[0]!.clientY }
function end(e:TouchEvent) { const dx=e.changedTouches[0]!.clientX-touchX,dy=e.changedTouches[0]!.clientY-touchY; if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.3) {swiped=true;step(dx<0?1:-1)} }
function edit(c?:Collection, folder?:SourceFolder) {
  editId.value=c?.id || null; name.value=c?.name || ''; draftPhotos.value=c ? [...c.photos] : []
  draftCover.value=c?.cover ? {...c.cover} : undefined; coverEditor.value=false; editorScrolled.value=false
  selectedFolder.value=null; folderPhotos.value=[]; modal.value=true; error.value=''
  const initial=folder || folders.value[0]
  if(initial) void browseFolder(initial)
}
async function browseFolder(folder:SourceFolder) {
  const token=++folderRequest
  selectedFolder.value=folder; folderPhotos.value=[]; folderBusy.value=true; error.value=''
  try { const result=await Folders.list({tree:folder.uri}); if(token===folderRequest) folderPhotos.value=sortedPhotos(result.images) }
  catch(e) { if(token===folderRequest) error.value=`無法讀取資料夾，請重新授權此目錄。${message(e)}` }
  finally { if(token===folderRequest) folderBusy.value=false }
}
async function pick() {
  if(!Capacitor.isNativePlatform()) { error.value='請安裝 Android APK，使用系統目錄選擇器讀取手機圖片。'; return }
  try {
    const result=await Folders.pick()
    if(result.cancelled) return
    const folder={uri:result.uri,name:result.name}
    const pos=folders.value.findIndex(f=>f.uri===folder.uri)
    if(pos<0) folders.value.push(folder); else folders.value[pos]=folder
    await browseFolder(folder)
  } catch(e) { error.value=`無法選擇目錄：${message(e)}` }
}
function selected(uri:string) { return draftPhotos.value.some(p=>p.uri===uri) }
function toggle(p:Photo) { draftPhotos.value=selected(p.uri) ? draftPhotos.value.filter(v=>v.uri!==p.uri) : [...draftPhotos.value,p] }
function selectAll() { draftPhotos.value=uniquePhotos([...draftPhotos.value,...folderPhotos.value]) }
async function save() {
  if(!name.value.trim() || !draftPhotos.value.length || busy.value) return
  const existing=collections.value.find(c=>c.id===editId.value)
  const now=Date.now()
  const c:Collection={createdAt:existing ? existing.createdAt : now,updatedAt:now,id:editId.value || crypto.randomUUID(),name:name.value.trim(),photos:uniquePhotos(draftPhotos.value),...(draftCover.value && selected(draftCover.value.uri) ? {cover:{...draftCover.value}} : {})}
  const pos=collections.value.findIndex(v=>v.id===c.id)
  if(pos<0) collections.value.push(c); else collections.value[pos]=c
  modal.value=false; ++folderRequest
  if(active.value?.id===c.id) { active.value=c; photos.value=[...c.photos]; index.value=0; await show() }
  void cover(c)
}
const deleting = ref(false)
function remove() {
  if(!editId.value) return
  collections.value=collections.value.filter(c=>c.id!==editId.value)
  delete covers.value[editId.value]
  if(active.value?.id===editId.value) close()
  modal.value=false; deleting.value=false
}
watch(modal, () => { deleting.value=false; if(!modal.value) { ++folderRequest; folderBusy.value=false } })
function keyboard(e:KeyboardEvent) { if(coverEditor.value) { if(e.key==='Escape') coverEditor.value=false; return }; if(modal.value) { if(e.key==='Escape') modal.value=false; return }; if(active.value) { if(e.key==='ArrowRight') step(1); if(e.key==='ArrowLeft') step(-1); if(e.key==='Escape') close() } else if(e.key==='Escape' && page.value==='settings') navigate(settingsReturn) }
onMounted(async () => {
  window.addEventListener('keydown',keyboard)
  window.addEventListener('hashchange',changedHash)
  if(Capacitor.isNativePlatform()) {
    const listener=await NativeApp.addListener('backButton', () => { if(coverEditor.value) coverEditor.value=false; else if(modal.value) modal.value=false; else if(active.value) close(); else if(page.value==='settings') navigate(settingsReturn); else if(page.value==='collections') { if((document.scrollingElement?.scrollTop || window.scrollY)>1) window.scrollTo(0,0); else void NativeApp.exitApp() } else void NativeApp.exitApp() })
    removeBack=()=>void listener.remove()
        for(const c of collections.value) {
      if(c.legacyTree) {
        try { const result=await Folders.list({tree:c.legacyTree}); c.photos=sortedPhotos(result.images); delete c.legacyTree }
        catch { error.value='部分舊集合無法轉換，請編輯集合重新選取圖片。' }
      }
      await cover(c)
    }
  }
})
onUnmounted(() => { window.removeEventListener('keydown',keyboard); window.removeEventListener('hashchange',changedHash); removeBack?.() })
</script>

<template>
  <main v-if="!active" class="library">
    <header class="topbar"><a class="brand" href="#/home" aria-label="ILSlides 首頁" @click.prevent="navigate('home')"><span class="brand-icon"><Images :size="21" /></span>ILSlides<span class="brand-dot"></span></a><button class="icon-button settings-button" @click="navigate('settings')" aria-label="開啟設定"><Settings :size="22" /></button></header>
    <section v-if="page==='settings'" class="settings-page"><div class="settings-heading"><button class="icon-button" @click="navigate(settingsReturn)" aria-label="返回設定前頁面"><ArrowLeft :size="20" /></button><h1>設定</h1></div><section class="setting-card"><div class="setting-title"><Images :size="21" /><h2>圖片轉場動畫</h2></div><p>調整左右瀏覽時，淡入淡出的動畫時間。</p><div class="duration-label"><label for="transition-duration">動畫時間</label><output>{{ (preferences.transitionMs/1000).toFixed(2) }} 秒</output></div><input id="transition-duration" type="range" min="100" max="2000" step="20" :value="preferences.transitionMs" @input="preferences.transitionMs=transitionTime(Number(($event.target as HTMLInputElement).value))" /><div class="duration-scale"><span>0.10 秒 · 快速</span><span>2.00 秒 · 緩慢</span></div><button class="reset-setting" @click="preferences.transitionMs=360">恢復預設 0.36 秒</button><p class="setting-note">設定自動保存。裝置啟用減少動畫時，會優先依裝置設定顯示。</p></section><section class="setting-card version-card"><span>ILSlides 版本</span><strong>{{ version }}</strong></section></section>
    <template v-else>
    <section v-if="page==='home'" class="stats"><div><strong>{{ collections.length.toString().padStart(2,'0') }}</strong><span>圖片集合</span></div><div class="stat-divider"></div><div><strong>{{ total.toLocaleString() }}</strong><span>張照片</span></div><span class="offline"><span></span>僅在裝置上讀取</span></section>
    <section v-if="page==='collections'" class="source-section"><div class="source-heading"><span><FolderOpen :size="15" />常用資料夾</span><button @click="edit()">管理／挑選圖片<ChevronRight :size="15" /></button></div><div class="folder-chips"><button v-for="f in folders" :key="f.uri" @click="edit(undefined,f)"><FolderOpen :size="14" />{{ f.name }}</button><button v-if="!folders.length" @click="edit()"><Plus :size="14" />記住圖片資料夾</button></div></section>
    <div class="section-heading"><div><h2>{{ page==='home' ? '最近的集合' : '我的集合' }} <span>{{ collections.length }}</span></h2><p>{{ page==='home' ? '最近修改的 4 筆集合' : '挑選喜歡的照片，組成你的故事' }}</p></div><button v-if="page==='collections'" class="add-button" @click="edit()"><Plus :size="18" />新增集合</button><button v-else class="add-button" @click="navigate('collections')">查看全部<ChevronRight :size="18" /></button></div>
    <div v-if="page==='collections'" class="collection-search"><Search :size="18" /><input v-model="query" type="search" aria-label="搜尋集合" placeholder="搜尋集合名稱" /><button v-if="query" @click="query=''" aria-label="清除搜尋"><X :size="18" /></button></div>
    <div v-if="page==='collections'" class="sort-toolbar"><ArrowUpDown :size="16" /><label for="sort-key">排序</label><select id="sort-key" v-model="preferences.sortKey"><option value="name">字母</option><option value="createdAt">建立日期</option><option value="updatedAt">修改日期</option></select><select v-model="preferences.sortDirection" aria-label="排序方向"><option value="asc">遞增</option><option value="desc">遞減</option></select></div>
    <p v-if="page==='collections' && collections.length && !filteredCollections.length" class="search-empty">找不到符合「{{ query }}」的集合。</p>
    <section v-if="collections.length" class="collection-grid">
      <article v-for="(c,i) in visibleCollections" :key="c.id" class="collection-card">
        <button class="card-open" @click="open(c)" :disabled="busy" :aria-label="`開啟 ${c.name}`"><div class="cover" :class="`cover-${i%3}`"><img v-if="covers[c.id]" :src="covers[c.id]" alt="" /><div v-else class="cover-placeholder"><Images :size="38" :stroke-width="1" /></div><span class="photo-count"><Images :size="13" />{{ c.photos.length }} 張</span><span class="open-indicator"><ChevronRight :size="20" /></span></div><div class="card-copy"><h3>{{ c.name }}</h3><p v-if="page==='collections'">建立 {{ dateLabel(c.createdAt) }}</p><p v-if="page==='collections'">修改 {{ dateLabel(c.updatedAt) }}</p><p v-else><Images :size="13" />已挑選的照片</p></div></button>
        <button v-if="page==='collections'" class="card-edit icon-button" @click="edit(c)" :aria-label="`編輯 ${c.name}`"><Pencil :size="16" /></button>
      </article>
      <button v-if="page==='collections'" class="new-card" @click="edit()"><span><Plus :size="26" /></span><strong>新的故事</strong><small>新增你的圖片集合</small></button>
    </section>
    <section v-if="!collections.length" class="empty-card"><div class="empty-art"><div class="art-frame back"></div><div class="art-frame front"><Images :size="48" :stroke-width="1" /><span class="art-spark">✦</span></div></div><h2>你的回憶，從這裡開始</h2><p>從記住的資料夾挑選多張照片，<br />建立第一個專屬集合。</p><button class="primary" @click="page==='home' ? navigate('collections') : edit()"><FolderOpen :size="18" />挑選圖片，建立集合</button><span class="empty-note">照片保留在原目錄，無需上傳</span></section>
    <footer><span class="footer-line"></span>留一點空間，給美好的日常<span class="footer-line"></span></footer>
    </template><nav class="bottom-bar" aria-label="主要導覽"><button @click="navigate('home')" :class="{selected:page==='home'}" :aria-current="page==='home' ? 'page' : undefined"><Home :size="21" />首頁</button><button @click="navigate('collections')" :class="{selected:page==='collections'}" :aria-current="page==='collections' ? 'page' : undefined"><Grid2X2 :size="21" />集合</button></nav>
  </main>
  <main v-else class="viewer" :style="{'--transition-time':preferences.transitionMs+'ms'}" @touchstart.passive="start" @touchend.passive="end">
    <header class="viewer-header" :class="{hidden:!controls}"><button class="icon-button" @click="close()" aria-label="返回集合"><ArrowLeft /></button><div><h2>{{ active.name }}</h2><span>{{ photos.length ? index+1 : 0 }} / {{ photos.length }}</span></div><button class="icon-button" @click="edit(active)" aria-label="編輯集合"><Pencil :size="20" /></button></header>
    <div class="image-stage" @click="toggleControls"><Transition name="dissolve"><img v-if="displayed" :key="displayed" :src="displayed" :alt="displayedName" class="main-photo" /></Transition><span v-if="imageBusy" class="loading-indicator">讀取中</span><div v-if="!photos.length" class="viewer-empty"><Images :size="40" /><h2>集合中還沒有圖片</h2><p>編輯集合並挑選要加入的圖片。</p><button class="primary" @click.stop="edit(active)"><Plus :size="18" />挑選圖片</button></div></div>

  </main>
  <div v-if="error" class="toast" role="alert"><span>{{ error }}</span><button @click="error=''" aria-label="關閉訊息"><X :size="18" /></button></div>
  <div v-if="modal" class="modal-backdrop" @click.self="modal=false">
    <section class="sheet collection-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-handle"></div><div class="sheet-heading"><div><span class="eyebrow">CURATE YOUR COLLECTION</span><h2 id="sheet-title">{{ editId ? '編輯集合' : '建立新的集合' }}</h2></div><button class="icon-button" @click="modal=false" aria-label="關閉"><X :size="21" /></button></div>
      <div class="editor-scroll-wrap"><div ref="editorScroll" class="editor-scroll" @scroll.passive="updateEditorScroll">
        <label class="field-label" for="collection-name">集合名稱</label><input id="collection-name" v-model="name" maxlength="60" placeholder="例如：旅行片刻、日常光影" />
        <label class="field-label">集合封面</label><button class="folder-select" :disabled="!draftPhotos.length" @click="coverEditor=true"><Images :size="23" /><span><strong>{{ draftCover && selected(draftCover.uri) ? '調整已選封面' : '選擇封面與調整視窗' }}</strong><small>從集合圖片挑選，拖曳及縮放封面範圍</small></span><ChevronRight :size="18" /></button>
        <label class="field-label">常用資料夾</label>
        <div class="folder-chips"><button v-for="f in folders" :key="f.uri" :class="{chosen:selectedFolder?.uri===f.uri}" @click="browseFolder(f)"><FolderOpen :size="14" />{{ f.name }}</button></div>
        <button class="folder-select" @click="pick" :disabled="folderBusy"><span class="folder-symbol"><FolderOpen :size="23" /></span><span><strong>選擇／重新授權資料夾</strong><small>記住此位置，下次可直接開啟挑圖</small></span><Plus :size="18" /></button>
        <div v-if="draftPhotos.length" class="selection-summary"><div class="picker-heading"><span>已選 {{ draftPhotos.length }} 張（點擊可移除）</span><button @click="draftPhotos=[]">清空選取</button></div><div class="selected-strip"><button v-for="p in draftPhotos" :key="p.uri" @click="toggle(p)" :aria-label="`移除已選 ${p.name}`"><PhotoThumb :uri="p.uri" :name="p.name" /><span>{{ p.name }}</span><X :size="13" /></button></div></div>
        <div class="picker-heading"><span>{{ selectedFolder?.name || '選擇資料夾後開始挑圖' }}</span><button v-if="folderPhotos.length" @click="selectAll">全選此資料夾</button></div>
        <p v-if="folderBusy" class="picker-empty">正在讀取資料夾…</p><p v-else-if="selectedFolder && !folderPhotos.length" class="picker-empty">沒有可讀取的圖片；可選擇其他資料夾。</p>
        <div class="photo-picker"><button v-for="p in folderPhotos" :key="p.uri" class="pick-photo" :class="{selected:selected(p.uri)}" @click="toggle(p)" :aria-label="`選取 ${p.name}`" :aria-pressed="selected(p.uri)"><PhotoThumb :uri="p.uri" :name="p.name" /><span class="pick-check"><Check v-if="selected(p.uri)" :size="15" /></span><span class="pick-name">{{ p.name }}</span></button></div>
        <p class="sheet-note">可切換資料夾繼續挑選；集合只保留你勾選的圖片。<br />資料夾新增圖片不會自動加入集合，原始檔案不會修改。</p>

      </div>
      <button v-if="!editId && editorScrolled" class="editor-top-button" @click="editorTop" aria-label="回到新增集合頂部"><ArrowUp :size="22" /></button></div>
      <div v-if="editId" class="editor-delete"><button v-if="!deleting" class="delete-button" @click="deleting=true"><Trash2 :size="16" />刪除集合</button><div v-else class="delete-confirm"><p>確定刪除此集合？原始圖片會保留。</p><button @click="deleting=false">取消刪除</button><button class="danger" @click="remove">確定刪除</button></div></div>
      <button class="primary save-button" :disabled="!name.trim() || !draftPhotos.length || busy" @click="save">{{ editId ? '儲存變更' : '建立集合' }} · {{ draftPhotos.length }} 張<ArrowRight :size="18" /></button>
    </section>
  </div>
  <CoverEditor v-if="coverEditor && draftPhotos.length" :photos="draftPhotos" :initial="draftCover && selected(draftCover.uri) ? draftCover : undefined" @close="coverEditor=false" @save="draftCover=$event; coverEditor=false" />
</template>
