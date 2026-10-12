import { describe, expect, it } from 'vitest'
import { nextIndex, sortedPhotos } from './library'
describe('集合瀏覽', () => {
  it('依檔名自然排序並保留原清單', () => {
    const source=[{name:'photo10.jpg',uri:'10'},{name:'photo2.jpg',uri:'2'},{name:'photo1.jpg',uri:'1'}]
    expect(sortedPhotos(source).map(p=>p.uri)).toEqual(['1','2','10'])
    expect(source[0]!.uri).toBe('10')
  })
  it('最後一張往右及第一張往左循環', () => {
    expect(nextIndex(2,1,3)).toBe(0)
    expect(nextIndex(0,-1,3)).toBe(2)
  })
  it('沒有圖片或只有一張時不越界', () => {
    expect(nextIndex(0,1,0)).toBe(0)
    expect(nextIndex(0,-1,1)).toBe(0)
  })
})
