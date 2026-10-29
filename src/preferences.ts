import type { Collection } from './library'
export type SortKey='name'|'createdAt'|'updatedAt'
export type SortDirection='asc'|'desc'
export type HomeMode='recent'|'recommended'
export function recommendedCollectionIds(collections:Collection[],random=Math.random) {
 const ids=collections.map(c=>c.id)
 for(let i=0;i<Math.min(4,ids.length);i++) {
  const pick=i+Math.floor(random()*(ids.length-i))
  ;[ids[i],ids[pick]]=[ids[pick]!,ids[i]!]
 }
 return ids.slice(0,4)
}
export function filterCollections(collections:Collection[], query:string, tags:string[]) {
 const name=query.trim().toLocaleLowerCase()
 return collections.filter(c=>c.name.toLocaleLowerCase().includes(name) && (!tags.length || tags.some(id=>c.tagIds?.includes(id))))
}
export function sortCollections(collections:Collection[], key:SortKey, direction:SortDirection) {
 const sign=direction==='asc' ? 1 : -1
 return [...collections].sort((a,b)=>sign*(key==='name' ? a.name.localeCompare(b.name,'zh-Hant',{numeric:true,sensitivity:'base'}) : (a[key] || 0)-(b[key] || 0)))
}
export function transitionTime(value:unknown) {
 return typeof value==='number' && Number.isFinite(value) ? Math.max(100,Math.min(2000,Math.round(value/20)*20)) : 360
}
export function doubleTapScale(value:unknown) {
 return typeof value==='number' && Number.isFinite(value) ? Math.max(1.5,Math.min(4,Math.round(value*4)/4)) : 2
}
export function loadPreferences():{transitionMs:number;sortKey:SortKey;sortDirection:SortDirection;autoName:boolean;doubleTapScale:number;photoSortKey:'name'|'updatedAt';photoSortDirection:SortDirection;homeMode:HomeMode} {
 try {
  const value=JSON.parse(localStorage.getItem('ilslides.preferences') || '{}')
  return {transitionMs:transitionTime(value.transitionMs),sortKey:['name','createdAt','updatedAt'].includes(value.sortKey)?value.sortKey:'name',sortDirection:value.sortDirection==='desc'?'desc':'asc',autoName:value.autoName!==false,doubleTapScale:doubleTapScale(value.doubleTapScale),photoSortKey:value.photoSortKey==='updatedAt'?'updatedAt':'name',photoSortDirection:value.photoSortDirection==='desc'?'desc':'asc',homeMode:value.homeMode==='recommended'?'recommended':'recent'}
 } catch { return {transitionMs:360,sortKey:'name',sortDirection:'asc',autoName:true,doubleTapScale:2,photoSortKey:'name',photoSortDirection:'asc',homeMode:'recent'} }
}
