import { Capacitor } from '@capacitor/core'
import { Folders, type CachedCover, type Collection, type SourceState } from './library'
import { drawCover } from './cover'

const MAX_AGE=24*60*60*1000
export function coverKey(c:Collection) {
  const crop=c.cover && c.photos.some(p=>p.uri===c.cover!.uri) ? c.cover : undefined
  return JSON.stringify([1,c.id,crop ? [crop.uri,crop.x,crop.y,crop.zoom] : c.photos[0]?.uri || ''])
}
export interface CoverBackend {
  get(key:string):Promise<CachedCover | undefined>
  put(key:string,data:string,sourceUri:string,signature:string):Promise<CachedCover | undefined>
  remove(key:string):Promise<void>
  source(uri:string):Promise<SourceState>
}
export interface RenderedCover { data:string; sourceUri:string; signature:string }
type Job={key:string;collection:Collection;listeners:Set<(src:string)=>void>;entry?:CachedCover;epoch:number}

// Cache lookups happen immediately; expensive generation and validation have one worker.
export class CoverLoader {
  private jobs=new Map<string,Job>()
  private queue:Job[]=[]
  private running=false
  private epoch=0
  constructor(private backend:CoverBackend,private render:(c:Collection)=>Promise<RenderedCover>,private url=(uri:string)=>uri) {}
  request(collection:Collection,publish:(src:string)=>void) {
    const key=coverKey(collection)
    let job=this.jobs.get(key)
    if(job) { job.listeners.add(publish); if(job.entry) publish(this.url(job.entry.uri)) }
    else {
      job={key,collection,listeners:new Set([publish]),epoch:this.epoch}
      this.jobs.set(key,job)
      void this.lookup(job)
    }
    const current=job
    return ()=>{
      current.listeners.delete(publish)
      if(!current.listeners.size && this.jobs.get(key)===current) this.jobs.delete(key)
    }
  }
  reset() { ++this.epoch; this.queue=[]; this.jobs.clear() }
  async remove(key:string) {
    const job=this.jobs.get(key)
    if(job) {job.listeners.clear();this.jobs.delete(key)}
    await this.backend.remove(key)
  }
  private wanted(job:Job) { return job.epoch===this.epoch && job.listeners.size>0 }
  private publish(job:Job,src:string) { if(this.wanted(job)) job.listeners.forEach(fn=>fn(src)) }
  private async lookup(job:Job) {
    try { job.entry=await this.backend.get(job.key) } catch { /* Cache is optional. */ }
    if(this.wanted(job)) {
      if(job.entry) this.publish(job,this.url(job.entry.uri))
      this.queue.push(job)
      void this.work()
    } else if(this.jobs.get(job.key)===job) this.jobs.delete(job.key)
  }
  private async fresh(job:Job) {
    const entry=job.entry
    if(!entry) return false
    if(!job.collection.photos.some(p=>p.uri===entry.sourceUri)) {
      this.publish(job,''); await this.backend.remove(job.key);job.entry=undefined;return false
    }
    const state=await this.backend.source(entry.sourceUri)
    if(state.status==='missing' || state.status==='denied') {
      this.publish(job,''); await this.backend.remove(job.key); job.entry=undefined; return false
    }
    const preferred=job.collection.cover?.uri || job.collection.photos[0]?.uri
    if(preferred && preferred!==entry.sourceUri && (await this.backend.source(preferred)).status==='ok') return false
    if(state.status==='ok' && state.signature && entry.signature) return state.signature===entry.signature
    return Date.now()-entry.createdAt<MAX_AGE
  }
  private async work() {
    if(this.running) return
    this.running=true
    try {
      while(this.queue.length) {
        const job=this.queue.shift()!
        try {
          if(!this.wanted(job)) continue
          if(await this.fresh(job) || !this.wanted(job)) continue
          const result=await this.render(job.collection)
          if(!this.wanted(job)) continue
          let saved:CachedCover | undefined
          try { saved=await this.backend.put(job.key,result.data,result.sourceUri,result.signature) } catch { /* Display even when disk is full. */ }
          this.publish(job,saved ? this.url(saved.uri) : result.data)
        } catch { /* Keep a usable cached preview on transient provider failures. */ }
        finally { if(this.jobs.get(job.key)===job) this.jobs.delete(job.key) }
      }
    } finally { this.running=false }
  }
}

const backend:CoverBackend={
  get:async key=>(await Folders.coverCache({op:'get',key})).entry,
  put:async(key,data,sourceUri,signature)=>(await Folders.coverCache({op:'put',key,data,sourceUri,signature})).entry,
  remove:async key=>{ await Folders.coverCache({op:'remove',key}) },
  source:async uri=>Folders.sourceState({uri})
}
async function renderCover(c:Collection):Promise<RenderedCover> {
  const selected=c.cover && c.photos.some(p=>p.uri===c.cover!.uri) ? c.cover : undefined
  const candidates=[...(selected ? [{uri:selected.uri,crop:selected}] : []),...c.photos.map(p=>({uri:p.uri,crop:undefined}))]
  for(const candidate of candidates) {
    try {
      const state=await backend.source(candidate.uri)
      if(state.status==='missing' || state.status==='denied') continue
      const result=await Folders.image({uri:candidate.uri,size:candidate.crop ? 1600 : 600})
      let data=result.data
      if(candidate.crop) {
        const img=new Image(); img.src=data; await img.decode()
        const canvas=document.createElement('canvas'); drawCover(canvas,img,candidate.crop)
        data=canvas.toDataURL('image/webp',.88)
      }
      return {data,sourceUri:candidate.uri,signature:state.signature}
    } catch { /* Try another selected photo if its source cannot be read. */ }
  }
  throw new Error('集合中沒有可讀取的封面圖片')
}
export const coverLoader=new CoverLoader(backend,renderCover,uri=>Capacitor.convertFileSrc(uri))
