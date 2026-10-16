import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { ViewerGestures,initialView,imageBox,imagePoint,zoomAt,type ImageFrame,type Point,type ViewState } from './viewer-gestures'
const frame:ImageFrame={width:400,height:400,imageWidth:800,imageHeight:800}
const center={x:200,y:200}
function setup(initial=initialView()) {
 let view={...initial}
 const change=vi.fn((next:ViewState)=>{view=next}),tap=vi.fn(),step=vi.fn()
 const gestures=new ViewerGestures({frame:()=>frame,view:()=>view,change,tap,step,doubleScale:()=>2})
 const touch=(point:Point,time:number)=>{gestures.down(1,point,time);gestures.up(1,point,time+10)}
 return {gestures,change,tap,step,touch,view:()=>view}
}
beforeEach(()=>vi.useFakeTimers())
afterEach(()=>vi.useRealTimers())
describe('縮放視窗座標',()=>{
 it('初始完整顯示並維持原始比例',()=>{
  const box=imageBox(initialView(),{width:400,height:800,imageWidth:800,imageHeight:400})
  expect(box.width).toBe(400);expect(box.height).toBe(200);expect(box.left).toBe(0);expect(box.top).toBe(300)
 })
 it('指定位置放大後該圖片座標仍在手指位置',()=>{
  const point={x:300,y:100},anchor=imagePoint(initialView(),frame,point)
  const zoom=zoomAt(initialView(),frame,point,2)
  expect(zoom).toEqual({scale:2,x:.625,y:.375})
  expect(imagePoint(zoom,frame,point)).toEqual(anchor)
 })
 it('位移及倍率限位避免超過圖片邊緣',()=>{
  const box=imageBox({scale:9,x:9,y:-3},frame)
  expect(box.scale).toBe(4);expect(box.x).toBe(.875);expect(box.y).toBe(.125)
  expect(box.left+box.width*box.scale).toBe(frame.width);expect(box.top).toBe(0)
 })
 it('跨不同長寬比或螢幕尺寸計算不改寫保存的視窗',()=>{
  const view={scale:2,x:.7,y:.25},before={...view}
  imageBox(view,{...frame,imageHeight:1600})
  imageBox(view,{...frame,width:800,height:400})
  expect(view).toEqual(before)
  expect(imageBox(view,{...frame,imageWidth:1600,imageHeight:1600})).toEqual(imageBox(view,frame))
 })
})
describe('單指、雙指與雙擊手勢仲裁',()=>{
 it('單擊等待雙擊時間後只切換一次標題',()=>{
  const s=setup();s.touch(center,0);expect(s.tap).not.toHaveBeenCalled()
  vi.advanceTimersByTime(280);expect(s.tap).toHaveBeenCalledTimes(1);expect(s.change).not.toHaveBeenCalled()
 })
 it('雙擊放大指定區域，再次雙擊回完整圖片，均不觸發單擊',()=>{
  const s=setup(),point={x:300,y:100}
  s.touch(point,0);s.touch(point,150);vi.advanceTimersByTime(500)
  expect(s.view()).toEqual({scale:2,x:.625,y:.375});expect(s.tap).not.toHaveBeenCalled()
  s.touch(point,1000);s.touch(point,1150)
  expect(s.view()).toEqual(initialView());expect(s.step).not.toHaveBeenCalled()
 })
 it('雙擊間隔或位置相隔太遠只算兩次單擊',()=>{
  const s=setup();s.touch(center,0);s.touch({x:300,y:200},100)
  vi.advanceTimersByTime(280);expect(s.tap).toHaveBeenCalledTimes(2);expect(s.change).not.toHaveBeenCalled()
  const other=setup();other.touch(center,0);vi.advanceTimersByTime(280);other.touch(center,500);vi.advanceTimersByTime(280)
  expect(other.tap).toHaveBeenCalledTimes(2);expect(other.change).not.toHaveBeenCalled()
 })
 it('放大後單指仍切圖，不變更縮放視窗',()=>{
  const s=setup({scale:3,x:.6,y:.4})
  s.gestures.down(1,{x:300,y:200},0);s.gestures.move(1,{x:100,y:200});s.gestures.up(1,{x:100,y:200},100)
  expect(s.step).toHaveBeenCalledExactlyOnceWith(1);expect(s.view()).toEqual({scale:3,x:.6,y:.4})
  vi.advanceTimersByTime(500);expect(s.tap).not.toHaveBeenCalled()
 })
 it('垂直、短距離或拖出又拖回都不誤判成點擊',()=>{
  const s=setup();s.gestures.down(1,center,0);s.gestures.move(1,{x:200,y:300});s.gestures.up(1,center,100)
  s.gestures.down(1,center,200);s.gestures.up(1,{x:205,y:280},300)
  vi.advanceTimersByTime(500);expect(s.tap).not.toHaveBeenCalled();expect(s.step).not.toHaveBeenCalled()
 })
 it('加入第二指後取消原單指切圖並連續縮放',()=>{
  const s=setup();s.gestures.down(1,{x:150,y:200},0);s.gestures.move(1,{x:100,y:200})
  s.gestures.down(2,{x:300,y:200},30);s.gestures.move(1,{x:0,y:200});s.gestures.move(2,{x:400,y:200})
  expect(s.view().scale).toBe(2)
  s.gestures.up(1,{x:0,y:200},100);s.gestures.move(2,{x:100,y:200});s.gestures.up(2,{x:100,y:200},200)
  vi.advanceTimersByTime(500);expect(s.step).not.toHaveBeenCalled();expect(s.tap).not.toHaveBeenCalled()
 })
 it('雙指同向移動平移視窗，不切圖',()=>{
  const s=setup({scale:2,x:.5,y:.5})
  s.gestures.down(1,{x:150,y:200},0);s.gestures.down(2,{x:250,y:200},10)
  s.gestures.move(1,{x:190,y:240});s.gestures.move(2,{x:290,y:240})
  expect(s.view().scale).toBe(2);expect(s.view().x).toBeCloseTo(.45);expect(s.view().y).toBeCloseTo(.45)
  expect(s.step).not.toHaveBeenCalled()
 })
 it('雙指全部放開之後才接受新的單指切圖',()=>{
  const s=setup();s.gestures.down(1,{x:100,y:200},0);s.gestures.down(2,{x:300,y:200},10)
  s.gestures.up(1,{x:100,y:200},20);s.gestures.up(2,{x:0,y:200},30)
  expect(s.step).not.toHaveBeenCalled()
  s.gestures.down(3,{x:100,y:200},50);s.gestures.up(3,{x:300,y:200},150)
  expect(s.step).toHaveBeenCalledExactlyOnceWith(-1)
 })
 it('第三指加入再離開不產生縮放跳動或切圖',()=>{
  const s=setup();s.gestures.down(1,{x:100,y:200},0);s.gestures.down(2,{x:300,y:200},10)
  s.gestures.down(3,center,20);s.gestures.move(1,{x:50,y:200});expect(s.change).not.toHaveBeenCalled()
  s.gestures.up(3,center,30);s.gestures.move(1,{x:50,y:200})
  expect(s.view().scale).toBe(1);expect(s.step).not.toHaveBeenCalled()
 })
 it('圖片切換或尺寸改變取消待定點擊並保留倍率',()=>{
  const s=setup({scale:2,x:.6,y:.4});s.touch(center,0);s.gestures.abort();vi.advanceTimersByTime(500)
  expect(s.tap).not.toHaveBeenCalled();expect(s.view()).toEqual({scale:2,x:.6,y:.4})
 })
 it('系統取消一個觸點後其餘手指不會誤觸切圖',()=>{
  const s=setup();s.gestures.down(1,{x:100,y:200},0);s.gestures.down(2,{x:300,y:200},10)
  s.gestures.cancelPointer(1);s.gestures.up(2,{x:0,y:200},100)
  vi.advanceTimersByTime(500);expect(s.step).not.toHaveBeenCalled();expect(s.tap).not.toHaveBeenCalled()
 })
 it('清理後不會留下延遲單擊',()=>{
  const s=setup();s.touch(center,0);s.gestures.dispose();vi.advanceTimersByTime(500);expect(s.tap).not.toHaveBeenCalled()
 })
})
