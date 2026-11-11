const ORIGIN='https://denmily.netlify.app';
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const escapeHtml=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export default async request=>{
 if(request.method!=='POST')return json(405,{ok:false});
 if(request.headers.get('origin')!==ORIGIN)return json(403,{ok:false});
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json(415,{ok:false});
 if(Number(request.headers.get('content-length')||0)>5000)return json(413,{ok:false});
 let input;try{input=await request.json()}catch{return json(400,{ok:false})}
 if(!input||typeof input!=='object'||Array.isArray(input))return json(400,{ok:false});
 if(clean(input.website,200))return json(200,{ok:true});
 const name=clean(input.name,80),age=clean(input.age,3),nickname=clean(input.nickname,32),about=clean(input.about,1000);
 if(!name||!/^\d{1,3}$/.test(age)||Number(age)<1||Number(age)>120||!nickname||!about)return json(400,{ok:false});
 const token=process.env.DENMILY_TELEGRAM_BOT_TOKEN;
 if(!token||token.length>200)return json(503,{ok:false});
 const text=`<b>Новая анкета DENMILY</b>\n\n<b>Имя:</b> ${escapeHtml(name)}\n<b>Возраст:</b> ${age}\n<b>Ник в Minecraft:</b> ${escapeHtml(nickname)}\n<b>О себе:</b>\n${escapeHtml(about)}`;
 try{
  const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:'-1002775606195',message_thread_id:42,text,parse_mode:'HTML',link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return json(502,{ok:false});
  const result=await response.json();return result.ok?json(200,{ok:true}):json(502,{ok:false});
 }catch{return json(502,{ok:false})}
};
export const config={path:'/api/application',rateLimit:{windowLimit:5,windowSize:60,aggregateBy:['ip','domain']}};
