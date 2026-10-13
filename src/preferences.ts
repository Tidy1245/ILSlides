import type { Collection } from './library'
export type SortKey='name'|'createdAt'|'updatedAt'
export type SortDirection='asc'|'desc'
export function sortCollections(collections:Collection[], key:SortKey, direction:SortDirection) {
 const sign=direction==='asc' ? 1 : -1
 return [...collections].sort((a,b)=>sign*(key==='name' ? a.name.localeCompare(b.name,'zh-Hant',{numeric:true,sensitivity:'base'}) : (a[key] || 0)-(b[key] || 0)))
}
export function transitionTime(value:unknown) {
 return typeof value==='number' && Number.isFinite(value) ? Math.max(100,Math.min(2000,Math.round(value/20)*20)) : 360
}
export function loadPreferences():{transitionMs:number;sortKey:SortKey;sortDirection:SortDirection;autoName:boolean} {
 try {
  const value=JSON.parse(localStorage.getItem('ilslides.preferences') || '{}')
  return {transitionMs:transitionTime(value.transitionMs),sortKey:['name','createdAt','updatedAt'].includes(value.sortKey)?value.sortKey:'name',sortDirection:value.sortDirection==='desc'?'desc':'asc',autoName:value.autoName!==false}
 } catch { return {transitionMs:360,sortKey:'name',sortDirection:'asc',autoName:true} }
}
