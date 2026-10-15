import type { CoverSettings } from './cover'
import { tagIds } from './tags'
import { registerPlugin } from '@capacitor/core'
export interface Photo { uri: string; name: string }
export interface SourceFolder { uri: string; name: string }
export interface Collection { id: string; name: string; photos: Photo[]; legacyTree?: string; cover?:CoverSettings; tagIds?:string[]; createdAt?:number; updatedAt?:number }
export interface CachedCover { uri:string; sourceUri:string; signature:string; createdAt:number }
export interface SourceState { status:'ok'|'missing'|'denied'|'unknown'; signature:string }
export const Folders = registerPlugin<{
  pick(): Promise<{ uri: string; name: string; cancelled?: boolean }>
  list(options: { tree: string }): Promise<{ images: Photo[] }>
  image(options: { uri: string; size: number }): Promise<{ data: string }>
  coverCache(options:{op:'get'|'put'|'remove'|'clear';key?:string;data?:string;sourceUri?:string;signature?:string}):Promise<{entry?:CachedCover}>
  sourceState(options:{uri:string}):Promise<SourceState>
}>('ImageFolders')
export function sortedPhotos(photos: Photo[]) {
  return [...photos].sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant', { numeric: true }))
}
export function nextIndex(index: number, delta: number, length: number) {
  return length ? (index + delta + length) % length : 0
}
export function uniquePhotos(photos: Photo[]) {
  return [...new Map(photos.map(p => [p.uri, {uri:p.uri, name:p.name}])).values()]
}
export function suggestCollectionName(fileName?:string) {
  return fileName?.match(/^([^\s-]+)/)?.[1] || ''
}
function read(key: string): unknown[] {
  try { const value=JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}
function validPhoto(p: any): p is Photo { return p && typeof p.uri === 'string' && typeof p.name === 'string' }
export function loadCollections(): Collection[] {
  return read('ilslides.collections').filter((c:any) => c && typeof c.id==='string' && typeof c.name==='string').map((c:any) => ({
    id:c.id, name:c.name, ...(Number.isFinite(c.createdAt) && c.createdAt>0 ? {createdAt:c.createdAt} : {}), ...(Number.isFinite(c.updatedAt) && c.updatedAt>0 ? {updatedAt:c.updatedAt} : {}), ...((c.cover && typeof c.cover.uri === 'string' && [c.cover.x,c.cover.y,c.cover.zoom].every(Number.isFinite) && Array.isArray(c.photos) && c.photos.some((p:any)=>p?.uri===c.cover.uri)) ? {cover:c.cover} : {}), photos:Array.isArray(c.photos) ? uniquePhotos(c.photos.filter(validPhoto)) : [],
    ...(tagIds(c.tagIds).length ? {tagIds:tagIds(c.tagIds)} : {}),
    ...((c.legacyTree || (!Array.isArray(c.photos) && c.tree)) ? {legacyTree:c.legacyTree || c.tree} : {})
  }))
}
export function loadFolders(): SourceFolder[] {
  const folders=read('ilslides.folders').filter((f:any) => f && typeof f.uri==='string' && typeof f.name==='string') as SourceFolder[]
  // Recover folder shortcuts from v1.0.0 without changing existing collections.
  for(const c of read('ilslides.collections') as any[]) {
    if(c && typeof c.tree==='string' && !folders.some(f=>f.uri===c.tree)) folders.push({uri:c.tree,name:c.folder || '圖片目錄'})
  }
  return folders
}
