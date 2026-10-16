import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.addInitScript(()=>{
 const svg=uri=>{
  const [w,h]=uri.includes('landscape') ? [1200,800] : [800,1200]
  return 'data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="#14335a" stroke="#6ca0cd" stroke-width="2"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/><circle cx="600" cy="300" r="85" fill="#db9169"/><circle cx="200" cy="900" r="70" fill="#82c4ac"/><text x="30" y="80" fill="white" font-size="40">${uri.split('/').at(-1)}</text></svg>`)
 }
 window.androidBridge={}
 window.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'},{name:'exitApp',rtype:'promise'}]},{name:'ImageFolders',methods:['image','coverCache','sourceState'].map(name=>({name,rtype:'promise'}))}],nativeCallback:(plugin,method,options,callback)=>{if(options.eventName==='backButton')window.__backHandler=callback;return 'listener'},nativePromise:async(plugin,method,options)=>{
  if(plugin==='App')return {}
  if(method==='image'){window.__decodes=(window.__decodes || 0)+1;return {data:svg(options.uri)}}
  if(method==='coverCache')return {}
  if(method==='sourceState')return {status:'ok',signature:'1:100'}
  throw Error(method)
 }}
})
const url=process.env.APP_URL || 'http://127.0.0.1:5173'
const touch=await page.context().newCDPSession(page)
const send=(type,points)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:points})
const tap=async(x,y)=>{await send('touchStart',[{id:1,x,y}]);await send('touchEnd',[])}
const doubleTap=async(x,y)=>{await tap(x,y);await page.waitForTimeout(70);await tap(x,y)}
const state=()=>page.locator('.image-stage').evaluate(el=>({scale:Number(el.dataset.scale),x:Number(el.dataset.focusX),y:Number(el.dataset.focusY)}))
const scale=expected=>page.waitForFunction(value=>Math.abs(Number(document.querySelector('.image-stage')?.dataset.scale)-value)<.01,expected)
const photo=name=>page.waitForFunction(name=>{const imgs=[...document.querySelectorAll('.main-photo')];return imgs.length===1 && imgs[0].alt===name && imgs[0].naturalWidth>0 && getComputedStyle(imgs[0]).visibility==='visible' && !imgs[0].className.includes('dissolve-')},name)
const swipe=async()=>{await send('touchStart',[{id:1,x:290,y:430}]);await send('touchMove',[{id:1,x:90,y:430}]);await send('touchEnd',[])}
const same=(a,b)=>Math.abs(a.scale-b.scale)<.001 && Math.abs(a.x-b.x)<.001 && Math.abs(a.y-b.y)<.001
try {
 await page.goto(url+'/#/collections')
 await page.evaluate(()=>{
  localStorage.setItem('ilslides.collections',JSON.stringify([{id:'zoom',name:'手勢測試',photos:[{uri:'content://photo/portrait1',name:'直式一'},{uri:'content://photo/portrait2',name:'直式二'},{uri:'content://photo/landscape',name:'橫式'}]}]))
  localStorage.setItem('ilslides.preferences',JSON.stringify({transitionMs:800}))
 })
 await page.reload();await page.getByRole('button',{name:'開啟設定',exact:true}).click()
 if(await page.getByLabel('放大倍率',{exact:true}).inputValue()!=='2')throw Error('Default double tap scale not 2')
 await page.getByLabel('放大倍率',{exact:true}).fill('3.25')
 await page.reload()
 if(await page.getByLabel('放大倍率',{exact:true}).inputValue()!=='3.25')throw Error('Zoom setting not persisted')
 await page.locator('.zoom-setting').evaluate(el=>scrollTo(0,el.getBoundingClientRect().top+scrollY-90))
 await page.screenshot({path:'docs/zoom-settings.png'})
 await page.getByRole('button',{name:'集合',exact:true}).click();await page.getByRole('button',{name:'開啟 手勢測試',exact:true}).click();await photo('直式一')
 await doubleTap(290,280);await scale(3.25)
 await page.waitForTimeout(320)
 if(await page.locator('.viewer-header').evaluate(el=>el.classList.contains('hidden')))throw Error('Double tap toggled header')
 await doubleTap(200,420);await scale(1)
 await tap(200,420);await page.waitForFunction(()=>document.querySelector('.viewer-header').classList.contains('hidden'))
 await tap(200,420);await page.waitForFunction(()=>!document.querySelector('.viewer-header').classList.contains('hidden'))
 // Return to default scale for comparable viewports across the image sequence.
 await page.getByRole('button',{name:'返回集合',exact:true}).click();await page.getByRole('button',{name:'開啟設定',exact:true}).click()
 await page.getByRole('button',{name:'恢復預設 2 倍',exact:true}).click();await page.getByRole('button',{name:'集合',exact:true}).click()
 await page.getByRole('button',{name:'開啟 手勢測試',exact:true}).click();await photo('直式一')
 await doubleTap(290,280);await scale(2)
 const zoomed=await state()
 if(zoomed.x<=.5 || zoomed.y>=.5)throw Error('Double tap did not focus specified upper-right area')
 await page.screenshot({path:'docs/zoom-viewer.png'})
 await swipe()
 await page.waitForFunction(()=>document.querySelectorAll('.main-photo').length===2 && [...document.querySelectorAll('.main-photo')].every(el=>getComputedStyle(el).visibility==='visible'))
 await doubleTap(200,420);await scale(1)
 const duringFade=await page.locator('.main-photo').evaluateAll(imgs=>imgs.map(img=>getComputedStyle(img).transform))
 if(duringFade.length===2 && duringFade[0]!==duringFade[1])throw Error('Gesture during fade left old layer at previous zoom: '+JSON.stringify(duringFade))
 await doubleTap(290,280);await scale(2)
 const layers=await page.locator('.main-photo').evaluateAll(imgs=>imgs.map(img=>getComputedStyle(img).transform))
 if(layers[0]!==layers[1])throw Error('Fade layers did not retain the same viewport')
 await photo('直式二');if(!same(await state(),zoomed))throw Error('Swipe reset viewport')
 await swipe();await photo('橫式');if(!same(await state(),zoomed))throw Error('Different aspect ratio reset viewport')
 const shape=await page.locator('.main-photo').evaluate(img=>{const r=img.getBoundingClientRect();return r.width/r.height})
 if(Math.abs(shape-1.5)>.001)throw Error('Landscape image stretched')
 await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>document.querySelector('.image-stage').clientWidth===844)
 if(!same(await state(),zoomed))throw Error('Rotation reset saved viewport')
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.image-stage').clientWidth===390)
 await doubleTap(200,420);await scale(1)
 await page.keyboard.press('ArrowLeft');await photo('直式二')
 // Pinch out around a chosen midpoint, then pan with both fingers.
 const baselineDecodes=await page.evaluate(()=>window.__decodes)
 await send('touchStart',[{id:1,x:150,y:350},{id:2,x:250,y:450}])
 await send('touchMove',[{id:1,x:100,y:300},{id:2,x:300,y:500}]);await scale(2)
 const pinched=await state()
 await send('touchMove',[{id:1,x:130,y:320},{id:2,x:330,y:520}])
 await page.waitForFunction(previous=>Number(document.querySelector('.image-stage').dataset.focusX)<previous.x && Number(document.querySelector('.image-stage').dataset.focusY)<previous.y,pinched)
 await scale(2)
 const panned=await state()
 if(Math.abs(panned.scale-2)>.01 || panned.x>=pinched.x || panned.y>=pinched.y)throw Error('Two-finger pan failed: '+JSON.stringify({pinched,panned}))
 // Lift one contact and move the remaining contact: it must not become a swipe.
 await send('touchEnd',[{id:2,x:330,y:520}])
 await send('touchMove',[{id:2,x:90,y:520}]);await send('touchEnd',[])
 await page.waitForTimeout(320);await photo('直式二')
 if(await page.locator('.viewer-header').evaluate(el=>el.classList.contains('hidden')))throw Error('Pinch produced a click')
 if(await page.evaluate(()=>window.__decodes)!==baselineDecodes)throw Error('Pinch or pan decoded image again')
 if(!same(await state(),panned))throw Error('Remaining finger changed viewport')
 await swipe();await photo('橫式');if(!same(await state(),panned))throw Error('Post-pinch swipe lost viewport')
 // System cancellation must not leave a swipe or a delayed tap behind.
 await send('touchStart',[{id:1,x:130,y:350},{id:2,x:260,y:450}]);await send('touchCancel',[])
 await page.waitForTimeout(320);await photo('橫式')
 await doubleTap(200,420);await scale(1)
 await page.getByRole('button',{name:'返回集合',exact:true}).click();await page.getByRole('button',{name:'開啟 手勢測試',exact:true}).click();await photo('直式一');await scale(1)
 if(errors.length)throw Error(errors.join('\n'))
 console.log('PASS: real Chromium touch double-tap focal zoom/reset, 3.25x setting persistence, delayed single tap, pinch/pan without re-decode, partial lift and cancel without swipe/click, zoomed single-finger navigation, shared fade viewport, aspect-ratio/rotation persistence and new-session reset. SAF and native image bridge mocked.')
} catch(error) {await page.screenshot({path:'release/zoom-smoke-failure.png'}).catch(()=>{});throw error}
finally {await browser.close()}
