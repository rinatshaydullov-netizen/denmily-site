import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createPasswordAuth} from './netlify/lib/password-auth.mjs';

class MemoryCAS {
  data=new Map(); serial=0;
  async read(key){const row=this.data.get(key);return row?{value:structuredClone(row.value),version:row.version}:null}
  async create(key,value){if(this.data.has(key))return false;this.data.set(key,{value:structuredClone(value),version:String(++this.serial)});return true}
  async replace(key,version,value){const row=this.data.get(key);if(!row||row.version!==version)return false;this.data.set(key,{value:structuredClone(value),version:String(++this.serial)});return true}
}
const secrets={bridge:'b'.repeat(32),code:'c'.repeat(32),account:'a'.repeat(32),session:'s'.repeat(32),rate:'r'.repeat(32)};
const origin='https://denmily.netlify.app',store=new MemoryCAS(),handler=createPasswordAuth({store,secrets,origin,clock:()=>1700000000});
const uuid='12345678-1234-1234-1234-123456789abc',name='TestPlayer';
async function request(path,data,{cookie='',code='A'.repeat(24)}={}){
  const url=`${origin}/api/auth/${path}`;let headers={origin,'content-type':'application/json'};let body=JSON.stringify(data);
  if(cookie)headers.cookie=cookie;
  if(path==='bridge'){
    const timestamp=1700000000,payload=`${timestamp}\n${uuid}\n${name}\n${code}`;
    headers={'content-type':'text/plain','x-denmily-signature':createHmac('sha256',secrets.bridge).update(payload).digest('hex')};body=payload;
  }
  return handler(new Request(url,{method:'POST',headers,body}),{ip:'192.0.2.10'});
}
async function run(){
  let response=await request('bridge',{}, {code:'A'.repeat(24)});assert.equal(response.status,201,'Minecraft bridge issues registration code');
  response=await request('register',{name,email:'player@example.org',password:'first-password-123',code:'A'.repeat(24)});assert.equal(response.status,201,'register with in-game proof');
  response=await request('login',{name,password:'first-password-123'});assert.equal(response.status,200,'initial login');
  const oldCookie=response.headers.get('set-cookie').split(';')[0];
  response=await request('session',{}, {cookie:oldCookie});assert.equal(response.status,200,'initial session valid');
  response=await request('bridge',{}, {code:'B'.repeat(24)});assert.equal(response.status,201,'issue recovery code from the game');
  response=await request('recover',{name,password:'replacement-password-456',code:'B'.repeat(24)});assert.equal(response.status,200,'recover with matching Minecraft account code');
  response=await request('session',{}, {cookie:oldCookie});assert.equal(response.status,401,'recovery invalidates existing sessions');
  response=await request('login',{name,password:'first-password-123'});assert.equal(response.status,401,'old password no longer works');
  response=await request('login',{name,password:'replacement-password-456'});assert.equal(response.status,200,'new password works');
  response=await request('recover',{name,password:'another-password-789',code:'B'.repeat(24)});assert.equal(response.status,400,'recovery code cannot be reused');
  response=await request('bridge',{}, {code:'C'.repeat(24)});assert.equal(response.status,201,'issue a code for a later mismatch case');
  response=await request('recover',{name:'OtherPlayer',password:'another-password-789',code:'C'.repeat(24)});assert.equal(response.status,400,'code does not reset another nickname');
  console.log('Password recovery checks passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1});
