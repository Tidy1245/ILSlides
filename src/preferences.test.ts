import { describe,it,expect,beforeEach } from 'vitest'
import { sortCollections, filterCollections, transitionTime, loadPreferences, doubleTapScale, recommendedCollectionIds } from './preferences'
import type { Collection } from './library'
const rows=[{id:'b',name:'B',photos:[],createdAt:10,updatedAt:30},{id:'a',name:'A',photos:[],createdAt:30,updatedAt:10},{id:'c',name:'C',photos:[],createdAt:20,updatedAt:20}]
beforeEach(()=>Object.assign(globalThis,{localStorage:{getItem:()=>null}}))
describe('集合排序與轉場設定',()=>{
 it('首頁推薦從所有集合抽四筆且不重複，集合不足四筆時全數顯示',()=>{
  const many=Array.from({length:8},(_,i)=>({id:String(i),name:String(i),photos:[]}))
  expect(recommendedCollectionIds(many,()=>0)).toEqual(['0','1','2','3'])
  expect(recommendedCollectionIds(many,()=>0.99)).toHaveLength(4)
  expect(new Set(recommendedCollectionIds(many,()=>0.99)).size).toBe(4)
  expect(recommendedCollectionIds(rows,()=>0.5).sort()).toEqual(['a','b','c'])
  expect(recommendedCollectionIds([],()=>0)).toEqual([])
 })
 it('首頁模式保存後重新開啟仍維持推薦，舊設定預設最近集合',()=>{
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({homeMode:'recommended'})}})
  expect(loadPreferences().homeMode).toBe('recommended')
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({homeMode:'invalid'})}})
  expect(loadPreferences().homeMode).toBe('recent')
 })
 it('未選標籤時保留全部，搜尋忽略大小寫及前後空白',()=>{
  expect(filterCollections(rows,'',[])).toEqual(rows)
  expect(filterCollections(rows,'  b ',[]).map(c=>c.id)).toEqual(['b'])
 })
 it('複選標籤採任一符合，且與名稱搜尋一起套用',()=>{
  const tagged:Collection[]=[{...rows[0]!,tagIds:['trip']},{...rows[1]!,tagIds:['family']},{...rows[2]!,tagIds:['trip','family']}, {id:'old',name:'Old',photos:[]}]
  expect(filterCollections(tagged,'',['trip']).map(c=>c.id)).toEqual(['b','c'])
  expect(filterCollections(tagged,'',['trip','family']).map(c=>c.id)).toEqual(['b','a','c'])
  expect(filterCollections(tagged,'c',['family']).map(c=>c.id)).toEqual(['c'])
  expect(filterCollections(tagged,'',['missing'])).toEqual([])
  expect(tagged[0]!.tagIds).toEqual(['trip'])
 })
 it('三種欄位各自支援遞增及遞減且不改原順序',()=>{
  expect(sortCollections(rows,'name','asc').map(c=>c.id)).toEqual(['a','b','c'])
  expect(sortCollections(rows,'name','desc').map(c=>c.id)).toEqual(['c','b','a'])
  expect(sortCollections(rows,'createdAt','asc').map(c=>c.id)).toEqual(['b','c','a'])
  expect(sortCollections(rows,'createdAt','desc').map(c=>c.id)).toEqual(['a','c','b'])
  expect(sortCollections(rows,'updatedAt','asc').map(c=>c.id)).toEqual(['a','c','b'])
  expect(sortCollections(rows,'updatedAt','desc').map(c=>c.id)).toEqual(['b','c','a'])
  expect(rows.map(c=>c.id)).toEqual(['b','a','c'])
 })
 it('舊集合缺少日期時仍能穩定排序',()=>{
  expect(sortCollections([{id:'old',name:'舊',photos:[]},...rows],'createdAt','asc')[0]!.id).toBe('old')
 })
 it('轉場時間限制在滑桿範圍並處理無效值',()=>{
  expect(transitionTime(-1)).toBe(100);expect(transitionTime(9000)).toBe(2000)
  expect(transitionTime(NaN)).toBe(360);expect(transitionTime(361)).toBe(360)
 })
 it('雙擊倍率有預設、範圍與四分之一倍刻度，且可保存載入',()=>{
  expect(doubleTapScale(undefined)).toBe(2);expect(doubleTapScale(NaN)).toBe(2)
  expect(doubleTapScale(0)).toBe(1.5);expect(doubleTapScale(9)).toBe(4);expect(doubleTapScale(2.3)).toBe(2.25)
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({doubleTapScale:3.25})}})
  expect(loadPreferences().doubleTapScale).toBe(3.25)
 })
 it('挑圖排序與集合排序獨立保存，損壞值回預設',()=>{
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({sortKey:'createdAt',sortDirection:'asc',photoSortKey:'updatedAt',photoSortDirection:'desc'})}})
  expect(loadPreferences().sortKey).toBe('createdAt');expect(loadPreferences().photoSortKey).toBe('updatedAt');expect(loadPreferences().photoSortDirection).toBe('desc')
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({photoSortKey:'createdAt',photoSortDirection:'invalid'})}})
  expect(loadPreferences().photoSortKey).toBe('name');expect(loadPreferences().photoSortDirection).toBe('asc')
 })
 it('停用自動命名後重新載入仍保持停用',()=>{
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({autoName:false})}})
  expect(loadPreferences().autoName).toBe(false)
 })
 it('載入有效設定並回退損壞設定',()=>{
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({transitionMs:1200,sortKey:'updatedAt',sortDirection:'desc',autoName:true,doubleTapScale:2,photoSortKey:'name',photoSortDirection:'asc'})}})
  expect(loadPreferences()).toEqual({transitionMs:1200,sortKey:'updatedAt',sortDirection:'desc',autoName:true,doubleTapScale:2,photoSortKey:'name',photoSortDirection:'asc',homeMode:'recent'})
  Object.assign(globalThis,{localStorage:{getItem:()=>'{invalid'}})
  expect(loadPreferences()).toEqual({transitionMs:360,sortKey:'name',sortDirection:'asc',autoName:true,doubleTapScale:2,photoSortKey:'name',photoSortDirection:'asc',homeMode:'recent'})
 })
})
