set -eu
node --input-type=module <<'JS'
import { deepEqual } from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  listBrowserPartitionDirectories, getPaseoBrowserProfileSessions,
  listPaseoBrowserProfileGuests, clearPaseoBrowserProfile,
} from './packages/desktop/dist/features/browser-profile.js';
const dir = await mkdtemp(join(tmpdir(), 'validation-reload-'));
const project = 'paseo-project-' + 'a'.repeat(32) + '-';
const names = ['paseo-browser', 'paseo-shared-work', project+'customer', project+'ws-'+'b'.repeat(32), 'paseo-browser-1700000000001-ef', 'unrelated'];
try {
  const counts = Object.fromEntries(names.map(name => [name,0]));
  const handles = new Map();
  const fromPartition = name => {
    if (!handles.has(name)) handles.set(name, {async clearStorageData(){},async clearCache(){},async clearAuthCache(){}});
    return handles.get(name);
  };
  const guests = [];
  for (const name of names) {
    await mkdir(join(dir,'Partitions',name), {recursive:true});
    guests.push({id:guests.length+1,session:fromPartition('persist:'+name),isDestroyed:()=>false,getType:()=>'webview',reload:()=>counts[name]++});
  }
  const sessions = getPaseoBrowserProfileSessions({fromPartition},[],await listBrowserPartitionDirectories(dir));
  await clearPaseoBrowserProfile({profileSessions:sessions,listGuests:()=>listPaseoBrowserProfileGuests({webContents:guests,profileSessions:new Set(sessions)}),logReloadError:e=>{throw e;}});
  console.log(JSON.stringify(counts,null,2));
  deepEqual(names.map(name=>counts[name]),[1,1,1,1,1,0]);
} finally {
  await rm(dir,{recursive:true,force:true});
}
JS
