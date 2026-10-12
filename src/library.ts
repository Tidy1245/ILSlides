import { registerPlugin } from '@capacitor/core'
export interface Photo { uri: string; name: string }
export interface Collection { id: string; name: string; tree: string; folder: string; count: number }
export const Folders = registerPlugin<{
  pick(): Promise<{ uri: string; name: string; cancelled?: boolean }>
  list(options: { tree: string }): Promise<{ images: Photo[] }>
  image(options: { uri: string; size: number }): Promise<{ data: string }>
}>('ImageFolders')
export function sortedPhotos(photos: Photo[]) {
  return [...photos].sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant', { numeric: true }))
}
export function nextIndex(index: number, delta: number, length: number) {
  return length ? (index + delta + length) % length : 0
}
export function loadCollections(): Collection[] {
  try {
    const value = JSON.parse(localStorage.getItem('ilslides.collections') || '[]')
    return Array.isArray(value) ? value.filter(c => typeof c.id === 'string' && typeof c.name === 'string' && typeof c.tree === 'string') : []
  } catch { return [] }
}
