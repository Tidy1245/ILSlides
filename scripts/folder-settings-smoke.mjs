import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>{
 const data='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#325b83"/><circle cx="400" cy="180" r="90" fill="#88b4e8"/></svg>')
 window.androidBridge={}
 window.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]},{name:'ImageFolders',methods:['pick','list','image','coverCache','sourceState'].map(name=>({name,rtype:'promise'}))}],nativeCallback:(plugin,method,options,callback)=>{if(options.eventName==='backButton')window.__backHandler=callback;return 'listener'},nativePromise:async(plugin,method,options)=>{
  if(plugin==='App')return {}
  if(method==='image')return {data}
  if(method==='sourceState')return {status:'ok',signature:'1:100'}
  if(method==='coverCache')return {}
  if(method==='pick') {window.__picks=(window.__picks || 0)+1;return window.__pick || {uri:'content://folder',name:'相簿'}}
  if(method==='list')return {images:options.tree==='content://other' ? [{uri:'content://other/1',name:'Other.jpg'}] : Array.from({length:20},(_,i)=>({uri:'content://photo/'+i,name:String.fromCharCode(65+i)+'-'+String(i+1).padStart(2,'0')+'.jpg',modifiedAt:i===19 ? undefined : (20-i)*1000}))}
  throw Error(method)
 }}
})

try {
 await page.addInitScript(()=>{
  localStorage.setItem('ilslides.folders',localStorage.getItem('ilslides.folders') ?? JSON.stringify([{uri:'content://folder',name:'相簿'},{uri:'content://other',name:'另一個相簿'}]));
  if(!localStorage.getItem('ilslides.collections'))localStorage.setItem('ilslides.collections',JSON.stringify([{id:'saved',name:'保留的集合',photos:[{uri:'content://photo/0',name:'A-01.jpg'}]}]));
 });
 const url=(process.env.APP_URL || 'http://127.0.0.1:5173');
 await page.goto(url+'/#/settings');
 const rows=page.locator('.authorized-folders>div');
 assert.equal(await rows.count(),2);
 const remove=()=>page.getByRole('button',{name:'刪除資料夾 相簿',exact:true});
 await remove().click();await page.getByRole('button',{name:'取消刪除資料夾',exact:true}).click();
 assert.equal(await rows.count(),2);
 await remove().click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('.folder-delete-confirm').count(),0);
 assert.equal(await page.locator('.settings-page').count(),1);
 await remove().click();await page.evaluate(()=>window.__backHandler({canGoBack:true}));
 assert.equal(await page.locator('.folder-delete-confirm').count(),0);
 assert.equal(await page.locator('.settings-page').count(),1);
 await remove().click();
 await page.screenshot({path:'release/folder-delete-confirm.png',fullPage:true});
 await page.getByRole('button',{name:'確定刪除資料夾',exact:true}).click();
 assert.equal(await rows.count(),1);
 assert.equal(await remove().count(),0);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ilslides.collections'))[0].photos.length),1);
 await page.reload();assert.equal(await rows.count(),1);
 await page.getByRole('button',{name:'返回設定前頁面'}).click();
 await page.locator('.card-open').first().click();
 await page.locator('.main-photo').first().waitFor();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'開啟設定',exact:true}).click();
 await page.getByRole('button',{name:'刪除資料夾 另一個相簿',exact:true}).click();
 await page.getByRole('button',{name:'確定刪除資料夾',exact:true}).click();
 assert.equal(await rows.count(),0);
 await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('ilslides.collections'));c.push({id:'legacy',name:'舊集合',tree:'content://folder',folder:'相簿'});localStorage.setItem('ilslides.collections',JSON.stringify(c));});
 await page.reload();assert.equal(await rows.count(),0,'Deleted shortcuts must not reappear from legacy collections');
 await page.evaluate(()=>window.Capacitor.isNativePlatform=()=>true);
 await page.getByRole('button',{name:'選擇／重新授權資料夾'}).click();
 assert.equal(await rows.count(),1,'A deleted shortcut can be authorized again');
 await page.screenshot({path:'release/folder-settings.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('Folder settings: delete/cancel/Escape/Android back/persistence/legacy migration/existing collection/re-add/mobile layout passed');
} finally {await browser.close()}
