// Read-only Storage backup. POST is used only by Supabase's object-list API.
// Output contains counts/hashes only; paths and bucket metadata stay private.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

let backupStage='startup';
function safeFailure(error){
 const message=error instanceof Error?error.message:String(error);
 const reason=/HTTP \d{3}/.exec(message)?.[0]
  ??(['identity/credentials mismatch','Client/server project mismatch','Existing backup manifest','Backup must be outside Git','Unexpected bucket response','Unexpected object list','Storage size mismatch','Repeated Storage prefix','Object exceeds backup size limit'].find(value=>message.includes(value)))
  ??(error instanceof Error?error.name:'unknown');
 console.log('BACKUP_ERROR '+JSON.stringify({target,stage:backupStage,reason}));
}
process.on('uncaughtException',error=>{safeFailure(error);process.exit(1);});
process.on('unhandledRejection',error=>{safeFailure(error);process.exit(1);});

const [target,destination]=process.argv.slice(2);
const refs={preview:'zhrucqghrqkjyzmupdyy',production:'yecbsezhwvpdkuzmmziv'};
if(!refs[target]||!destination)throw new Error('Expected preview|production and private destination');
const root=path.resolve(destination);
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(root===repository||root.startsWith(repository+path.sep))throw new Error('Backup must be outside Git');
const base=(process.env.SUPABASE_URL||process.env.EXPO_PUBLIC_SUPABASE_URL||'').trim().replace(/\/$/,'');
const key=(process.env.SUPABASE_SERVICE_ROLE||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
if(!key||new URL(base).protocol!=='https:'||new URL(base).hostname!==refs[target]+'.supabase.co')throw new Error('Backup project identity/credentials mismatch');
if(process.env.EXPO_PUBLIC_SUPABASE_URL&&new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).hostname!==new URL(base).hostname)throw new Error('Client/server project mismatch');
process.umask(0o077);
fs.mkdirSync(root,{recursive:true,mode:0o700});
fs.chmodSync(root,0o700);
const manifestPath=path.join(root,'storage-manifest.json');
if(fs.existsSync(manifestPath))throw new Error('Existing backup manifest; use a new destination');
const headers={apikey:key,Authorization:`Bearer ${key}`};
async function request(suffix,body){
 if(body&&!suffix.startsWith('/storage/v1/object/list/'))throw new Error('Only read-only listing may use POST');
 const response=await fetch(base+suffix,{method:body?'POST':'GET',headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Storage read failed: HTTP ${response.status}`);
 return response;
}
const manifest={environment:target,projectRef:refs[target],startedAt:new Date().toISOString(),status:'in_progress',buckets:[],objects:[]};
const save=()=>fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
save();
try{
 backupStage='list_buckets';
 const buckets=await (await request('/storage/v1/bucket')).json();
 if(!Array.isArray(buckets))throw new Error('Unexpected bucket response');
 manifest.buckets=buckets;
 let totalBytes=0;
 for(const bucket of buckets){
  backupStage='list_objects';
  const queue=[''];const visited=new Set();
  while(queue.length){
   const prefix=queue.shift();
   if(visited.has(prefix))throw new Error('Repeated Storage prefix');
   visited.add(prefix);
   for(let offset=0;;offset+=100){
    backupStage='list_objects';
    const rows=await (await request('/storage/v1/object/list/'+encodeURIComponent(bucket.id),{prefix,limit:100,offset,sortBy:{column:'name',order:'asc'}})).json();
    if(!Array.isArray(rows))throw new Error('Unexpected object list');
    for(const row of rows){
     const objectPath=prefix?`${prefix}/${row.name}`:row.name;
     if(!row.id&&!row.metadata){queue.push(objectPath);continue;}
     backupStage='download_object';
     const response=await request('/storage/v1/object/'+encodeURIComponent(bucket.id)+'/'+objectPath.split('/').map(encodeURIComponent).join('/'));
     const chunks=[];let size=0;
     for await(const chunk of response.body){
      size+=chunk.length;
      if(size>100*1024*1024)throw new Error('Object exceeds backup size limit');
      chunks.push(Buffer.from(chunk));
     }
     const data=Buffer.concat(chunks);
     const sha256=crypto.createHash('sha256').update(data).digest('hex');
     const file=crypto.createHash('sha256').update(bucket.id+'\0'+objectPath).digest('hex')+'.bin';
     backupStage='write_object';
     fs.writeFileSync(path.join(root,file),data,{flag:'wx',mode:0o600});
     if(Number.isFinite(row.metadata?.size)&&row.metadata.size!==size)throw new Error('Storage size mismatch');
     manifest.objects.push({bucket:bucket.id,path:objectPath,file,bytes:size,sha256,metadata:row});
     totalBytes+=size;save();
    }
    if(rows.length<100)break;
    if(offset>=100000)throw new Error('Listing exceeds backup limit');
   }
  }
 }
 manifest.status='downloaded_checksums_verified';manifest.completedAt=new Date().toISOString();save();
 console.log('BACKUP_RESULT '+JSON.stringify({target,buckets:manifest.buckets.length,objects:manifest.objects.length,totalBytes,status:manifest.status}));
}catch(error){
 manifest.status='failed';save();
 safeFailure(error);
 process.exitCode=1;
}
