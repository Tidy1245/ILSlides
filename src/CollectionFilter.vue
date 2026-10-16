<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { X, Check, SlidersHorizontal } from 'lucide-vue-next'
import { tagStyle, type Tag } from './tags'
import type { SortKey, SortDirection } from './preferences'
const props=defineProps<{tags:Tag[];selected:string[];sortKey:SortKey;sortDirection:SortDirection;photos?:boolean}>()
const emit=defineEmits<{close:[];apply:[value:{tags:string[];sortKey:SortKey;sortDirection:SortDirection}]}>()
const selected=ref([...props.selected]),key=ref(props.sortKey),direction=ref(props.sortDirection),sheet=ref<HTMLElement>()
const previousFocus=document.activeElement instanceof HTMLElement ? document.activeElement : undefined
const previousOverflow=document.body.style.overflow
function toggle(id:string) {selected.value=selected.value.includes(id) ? selected.value.filter(v=>v!==id) : [...selected.value,id]}
function reset() {selected.value=[];key.value='name';direction.value='asc'}
function apply() {emit('apply',{tags:selected.value.filter(id=>props.tags.some(t=>t.id===id)),sortKey:key.value,sortDirection:direction.value})}
function keyboard(e:KeyboardEvent) {
 if(e.key==='Escape') {e.stopPropagation();emit('close');return}
 if(e.key!=='Tab') return
 const focusable=sheet.value?.querySelectorAll<HTMLElement>('button:not(:disabled),select')
 if(!focusable?.length) return
 const first=focusable[0]!,last=focusable[focusable.length-1]!
 if(e.shiftKey && document.activeElement===first) {e.preventDefault();last.focus()}
 else if(!e.shiftKey && document.activeElement===last) {e.preventDefault();first.focus()}
}
onMounted(()=>{document.body.style.overflow='hidden';sheet.value?.querySelector<HTMLElement>('button')?.focus({preventScroll:true})})
onUnmounted(()=>{document.body.style.overflow=previousOverflow;previousFocus?.focus({preventScroll:true})})
</script>
<template>
 <div class="modal-backdrop filter-backdrop" :class="{'photo-sort-backdrop':photos}" @click.self="emit('close')" @keydown="keyboard">
  <section :id="photos ? 'photo-sort' : 'collection-filter'" ref="sheet" class="sheet filter-sheet" role="dialog" aria-modal="true" :aria-labelledby="photos ? 'photo-sort-title' : 'filter-title'">
   <div class="sheet-handle"></div>
   <div class="sheet-heading"><div><span class="eyebrow">{{ photos ? 'FIND YOUR PHOTOS' : 'FIND YOUR COLLECTION' }}</span><h2 :id="photos ? 'photo-sort-title' : 'filter-title'">{{ photos ? '圖片排序' : '篩選與排序' }}</h2></div><button class="icon-button" aria-label="關閉篩選" @click="emit('close')"><X :size="21" /></button></div>
   <div class="filter-scroll">
    <div class="filter-section-title"><SlidersHorizontal :size="16" /><h3>排序方式</h3></div>
    <div class="filter-sort"><div><label :for="photos ? 'photo-sort-key' : 'sort-key'" class="field-label">排序</label><select :id="photos ? 'photo-sort-key' : 'sort-key'" v-model="key"><option value="name">{{ photos ? '檔名' : '字母' }}</option><option v-if="!photos" value="createdAt">建立日期</option><option value="updatedAt">修改日期</option></select></div><div><label :for="photos ? 'photo-sort-direction' : 'sort-direction'" class="field-label">排序方向</label><select :id="photos ? 'photo-sort-direction' : 'sort-direction'" v-model="direction"><option value="asc">遞增</option><option value="desc">遞減</option></select></div></div>
    <template v-if="!photos"><div class="filter-tag-heading"><h3>依標籤篩選</h3><button class="reset-setting" :class="{selected:!selected.length}" :aria-pressed="!selected.length" @click="selected=[]">全部集合</button></div>
    <p class="filter-hint">可複選，符合任一所選標籤即顯示；未選標籤時顯示全部集合。</p>
    <div v-if="tags.length" class="tag-picker"><button v-for="tag in tags" :key="tag.id" class="tag-pill" :class="{chosen:selected.includes(tag.id)}" :style="tagStyle(tag)" :aria-label="'篩選標籤 '+tag.name" :aria-pressed="selected.includes(tag.id)" @click="toggle(tag.id)"><span><Check v-if="selected.includes(tag.id)" :size="13" />{{ tag.name }}</span></button></div>
    <p v-else class="filter-hint">尚未建立標籤，可至設定頁新增。</p></template><p v-else class="filter-hint">排序只影響資料夾挑圖清單；已選圖片可長按拖曳調整順序。未提供修改日期的圖片會排在最後。</p>
   </div>
   <div class="filter-actions"><button class="reset-setting" @click="reset">重設條件</button><button class="primary" @click="apply">{{ photos ? '套用排序' : '套用篩選' }}<span v-if="!photos && selected.length"> · {{ selected.length }} 個標籤</span></button></div>
  </section>
 </div>
</template>
