<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { Plus, ArrowLeft, ArrowRight, FolderOpen, Images, X, Pencil, Trash2, ChevronRight, ArrowUp, Grid2X2, Check, Search, Settings, Home, Funnel } from 'lucide-vue-next'
import { Folders, loadCollections, loadFolders, uniquePhotos, suggestCollectionName, sortedPhotos, nextIndex, type Collection, type Photo, type SourceFolder } from './library'
import PhotoThumb from './PhotoThumb.vue'
import CoverEditor from './CoverEditor.vue'
import type { CoverSettings } from './cover'
import CollectionCover from './CollectionCover.vue'
import TagManager from './TagManager.vue'
import CollectionFilter from './CollectionFilter.vue'
import PhotoViewport from './PhotoViewport.vue'
import SelectedPhotos from './SelectedPhotos.vue'
import { matchesFolder, pickerPhotos } from './photo-picker'
import { loadTags, tagStyle, type Tag } from './tags'
import { coverKey, coverLoader } from './cover-cache'
import { version } from '../package.json'
import { sortCollections, filterCollections, loadPreferences, transitionTime, doubleTapScale } from './preferences'
const folders = ref(loadFolders())
const deletingFolder = ref<string | null>(null)
function removeFolder(folder:SourceFolder) {
  folders.value=folders.value.filter(f=>f.uri!==folder.uri)
  deletingFolder.value=null
  if(selectedFolder.value?.uri===folder.uri) {
    ++folderRequest;selectedFolder.value=null;folderPhotos.value=[];folderQuery.value='';folderBusy.value=false
  }
}
const collections = ref(loadCollections())
const active = ref<Collection | null>(null)
const photos = ref<Photo[]>([])
const index = ref(0)
const displayed = ref('')
const displayedName = ref('')
const viewport=ref<InstanceType<typeof PhotoViewport>>()
const selectedStrip=ref<InstanceType<typeof SelectedPhotos>>()
const tags=ref(loadTags())
const draftTags=ref<string[]>([]),coverEpoch=ref(0),cacheBusy=ref(false),cacheMessage=ref('')
watch(tags,value=>{try {localStorage.setItem('ilslides.tags',JSON.stringify(value))} catch {error.value='標籤無法保存。'}},{deep:true})
function collectionTags(c:Collection):Tag[] {return (c.tagIds || []).map(id=>tags.value.find(t=>t.id===id)).filter((t):t is Tag=>!!t)}
function toggleTag(id:string) {draftTags.value=draftTags.value.includes(id) ? draftTags.value.filter(v=>v!==id) : [...draftTags.value,id]}
function removeTag(id:string) {
  tags.value=tags.value.filter(t=>t.id!==id)
  for(const c of collections.value) if(c.tagIds?.includes(id)) c.tagIds=c.tagIds.filter(v=>v!==id)
  draftTags.value=draftTags.value.filter(v=>v!==id)
  filterTags.value=filterTags.value.filter(v=>v!==id)
}
async function refreshCovers() {
  if(cacheBusy.value) return
  cacheBusy.value=true;cacheMessage.value='';coverLoader.reset()
  try {await Folders.coverCache({op:'clear'});++coverEpoch.value;cacheMessage.value='封面快取已清除，返回集合時會重新產生。'}
  catch {cacheMessage.value='無法清除封面快取，請稍後再試。'}
  finally {cacheBusy.value=false}
}
type Page='home'|'collections'|'settings'
function hashPage():Page { const route=location.hash.slice(2); return route==='collections' || route==='settings' ? route : 'home' }
const page = ref<Page>(hashPage())
watch(page,()=>{deletingFolder.value=null})
let settingsReturn:Page='home'
function navigate(next:Page) { if(next==='settings' && page.value!=='settings') settingsReturn=page.value; page.value=next; location.hash='/'+next; window.scrollTo(0,0) }
function changedHash() { page.value=hashPage(); window.scrollTo(0,0) }
const preferences = ref(loadPreferences())
watch(preferences,value=>{ try {localStorage.setItem('ilslides.preferences',JSON.stringify(value))} catch {error.value='設定無法保存。'} },{deep:true})
const query = ref('')
const filterOpen=ref(false),filterTags=ref<string[]>([])
function applyFilter(value:{tags:string[];sortKey:typeof preferences.value.sortKey;sortDirection:typeof preferences.value.sortDirection}) {
  preferences.value.sortKey=value.sortKey;preferences.value.sortDirection=value.sortDirection
  filterTags.value=value.tags;filterOpen.value=false
  window.scrollTo(0,0)
}
const filteredCollections = computed(() => sortCollections(filterCollections(collections.value,query.value,filterTags.value),preferences.value.sortKey,preferences.value.sortDirection))
const visibleCollections = computed(() => page.value==='home' ? sortCollections(collections.value,'updatedAt','desc').slice(0,4) : filteredCollections.value)
const draftCover = ref<CoverSettings>()
const coverEditor = ref(false)
const busy = ref(false)
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
const suggestedName = computed(() => !editId.value && preferences.value.autoName ? suggestCollectionName(draftPhotos.value[0]?.name,draftPhotos.value[0]?.folderName) : '')
const collectionName = computed(() => name.value.trim() || suggestedName.value)
const folderBusy = ref(false),authorizationBusy=ref(false),folderQuery=ref(''),photoSortOpen=ref(false)
const visibleFolderPhotos=computed(()=>pickerPhotos(folderPhotos.value,folderQuery.value,preferences.value.photoSortKey,preferences.value.photoSortDirection))
function applyPhotoSort(value:{sortKey:typeof preferences.value.sortKey;sortDirection:typeof preferences.value.sortDirection}) {
 preferences.value.photoSortKey=value.sortKey==='updatedAt' ? 'updatedAt' : 'name';preferences.value.photoSortDirection=value.sortDirection;photoSortOpen.value=false
}
let folderRequest = 0
const controls = ref(true)
const total = computed(() => collections.value.reduce((sum,c) => sum + c.photos.length, 0))
const current = computed(() => photos.value[index.value])
const cache = new Map<string,string>()
let request = 0
let libraryScrollTop=0
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
  try {
    const data = await image(photo.uri)
    // Decode before changing layers so the fade never flashes an empty frame.
    await new Promise<void>((resolve,reject) => { const img = new Image(); img.onload = () => resolve(); img.onerror = () => reject(new Error('圖片無法顯示')); img.src = data })
    if(token !== request) return
    displayedName.value = photo.name; displayed.value = data
    const neighbor = photos.value[nextIndex(index.value,1,photos.value.length)]
    if(neighbor && neighbor.uri !== photo.uri) void image(neighbor.uri).catch(() => {})
  } catch(e) { if(token === request) { displayed.value=''; error.value = `無法讀取「${photo.name}」，請確認檔案仍存在。${message(e)}` } }
}
watch(index, show)
async function open(c:Collection) {
  if(busy.value) return
  if(c.legacyTree) { error.value='舊集合尚未完成轉換，請編輯並選取要保留的圖片。'; return }
  libraryScrollTop=document.scrollingElement?.scrollTop || window.scrollY
  busy.value=true; error.value=''
  cache.clear(); photos.value=[...c.photos]
  index.value=0; displayed.value=''; active.value=c; controls.value=true
  try { await show() } finally { busy.value=false }
}
async function close() {
  const returnPage=page.value,position=libraryScrollTop
  ++request;active.value=null;photos.value=[];displayed.value=''
  await nextTick()
  if(!active.value && page.value===returnPage) window.scrollTo(0,position)
}
function step(delta:number) { if(photos.value.length > 1) { viewport.value?.cancel();error.value=''; index.value=nextIndex(index.value,delta,photos.value.length) } }
function toggleControls() { controls.value=!controls.value }
function edit(c?:Collection, folder?:SourceFolder) {
  editId.value=c?.id || null; name.value=c?.name || ''; draftPhotos.value=c ? [...c.photos] : []
  draftTags.value=(c?.tagIds || []).filter(id=>tags.value.some(t=>t.id===id))
  draftCover.value=c?.cover ? {...c.cover} : undefined; coverEditor.value=false; editorScrolled.value=false
  selectedFolder.value=null; folderPhotos.value=[];folderQuery.value='';photoSortOpen.value=false; modal.value=true; error.value=''
  const initial=folder || folders.value[0]
  if(initial) void browseFolder(initial)
}
async function browseFolder(folder:SourceFolder) {
  const token=++folderRequest
  selectedFolder.value=folder; folderPhotos.value=[];folderQuery.value=''; folderBusy.value=true; error.value=''
  try { const result=await Folders.list({tree:folder.uri}); if(token===folderRequest) folderPhotos.value=sortedPhotos(result.images) }
  catch(e) { if(token===folderRequest) error.value=`無法讀取資料夾，請重新授權此目錄。${message(e)}` }
  finally { if(token===folderRequest) folderBusy.value=false }
}
async function pick() {
  if(!Capacitor.isNativePlatform()) { error.value='請安裝 Android APK，使用系統目錄選擇器讀取手機圖片。'; return }
  if(authorizationBusy.value) return
  authorizationBusy.value=true
  try {
    const result=await Folders.pick()
    if(result.cancelled) return
    const folder={uri:result.uri,name:result.name}
    const pos=folders.value.findIndex(f=>f.uri===folder.uri)
    if(pos<0) folders.value.push(folder); else folders.value[pos]=folder

  } catch(e) { error.value=`無法選擇目錄：${message(e)}` }
  finally {authorizationBusy.value=false}
}
function selected(uri:string) { return draftPhotos.value.some(p=>p.uri===uri) }
function toggle(p:Photo) { draftPhotos.value=selected(p.uri) ? draftPhotos.value.filter(v=>v.uri!==p.uri) : [...draftPhotos.value,p] }
function selectAll() { draftPhotos.value=uniquePhotos([...draftPhotos.value,...visibleFolderPhotos.value]) }
async function save() {
  if(!collectionName.value || !draftPhotos.value.length || busy.value) return
  const existing=collections.value.find(c=>c.id===editId.value)
  const now=Date.now()
  const c:Collection={createdAt:existing ? existing.createdAt : now,updatedAt:now,id:editId.value || crypto.randomUUID(),name:collectionName.value,tagIds:[...draftTags.value],photos:uniquePhotos(draftPhotos.value),...(draftCover.value && selected(draftCover.value.uri) ? {cover:{...draftCover.value}} : {})}
  const pos=collections.value.findIndex(v=>v.id===c.id)
  if(pos<0) collections.value.push(c); else collections.value[pos]=c
  modal.value=false; ++folderRequest
  if(active.value?.id===c.id) { active.value=c; photos.value=[...c.photos]; index.value=0; await show() }
  if(existing && coverKey(existing)!==coverKey(c)) void coverLoader.remove(coverKey(existing)).catch(()=>{})
}
const deleting = ref(false)
function remove() {
  if(!editId.value) return
  const removed=collections.value.find(c=>c.id===editId.value)
  collections.value=collections.value.filter(c=>c.id!==editId.value)
  if(removed) void coverLoader.remove(coverKey(removed)).catch(()=>{})
  if(active.value?.id===editId.value) close()
  modal.value=false; deleting.value=false
}
watch(modal, () => { deleting.value=false; if(!modal.value) { ++folderRequest; folderBusy.value=false;photoSortOpen.value=false } })
function keyboard(e:KeyboardEvent) { if(deletingFolder.value && e.key==='Escape') {deletingFolder.value=null;return};if(photoSortOpen.value) {if(e.key==='Escape') photoSortOpen.value=false;return};if(e.key==='Escape' && selectedStrip.value?.cancel()) return;if(filterOpen.value) {if(e.key==='Escape') filterOpen.value=false;return}; if(coverEditor.value) { if(e.key==='Escape') coverEditor.value=false; return }; if(modal.value) { if(e.key==='Escape') modal.value=false; return }; if(active.value) { if(e.key==='ArrowRight') step(1); if(e.key==='ArrowLeft') step(-1); if(e.key==='Escape') close() } else if(e.key==='Escape' && page.value==='settings') navigate(settingsReturn) }
onMounted(async () => {
  window.addEventListener('keydown',keyboard)
  window.addEventListener('hashchange',changedHash)
  if(Capacitor.isNativePlatform()) {
    const listener=await NativeApp.addListener('backButton', () => { if(deletingFolder.value) deletingFolder.value=null;else if(photoSortOpen.value) photoSortOpen.value=false;else if(selectedStrip.value?.cancel()) return;else if(filterOpen.value) filterOpen.value=false; else if(coverEditor.value) coverEditor.value=false; else if(modal.value) modal.value=false; else if(active.value) close(); else if(page.value==='settings') navigate(settingsReturn); else if(page.value==='collections') { if((document.scrollingElement?.scrollTop || window.scrollY)>1) window.scrollTo(0,0); else void NativeApp.exitApp() } else void NativeApp.exitApp() })
    removeBack=()=>void listener.remove()
    for(const c of collections.value) {
      if(c.legacyTree) {
        try { const result=await Folders.list({tree:c.legacyTree}); c.photos=sortedPhotos(result.images); delete c.legacyTree }
        catch { error.value='部分舊集合無法轉換，請編輯集合重新選取圖片。' }
      }

    }
  }
})
onUnmounted(() => { window.removeEventListener('keydown',keyboard); window.removeEventListener('hashchange',changedHash); removeBack?.() })
</script>

<template>
  <main v-if="!active" class="library" :inert="filterOpen">
    <header class="topbar"><a class="brand" href="#/home" aria-label="ILSlides 首頁" @click.prevent="navigate('home')"><span class="brand-icon"><Images :size="21" /></span>ILSlides<span class="brand-dot"></span></a><button class="icon-button settings-button" @click="navigate('settings')" aria-label="開啟設定"><Settings :size="22" /></button></header>
    <section v-if="page==='settings'" class="settings-page"><div class="settings-heading"><button class="icon-button" @click="navigate(settingsReturn)" aria-label="返回設定前頁面"><ArrowLeft :size="20" /></button><h1>設定</h1></div><section class="setting-card"><div class="setting-title"><Images :size="21" /><h2>圖片轉場動畫</h2></div><p>調整左右瀏覽時，淡入淡出的動畫時間。</p><div class="duration-label"><label for="transition-duration">動畫時間</label><output>{{ (preferences.transitionMs/1000).toFixed(2) }} 秒</output></div><input id="transition-duration" type="range" min="100" max="2000" step="20" :value="preferences.transitionMs" @input="preferences.transitionMs=transitionTime(Number(($event.target as HTMLInputElement).value))" /><div class="duration-scale"><span>0.10 秒 · 快速</span><span>2.00 秒 · 緩慢</span></div><button class="reset-setting" @click="preferences.transitionMs=360">恢復預設 0.36 秒</button><p class="setting-note">設定自動保存。裝置啟用減少動畫時，會優先依裝置設定顯示。</p></section><section class="setting-card folder-settings"><div class="setting-title"><FolderOpen :size="21" /><h2>圖片資料夾</h2></div><p>新增或重新授權圖片來源，包含所有子目錄中的圖片，再於集合中切換資料夾挑圖。</p><div v-if="folders.length" class="authorized-folders"><div v-for="folder in folders" :key="folder.uri"><div class="folder-setting-row"><FolderOpen :size="16" /><span>{{ folder.name }}</span><button class="icon-button folder-delete" :aria-label="`刪除資料夾 ${folder.name}`" @click="deletingFolder=folder.uri"><Trash2 :size="17" /></button></div><div v-if="deletingFolder===folder.uri" class="delete-confirm folder-delete-confirm"><p>確定刪除「{{ folder.name }}」資料夾捷徑？既有集合與原始圖片會保留。</p><button @click="deletingFolder=null">取消刪除資料夾</button><button class="danger" @click="removeFolder(folder)">確定刪除資料夾</button></div></div></div><p v-else class="tag-hint">尚未授權圖片資料夾。</p><button class="folder-select" @click="pick" :disabled="authorizationBusy"><FolderOpen :size="23" /><span><strong>{{ authorizationBusy ? '正在選擇資料夾…' : '選擇／重新授權資料夾' }}</strong><small>保存讀取授權，原始圖片不會修改</small></span><Plus :size="18" /></button></section><section class="setting-card zoom-setting"><div class="setting-title"><Images :size="21" /><h2>雙擊放大倍率</h2></div><p>雙擊圖片指定位置放大，再次雙擊恢復完整圖片。單指左右滑動切圖，兩指縮放或移動查看區域。</p><div class="duration-label"><label for="double-tap-scale">放大倍率</label><output>{{ preferences.doubleTapScale.toFixed(2) }}×</output></div><input id="double-tap-scale" type="range" min="1.5" max="4" step="0.25" :value="preferences.doubleTapScale" @input="preferences.doubleTapScale=doubleTapScale(Number(($event.target as HTMLInputElement).value))" /><div class="duration-scale"><span>1.50×</span><span>4.00×</span></div><button class="reset-setting" @click="preferences.doubleTapScale=2">恢復預設 2 倍</button><p class="setting-note">切換圖片保留倍率與查看位置；重新開啟集合時恢復完整圖片。</p></section><section class="setting-card auto-name-setting"><div class="setting-toggle-row"><div><h2>自動命名新集合</h2><p>名稱留空時，以第一張選取圖片的檔名命名。</p></div><button role="switch" aria-label="自動命名新集合" :aria-checked="preferences.autoName" :class="{enabled:preferences.autoName}" @click="preferences.autoName=!preferences.autoName"><span></span></button></div><p class="setting-note">規則 <code>^([^\s-]+)</code>：取第一個空白或「-」之前的字串；手動輸入名稱時優先使用手動名稱。</p></section><TagManager v-model:tags="tags" @remove="removeTag" /><section class="setting-card"><div class="setting-title"><h2>封面快取</h2></div><p>封面會保存於裝置，讓下次開啟更快。若圖片已變更，可清除快取並重新整理。</p><button class="reset-setting" :disabled="cacheBusy" @click="refreshCovers">{{ cacheBusy ? '正在清除…' : '重新整理封面' }}</button><p v-if="cacheMessage" role="status" class="setting-note">{{ cacheMessage }}</p></section><section class="setting-card version-card"><span>ILSlides 版本</span><strong>{{ version }}</strong></section></section>
    <template v-else>
    <section v-if="page==='home'" class="stats"><div><strong>{{ collections.length.toString().padStart(2,'0') }}</strong><span>圖片集合</span></div><div class="stat-divider"></div><div><strong>{{ total.toLocaleString() }}</strong><span>張照片</span></div><span class="offline"><span></span>僅在裝置上讀取</span></section>
    <section v-if="page==='collections'" class="source-section"><div class="source-heading"><span><FolderOpen :size="15" />常用資料夾</span><button @click="edit()">管理／挑選圖片<ChevronRight :size="15" /></button></div><div class="folder-chips"><button v-for="f in folders" :key="f.uri" @click="edit(undefined,f)"><FolderOpen :size="14" />{{ f.name }}</button><button v-if="!folders.length" @click="navigate('settings')"><Plus :size="14" />到設定授權資料夾</button></div></section>
    <div class="section-heading"><div><h2>{{ page==='home' ? '最近的集合' : '我的集合' }} <span>{{ collections.length }}</span></h2><p>{{ page==='home' ? '最近修改的 4 筆集合' : '挑選喜歡的照片，組成你的故事' }}</p></div><button v-if="page==='collections'" class="add-button" @click="edit()"><Plus :size="18" />新增集合</button><button v-else class="add-button" @click="navigate('collections')">查看全部<ChevronRight :size="18" /></button></div>
    <div v-if="page==='collections'" class="collection-search-row"><div class="collection-search"><Search :size="18" /><input v-model="query" type="search" aria-label="搜尋集合" placeholder="搜尋集合名稱" /><button v-if="query" @click="query=''" aria-label="清除搜尋"><X :size="18" /></button></div><button class="filter-button" :class="{active:filterTags.length}" aria-label="篩選與排序" aria-haspopup="dialog" aria-controls="collection-filter" :aria-expanded="filterOpen" @click="filterOpen=true"><Funnel :size="21" /><span v-if="filterTags.length" aria-hidden="true">{{ filterTags.length }}</span></button></div>
    <p v-if="page==='collections' && collections.length && !filteredCollections.length" class="search-empty">{{ query.trim() ? '找不到符合「'+query+'」'+(filterTags.length ? '及目前篩選條件' : '')+'的集合。' : '沒有符合所選標籤的集合。' }}</p>
    <section v-if="collections.length" class="collection-grid">
      <article v-for="(c,i) in visibleCollections" :key="c.id" class="collection-card">
        <button class="card-open" @click="open(c)" :disabled="busy" :aria-label="`開啟 ${c.name}`"><CollectionCover :key="c.id+':'+coverEpoch" :collection="c" :class="`cover-${i%3}`"><span class="photo-count"><Images :size="13" />{{ c.photos.length }} 張</span><span class="open-indicator"><ChevronRight :size="20" /></span></CollectionCover><div class="card-copy"><h3>{{ c.name }}</h3><div class="collection-tags"><span v-for="tag in collectionTags(c)" :key="tag.id" class="tag-pill" :style="tagStyle(tag)"><span>{{ tag.name }}</span></span></div></div></button>
        <button v-if="page==='collections'" class="card-edit icon-button" @click="edit(c)" :aria-label="`編輯 ${c.name}`"><Pencil :size="16" /></button>
      </article>
      <button v-if="page==='collections'" class="new-card" @click="edit()"><span><Plus :size="26" /></span><strong>新的故事</strong><small>新增你的圖片集合</small></button>
    </section>
    <section v-if="!collections.length" class="empty-card"><div class="empty-art"><div class="art-frame back"></div><div class="art-frame front"><Images :size="48" :stroke-width="1" /><span class="art-spark">✦</span></div></div><h2>你的回憶，從這裡開始</h2><p>從記住的資料夾挑選多張照片，<br />建立第一個專屬集合。</p><button class="primary" @click="page==='home' ? navigate('collections') : edit()"><FolderOpen :size="18" />挑選圖片，建立集合</button><span class="empty-note">照片保留在原目錄，無需上傳</span></section>
    <footer><span class="footer-line"></span>留一點空間，給美好的日常<span class="footer-line"></span></footer>
    </template><nav class="bottom-bar" aria-label="主要導覽"><button @click="navigate('home')" :class="{selected:page==='home'}" :aria-current="page==='home' ? 'page' : undefined"><Home :size="21" />首頁</button><button @click="navigate('collections')" :class="{selected:page==='collections'}" :aria-current="page==='collections' ? 'page' : undefined"><Grid2X2 :size="21" />集合</button></nav>
  </main>
  <main v-else class="viewer" :style="{'--transition-time':preferences.transitionMs+'ms'}">
    <header class="viewer-header" :class="{hidden:!controls}"><button class="icon-button" @click="close()" aria-label="返回集合"><ArrowLeft /></button><div><h2>{{ active.name }}</h2><span>{{ photos.length ? index+1 : 0 }} / {{ photos.length }}</span></div><button class="icon-button" @click="edit(active)" aria-label="編輯集合"><Pencil :size="20" /></button></header>
    <PhotoViewport ref="viewport" :src="displayed" :name="displayedName" :double-scale="preferences.doubleTapScale" :enabled="!modal && !coverEditor" @tap="toggleControls" @step="step"><div v-if="!photos.length" class="viewer-empty"><Images :size="40" /><h2>集合中還沒有圖片</h2><p>編輯集合並挑選要加入的圖片。</p><button class="primary" @click.stop="edit(active)"><Plus :size="18" />挑選圖片</button></div></PhotoViewport>

  </main>
  <div v-if="error" class="toast" role="alert"><span>{{ error }}</span><button @click="error=''" aria-label="關閉訊息"><X :size="18" /></button></div>
  <div v-if="modal" class="modal-backdrop" @click.self="modal=false">
    <section class="sheet collection-sheet" :inert="photoSortOpen" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-handle"></div><div class="sheet-heading"><div><span class="eyebrow">CURATE YOUR COLLECTION</span><h2 id="sheet-title">{{ editId ? '編輯集合' : '建立新的集合' }}</h2></div><button class="icon-button" @click="modal=false" aria-label="關閉"><X :size="21" /></button></div>
      <div class="editor-scroll-wrap"><div ref="editorScroll" class="editor-scroll" @scroll.passive="updateEditorScroll">
        <label class="field-label" for="collection-name">集合名稱</label><input id="collection-name" v-model="name" maxlength="60" placeholder="例如：旅行片刻、日常光影" />
        <p v-if="!editId && !name.trim() && draftPhotos.length" class="auto-name-hint">{{ suggestedName ? '將自動命名為：' + suggestedName : preferences.autoName ? '檔名無法套用規則，請輸入集合名稱。' : '自動命名已停用，請輸入集合名稱。' }}</p>
        <label class="field-label">集合標籤</label>
        <div v-if="tags.length" class="tag-picker"><button v-for="tag in tags" :key="tag.id" class="tag-pill" :class="{chosen:draftTags.includes(tag.id)}" :style="tagStyle(tag)" :aria-label="'套用標籤 '+tag.name" :aria-pressed="draftTags.includes(tag.id)" @click="toggleTag(tag.id)"><span><Check v-if="draftTags.includes(tag.id)" :size="13" />{{ tag.name }}</span></button></div>
        <p v-else class="tag-hint">可先至設定頁建立標籤。</p>
        <label class="field-label">集合封面</label><button class="folder-select" :disabled="!draftPhotos.length" @click="coverEditor=true"><Images :size="23" /><span><strong>{{ draftCover && selected(draftCover.uri) ? '調整已選封面' : '選擇封面與調整視窗' }}</strong><small>從集合圖片挑選，拖曳及縮放封面範圍</small></span><ChevronRight :size="18" /></button>
        <label class="field-label">常用資料夾</label>
        <div class="folder-chips"><button v-for="f in folders" :key="f.uri" :class="{chosen:selectedFolder?.uri===f.uri}" @click="browseFolder(f)"><FolderOpen :size="14" />{{ f.name }}</button></div>
        <p v-if="!folders.length" class="tag-hint">尚未授權圖片資料夾，請先至設定頁新增。</p>
        <div class="collection-search-row photo-search-row"><div class="collection-search"><Search :size="18" /><input v-model="folderQuery" type="search" aria-label="搜尋資料夾圖片" placeholder="搜尋圖片檔名或目錄" /><button v-if="folderQuery" @click="folderQuery=''" aria-label="清除圖片搜尋"><X :size="18" /></button></div><button class="filter-button" :class="{active:preferences.photoSortKey!=='name' || preferences.photoSortDirection!=='asc'}" aria-label="圖片篩選與排序" aria-haspopup="dialog" aria-controls="photo-sort" :aria-expanded="photoSortOpen" @click="photoSortOpen=true"><Funnel :size="21" /></button></div>
        <div v-if="draftPhotos.length" class="selection-summary"><div class="picker-heading"><span>已選 {{ draftPhotos.length }} 張</span><button @click="draftPhotos=[]">清空選取</button></div><SelectedPhotos ref="selectedStrip" :photos="draftPhotos" @remove="toggle" @reorder="draftPhotos=$event" /></div>
        <div class="picker-heading"><span>{{ selectedFolder?.name || '選擇資料夾後開始挑圖' }}</span><button v-if="visibleFolderPhotos.length" @click="selectAll">{{ folderQuery.trim() ? '全選搜尋結果' : '全選此資料夾' }}</button></div>
        <p v-if="folderBusy" class="picker-empty">正在讀取資料夾…</p><p v-else-if="selectedFolder && !folderPhotos.length" class="picker-empty">沒有可讀取的圖片；可選擇其他資料夾。</p>
        <p v-if="!folderBusy && folderPhotos.length && !visibleFolderPhotos.length" class="picker-empty">找不到符合「{{ folderQuery }}」的圖片。</p>
        <div class="photo-picker"><button v-for="p in visibleFolderPhotos" :key="p.uri" class="pick-photo" :class="{selected:selected(p.uri)}" @click="toggle(p)" :aria-label="matchesFolder(p,folderQuery) ? `選取 ${p.name}，目錄 ${p.folderPath}` : `選取 ${p.name}`" :aria-pressed="selected(p.uri)"><PhotoThumb :uri="p.uri" :name="p.name" /><span class="pick-check"><Check v-if="selected(p.uri)" :size="15" /></span><span v-if="matchesFolder(p,folderQuery)" class="pick-folder-name" :title="p.folderPath">{{ p.folderPath }}</span><span class="pick-name">{{ p.name }}</span></button></div>
        <p class="sheet-note">可切換資料夾繼續挑選；集合只保留你勾選的圖片。<br />資料夾新增圖片不會自動加入集合，原始檔案不會修改。</p>

      </div>
      <button v-if="editorScrolled" class="editor-top-button" @click="editorTop" :aria-label="editId ? '回到編輯集合頂部' : '回到新增集合頂部'"><ArrowUp :size="22" /></button></div>
      <div v-if="editId" class="editor-delete"><button v-if="!deleting" class="delete-button" @click="deleting=true"><Trash2 :size="16" />刪除集合</button><div v-else class="delete-confirm"><p>確定刪除此集合？原始圖片會保留。</p><button @click="deleting=false">取消刪除</button><button class="danger" @click="remove">確定刪除</button></div></div>
      <button class="primary save-button" :disabled="!collectionName || !draftPhotos.length || busy" @click="save">{{ editId ? '儲存變更' : '建立集合' }} · {{ draftPhotos.length }} 張<ArrowRight :size="18" /></button>
    </section>
  </div>
  <CollectionFilter v-if="photoSortOpen" photos :tags="[]" :selected="[]" :sort-key="preferences.photoSortKey" :sort-direction="preferences.photoSortDirection" @close="photoSortOpen=false" @apply="applyPhotoSort" />
  <CollectionFilter v-if="filterOpen" :tags="tags" :selected="filterTags" :sort-key="preferences.sortKey" :sort-direction="preferences.sortDirection" @close="filterOpen=false" @apply="applyFilter" />
  <CoverEditor v-if="coverEditor && draftPhotos.length" :photos="draftPhotos" :initial="draftCover && selected(draftCover.uri) ? draftCover : undefined" @close="coverEditor=false" @save="draftCover=$event; coverEditor=false" />
</template>
