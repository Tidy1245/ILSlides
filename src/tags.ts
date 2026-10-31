export interface Tag { id:string; name:string; start:string; end:string }
export function validColor(value:unknown): value is string { return typeof value==='string' && /^#[\da-f]{6}$/i.test(value) }
export function tagStyle(tag:Tag) { return {background:`linear-gradient(135deg, ${tag.start}, ${tag.end})`} }
export function tagIds(value:unknown):string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id):id is string=>typeof id==='string' && !!id))] : []
}
// The saved tag array is the shared display order; positions are one-based in settings.
export function moveTag(tags:Tag[],id:string,position:number):Tag[] {
  const from=tags.findIndex(tag=>tag.id===id)
  if(from<0 || !Number.isInteger(position)) return tags
  const to=Math.max(0,Math.min(tags.length-1,position-1))
  if(from===to) return tags
  const result=[...tags]
  result.splice(to,0,result.splice(from,1)[0]!)
  return result
}
export function loadTags():Tag[] {
  try {
    const data:unknown=JSON.parse(localStorage.getItem('ilslides.tags') || '[]')
    if(!Array.isArray(data)) return []
    const seen=new Set<string>()
    return data.filter((t):t is Tag=>!!t && typeof t.id==='string' && !!t.id && typeof t.name==='string' && !!t.name.trim() && validColor(t.start) && validColor(t.end))
      .filter(t=>!seen.has(t.id) && !!seen.add(t.id)).map(t=>({...t,name:t.name.trim().slice(0,24)}))
  } catch { return [] }
}
