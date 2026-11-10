import {randomBytes,createHmac} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {NetlifyBlobCAS} from '../lib/netlify-blob-store.mjs';
import {createPasswordAuth} from '../lib/password-auth.mjs';
// Isolated synthetic test only; never include in a release.
export default async req=>{
 if(req.method!=='GET')return new Response('Method not allowed',{status:405});
 const blob=getStore({name:'denmily-auth-test-only',consistency:'strong'}),cas=new NetlifyBlobCAS(blob),created=[];
 const store={read:k=>cas.read(k),replace:(...a)=>cas.replace(...a),create:async(k,v)=>{const ok=await cas.create(k,v);if(ok)created.push(k);return ok}};
 try{
  const secrets=Object.fromEntries(['bridge','code','account','session','rate'].map(k=>[k,randomBytes(32).toString('hex')]));
  const origin='https://denmily-auth-test.netlify.app',now=Math.floor(Date.now()/1000),auth=createPasswordAuth({store,secrets,origin,clock:()=>now});
  const code=randomBytes(18).toString('base64url'),name='TestPlayer',pass=randomBytes(18).toString('base64url');
  const payload=`${now}\n12345678-1234-1234-1234-123456789abc\n${name}\n${code}`,signature=createHmac('sha256',secrets.bridge).update(payload).digest('hex');
  const call=(path,data,extra={})=>auth(new Request(`${origin}/api/auth/${path}`,{method:'POST',headers:{origin,'content-type':'application/json',...extra},body:typeof data==='string'?data:JSON.stringify(data)}),{ip:'192.0.2.88'});
  const issue=await call('bridge',payload,{'content-type':'text/plain','x-denmily-signature':signature});
  const info={name,email:'test@example.test',password:pass,code};
  const races=await Promise.all([call('register',info),call('register',info)]);
  const login=await call('login',{name,password:pass}),sessionCookie=login.headers.get('set-cookie')?.split(';')[0]||'';
  const session=await call('session',{}, {cookie:sessionCookie});const logout=await call('logout',{}, {cookie:sessionCookie});const after=await call('session',{}, {cookie:sessionCookie});
  const ok=issue.status===201&&races.filter(x=>x.status===201).length===1&&login.status===200&&session.status===200&&logout.status===200&&after.status===401;
  return Response.json({ok,issue:issue.status,registration:races.map(x=>x.status),login:login.status,session:session.status,logout:logout.status,afterLogout:after.status},{status:ok?200:500,headers:{'cache-control':'no-store'}});
 }catch{return Response.json({ok:false,reason:'test-error'},{status:500,headers:{'cache-control':'no-store'}})}
 finally{await Promise.allSettled(created.map(k=>blob.delete(k)))}
};
export const config={path:'/auth-self-test',rateLimit:{windowLimit:4,windowSize:60,aggregateBy:['ip','domain']}};

