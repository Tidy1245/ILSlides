export interface Tag { id:string; name:string; start:string; end:string }
export function validColor(value:unknown): value is string { return typeof value==='string' && /^#[\da-f]{6}$/i.test(value) }
export function tagStyle(tag:Tag) { return {background:`linear-gradient(135deg, ${tag.start}, ${tag.end})`} }
export function tagIds(value:unknown):string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id):id is string=>typeof id==='string' && !!id))] : []
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
