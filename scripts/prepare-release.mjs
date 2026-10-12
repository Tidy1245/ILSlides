// Run once before each release. An explicit argument overrides the default patch increment.
import fs from 'node:fs'
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const next=process.argv[2] || pkg.version.replace(/(\d+)$/, n=>String(Number(n)+1))
if(!/^\d+\.\d+\.\d+$/.test(next)) throw new Error('Version must be major.minor.patch')
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'))
pkg.version=next; lock.version=next; lock.packages[''].version=next
const file='android/app/build.gradle'
let gradle=fs.readFileSync(file,'utf8')
const code=Number(gradle.match(/versionCode (\d+)/)?.[1])
if(!code) throw new Error('Android versionCode not found')
gradle=gradle.replace(/versionCode \d+/,`versionCode ${code+1}`).replace(/versionName "[^"]+"/,`versionName "${next}"`)
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n')
fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n')
fs.writeFileSync(file,gradle)
console.log(`Release version: ${next} (Android versionCode ${code+1})`)
