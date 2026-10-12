import { describe,it,expect } from 'vitest'
import { cropRect } from './cover'
describe('封面裁切',()=>{
 it('直式圖片置中裁成 4:3',()=>{
  expect(cropRect(600,800,{x:.5,y:.5,zoom:1})).toEqual({x:0,y:175,width:600,height:450})
 })
 it('縮放和拖曳不超出來源且維持比例',()=>{
  const crop=cropRect(1600,900,{x:1,y:0,zoom:2})
  expect(crop).toEqual({x:1000,y:0,width:600,height:450})
  expect(crop.x+crop.width).toBeLessThanOrEqual(1600)
 })
 it('限制縮放與位置的上下限',()=>{
  expect(cropRect(600,800,{x:-1,y:2,zoom:0})).toEqual({x:0,y:350,width:600,height:450})
  expect(cropRect(600,800,{x:.5,y:.5,zoom:10}).width).toBe(200)
 })
})
