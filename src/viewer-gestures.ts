export interface Point { x:number; y:number }
export interface ViewState { scale:number; x:number; y:number }
export interface ImageFrame { width:number; height:number; imageWidth:number; imageHeight:number }
export const initialView=():ViewState=>({scale:1,x:.5,y:.5})
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value))
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const midpoint=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2})
export function imageBox(view:ViewState,frame:ImageFrame) {
  const fit=Math.min(frame.width/frame.imageWidth,frame.height/frame.imageHeight)
  const width=frame.imageWidth*fit,height=frame.imageHeight*fit,scale=clamp(view.scale,1,4)
  const x=width*scale<=frame.width ? .5 : clamp(view.x,frame.width/(2*width*scale),1-frame.width/(2*width*scale))
  const y=height*scale<=frame.height ? .5 : clamp(view.y,frame.height/(2*height*scale),1-frame.height/(2*height*scale))
  return {width,height,scale,x,y,left:frame.width/2-width*scale*x,top:frame.height/2-height*scale*y}
}
export function imagePoint(view:ViewState,frame:ImageFrame,point:Point):Point {
  const box=imageBox(view,frame)
  return {x:(point.x-box.left)/(box.width*box.scale),y:(point.y-box.top)/(box.height*box.scale)}
}
export function anchoredView(frame:ImageFrame,anchor:Point,point:Point,scale:number):ViewState {
  const base=imageBox(initialView(),frame),s=clamp(scale,1,4)
  const view={scale:s,x:anchor.x-(point.x-frame.width/2)/(base.width*s),y:anchor.y-(point.y-frame.height/2)/(base.height*s)}
  const box=imageBox(view,frame)
  return {scale:s,x:box.x,y:box.y}
}
export function zoomAt(view:ViewState,frame:ImageFrame,point:Point,scale:number) {
  return anchoredView(frame,imagePoint(view,frame,point),point,scale)
}
interface GestureOptions {
  frame:()=>ImageFrame | undefined
  view:()=>ViewState
  change:(view:ViewState)=>void
  tap:()=>void
  step:(delta:number)=>void
  doubleScale:()=>number
}
type Pinch={ids:number[];distance:number;scale:number;anchor:Point;frame:ImageFrame}
/** One recognizer owns taps, swipes and multi-touch so they cannot fire together. */
export class ViewerGestures {
  private points=new Map<number,Point>()
  private single?:{start:Point;time:number;movement:number}
  private multi=false
  private blocked=false
  private pinch?:Pinch
  private pending?:{point:Point;time:number}
  private timer?:ReturnType<typeof setTimeout>
  constructor(private options:GestureOptions) {}
  private clearTap() {clearTimeout(this.timer);this.timer=undefined;this.pending=undefined}
  private singleTap() {this.clearTap();this.options.tap()}
  down(id:number,point:Point,time:number) {
    if(!this.points.size) {
      if(this.pending && (time-this.pending.time>280 || distance(point,this.pending.point)>24)) this.singleTap()
      clearTimeout(this.timer)
      this.single={start:point,time,movement:0};this.multi=false;this.blocked=false
    }
    this.points.set(id,point)
    if(this.points.size>1) {
      this.multi=true;this.single=undefined;this.clearTap();this.beginPinch()
    }
  }
  private beginPinch() {
    this.pinch=undefined
    if(this.points.size!==2 || this.blocked) return
    const frame=this.options.frame(),entries=[...this.points.entries()]
    if(!frame) return
    const a=entries[0]!,b=entries[1]!,span=distance(a[1],b[1])
    if(span<2) return
    const view=this.options.view()
    this.pinch={ids:[a[0],b[0]],distance:span,scale:view.scale,anchor:imagePoint(view,frame,midpoint(a[1],b[1])),frame}
  }
  move(id:number,point:Point) {
    if(!this.points.has(id)) return
    this.points.set(id,point)
    if(this.blocked) return
    if(this.multi) {
      if(this.points.size!==2) return
      if(!this.pinch) {this.beginPinch();return}
      const a=this.points.get(this.pinch.ids[0]!),b=this.points.get(this.pinch.ids[1]!)
      if(!a || !b) return
      this.options.change(anchoredView(this.pinch.frame,this.pinch.anchor,midpoint(a,b),this.pinch.scale*distance(a,b)/this.pinch.distance))
    } else if(this.single) {
      this.single.movement=Math.max(this.single.movement,distance(point,this.single.start))
      if(this.single.movement>10) this.clearTap()
    }
  }
  up(id:number,point:Point,time:number) {
    if(!this.points.has(id)) return
    this.points.delete(id)
    if(!this.multi && !this.blocked && this.single) {
      const {start,time:started,movement}=this.single,dx=point.x-start.x,dy=point.y-start.y
      if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.3) {this.clearTap();this.options.step(dx<0 ? 1 : -1)}
      else if(Math.max(movement,distance(start,point))<=10 && time-started<=250) this.tap(point,time)
      else this.clearTap()
    }
    if(!this.points.size) {this.single=undefined;this.multi=false;this.blocked=false;this.pinch=undefined}
    else if(this.multi) this.beginPinch()
  }
  private tap(point:Point,time:number) {
    const frame=this.options.frame()
    if(!frame) {this.clearTap();return}
    if(this.pending && time-this.pending.time<=280 && distance(point,this.pending.point)<=24) {
      this.clearTap()
      const view=this.options.view(),location=imagePoint(view,frame,point)
      if(location.x<0 || location.x>1 || location.y<0 || location.y>1) return
      this.options.change(view.scale>1.001 ? initialView() : zoomAt(view,frame,point,this.options.doubleScale()))
    } else {
      if(this.pending) this.singleTap()
      this.pending={point,time};this.timer=setTimeout(()=>this.singleTap(),280)
    }
  }
  // A canceled or reconfigured gesture stays blocked until every remaining contact lifts.
  abort() {this.clearTap();this.single=undefined;this.pinch=undefined;this.blocked=this.points.size>0}
  cancelPointer(id:number) {
    if(!this.points.delete(id)) return
    this.abort()
    if(!this.points.size) {this.multi=false;this.blocked=false}
  }
  dispose() {this.clearTap();this.points.clear();this.pinch=undefined;this.single=undefined}
}
