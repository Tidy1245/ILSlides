import type { Photo } from './library'
import type { SortDirection } from './preferences'
export function pickerPhotos(photos:Photo[],query:string,key:'name'|'updatedAt',direction:SortDirection) {
 const name=query.trim().toLocaleLowerCase(),sign=direction==='asc' ? 1 : -1
 return photos.filter(p=>p.name.toLocaleLowerCase().includes(name)).sort((a,b)=>{
  if(key==='updatedAt') {
   const aDate=Number.isFinite(a.modifiedAt) && a.modifiedAt! > 0 ? a.modifiedAt! : 0,bDate=Number.isFinite(b.modifiedAt) && b.modifiedAt! > 0 ? b.modifiedAt! : 0
   if(!aDate && bDate) return 1
   if(aDate && !bDate) return -1
   if(aDate!==bDate) return sign*(aDate-bDate)
  }
  return sign*a.name.localeCompare(b.name,'zh-Hant',{numeric:true}) || a.uri.localeCompare(b.uri)
 })
}
export function movePhoto(photos:Photo[],from:number,to:number):Photo[] {
 if(!Number.isInteger(from) || !Number.isInteger(to) || from<0 || to<0 || from>=photos.length || to>=photos.length || from===to) return [...photos]
 const result=[...photos],photo=result.splice(from,1)[0]!
 result.splice(to,0,photo);return result
}
