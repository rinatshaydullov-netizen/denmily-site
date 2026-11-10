import {getStore} from '@netlify/blobs';
import {NetlifyBlobCAS} from '../lib/netlify-blob-store.mjs';
import {createPasswordAuth} from '../lib/password-auth.mjs';
import {deriveSecrets} from '../lib/derive-secrets.mjs';
export default async (req,context)=>{
 if(process.env.DENMILY_AUTH_ENABLED!=='true')return new Response('{"ok":false}',{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
 try{
  const secrets=deriveSecrets(process.env.DENMILY_MASTER_KEY);
  const store=new NetlifyBlobCAS(getStore({name:'denmily-auth',consistency:'strong'}));
  return await createPasswordAuth({store,secrets,origin:'https://denmily.netlify.app'})(req,context);
 }catch{return new Response('{"ok":false}',{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}})}
};
export const config={path:'/api/auth/*',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain']}};

