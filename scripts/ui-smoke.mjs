import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({channel:'chrome',headless:true})
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true})
async function settledPhoto(name) { await page.waitForFunction(name => { const imgs=[...document.querySelectorAll('.main-photo')]; return imgs.length===1 && imgs[0].alt===name && imgs[0].complete && imgs[0].naturalWidth>0 && !imgs[0].className.includes('dissolve-') }, name) }
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(() => { window.Capacitor = { PluginHeaders: [{name:'ImageFolders',methods:['pick','list','image'].map(name=>({name,rtype:'promise'}))}] } })
await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173')
await page.getByRole('heading',{name:'你的回憶，從這裡開始'}).waitFor()
await page.screenshot({path:'docs/home.png'})
await page.getByRole('button',{name:'新增集合',exact:true}).click()
await page.getByLabel('集合名稱').fill('旅行片刻')
if(await page.getByRole('button',{name:'建立集合',exact:true}).isEnabled()) throw new Error('Missing folder must block save')
await page.screenshot({path:'docs/create.png'})
await page.getByRole('button',{name:'關閉',exact:true}).click()
// Seed metadata and a Capacitor bridge double to exercise real UI logic offline.
await page.evaluate(()=>{
 localStorage.setItem('ilslides.collections',JSON.stringify([{id:'test',name:'旅行片刻',tree:'content://test',folder:'Travel',count:3}]))
})
await page.reload()
await page.evaluate(()=>{
 const svg=(color,text)=>'data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#0c2448"/></linearGradient></defs><path fill="url(#a)" d="M0 0h900v1200H0z"/><circle cx="640" cy="290" r="120" fill="#aac8ef"/><path d="M0 1000 350 450 900 1050v150H0" fill="#213e5e"/><path d="M0 1080 580 620 900 1000v200H0" fill="#102d47"/><text x="60" y="1120" fill="white" font-size="40">${text}</text></svg>`)
 window.Capacitor.nativePromise=async(plugin,method,options)=>{
  if(method==='list') return {images:[{uri:'1',name:'photo1.jpg'},{uri:'2',name:'photo2.jpg'},{uri:'3',name:'photo10.jpg'}]}
  if(method==='image') return {data:svg(options.uri==='1'?'#568aa6':options.uri==='2'?'#6083c2':'#3d727c',options.uri)}
  if(method==='pick') return {uri:'content://new',name:'新目錄'}
  throw new Error(method)
 }
 window.Capacitor.isPluginAvailable=()=>true
 window.Capacitor.isNativePlatform=()=> true
})
await page.getByRole('button',{name:'開啟 旅行片刻'}).click()
await settledPhoto('photo1.jpg')
await page.waitForFunction(() => getComputedStyle(document.querySelector('.viewer-header')).opacity==='1')
await page.screenshot({path:'docs/viewer.png'})
await page.getByRole('button',{name:'下一張'}).click()
await settledPhoto('photo2.jpg')
await page.getByRole('button',{name:'上一張'}).click()
await settledPhoto('photo1.jpg')
await page.getByRole('button',{name:'上一張'}).click()
await settledPhoto('photo10.jpg')
await page.getByRole('button',{name:'編輯集合',exact:true}).click()
await page.getByLabel('集合名稱').fill('旅途光影')
await page.getByRole('button',{name:'儲存變更'}).click()
await page.getByRole('heading',{name:'旅途光影',exact:true}).waitFor()
await page.getByRole('button',{name:'返回集合'}).click()
await page.getByRole('button',{name:'新增集合',exact:true}).click()
await page.getByLabel('集合名稱').fill('日常收藏')
await page.getByRole('button',{name:'選擇裝置目錄'}).click()
await page.getByRole('button',{name:'建立集合',exact:true}).click()
await page.getByRole('heading',{name:'日常收藏'}).waitFor()
await page.screenshot({path:'docs/collections.png'})
await page.reload()
await page.getByRole('heading',{name:'旅途光影'}).waitFor()
await page.getByRole('heading',{name:'日常收藏'}).waitFor()
await page.getByRole('button',{name:'編輯 日常收藏'}).click()
await page.getByRole('button',{name:'移除集合',exact:true}).click()
await page.getByRole('button',{name:'確定移除'}).click()
if(await page.getByRole('heading',{name:'日常收藏'}).count()) throw new Error('Delete failed')
if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)) throw new Error('Mobile horizontal overflow')
if(errors.length) throw new Error(errors.join('\n'))
console.log('PASS: mobile layout, validation, collection create/rename/persistence/delete, image navigation/wrap, no runtime errors. Native bridge mocked; device permissions are not verified.')
await browser.close()






