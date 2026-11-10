const root=document.documentElement; const themeButton=document.querySelector('#theme-toggle'); function setTheme(theme){root.dataset.theme=theme;const light=theme==='light';themeButton.setAttribute('aria-label',light?'Включить тёмную тему':'Включить светлую тему');themeButton.innerHTML=light?'☾ <span>Тёмная тема</span>':'☼ <span>Светлая тема</span>';try{localStorage.setItem('denmily-theme',theme)}catch{}} let savedTheme;try{savedTheme=localStorage.getItem('denmily-theme')}catch{} setTheme(savedTheme==='light'?'light':'dark'); themeButton.addEventListener('click',()=>setTheme(root.dataset.theme==='dark'?'light':'dark'));
document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>{const current=button.closest('dialog');if(current)current.close();document.getElementById(button.dataset.open).showModal()}));document.querySelectorAll('.close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()}));
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{const label=button.textContent;try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent='Скопировано'}catch{button.textContent='Скопируйте вручную'}setTimeout(()=>button.textContent=label,2500)}));
document.querySelector('#application-form').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);const body=`Анкета DENMILY\nИмя: ${f.get('name')}\nВозраст: ${f.get('age')}\nНик в Minecraft: ${f.get('nickname')}\nО себе: ${f.get('about')}`;document.querySelector('#form-message').textContent='Проверьте письмо в почтовой программе и отправьте его.';window.location.href='mailto:rinatshaydullov@gmail.com?subject='+encodeURIComponent('Анкета DENMILY — '+f.get('nickname'))+'&body='+encodeURIComponent(body)});
async function loadStatus(){const status=document.querySelector('#server-status'),players=document.querySelector('#server-players');try{const response=await fetch('https://api.mcstatus.io/v2/status/java/denmily.joinserver.xyz',{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('status');const data=await response.json();if(data.online){status.textContent='Сервер онлайн';players.textContent=Number.isFinite(data.players?.online)?`Игроков сейчас: ${data.players.online}${Number.isFinite(data.players?.max)?' / '+data.players.max:''}`:'Количество игроков недоступно'}else{status.textContent='Сервер недоступен';players.textContent='Сервис проверки не смог подключиться к серверу.'}}catch{status.textContent='Статус недоступен';players.textContent='Не удалось получить данные. Попробуйте позже.'}}loadStatus();const paint=document.querySelector('.ambient-paint');
// The botanical illustration slowly opens as the reader explores the page.
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
if(!motionPreference.matches){
  let scrollPending=false;
  const updateBloom=()=>{const available=Math.max(1,document.documentElement.scrollHeight-innerHeight);const bloom=Math.max(.42,Math.min(1,.42+scrollY/available*.58));document.documentElement.style.setProperty('--bloom',bloom.toFixed(3));scrollPending=false};
  window.addEventListener('scroll',()=>{if(!scrollPending){scrollPending=true;requestAnimationFrame(updateBloom)}},{passive:true});updateBloom();
}

// Two decorative margin plants: scroll opens and closes their leaves; pointer tint stays subtle.
const fernTemplate=document.querySelector('.hero-art .fern');
if(fernTemplate){
  const garden=document.createElement('div');garden.className='edge-garden';garden.setAttribute('aria-hidden','true');
  for(const side of ['left','right','left-back','right-back']){const plant=document.createElement('div');plant.className=`edge-plant edge-${side}`;const svg=fernTemplate.cloneNode(true);svg.removeAttribute('class');if(side.startsWith('right'))svg.classList.add('fern-broad');plant.appendChild(svg);garden.appendChild(plant)}
  document.body.prepend(garden);
  if(!motionPreference.matches){
    let queued=false;
    const updateGarden=()=>{const phase=scrollY/340;const openness=(.5+.5*Math.cos(phase));garden.style.setProperty('--edge-bloom',openness.toFixed(3));garden.style.setProperty('--edge-leaf-tilt',`${(24*(1-openness)).toFixed(2)}deg`);garden.style.setProperty('--edge-sway','0deg');queued=false};
    addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(updateGarden)}},{passive:true});updateGarden();
    if(matchMedia('(pointer:fine)').matches){addEventListener('pointermove',e=>{const edge=Math.min(e.clientX,innerWidth-e.clientX);garden.classList.toggle('edge-near',edge<Math.min(180,innerWidth*.15));garden.style.setProperty('--edge-hue',`${((e.clientY/innerHeight-.5)*55).toFixed(1)}deg`)},{passive:true});document.addEventListener('pointerleave',()=>garden.classList.remove('edge-near'))}
  }
}


// Tint only nearby text and icons, keeping the page background unchanged.
if(matchMedia('(pointer:fine)').matches&&!motionPreference.matches){
 const targets=[...document.querySelectorAll('h1, h2, .tile strong, .tile-icon, .tile-top b, .header-link')];let pending=false,px=0,py=0;
 const updatePearl=()=>{for(const el of targets){const r=el.getBoundingClientRect();const x=Math.max(r.left,Math.min(px,r.right));const y=Math.max(r.top,Math.min(py,r.bottom));const distance=Math.hypot(px-x,py-y);const strength=Math.max(0,1-distance/180);if(strength>0){el.style.setProperty('--pearl-amount',`${Math.round(strength*32)}%`);el.style.setProperty('--pearl-scale',(1+strength*.2).toFixed(3));el.style.setProperty('--local-x',`${(px-r.left).toFixed(1)}px`);el.style.setProperty('--local-y',`${(py-r.top).toFixed(1)}px`);el.classList.add('pearl-near')}else{el.classList.remove('pearl-near')}}pending=false};
 addEventListener('pointermove',e=>{px=e.clientX;py=e.clientY;if(!pending){pending=true;requestAnimationFrame(updatePearl)}},{passive:true});
 document.addEventListener('pointerleave',()=>targets.forEach(el=>el.classList.remove('pearl-near')));
}
