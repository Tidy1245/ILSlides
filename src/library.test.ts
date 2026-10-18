import { describe, expect, it, beforeEach } from 'vitest'
import { nextIndex, sortedPhotos, uniquePhotos, suggestCollectionName, loadCollections, loadFolders } from './library'
const storage=new Map<string,string>()
beforeEach(() => {
 storage.clear()
 Object.assign(globalThis,{localStorage:{getItem:(key:string)=>storage.get(key) ?? null}})
})
describe('集合瀏覽', () => {
 it('按指定正則取空白或連字號前的檔名',()=>{
  expect(suggestCollectionName('旅行 001.jpg')).toBe('旅行')
  expect(suggestCollectionName('旅行-001.jpg')).toBe('旅行')
  expect(suggestCollectionName('旅行	001.jpg')).toBe('旅行')
 })
 it('無分隔符時保留完整檔名，包含副檔名',()=>{
  expect(suggestCollectionName('photo.jpg')).toBe('photo.jpg')
 })
 it('未選圖片或第一字元無法匹配時不產生名稱',()=>{
  expect(suggestCollectionName()).toBe('')
  expect(suggestCollectionName(' leading.jpg')).toBe('')
  expect(suggestCollectionName('-leading.jpg')).toBe('')
 })
 it('依檔名自然排序並保留原清單', () => {
  const source=[{name:'photo10.jpg',uri:'10'},{name:'photo2.jpg',uri:'2'},{name:'photo1.jpg',uri:'1'}]
  expect(sortedPhotos(source).map(p=>p.uri)).toEqual(['1','2','10']); expect(source[0]!.uri).toBe('10')
 })
 it('前後循環與空清單不越界', () => {
  expect(nextIndex(2,1,3)).toBe(0); expect(nextIndex(0,-1,3)).toBe(2); expect(nextIndex(0,1,0)).toBe(0)
 })
 it('同一圖片跨資料夾重複選取只保留一次', () => {
  expect(uniquePhotos([{uri:'a',name:'a'},{uri:'b',name:'b'},{uri:'a',name:'a'}]).map(p=>p.uri)).toEqual(['a','b'])
 })
 it('集合只載入所選圖片，來源資料夾獨立保存', () => {
  storage.set('ilslides.collections',JSON.stringify([{id:'1',name:'精選',photos:[{uri:'2',name:'photo2'}]}]))
  storage.set('ilslides.folders',JSON.stringify([{uri:'folder',name:'常用'}]))
  expect(loadCollections()).toEqual([{id:'1',name:'精選',photos:[{uri:'2',name:'photo2'}]}])
  expect(loadFolders()).toEqual([{uri:'folder',name:'常用'}])
 })
 it('舊集合保留待轉換來源且恢復資料夾捷徑', () => {
  storage.set('ilslides.collections',JSON.stringify([{id:'old',name:'舊回憶',tree:'old-uri',folder:'Travel',count:3}]))
  expect(loadCollections()).toEqual([{id:'old',name:'舊回憶',photos:[],legacyTree:'old-uri'}])
  expect(loadFolders()).toEqual([{uri:'old-uri',name:'Travel'}])
 })
 it('刪除最後一個捷徑後重開，不從舊集合恢復已刪除資料夾',()=>{
  storage.set('ilslides.collections',JSON.stringify([{id:'old',name:'舊回憶',tree:'old-uri',folder:'Travel'}]))
  storage.set('ilslides.folders','[]')
  expect(loadFolders()).toEqual([])
  expect(loadCollections()[0]!.legacyTree).toBe('old-uri')
 })
 it('明確保存的資料夾清單不重新加入舊捷徑',()=>{
  storage.set('ilslides.collections',JSON.stringify([{id:'old',name:'舊回憶',tree:'deleted-uri'}]))
  storage.set('ilslides.folders',JSON.stringify([{uri:'kept-uri',name:'保留'}]))
  expect(loadFolders()).toEqual([{uri:'kept-uri',name:'保留'}])
 })
 it('保留有效封面設定，來源移出集合時移除封面',()=>{
  const cover={uri:'a',x:.2,y:.7,zoom:2}
  storage.set('ilslides.collections',JSON.stringify([{id:'1',name:'收藏',photos:[{uri:'a',name:'a'}],cover}]))
  expect(loadCollections()[0]!.cover).toEqual(cover)
  storage.set('ilslides.collections',JSON.stringify([{id:'1',name:'收藏',photos:[],cover}]))
  expect(loadCollections()[0]!.cover).toBeUndefined()
 })
 it('無效封面數值與非陣列資料不會使載入崩潰',()=>{
  storage.set('ilslides.collections',JSON.stringify([{id:'1',name:'收藏',photos:{},cover:{uri:'a',x:0,y:0,zoom:1}}]))
  expect(loadCollections()[0]!.cover).toBeUndefined()
 })
 it('損壞資料與無效圖片不會使載入崩潰', () => {
  storage.set('ilslides.collections','broken'); expect(loadCollections()).toEqual([])
  storage.set('ilslides.collections',JSON.stringify([null,{id:'1',name:'收藏',photos:[null,{uri:'ok',name:'有效'}]}]))
  expect(loadCollections()[0]!.photos).toEqual([{uri:'ok',name:'有效'}])
 })
})
