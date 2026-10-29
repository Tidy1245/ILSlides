import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
const errors=[];page.on('pageerror',e=>errors.push(e.message))
async function editCollection(name){await page.getByRole('button',{name:`${name} 選項`}).click();await page.getByRole('menuitem',{name:'編輯集合'}).click()}
await page.addInitScript(()=>{
 localStorage.setItem('ilslides.folders',JSON.stringify([{uri:'content://root',name:'相簿'}]))
 const data='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#325b83"/></svg>')
 window.androidBridge={}
 window.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]},{name:'ImageFolders',methods:['list','image','coverCache','sourceState'].map(name=>({name,rtype:'promise'}))}],nativeCallback:()=> 'listener',nativePromise:async(plugin,method)=>{
  if(plugin==='App' || method==='coverCache') return {}
  if(method==='sourceState') return {status:'ok',signature:'1:100'}
  if(method==='image') return {data}
  if(method==='list') return {images:[
   {uri:'content://apple',name:'0.jpg',folderName:'蘋果',folderPath:'水果/蘋果'},
   {uri:'content://pear',name:'0.jpg',folderName:'梨子',folderPath:'水果/梨子'},
   {uri:'content://root-numeric',name:'7.jpg',folderName:'相簿'},
   {uri:'content://root-name',name:'水果照.jpg',folderName:'相簿'}]}
  throw Error(method)
 }}
})
try {
 await page.goto((process.env.APP_URL || 'http://127.0.0.1:5173')+'/#/collections')
 await page.getByRole('button',{name:'新增集合',exact:true}).click()
 const search=page.getByRole('searchbox',{name:'搜尋資料夾圖片'})
 await search.fill(' 蘋果 ')
 assert.equal(await page.locator('.pick-photo').count(),1)
 assert.equal(await page.locator('.pick-folder-name').textContent(),'水果/蘋果')
 assert.equal(await page.locator('.pick-folder-name').isVisible(),true)
 await page.getByRole('button',{name:'選取 0.jpg，目錄 水果/蘋果'}).click()
 await page.getByRole('button',{name:'下一步',exact:true}).click()
 await page.getByText('將自動命名為：蘋果',{exact:true}).waitFor()
 await page.getByRole('button',{name:'建立集合 · 1 張'}).click()
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ilslides.collections')))
 assert.equal(saved[0].name,'蘋果')
 assert.equal(saved[0].photos[0].folderName,'蘋果')
 await editCollection('蘋果')
 await search.fill('水果')
 assert.equal(await page.locator('.pick-photo').count(),3,'Ancestor directory and filename matches must both appear')
 assert.deepEqual(await page.locator('.pick-folder-name').allTextContents(),['水果/蘋果','水果/梨子'])
 await page.getByRole('button',{name:'選取 0.jpg，目錄 水果/梨子'}).click()
 await page.getByRole('button',{name:'下一步',exact:true}).click()
 await page.getByRole('button',{name:'儲存變更 · 2 張'}).click()
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ilslides.collections')))
 assert.equal(saved[0].name,'蘋果','Editing must keep the existing collection name')
 assert.deepEqual(saved[0].photos.map(p=>p.uri),['content://apple','content://pear'])
 await page.getByRole('button',{name:'新增集合',exact:true}).click()
 await page.getByRole('button',{name:'選取 7.jpg',exact:true}).click()
 await page.getByRole('button',{name:'下一步',exact:true}).click()
 await page.getByText('將自動命名為：相簿',{exact:true}).waitFor()
 assert.deepEqual(errors,[])
 console.log('PASS: new/edit folder-path search, visible matching folders, duplicate filenames, nested/root numeric auto-name and persistence')
} finally {await browser.close()}
