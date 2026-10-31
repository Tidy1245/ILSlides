import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>{
 localStorage.setItem('ilslides.folders',JSON.stringify([{uri:'content://root',name:'相簿'}]))
 localStorage.setItem('ilslides.tags',JSON.stringify([{id:'trip',name:'旅行',start:'#386fbc',end:'#8850bf'}]))
 const image='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#325b83"/></svg>')
 window.androidBridge={}
 window.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]},{name:'ImageFolders',methods:['image','list','coverCache','sourceState'].map(name=>({name,rtype:'promise'}))}],nativeCallback:()=> 'listener',nativePromise:async(plugin,method)=>{
  if(plugin==='App' || method==='coverCache') return {}
  if(method==='sourceState') return {status:'ok',signature:'1:100'}
  if(method==='image') return {data:image}
  if(method==='list') return {images:[{uri:'content://one',name:'旅行-01.jpg'},{uri:'content://two',name:'旅行-02.jpg'},{uri:'content://three',name:'日常.jpg'}]}
  throw Error(method)
 }}
})
const touch=await page.context().newCDPSession(page)
async function swipe(from,to) {
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:from.x,y:from.y}]})
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:to.x,y:to.y}]})
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
}
async function center(locator){const b=await locator.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2}}
try {
 await page.goto((process.env.APP_URL || 'http://127.0.0.1:5173')+'/#/collections')
 await page.getByRole('button',{name:'新增集合',exact:true}).click()
 await page.getByRole('button',{name:'下一步',exact:true}).waitFor()
 assert.equal(await page.locator('.editor-page').nth(1).getAttribute('inert'),'','Details must be inert on the first page')
 await page.getByRole('button',{name:'下一步',exact:true}).click()
 assert.equal(await page.getByRole('button',{name:'建立集合 · 0 張'}).isEnabled(),false)
 await page.getByRole('button',{name:'選擇圖片步驟'}).click()
 const search=page.getByRole('searchbox',{name:'搜尋資料夾圖片'})
 await search.fill('旅行')
 assert.equal(await page.locator('.pick-photo').count(),2)
 await page.getByRole('button',{name:'圖片篩選與排序'}).click()
 await page.getByRole('button',{name:'關閉篩選'}).click()
 const folderPoint=await center(page.getByRole('dialog',{name:'建立新的集合'}).getByRole('button',{name:'相簿',exact:true}))
 await swipe(folderPoint,{x:folderPoint.x-100,y:folderPoint.y})
 assert.equal(await page.getByRole('button',{name:'下一步',exact:true}).count(),1,'Folder-chip swipe must not switch pages')
 await page.getByRole('button',{name:'選取 旅行-01.jpg'}).click()
 const strip=page.locator('.selected-strip');const stripPoint=await center(strip)
 await swipe(stripPoint,{x:stripPoint.x-100,y:stripPoint.y})
 assert.equal(await page.getByRole('button',{name:'下一步',exact:true}).count(),1,'Selected-photo swipe must not switch pages')
 const photoPoint=await center(page.getByRole('button',{name:'選取 旅行-02.jpg'}))
 await swipe(photoPoint,{x:photoPoint.x-120,y:photoPoint.y})
 await page.getByLabel('集合名稱').waitFor()
 assert.equal(await page.locator('.editor-page').first().getAttribute('inert'),'','Picker must be inert on details page')
 const duration=await page.locator('.editor-pages').evaluate(el=>getComputedStyle(el).transitionDuration)
 assert.equal(duration,'0.3s')
 await page.waitForFunction(()=>{const el=document.querySelector('.editor-pages');return Math.abs(new DOMMatrix(getComputedStyle(el).transform).m41+el.clientWidth)<1})
 await page.getByLabel('集合名稱').fill('旅行精選')
 await page.getByRole('button',{name:'套用標籤 旅行'}).click()
 await page.getByRole('button',{name:'選擇封面與調整視窗'}).click()
 await page.getByRole('button',{name:'取消封面調整'}).click()
 const labelPoint=await center(page.locator('.editor-page').nth(1).getByText('集合標籤',{exact:true}))
 await swipe(labelPoint,{x:labelPoint.x+120,y:labelPoint.y})
  await page.getByRole('button',{name:'下一步',exact:true}).waitFor({timeout:3000})
 assert.equal(await page.getByRole('button',{name:'選取 旅行-01.jpg'}).getAttribute('aria-pressed'),'true')
 await page.getByRole('button',{name:'下一步',exact:true}).click()
 await page.getByRole('button',{name:'建立集合 · 1 張'}).click()
 await page.getByRole('button',{name:'旅行精選 選項'}).click()
 await page.getByRole('menuitem',{name:'編輯集合'}).click()
 await page.getByRole('button',{name:'儲存變更 · 1 張'}).waitFor()
 assert.equal(await page.getByLabel('集合名稱').inputValue(),'旅行精選','Editing must start on collection details')
 assert.equal(await page.locator('.editor-page').first().getAttribute('inert'),'')
 await page.getByRole('button',{name:'選擇圖片步驟'}).click()
 await page.getByRole('button',{name:'下一步',exact:true}).waitFor()
 await page.getByRole('button',{name:'選取 旅行-02.jpg'}).click()
 await page.getByRole('button',{name:'下一步',exact:true}).click()
 assert.equal(await page.getByLabel('集合名稱').inputValue(),'旅行精選')
 assert.equal(await page.getByRole('button',{name:'套用標籤 旅行'}).getAttribute('aria-pressed'),'true')
 await page.getByRole('button',{name:'儲存變更 · 2 張'}).click()
 const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('ilslides.collections')))[0]
 assert.equal(saved.photos.length,2);assert.deepEqual(saved.tagIds,['trip'])
 assert.deepEqual(errors,[])
 console.log('Editor two-page swipe, transition, picker, details, save and edit smoke passed')
} finally {await browser.close()}
