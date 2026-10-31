<script setup lang="ts">
import { ref, computed } from 'vue'
import { Pencil, Trash2, Plus } from 'lucide-vue-next'
import { tagStyle, moveTag, type Tag } from './tags'
const props=defineProps<{tags:Tag[]}>()
const emit=defineEmits<{'update:tags':[tags:Tag[]];remove:[id:string]}>()
const editing=ref<string | null>(null),name=ref(''),start=ref('#3974db'),end=ref('#8a44b8'),message=ref('')
const preview=computed(()=>({id:'preview',name:name.value.trim() || '標籤預覽',start:start.value,end:end.value}))
function edit(tag:Tag) { editing.value=tag.id;name.value=tag.name;start.value=tag.start;end.value=tag.end;message.value='' }
function reset() { editing.value=null;name.value='';start.value='#3974db';end.value='#8a44b8';message.value='' }
function save() {
  const value=name.value.trim()
  if(!value) {message.value='請輸入標籤名稱。';return}
  if(props.tags.some(t=>t.id!==editing.value && t.name.toLocaleLowerCase()===value.toLocaleLowerCase())) {message.value='已有相同名稱的標籤。';return}
  const tag:Tag={id:editing.value || crypto.randomUUID(),name:value,start:start.value,end:end.value}
  emit('update:tags',editing.value ? props.tags.map(t=>t.id===editing.value ? tag : t) : [...props.tags,tag])
  reset()
}
function remove(tag:Tag) { if(editing.value===tag.id) reset(); emit('remove',tag.id) }
function reorder(tag:Tag,event:Event) {
  const input=event.target as HTMLInputElement
  const next=moveTag(props.tags,tag.id,input.valueAsNumber)
  input.value=String(next.findIndex(t=>t.id===tag.id)+1)
  emit('update:tags',next)
}
</script>
<template>
  <section class="setting-card tag-manager">
    <div class="setting-title"><h2>集合標籤</h2></div>
    <p>建立自己的漸層標籤，再於新增或編輯集合時套用。調整序位後，所有頁面的標籤會依相同順序排列，設定自動保存。</p>
    <div v-if="tags.length" class="tag-list">
      <div v-for="(tag,index) in tags" :key="tag.id" class="tag-row">
        <label class="tag-position">序位<input type="number" min="1" :max="tags.length" step="1" :value="index+1" :aria-label="`標籤 ${tag.name} 序位`" @change="reorder(tag,$event)" /></label>
        <span class="tag-pill" :style="tagStyle(tag)"><span>{{ tag.name }}</span></span>
        <button class="icon-button" :aria-label="`編輯標籤 ${tag.name}`" @click="edit(tag)"><Pencil :size="16" /></button>
        <button class="icon-button tag-delete" :aria-label="`刪除標籤 ${tag.name}`" @click="remove(tag)"><Trash2 :size="16" /></button>
      </div>
    </div>
    <p v-else class="tag-empty">還沒有標籤，先建立第一個。</p>
    <form class="tag-form" @submit.prevent="save">
      <label class="field-label" for="tag-name">{{ editing ? '修改標籤名稱' : '新增標籤名稱' }}</label>
      <input id="tag-name" v-model="name" maxlength="24" placeholder="例如：旅行、家人、靈感" />
      <div class="tag-colors"><label>漸層起始色<input v-model="start" type="color" aria-label="漸層起始色" /></label><label>漸層結束色<input v-model="end" type="color" aria-label="漸層結束色" /></label></div>
      <div class="tag-preview"><span>預覽</span><span class="tag-pill" :style="tagStyle(preview)"><span>{{ preview.name }}</span></span></div>
      <p v-if="message" class="tag-error" role="alert">{{ message }}</p>
      <div class="tag-actions"><button type="submit" class="primary"><Plus v-if="!editing" :size="16" />{{ editing ? '儲存標籤' : '新增標籤' }}</button><button v-if="editing" type="button" class="reset-setting" @click="reset">取消修改標籤</button></div>
    </form>
  </section>
</template>
