import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>{
 const rows=Array.from({length:6},(_,i)=>({id:String(i),name:`集合${i+1}`,createdAt:i+1,updatedAt:i+1,photos:[{uri:`content://photo/${i}`,name:`${i}.jpg`}]}))
 if(!localStorage.getItem('ilslides.collections')) localStorage.setItem('ilslides.collections',JSON.stringify(rows))
 const data='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#325b83"/></svg>')
 window.androidBridge={}
 window.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]},{name:'ImageFolders',methods:['image','coverCache','sourceState','list'].map(name=>({name,rtype:'promise'}))}],nativeCallback:()=> 'listener',nativePromise:async(plugin,method)=>{
  if(plugin==='App' || method==='coverCache') return {}
  if(method==='sourceState') return {status:'ok',signature:'1:100'}
  if(method==='image') return {data}
  if(method==='list') return {images:[]}
  throw Error(method)
 }}
})
try {
 await page.goto((process.env.APP_URL || 'http://127.0.0.1:5173')+'/#/home')
 assert.deepEqual(await page.locator('.collection-card h3').allTextContents(),['集合6','集合5','集合4','集合3'])
 await page.getByRole('button',{name:'切換至為你推薦'}).click()
 await page.getByRole('button',{name:'切換至最近的集合'}).waitFor()
 const recommended=await page.locator('.collection-card h3').allTextContents()
 assert.equal(recommended.length,4)
 assert.equal(new Set(recommended).size,4)
 assert.ok(recommended.every(name=>/^集合[1-6]$/.test(name)))
 await page.reload()
 await page.getByRole('button',{name:'切換至最近的集合'}).waitFor()
 assert.equal((await page.locator('.collection-card h3').allTextContents()).length,4)
 await page.getByRole('button',{name:'切換至最近的集合'}).click()
 assert.deepEqual(await page.locator('.collection-card h3').allTextContents(),['集合6','集合5','集合4','集合3'])
 await page.getByRole('button',{name:'集合',exact:true}).click()
 await page.getByRole('button',{name:'集合1 選項'}).click()
 await page.getByRole('menuitem',{name:'編輯集合'}).waitFor()
 await page.getByRole('menuitem',{name:'刪除集合'}).waitFor()
 await page.keyboard.press('Escape')
 assert.equal(await page.getByRole('menuitem').count(),0)
 await page.getByRole('button',{name:'集合1 選項'}).click()
 await page.getByRole('menuitem',{name:'編輯集合'}).click()
 await page.getByRole('heading',{name:'編輯集合'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'刪除集合',exact:true}).count(),0)
 await page.getByRole('button',{name:'關閉',exact:true}).click()
 await page.getByRole('button',{name:'集合1 選項'}).click()
 await page.getByRole('menuitem',{name:'刪除集合'}).click()
 await page.getByRole('button',{name:'取消刪除'}).click()
 assert.equal((await page.locator('.collection-card').count()),6)
 await page.getByRole('button',{name:'集合1 選項'}).click()
 await page.getByRole('menuitem',{name:'刪除集合'}).click()
 await page.getByRole('button',{name:'確定刪除'}).click()
 assert.equal((await page.locator('.collection-card').count()),5)
 assert.equal(await page.getByRole('button',{name:'集合1 選項'}).count(),0)
 assert.equal(JSON.parse(await page.evaluate(()=>localStorage.getItem('ilslides.collections'))).length,5)
 assert.deepEqual(errors,[])
 console.log('Home recommendations and collection menu smoke passed')
} finally { await browser.close() }
