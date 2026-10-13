import { describe,it,expect,beforeEach } from 'vitest'
import { sortCollections, transitionTime, loadPreferences } from './preferences'
const rows=[{id:'b',name:'B',photos:[],createdAt:10,updatedAt:30},{id:'a',name:'A',photos:[],createdAt:30,updatedAt:10},{id:'c',name:'C',photos:[],createdAt:20,updatedAt:20}]
beforeEach(()=>Object.assign(globalThis,{localStorage:{getItem:()=>null}}))
describe('集合排序與轉場設定',()=>{
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
 it('停用自動命名後重新載入仍保持停用',()=>{
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({autoName:false})}})
  expect(loadPreferences().autoName).toBe(false)
 })
 it('載入有效設定並回退損壞設定',()=>{
  Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify({transitionMs:1200,sortKey:'updatedAt',sortDirection:'desc',autoName:true})}})
  expect(loadPreferences()).toEqual({transitionMs:1200,sortKey:'updatedAt',sortDirection:'desc',autoName:true})
  Object.assign(globalThis,{localStorage:{getItem:()=>'{invalid'}})
  expect(loadPreferences()).toEqual({transitionMs:360,sortKey:'name',sortDirection:'asc',autoName:true})
 })
})
