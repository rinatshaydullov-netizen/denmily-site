import {randomBytes} from 'node:crypto';
import {getStore} from '@netlify/blobs';
// Test-only endpoint in the isolated project; remove before a real release.
export default async req=>{
 if(req.method!=='GET')return new Response('Method not allowed',{status:405});
 const store=getStore({name:'denmily-cas-test',consistency:'strong'}),key='test-'+randomBytes(16).toString('hex');
 try{
  const first=await store.setJSON(key,{round:0},{onlyIfNew:true});
  const initial=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
  if(!first.modified||!initial?.etag)return Response.json({ok:false,reason:'missing-etag'},{status:500,headers:{'cache-control':'no-store'}});
  const results=await Promise.all(Array.from({length:8},(_,i)=>store.setJSON(key,{round:i+1},{onlyIfMatch:initial.etag})));
  const wins=results.filter(x=>x.modified).length;
  return Response.json({ok:wins===1,wins},{status:wins===1?200:500,headers:{'cache-control':'no-store'}});
 }catch{return Response.json({ok:false,reason:'storage-error'},{status:500,headers:{'cache-control':'no-store'}})}
 finally{try{await store.delete(key)}catch{}}
};
export const config={path:'/storage-check',rateLimit:{windowLimit:5,windowSize:60,aggregateBy:['ip','domain']}};

