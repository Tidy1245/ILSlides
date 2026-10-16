import {describe,it,expect} from 'vitest'
import {pickerPhotos,movePhoto} from './photo-picker'
const photos=[{uri:'10',name:'photo10.jpg',modifiedAt:1000},{uri:'2',name:'photo2.jpg',modifiedAt:3000},{uri:'1',name:'PHOTO1.jpg'},{uri:'4',name:'photo4.jpg',modifiedAt:0}]
describe('挑圖搜尋、排序及已選順序',()=>{
 it('檔名搜尋忽略大小寫及前後空白，保留原始清單',()=>{
  expect(pickerPhotos(photos,' PHOTO1 ','name','asc').map(p=>p.uri)).toEqual(['1','10'])
  expect(pickerPhotos(photos,'missing','name','asc')).toEqual([])
  expect(photos.map(p=>p.uri)).toEqual(['10','2','1','4'])
 })
 it('檔名採自然排序，遞增及遞減獨立於選取順序',()=>{
  expect(pickerPhotos(photos,'','name','asc').map(p=>p.uri)).toEqual(['1','2','4','10'])
  expect(pickerPhotos(photos,'','name','desc').map(p=>p.uri)).toEqual(['10','4','2','1'])
 })
 it('修改日期排序在兩個方向都把未知日期放最後',()=>{
  expect(pickerPhotos(photos,'','updatedAt','asc').map(p=>p.uri)).toEqual(['10','2','1','4'])
  expect(pickerPhotos(photos,'','updatedAt','desc').map(p=>p.uri)).toEqual(['2','10','4','1'])
 })
 it('搜尋與日期排序共同套用且處理不合法日期',()=>{
  const source=[...photos,{uri:'bad',name:'photo9.jpg',modifiedAt:NaN}]
  expect(pickerPhotos(source,'photo','updatedAt','desc').map(p=>p.uri)).toEqual(['2','10','bad','4','1'])
 })
 it('向前及向後移動不遺失照片也不修改原清單',()=>{
  expect(movePhoto(photos,0,3).map(p=>p.uri)).toEqual(['2','1','4','10'])
  expect(movePhoto(photos,3,0).map(p=>p.uri)).toEqual(['4','10','2','1'])
  expect(photos.map(p=>p.uri)).toEqual(['10','2','1','4'])
 })
 it('無效拖曳索引及同位置皆保留選取清單',()=>{
  for(const [from,to] of [[-1,2],[0,99],[1.5,2],[2,2]]) expect(movePhoto(photos,from!,to!)).toEqual(photos)
  expect(movePhoto([],0,1)).toEqual([])
 })
})
