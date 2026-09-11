const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
let user={id,email:'account@example.com',email_confirmed_at:'2026-01-01'},rpcResult={data:{id},error:null};const calls=[];
const client={auth:{getUser:async()=>({data:{user}})},rpc:async(name,args)=>{calls.push({name,args});return rpcResult;},from:()=>({select(){return this;},eq(){return this;},limit:async()=>({data:[{user_id:id}],error:null}),single:async()=>({data:null})})};
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/mosque-enquiries/submit+api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require:()=>({createClient:()=>client}),Response,console,process:{env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE:'test'}}});
const req=(data,auth=true)=>new Request('https://example.test/api',{method:'POST',headers:auth?{authorization:'Bearer test'}:{},body:JSON.stringify(data)});
(async()=>{
 const post=exportsObject.POST;
 assert.equal((await post(req({},false))).status,401);
 for(const value of [null,[],{}, {id:'bad'}])assert.equal((await post(req(value))).status,400);
 const create={action:'create',id,mosque_id:other,contact_name:'Test User',category:'other',reason:'Something else',details:'Please help',account_id:other,contact_email:'forged@example.com'};
 assert.equal((await post(req(create))).status,200);assert.equal(calls[0].args.p_actor,id);assert.equal(calls[0].args.p_email,undefined);assert.equal(calls[0].args.p_account_id,undefined);
 user={...user,is_anonymous:true};assert.equal((await post(req(create))).status,401);user={...user,is_anonymous:false,email_confirmed_at:null};assert.equal((await post(req(create))).status,403);user={...user,email_confirmed_at:'2026-01-01'};
 for(const [code,status]of [['P0429',429],['42501',403],['22023',400],['P0404',404],['XX000',500]]){rpcResult={data:null,error:{code,message:'fixture'}};assert.equal((await post(req(create))).status,status);}
 rpcResult={data:{id},error:null};
 assert.equal((await post(req({action:'reply',id,enquiry_id:other,body:'Reply',as_admin:'yes'}))).status,400);
 assert.equal((await post(req({action:'reply',id,enquiry_id:other,body:'Reply',as_admin:true}))).status,200);
 assert.equal(calls.at(-1).args.p_actor,user.id);assert.equal(calls.at(-1).args.p_as_admin,true);
 const categories={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/mosqueEnquiryCategories.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:categories});
 const sql=fs.readFileSync('supabase/migrations/20260910000000_mosque_enquiries.sql','utf8');
 for(const c of categories.ENQUIRY_CATEGORIES){assert.ok(sql.includes("'"+c.id+"'"));for(const reason of c.reasons)assert.ok(sql.includes("'"+reason.replaceAll("'","''")+"'"));}
 assert.ok(!categories.ENQUIRY_CATEGORIES.some(c=>/imam|personal|family/.test(c.id)));
 console.log('Enquiry API validation, session requirements, trusted identity, error mapping and category catalogue checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
