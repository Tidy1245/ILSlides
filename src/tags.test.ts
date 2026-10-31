import { beforeEach,describe,expect,it } from 'vitest'
import { loadTags,tagIds,tagStyle,moveTag } from './tags'
import { loadCollections } from './library'
const storage=new Map<string,string>()
beforeEach(()=>{storage.clear();Object.assign(globalThis,{localStorage:{getItem:(key:string)=>storage.get(key) ?? null}})})
describe('集合標籤',()=>{
  const tags=['a','b','c'].map(id=>({id,name:id,start:'#123abc',end:'#FEDCBA'}))
  it('依序位移動標籤，保留參照與原清單',()=>{
    const moved=moveTag(tags,'c',1)
    expect(moved.map(t=>t.id)).toEqual(['c','a','b'])
    expect(moveTag(moved,'c',3).map(t=>t.id)).toEqual(['a','b','c'])
    expect(tags.map(t=>t.id)).toEqual(['a','b','c'])
    expect(moved[0]).toBe(tags[2])
  })
  it('超出範圍的序位限制在首尾，無效輸入不改變順序',()=>{
    expect(moveTag(tags,'c',0).map(t=>t.id)).toEqual(['c','a','b'])
    expect(moveTag(tags,'a',100).map(t=>t.id)).toEqual(['b','c','a'])
    for(const position of [NaN,Infinity,1.5]) expect(moveTag(tags,'b',position)).toBe(tags)
    expect(moveTag(tags,'missing',1)).toBe(tags)
    expect(moveTag([], 'a',1)).toEqual([])
  })
  it('保存的標籤序位於重開後維持一致',()=>{
    storage.set('ilslides.tags',JSON.stringify(moveTag(tags,'c',1)))
    expect(loadTags().map(t=>t.id)).toEqual(['c','a','b'])
  })
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
