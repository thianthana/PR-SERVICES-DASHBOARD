let services=[];
async function loadPortal(){
  const r=await Auth.call('getPortal');if(!r.success){UI.error(r);return false;}
  UI.profile(r.user);document.getElementById('adminLink').hidden=r.user.role!=='admin';
  services=r.services;renderServices();return true;
}
function renderServices(){
  const q=document.getElementById('search').value.trim().toLocaleLowerCase('th');
  const list=services.filter(s=>(s.name+' '+s.description).toLocaleLowerCase('th').includes(q));
  const grid=document.getElementById('services');grid.replaceChildren();
  document.getElementById('count').textContent=services.length+' บริการสำหรับคุณ';
  if(!list.length){grid.append(UI.el('div',{class:'empty',text:services.length?'ไม่พบบริการที่ค้นหา':'ยังไม่มีบริการที่ได้รับสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ'}));return;}
  list.forEach((s,i)=>{
    const icon=UI.el('span',{class:'icon-box'},[UI.icon(s.icon)]);
    const button=UI.el('button',{class:'service-card '+(i===0?'featured':''),'aria-label':'เข้าบริการ '+s.name},[icon,UI.el('h2',{text:s.name}),UI.el('p',{text:s.description}),UI.el('span',{class:'arrow','aria-hidden':'true',text:'→'})]);
    if(i===0)button.append(UI.el('span',{class:'tag',text:'บริการของคุณ'}));
    button.addEventListener('click',async()=>{button.disabled=true;UI.message('');try{const r=await Auth.call('checkService',{serviceId:s.id});if(r.success&&UI.validPath(r.path))location.href=new URL(r.path,location.href).href;else{UI.error(r);if(r.error==='FORBIDDEN')await loadPortal();}}finally{button.disabled=false;}});
    grid.append(button);
  });
}
document.getElementById('logout').onclick=()=>Auth.logout();
document.getElementById('search').oninput=renderServices;
(async()=>{if(!await Auth.requireAuth())return;if(await loadPortal()){document.getElementById('loading').hidden=true;document.getElementById('content').hidden=false;}})();
// Re-fetch visibility after revocation, and on return to the tab. Never show cached grants on errors.
let refreshing=false;
async function refreshPortal(){if(document.hidden||refreshing||document.getElementById('content').hidden)return;refreshing=true;try{if(!await loadPortal()){services=[];document.getElementById('services').replaceChildren(UI.el('div',{class:'empty',text:'ยังตรวจสอบสิทธิ์ไม่ได้ กรุณาโหลดหน้าใหม่'}));}}finally{refreshing=false;}}
setInterval(refreshPortal,30000);document.addEventListener('visibilitychange',refreshPortal);
