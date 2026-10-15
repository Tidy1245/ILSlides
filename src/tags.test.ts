import { beforeEach,describe,expect,it } from 'vitest'
import { loadTags,tagIds,tagStyle } from './tags'
import { loadCollections } from './library'
const storage=new Map<string,string>()
beforeEach(()=>{storage.clear();Object.assign(globalThis,{localStorage:{getItem:(key:string)=>storage.get(key) ?? null}})})
describe('集合標籤',()=>{
  it('保存多個標籤參照並移除重複與損壞資料',()=>{
    storage.set('ilslides.collections',JSON.stringify([{id:'c',name:'集合',photos:[],tagIds:['a',null,'b','a',2]}]))
    expect(loadCollections()[0]!.tagIds).toEqual(['a','b'])
    expect(tagIds({})).toEqual([])
  })
  it('舊集合不必有標籤',()=>{
    storage.set('ilslides.collections',JSON.stringify([{id:'c',name:'集合',photos:[]}]))
    expect(loadCollections()[0]!.tagIds).toBeUndefined()
  })
  it('讀取漸層顏色，略過無效顏色及重複 ID',()=>{
    const good={id:'a',name:'  旅行  ',start:'#123abc',end:'#FEDCBA'}
    storage.set('ilslides.tags',JSON.stringify([null,good,good,{...good,id:'b',start:'url(x)'},{...good,id:'c',name:' '}]))
    expect(loadTags()).toEqual([{...good,name:'旅行'}])
    expect(tagStyle(good).background).toBe('linear-gradient(135deg, #123abc, #FEDCBA)')
  })
  it('損壞標籤儲存內容不影響啟動',()=>{
    storage.set('ilslides.tags','broken');expect(loadTags()).toEqual([])
    storage.set('ilslides.tags','{}');expect(loadTags()).toEqual([])
  })
})
