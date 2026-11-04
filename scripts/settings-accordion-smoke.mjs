import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {openSetting} from './settings-helpers.mjs'
const require=createRequire(import.meta.url)
const {version}=require('../package.json')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>{
 if(!localStorage.getItem('ilslides.folders'))localStorage.setItem('ilslides.folders',JSON.stringify([{uri:'content://folder',name:'相簿'}]))
 window.androidBridge={}
 window.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]},{name:'ImageFolders',methods:['coverCache','list'].map(name=>({name,rtype:'promise'}))}],nativeCallback:()=> 'listener',nativePromise:async(plugin,method,options)=>{
  if(plugin==='App')return {}
  if(method==='coverCache'){if(options.op==='clear')window.__clears=(window.__clears || 0)+1;return {}}
  if(method==='list')return {images:[]}
  throw Error(method)
 }}
})
const titles=['圖片轉場動畫','圖片資料夾','雙擊放大倍率','自動命名新集合','集合標籤','封面快取','ILSlides 版本']
const expanded=()=>page.locator('.setting-section-header button[aria-expanded=true]')
const header=title=>page.locator('.setting-section-header').getByRole('button',{name:title,exact:true})
try {
 await page.goto((process.env.APP_URL || 'http://127.0.0.1:5173')+'/#/settings')
 assert.equal(await expanded().count(),0)
 assert.equal(await page.getByRole('region').count(),0)
 assert.deepEqual((await page.locator('.setting-section').allInnerTexts()).map(text=>text.trim()),titles,'Collapsed sections must only show their titles')
 const auto=page.getByRole('switch',{name:'自動命名新集合',exact:true})
 assert.equal(await auto.isVisible(),true)
 await auto.click();assert.equal(await auto.getAttribute('aria-checked'),'false');assert.equal(await expanded().count(),0)
 for(const title of titles) {
  await openSetting(page,title)
  assert.equal(await expanded().count(),1)
  assert.equal(await expanded().textContent(),title)
  assert.equal(await page.getByRole('region').count(),1)
 }
 await header('ILSlides 版本').click();assert.equal(await expanded().count(),0)
 await header('圖片轉場動畫').focus();await page.keyboard.press('Enter')
 assert.equal(await header('圖片轉場動畫').getAttribute('aria-expanded'),'true')
 await page.getByLabel('動畫時間').fill('1200')
 await openSetting(page,'雙擊放大倍率');await page.getByLabel('放大倍率',{exact:true}).fill('3.25')
 await auto.click();assert.equal(await auto.getAttribute('aria-checked'),'true');assert.equal(await expanded().textContent(),'雙擊放大倍率','Switch must not change the open section')
 await openSetting(page,'集合標籤');await page.getByLabel('新增標籤名稱').fill('暫存標籤')
 await openSetting(page,'圖片資料夾');await openSetting(page,'集合標籤')
 assert.equal(await page.getByLabel('新增標籤名稱').inputValue(),'暫存標籤','Collapsing must preserve unfinished tag input')
 await page.getByRole('button',{name:'新增標籤',exact:true}).click()
 await openSetting(page,'圖片資料夾');await page.getByRole('button',{name:'刪除資料夾 相簿',exact:true}).click()
 await openSetting(page,'封面快取');await openSetting(page,'圖片資料夾')
 assert.equal(await page.locator('.folder-delete-confirm').count(),0,'Section changes must cancel folder deletion confirmation')
 await openSetting(page,'封面快取');await page.getByRole('button',{name:'重新整理封面',exact:true}).click()
 await page.getByText('封面快取已清除，返回集合時會重新產生。',{exact:true}).waitFor()
 assert.equal(await page.evaluate(()=>window.__clears),1)
 await openSetting(page,'ILSlides 版本');assert.equal(await page.locator('.version-card strong').textContent(),version)
 await page.getByRole('button',{name:'集合',exact:true}).click();await page.getByRole('button',{name:'開啟設定',exact:true}).click()
 assert.equal(await expanded().count(),0,'Re-entering settings must collapse every section')
 await page.reload();assert.equal(await expanded().count(),0,'Reload must start collapsed')
 const preferences=await page.evaluate(()=>JSON.parse(localStorage.getItem('ilslides.preferences')))
 assert.equal(preferences.autoName,true);assert.equal(preferences.transitionMs,1200);assert.equal(preferences.doubleTapScale,3.25)
 assert.equal(await auto.isVisible(),true)
 await page.screenshot({path:'release/settings-collapsed.png'})
 await openSetting(page,'集合標籤');assert.equal(await page.locator('.tag-row').count(),1)
 await page.screenshot({path:'release/settings-expanded.png'})
 await page.setViewportSize({width:320,height:740})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 assert.deepEqual(errors,[])
 console.log('PASS settings default collapse, one-at-a-time/keyboard toggle, visible independent auto-name switch, draft/setting persistence, folder/cache/version and mobile layout')
} finally {await browser.close()}
