import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>{
 const image='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#325b83"/><circle cx="400" cy="180" r="90" fill="#88b4e8"/></svg>')
 window.androidBridge={}
 window.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]},{name:'ImageFolders',methods:['image','list','pick','coverCache','sourceState'].map(name=>({name,rtype:'promise'}))}],nativeCallback:()=> 'listener',nativePromise:async(plugin,method,options)=>{
  if(plugin==='App')return {}
  if(method==='image'){
   const calls=JSON.parse(sessionStorage.getItem('decodes') || '[]');calls.push(options.uri);sessionStorage.setItem('decodes',JSON.stringify(calls));return {data:image}
  }
  if(method==='sourceState')return {status:options.uri.includes('missing') ? 'missing' : 'ok',signature:sessionStorage.getItem('signature') || '1:100'}
  if(method==='list')return {images:[{uri:'content://new/one',name:'新增-001.jpg'}]}
  if(method==='pick')return {uri:'content://new',name:'測試資料夾'}
  if(method==='coverCache'){
   const key='cache.test.'+options.key
   if(options.op==='get')return {entry:JSON.parse(localStorage.getItem(key) || 'null') || undefined}
   if(options.op==='remove'){localStorage.removeItem(key);return {}}
   if(options.op==='clear'){Object.keys(localStorage).filter(k=>k.startsWith('cache.test.')).forEach(k=>localStorage.removeItem(k));return {}}
   const entry={uri:options.data,sourceUri:options.sourceUri,signature:options.signature,createdAt:Date.now()};localStorage.setItem(key,JSON.stringify(entry));return {entry}
  }
  throw Error(method)
 }}
})
const url=process.env.APP_URL || 'http://127.0.0.1:5173'
const count=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('decodes') || '[]').length)
const resetCalls=()=>page.evaluate(()=>sessionStorage.setItem('decodes','[]'))
const waitCovers=()=>page.waitForFunction(()=>[...document.querySelectorAll('.collection-card .cover img')].filter(i=>i.naturalWidth>0).length===4)
try {
 await page.goto(url)
 await page.evaluate(()=>{
  localStorage.setItem('ilslides.collections',JSON.stringify(Array.from({length:200},(_,i)=>({id:String(i),name:'集合 '+i,photos:[{uri:'content://photo/'+i,name:i+'.jpg'}],createdAt:i+1,updatedAt:i+1}))))
  sessionStorage.setItem('decodes','[]')
 })
 await page.reload();await waitCovers()
 if(await count()!==4)throw Error('Cold startup must decode only the four home covers')
 const coldUris=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('decodes')))
 if(!coldUris.every(uri=>Number(uri.split('/').at(-1))>=196))throw Error('Latest home collections must load first')
 await resetCalls();await page.reload();await waitCovers()
 if(await count()!==0)throw Error('Warm startup decoded original images')
 await page.getByRole('button',{name:'開啟設定',exact:true}).click()
 await page.getByLabel('新增標籤名稱').fill('旅行')
 await page.getByLabel('漸層起始色',{exact:true}).fill('#ff8800')
 await page.getByLabel('漸層結束色',{exact:true}).fill('#7733cc')
 await page.getByRole('button',{name:'新增標籤',exact:true}).click()
 await page.getByLabel('新增標籤名稱').fill('家人');await page.getByRole('button',{name:'新增標籤',exact:true}).click()
 await page.getByLabel('新增標籤名稱').fill('旅行');await page.getByRole('button',{name:'新增標籤',exact:true}).click()
 await page.getByText('已有相同名稱的標籤。',{exact:true}).waitFor()
 await page.getByRole('button',{name:'集合',exact:true}).click()
 await page.getByRole('button',{name:'新增集合',exact:true}).click()
 await page.getByRole('button',{name:'套用標籤 旅行',exact:true}).click()
 await page.getByRole('button',{name:'套用標籤 家人',exact:true}).click()
 await page.getByLabel('集合名稱',{exact:true}).fill('標籤測試')
 await page.getByRole('button',{name:'選擇／重新授權資料夾'}).click()
 await page.getByRole('button',{name:'選取 新增-001.jpg',exact:true}).click()
 await page.getByRole('button',{name:'建立集合 · 1 張',exact:true}).click()
 await page.getByRole('button',{name:'首頁',exact:true}).click()
 const card=page.locator('.collection-card').filter({has:page.getByRole('heading',{name:'標籤測試',exact:true})})
 await card.locator('.tag-pill').filter({hasText:'旅行'}).waitFor()
 if(await card.locator('.tag-pill').count()!==2)throw Error('Home must show both selected tags')
 const gradient=await card.locator('.tag-pill').first().evaluate(el=>getComputedStyle(el).backgroundImage)
 if(!gradient.includes('255, 136, 0') || !gradient.includes('119, 51, 204'))throw Error('Custom gradient not applied')
 await page.screenshot({path:'docs/tags-home.png',fullPage:true})
 await page.reload()
 await page.locator('.collection-card').filter({hasText:'標籤測試'}).locator('.tag-pill').first().waitFor()
 await page.getByRole('button',{name:'集合',exact:true}).click()
 await page.getByRole('button',{name:'編輯 標籤測試',exact:true}).click()
 if(await page.getByRole('button',{name:'套用標籤 旅行'}).getAttribute('aria-pressed')!=='true')throw Error('Tag selection not persisted')
 await page.getByRole('button',{name:'套用標籤 家人'}).click()
 await page.getByRole('button',{name:'儲存變更 · 1 張'}).click()
 const collectionCard=page.locator('.collection-card').filter({hasText:'標籤測試'})
 if(await collectionCard.locator('.tag-pill').count()!==1)throw Error('Edit did not remove selected tag')
 await page.getByRole('button',{name:'開啟設定',exact:true}).click()
 await page.getByRole('button',{name:'編輯標籤 旅行'}).click()
 await page.getByLabel('修改標籤名稱').fill('旅途')
 await page.getByLabel('漸層結束色',{exact:true}).fill('#00aa88')
 await page.getByRole('button',{name:'儲存標籤',exact:true}).click()
 await page.locator('.tag-manager').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-90));await page.screenshot({path:'docs/tags-settings.png'})
 await page.getByRole('button',{name:'首頁',exact:true}).click()
 await page.locator('.collection-card').filter({hasText:'標籤測試'}).getByText('旅途',{exact:true}).waitFor()
 await page.getByRole('button',{name:'開啟設定',exact:true}).click()
 await page.getByRole('button',{name:'刪除標籤 旅途',exact:true}).click()
 const orphan=await page.evaluate(()=>JSON.parse(localStorage.getItem('ilslides.collections')).find(c=>c.name==='標籤測試').tagIds)
 if(orphan.length)throw Error('Deleted tag remained attached to collection')
 await resetCalls();await page.getByRole('button',{name:'重新整理封面',exact:true}).click()
 await page.getByText('封面快取已清除，返回集合時會重新產生。',{exact:true}).waitFor();await page.getByRole('button',{name:'首頁',exact:true}).click();await waitCovers()
 if(await count()!==4)throw Error('Manual cache clear must regenerate only home covers')
 await resetCalls();await page.evaluate(()=>sessionStorage.setItem('signature','2:200'));await page.reload();await waitCovers()
 await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('decodes') || '[]').length===4)
 await page.getByRole('button',{name:'集合',exact:true}).click()
 await page.waitForTimeout(300)
 if(await count()>16)throw Error('Collection page generated too many offscreen covers')
 await page.getByRole('button',{name:'新增集合',exact:true}).click()
 await page.getByLabel('集合名稱',{exact:true}).fill('預覽測試')
 await page.screenshot({path:'docs/tags-editor.png'})
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile page overflows horizontally')
 if(errors.length)throw Error(errors.join('\n'))
 console.log('PASS: 200 collections load only four home covers; warm cache zero source decodes; custom gradient tags create/multi-select/edit/persist/delete; manual clear; source changes; mobile layout. Native storage and SAF mocked.')
} finally {await browser.close()}
