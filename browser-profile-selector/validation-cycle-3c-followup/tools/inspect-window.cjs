const fs=require("node:fs");
const {chromium}=require(require.resolve("playwright",{paths:[process.cwd()]}));
(async()=>{
 const dir=process.argv[2], suffix=process.argv[3];
 const port=fs.readFileSync(dir+"/desktop.log","utf8").match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)[1];
 const b=await chromium.connectOverCDP("http://127.0.0.1:"+port);
 for(const p of b.contexts()[0].pages().filter(p=>p.url().startsWith("http://localhost:"))){
   console.log(p.url(), await p.locator("body").innerText());
   console.log("UI targets", await p.evaluate(()=>[...document.querySelectorAll("[data-testid]")].filter(el=>/^workspace-tab-|tab-overflow|sidebar-workspace-row|workspace-deck-entry/.test(el.dataset.testid)).map(el=>({id:el.dataset.testid,w:Math.round(el.getBoundingClientRect().width),label:el.getAttribute("aria-label")}))));
   await p.screenshot({path:dir+"/window-"+suffix+".png"});
 }
 await b.close();
})().catch(e=>{console.error(e);process.exitCode=1});
