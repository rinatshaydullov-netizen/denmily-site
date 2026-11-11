import {createHmac,randomBytes,timingSafeEqual,scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {CasRateLimit} from './cas-rate-limit.mjs';
const scrypt=promisify(scryptCallback);
// Prototype: never enable without real Netlify conditional-write tests and security review.
export function createPasswordAuth({store,secrets,origin,clock=()=>Math.floor(Date.now()/1000)}) {
  if(new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('origin');
  const fields=['bridge','code','account','session','rate'];
  if(fields.some(k=>typeof secrets[k]!=='string'||Buffer.byteLength(secrets[k])<32)||new Set(fields.map(k=>secrets[k])).size!==fields.length)throw Error('secrets');
  const limit=new CasRateLimit(store,secrets.rate);
  const digest=(key,value)=>createHmac('sha256',secrets[key]).update(value).digest('hex');
  const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
  const cookie=(value,max)=>`__Host-denmily-session=${value}; Path=/; Max-Age=${max}; Secure; HttpOnly; SameSite=Strict`;
  const json=(status,data,c)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...(c?{'set-cookie':c}:{})}});
  const readCookie=req=>{const c=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-denmily-session='));return c.length===1?c[0].slice('__Host-denmily-session='.length):''};
  async function readBody(req,max){const len=req.headers.get('content-length');if(len!==null&&(!/^\d+$/.test(len)||Number(len)>max))throw Error('body');if(!req.body)return '';const reader=req.body.getReader(),chunks=[];let n=0;for(;;){const {value,done}=await reader.read();if(done)break;n+=value.byteLength;if(n>max){await reader.cancel();throw Error('body')}chunks.push(value)}return Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8')}
  const validName=n=>typeof n==='string'&&/^[A-Za-z0-9_]{1,16}$/.test(n);
  const validPass=p=>typeof p==='string'&&p.length>=12&&Buffer.byteLength(p)<=256;
  const accountKey=n=>'account:'+digest('account',n.toLowerCase());
  async function hash(password,salt){return Buffer.from(await scrypt(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024})).toString('hex')}
  return async(req,context={})=>{
    try{
      const now=clock(),u=new URL(req.url),path=u.pathname.split('/').pop(),ip=context.ip;
      if(u.origin!==origin||u.search||req.method!=='POST')return json(403,{ok:false});
      if(typeof ip!=='string'||ip.length<2||ip.length>64)return json(503,{ok:false});
      if(!await limit.consume('global','all',500,300,now)||!await limit.consume('ip',ip,40,300,now))return json(429,{ok:false});
      if(path==='bridge'){
        if(!(req.headers.get('content-type')||'').startsWith('text/plain'))return json(400,{ok:false});
        const body=await readBody(req,256),sig=req.headers.get('x-denmily-signature')||'';
        if(!equal(digest('bridge',body),sig))return json(403,{ok:false});
        const parts=body.split('\n');if(parts.length!==4)return json(400,{ok:false});const [time,uuid,name,code]=parts;
        if(!/^\d{10}$/.test(time)||Math.abs(now-Number(time))>30||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(uuid)||!validName(name)||!/^[A-Za-z0-9_-]{24}$/.test(code))return json(400,{ok:false});
        const ok=await store.create('code:'+digest('code',code),{name,uuid,expires:now+300,state:'issued'});return json(ok?201:403,{ok});
      }
      if(req.headers.get('origin')!==origin||!(req.headers.get('content-type')||'').startsWith('application/json'))return json(403,{ok:false});
      const data=JSON.parse(await readBody(req,2048));
      if(path==='register'){
        const {name,password,email,code}=data;
        if(!validName(name)||!validPass(password)||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof code!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(code))return json(400,{ok:false});
        if(!await limit.consume('register',name.toLowerCase(),5,900,now))return json(429,{ok:false});
        const key='code:'+digest('code',code),record=await store.read(key);
        if(!record||record.value.state!=='issued'||record.value.expires<=now||record.value.name.toLowerCase()!==name.toLowerCase())return json(400,{ok:false});
        const salt=randomBytes(16).toString('hex'),passwordHash=await hash(password,salt);
        if(!await store.replace(key,record.version,{state:'consumed',expires:record.value.expires}))return json(400,{ok:false});
        const ok=await store.create(accountKey(name),{uuid:record.value.uuid,name:record.value.name,email,salt,passwordHash,authVersion:0,created:now});
        if(!ok)return json(400,{ok:false});
        return json(201,{ok:true});
      }
      if(path==='recover'){
        const {name,password,code}=data;
        if(!validName(name)||!validPass(password)||typeof code!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(code))return json(400,{ok:false});
        if(!await limit.consume('recover',name.toLowerCase(),5,900,now))return json(429,{ok:false});
        const codeKey='code:'+digest('code',code),record=await store.read(codeKey);
        if(!record||record.value.state!=='issued'||record.value.expires<=now||record.value.name.toLowerCase()!==name.toLowerCase())return json(400,{ok:false});
        const key=accountKey(name),account=await store.read(key),v=account?.value;
        if(!v||v.uuid!==record.value.uuid)return json(400,{ok:false});
        const salt=randomBytes(16).toString('hex'),passwordHash=await hash(password,salt);
        if(!await store.replace(codeKey,record.version,{state:'consumed',expires:record.value.expires}))return json(400,{ok:false});
        const updated={...v,salt,passwordHash,authVersion:(Number.isSafeInteger(v.authVersion)?v.authVersion:0)+1,passwordChanged:now};
        if(!await store.replace(key,account.version,updated))return json(409,{ok:false});
        return json(200,{ok:true});
      }
      if(path==='login'){
        const {name,password}=data;
        if(!validName(name)||!validPass(password))return json(400,{ok:false});
        if(!await limit.consume('login',name.toLowerCase(),8,900,now))return json(429,{ok:false});
        const account=await store.read(accountKey(name)),v=account?.value;
        const salt=typeof v?.salt==='string'&&/^[a-f0-9]{32}$/.test(v.salt)?v.salt:'0'.repeat(32);
        const actual=await hash(password,salt);
        if(!v||!equal(actual,v.passwordHash))return json(401,{ok:false});
        const token=randomBytes(32).toString('hex');if(!await store.create('session:'+digest('session',token),{name:v.name,uuid:v.uuid,authVersion:Number.isSafeInteger(v.authVersion)?v.authVersion:0,expires:now+86400}))return json(503,{ok:false});
        return json(200,{ok:true,name:v.name},cookie(token,86400));
      }
      if(path==='session'){
        const token=readCookie(req);if(!/^[a-f0-9]{64}$/.test(token))return json(401,{ok:false});
        const s=await store.read('session:'+digest('session',token));if(!s||s.value.revoked||s.value.expires<=now)return json(401,{ok:false});
        const account=await store.read(accountKey(s.value.name));if(!account||account.value.uuid!==s.value.uuid||(Number.isSafeInteger(s.value.authVersion)?s.value.authVersion:0)!==(Number.isSafeInteger(account.value.authVersion)?account.value.authVersion:0))return json(401,{ok:false});
        return json(200,{ok:true,name:s.value.name});
      }
      if(path==='logout'){
        const token=readCookie(req);if(/^[a-f0-9]{64}$/.test(token)){const key='session:'+digest('session',token),s=await store.read(key);if(s&&!await store.replace(key,s.version,{revoked:true,expires:s.value.expires}))return json(503,{ok:false})}
        return json(200,{ok:true},cookie('',0));
      }
      return json(404,{ok:false});
    }catch{return json(503,{ok:false})}
  }
}
