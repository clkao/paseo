const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const {createBrowserProfileCatalog} = require(path.resolve("packages/desktop/dist/features/browser-profile-catalog.js"));
(async () => {
 const group = { serverId: "server", projectId: "project" };
 for (const original of ["Caf\u00e9 1", "Cafe\u0301 1"]) {
   const entered=original===original.normalize("NFC")?original.normalize("NFD"):original.normalize("NFC");
   const directory=await fs.mkdtemp(path.join(os.tmpdir(),"nfc-"));
   const catalog=createBrowserProfileCatalog(directory);
   const result=await catalog.create({group,name:entered,workspaceNames:[original]});
   const saved=await catalog.list();
   console.log(JSON.stringify({original,entered,result,saved}));
   assert.deepEqual(result,{ok:false,code:"duplicate"});
   assert.deepEqual(saved,[]);
 }
})().catch(e=>{console.error(e);process.exitCode=1});
