import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {setTimeout as delay} from "node:timers/promises";
const {chromium}=createRequire(path.join(process.cwd(),"package.json"))("playwright");
const run=process.argv[2];
let browser;
for(let i=0;i<90 && !browser;i++) {
 await delay(1000);
 const port=fs.existsSync(run+"/desktop.log") && fs.readFileSync(run+"/desktop.log","utf8").match(/DevTools listening on ws:\/\/127.0.0.1:(\d+)/)?.[1];
 if(port) browser=await chromium.connectOverCDP("http://127.0.0.1:"+port).catch(()=>undefined);
}
if(!browser) throw Error("test CDP missing");
const page=browser.contexts()[0].pages()[0];
page.on("pageerror",e=>console.log("renderer error",String(e)));
page.on("console",m=>{if(m.type()==="error") console.log("renderer console",m.text().slice(0,1600));});
page.on("requestfailed",r=>console.log("request failed",r.url().split("?")[0],r.failure()));
page.on("response",r=>{if(r.status()>=400) console.log("response",r.status(),r.url().split("?")[0]);});
for(let i=0;i<15 && !page.isClosed();i++) {
 console.log(new Date().toISOString(),await page.evaluate(()=>({url:location.pathname,text:document.body?.innerText?.slice(0,1000),ready:document.readyState,scripts:[...document.scripts].map(s=>s.src.split("?")[0]).filter(Boolean).slice(0,4)})).catch(String));
 await delay(7000);
}
await browser.close();
