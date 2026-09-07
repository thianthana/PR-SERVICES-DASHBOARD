let data={users:[],services:[]},selected='',editingVersion=0,manifest=[];
const form=document.getElementById('serviceForm'),dialog=document.getElementById('serviceDialog');
async function refresh(){
  const r=await Auth.call('adminData');
  if(!r.success){document.getElementById('content').hidden=true;UI.error(r);return false;}
  data=r;UI.profile(Auth.getSession());document.getElementById('loading').hidden=true;document.getElementById('content').hidden=false;renderUsers();renderTable();if(selected)renderUser(selected);return true;
}
function renderUsers(){
  const q=document.getElementById('userSearch').value.toLowerCase(),container=document.getElementById('users');container.replaceChildren();
  const users=data.users.filter(u=>(u.displayName+' '+u.email+' '+u.username).toLowerCase().includes(q));
  users.forEach(u=>container.append(UI.el('button',{class:selected===u.username?'selected':'',onclick:()=>{selected=u.username;renderUsers();renderUser(selected);}},[UI.el('span',{text:u.displayName}),UI.el('small',{text:u.email}),UI.el('small',{text:u.status==='pending'?'รออนุมัติ':u.role==='admin'?'ผู้ดูแลระบบ':u.status==='active'?'ใช้งานได้':'ปิดใช้งาน'})])));
  if(!users.length)container.append(UI.el('p',{class:'muted',text:'ไม่พบผู้ใช้'}));
}
function renderUser(username){
  const u=data.users.find(u=>u.username===username),container=document.getElementById('userEditor');if(!u)return;container.replaceChildren();
  container.append(UI.el('h2',{text:u.displayName}),UI.el('p',{class:'muted',text:u.email}),UI.el('p',{class:'small',text:'ชื่อผู้ใช้: '+u.username}));
  if(u.role==='admin'){container.append(UI.el('p',{class:'message',text:'ผู้ดูแลระบบเข้าถึงบริการที่เปิดใช้งานทั้งหมด'}));return;}
  const mode=UI.el('select',{},[UI.el('option',{value:'selected',text:'เลือกเฉพาะบริการ'}),UI.el('option',{value:'all',text:'ทุกบริการ รวมบริการใหม่ในอนาคต'})]);mode.value=u.access.mode;
  container.append(UI.el('label',{text:'รูปแบบสิทธิ์'},[mode]));
  const checks=UI.el('div',{class:'checks'}), ids=new Set(JSON.parse(u.access.service_ids||'[]'));
  data.services.forEach(s=>checks.append(UI.el('label',{class:'check'},[UI.el('input',{type:'checkbox',value:s.id,checked:ids.has(s.id)}),UI.el('span',{text:s.name+(s.enabled===true?'':' (ปิดใช้งาน)')})])));
  const toggle=()=>{checks.querySelectorAll('input').forEach(c=>c.disabled=mode.value==='all');checks.style.opacity=mode.value==='all'?'.55':'1';};mode.onchange=toggle;toggle();container.append(checks);
  const actions=UI.el('div',{class:'actions'}),button=UI.el('button',{class:'primary',text:u.status==='pending'?'อนุมัติพร้อมกำหนดสิทธิ์':'บันทึกสิทธิ์'});
  button.onclick=()=>UI.busy(button,async()=>{
    const serviceIds=[...checks.querySelectorAll('input:checked')].map(c=>c.value);
    const r=await Auth.call(u.status==='pending'?'approveRequest':'saveAccess',{targetUsername:u.username,mode:mode.value,serviceIds,version:Number(u.access.version)});
    if(!r.success){UI.error(r);return;}
    await refresh();UI.message(r.mailSent===false?'อนุมัติแล้ว แต่ส่งอีเมลไม่สำเร็จ ให้ผู้ใช้กดลืมรหัสผ่านอีกครั้ง':'บันทึกสิทธิ์แล้ว');
  });actions.append(button);
  if(u.status==='pending'){
    const reject=UI.el('button',{class:'danger',text:'ปฏิเสธคำขอ'});reject.onclick=()=>{if(!confirm('ปฏิเสธคำขอของ '+u.displayName+'?'))return;UI.busy(reject,async()=>{const r=await Auth.call('rejectRequest',{targetUsername:u.username});if(r.success){await refresh();UI.message('ปฏิเสธคำขอแล้ว');}else UI.error(r);});};actions.append(reject);
  }
  container.append(actions,UI.el('p',{class:'small muted',text:'การเปลี่ยนสิทธิ์มีผลกับการตรวจครั้งถัดไป ผู้ใช้ต้องมีสิทธิ์จึงจะเปิดบริการได้'}));
}
function renderTable(){const body=document.getElementById('serviceRows');body.replaceChildren();data.services.slice().sort((a,b)=>a.sort_order-b.sort_order).forEach(s=>body.append(UI.el('tr',{},[UI.el('td',{text:s.name}),UI.el('td',{text:s.path}),UI.el('td',{text:s.enabled===true?'เปิดใช้งาน':'ปิดใช้งาน'}),UI.el('td',{text:String(s.sort_order)}),UI.el('td',{},[UI.el('button',{class:'quiet',text:'แก้ไข',onclick:()=>openService(s)})])])));}
async function openService(s){
  form.reset();editingVersion=s?Number(s.version):0;
  document.getElementById('dialogError').hidden=true;document.getElementById('dialogTitle').textContent=s?'แก้ไขบริการ':'เพิ่มบริการ';
  const pathSelect=form.elements.path;pathSelect.replaceChildren(UI.el('option',{value:'',text:'กำลังโหลดรายการไฟล์…'}));
  for(const key of ['id','name','description','icon','sort_order'])form.elements[key].value=s?s[key]:({icon:'folder',sort_order:1}[key]||'');
  form.elements.id.readOnly=!!s;form.elements.enabled.checked=s?s.enabled===true:true;document.getElementById('saveService').disabled=true;dialog.showModal();
  try{
    const r=await fetch('services-manifest.json',{cache:'no-store'});if(!r.ok)throw Error();const m=await r.json();
    if(!Array.isArray(m.files))throw Error();manifest=m.files.filter(p=>typeof p==='string'&&UI.validPath(p));
    pathSelect.replaceChildren(UI.el('option',{value:'',text:'เลือกไฟล์บริการ'}),...manifest.map(p=>UI.el('option',{value:p,text:p})));
    if(s&&!manifest.includes(s.path))pathSelect.append(UI.el('option',{value:s.path,text:s.path+' (ไม่พบในรายการล่าสุด)',disabled:true}));
    if(s)pathSelect.value=s.path;document.getElementById('saveService').disabled=false;
  }catch{document.getElementById('dialogError').textContent='โหลดรายการไฟล์ไม่สำเร็จ กรุณาตรวจ services-manifest.json และลองเปิดใหม่';document.getElementById('dialogError').hidden=false;}
}
form.onsubmit=e=>{e.preventDefault();UI.busy(document.getElementById('saveService'),async()=>{
  const d=Object.fromEntries(new FormData(form));
  if(!manifest.includes(d.path)||!UI.validPath(d.path))return;
  const r=await Auth.call('saveService',{service:{id:d.id,name:d.name,description:d.description,path:d.path,icon:d.icon,enabled:form.elements.enabled.checked,sort_order:Number(d.sort_order),version:editingVersion}});
  if(!r.success){const err=document.getElementById('dialogError');err.textContent=r.error==='CONFLICT'?'ข้อมูลถูกแก้ไขแล้ว ปิดหน้าต่างและโหลดข้อมูลใหม่':'บันทึกไม่สำเร็จ ('+r.error+') กรุณาตรวจข้อมูลหรือโหลดใหม่เพื่อตรวจผล';err.hidden=false;return;}
  dialog.close();await refresh();UI.message('บันทึกบริการแล้ว');
});};
document.getElementById('closeDialog').onclick=()=>dialog.close();document.getElementById('addService').onclick=()=>openService();
document.getElementById('reload').onclick=e=>UI.busy(e.currentTarget,refresh);document.getElementById('logout').onclick=()=>Auth.logout();document.getElementById('userSearch').oninput=renderUsers;
const tabs=['users','services'];function tab(name){tabs.forEach(n=>{const b=document.getElementById(n+'Tab');b.setAttribute('aria-selected',String(n===name));b.tabIndex=n===name?0:-1;document.getElementById(n+'Panel').hidden=n!==name;});}
tabs.forEach(n=>{const b=document.getElementById(n+'Tab');b.onclick=()=>tab(n);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'users':e.key==='End'?'services':n==='users'?'services':'users';tab(next);document.getElementById(next+'Tab').focus();}};});
(async()=>{if(await Auth.requireAuth())await refresh();})();
