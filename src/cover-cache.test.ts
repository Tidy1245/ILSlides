import { describe,expect,it,vi } from 'vitest'
import { CoverLoader,coverKey,type CoverBackend } from './cover-cache'
import type { Collection,CachedCover } from './library'
const collection:Collection={id:'c',name:'集合',photos:[{uri:'content://one',name:'one'},{uri:'content://two',name:'two'}]}
const record:CachedCover={uri:'file://cover',sourceUri:'content://one',signature:'1:100',createdAt:Date.now()}
const flush=async()=>{for(let i=0;i<30;i++) await Promise.resolve()}
function setup(entry?:CachedCover) {
  const backend:CoverBackend={get:vi.fn(async()=>entry),put:vi.fn(async()=>record),remove:vi.fn(async()=>{}),source:vi.fn(async()=>({status:'ok' as const,signature:'1:100'}))}
  const render=vi.fn(async()=>({data:'new',sourceUri:'content://one',signature:'1:100'}))
  return {backend,render,loader:new CoverLoader(backend,render)}
}
describe('封面快取與排程',()=>{
  it('改名或標籤不使封面失效，換封面或裁切才改變識別',()=>{
    expect(coverKey({...collection,name:'新名稱',updatedAt:200,tagIds:['tag']})).toBe(coverKey(collection))
    expect(coverKey({...collection,photos:[...collection.photos,{uri:'third',name:'third'}]})).toBe(coverKey(collection))
    const custom={...collection,cover:{uri:'content://two',x:.5,y:.5,zoom:1}}
    expect(coverKey(custom)).not.toBe(coverKey(collection))
    expect(coverKey({...custom,cover:{...custom.cover,x:.1}})).not.toBe(coverKey(custom))
  })
  it('命中快取先顯示，檢查來源時不解碼原圖',async()=>{
    const {backend,render,loader}=setup(record),publish=vi.fn()
    loader.request(collection,publish);await flush()
    expect(publish).toHaveBeenCalledWith('file://cover');expect(backend.source).toHaveBeenCalledWith('content://one');expect(render).not.toHaveBeenCalled()
  })
  it('來源內容改變時先顯示舊圖再重建',async()=>{
    const {backend,render,loader}=setup(record),publish=vi.fn()
    vi.mocked(backend.source).mockResolvedValue({status:'ok',signature:'2:200'})
    loader.request(collection,publish);await flush()
    expect(render).toHaveBeenCalledTimes(1);expect(backend.put).toHaveBeenCalled();expect(publish).toHaveBeenCalledTimes(2)
  })
  it('確認授權失效時移除舊圖',async()=>{
    const {backend,render,loader}=setup(record),publish=vi.fn()
    vi.mocked(backend.source).mockResolvedValue({status:'denied',signature:''})
    render.mockRejectedValue(new Error('denied'));loader.request(collection,publish);await flush()
    expect(backend.remove).toHaveBeenCalledWith(coverKey(collection));expect(publish).toHaveBeenLastCalledWith('')
  })
  it('未知修改時間的來源滿 24 小時重新產生',async()=>{
    const {backend,render,loader}=setup({...record,signature:'',createdAt:Date.now()-86400001})
    vi.mocked(backend.source).mockResolvedValue({status:'ok',signature:''})
    loader.request(collection,()=>{});await flush();expect(render).toHaveBeenCalledTimes(1)
  })
  it('同一封面同時請求只產生一次並通知所有畫面',async()=>{
    const {render,loader}=setup(),a=vi.fn(),b=vi.fn()
    loader.request(collection,a);loader.request(collection,b);await flush()
    expect(render).toHaveBeenCalledTimes(1);expect(a).toHaveBeenCalled();expect(b).toHaveBeenCalled()
  })
  it('沒有訂閱的離屏工作跳過產生',async()=>{
    const {render,loader}=setup()
    const cancel=loader.request(collection,()=>{});cancel();await flush();expect(render).not.toHaveBeenCalled()
  })
  it('磁碟滿時仍可顯示產生的封面',async()=>{
    const {backend,loader}=setup(),publish=vi.fn()
    vi.mocked(backend.put).mockRejectedValue(new Error('full'));loader.request(collection,publish);await flush()
    expect(publish).toHaveBeenLastCalledWith('new')
  })
  it('清除期間完成的舊工作不會寫回快取',async()=>{
    const {backend,render,loader}=setup()
    let finish!:(value:{data:string;sourceUri:string;signature:string})=>void
    render.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    loader.request(collection,()=>{});await flush();loader.reset()
    finish({data:'late',sourceUri:'content://one',signature:'1:100'});await flush();expect(backend.put).not.toHaveBeenCalled()
  })
  it('原封面已移出集合時不保留快取',async()=>{
    const {backend,render,loader}=setup(record),publish=vi.fn()
    render.mockRejectedValue(new Error('missing'));loader.request({...collection,photos:[]},publish);await flush()
    expect(backend.remove).toHaveBeenCalled();expect(publish).toHaveBeenLastCalledWith('')
  })
  it('失敗的圖片網址被移除後，新請求不再拿到舊工作結果',async()=>{
    const {backend,render,loader}=setup(record)
    let finish!:(value:{status:'ok';signature:string})=>void
    vi.mocked(backend.source).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
    loader.request(collection,()=>{});await flush()
    await loader.remove(coverKey(collection));vi.mocked(backend.get).mockResolvedValue(undefined)
    const next=vi.fn();loader.request(collection,next)
    finish({status:'ok',signature:'1:100'});await flush()
    expect(render).toHaveBeenCalledTimes(1);expect(next).toHaveBeenCalledTimes(1)
  })
  it('慢速產生工作不阻擋其他集合先顯示磁碟快取',async()=>{
    const {backend,render,loader}=setup()
    let finish!:(value:{data:string;sourceUri:string;signature:string})=>void
    render.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
    loader.request(collection,()=>{});await flush()
    vi.mocked(backend.get).mockResolvedValue(record)
    const next=vi.fn();loader.request({...collection,id:'next'},next);await flush()
    expect(next).toHaveBeenCalledWith('file://cover')
    finish({data:'late',sourceUri:'content://one',signature:'1:100'});await flush()
  })
  it('離屏取消後重新進入使用最新集合清單',async()=>{
    const {render,loader}=setup(),old=vi.fn(),next=vi.fn()
    const cancel=loader.request(collection,old);cancel()
    const updated={...collection,photos:[collection.photos[0]!]}
    loader.request(updated,next);await flush()
    expect(render).toHaveBeenCalledExactlyOnceWith(updated);expect(old).not.toHaveBeenCalled();expect(next).toHaveBeenCalled()
  })
})
