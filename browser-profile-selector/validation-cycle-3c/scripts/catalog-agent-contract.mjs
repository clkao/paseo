// Select one complete committed real-Electron test function. Supply the failing
// catalog through the test's real, isolated on-disk main-process input.
import {registerHooks} from "node:module";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
const runner=pathToFileURL(resolve("packages/desktop/e2e/browser-tabs.e2e.mjs")).href;
const fixture=pathToFileURL(resolve("packages/desktop/e2e/browser-profiles.electron.mjs")).href;
registerHooks({load(url,ctx,next){
 const item=next(url,ctx);
 if(url!==fixture) return item;
 const source=Buffer.from(item.source).toString();
 const start=source.indexOf("export async function runProfileJourney(");
 if(start<0 || !source.slice(0,start).includes("async function checkDelayedRegistration(tool)")) throw Error("Committed contract missing");
 return {...item,source:source.slice(0,start)+`
 export async function runProfileJourney({page,inspect,artifactDir,tool,openWorkspace,serverId,workspaceIds}){
   await openWorkspace(page, serverId+":"+workspaceIds[0]);
   const dir=await inspect("return process.mainModule.require('electron').app.getPath('userData')");
   if (!dir.startsWith(process.env.TMPDIR+"/paseo-desktop-browser-e2e-")) throw Error("unexpected userData " + dir);
   const file=path.join(dir,"browser-profiles.json");
   fs.writeFileSync(file,"{");
   console.log("Running committed checkDelayedRegistration(tool) with an unreadable catalog in",dir);
   await page.evaluate(()=>{
     const create=document.createElement.bind(document);
     window.profileAttachOrder=[];
     document.createElement=(tag,...args)=>{
       const element=create(tag,...args);
       if(tag.toLowerCase()==="webview"){
         const events=[];
         window.profileAttachOrder.push(events);
         new MutationObserver((records)=>{
           for(const r of records) events.push({attribute:r.attributeName,oldValue:r.oldValue,partition:element.getAttribute("partition"),src:element.getAttribute("src"),browserId:element.dataset.paseoBrowserId});
         }).observe(element,{attributes:true,attributeFilter:["partition","src"],attributeOldValue:true});
       }
       return element;
     };
   });
   const result=await checkDelayedRegistration(tool);
   const order=await page.evaluate(()=>window.profileAttachOrder);
   fs.writeFileSync(path.join(artifactDir,"attach-order.json"),JSON.stringify(order,null,2));
   const events=order.find(events=>events.some(e=>e.browserId===result.browserId));
   if(!events || events[0]?.attribute!=="partition" || !events.some(e=>e.attribute==="src")) throw Error("Expected partition before src: "+JSON.stringify(order));

   fs.writeFileSync(path.join(artifactDir,"agent-contract.json"),JSON.stringify(result,null,2));
   console.log(JSON.stringify(result));
   return result;
 }`};
}});
process.env.PASEO_DESKTOP_BROWSER_PROFILES_ONLY="1";
await import(runner);
