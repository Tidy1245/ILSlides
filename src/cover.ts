export interface CoverSettings { uri:string; x:number; y:number; zoom:number }
export function cropRect(width:number,height:number,cover:Pick<CoverSettings,'x'|'y'|'zoom'>,ratio=4/3) {
  const zoom=Math.max(1,Math.min(3,cover.zoom))
  const w=Math.min(width,height*ratio)/zoom, h=w/ratio
  return {x:(width-w)*Math.max(0,Math.min(1,cover.x)),y:(height-h)*Math.max(0,Math.min(1,cover.y)),width:w,height:h}
}
export function drawCover(canvas:HTMLCanvasElement,img:HTMLImageElement,cover:CoverSettings,ratio=4/3) {
  const r=cropRect(img.naturalWidth,img.naturalHeight,cover,ratio)
  canvas.width=ratio>4/3 ? 1200 : 600; canvas.height=450
  const ctx=canvas.getContext('2d')!
  ctx.drawImage(img,r.x,r.y,r.width,r.height,0,0,canvas.width,canvas.height)
}
