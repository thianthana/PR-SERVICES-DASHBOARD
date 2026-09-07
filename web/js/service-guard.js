// Add this before other scripts in every new service HTML. Client guard is UX only.
// Every real data endpoint MUST call requireService_(body, 'service-id') on the server.
(()=>{
  document.documentElement.style.visibility='hidden';
  async function run(){
    if(!await Auth.requireAuth()) {document.documentElement.style.visibility='visible';return;}
    const configured=document.querySelector('meta[name="portal-service-path"]')?.content;
    const path=configured||decodeURIComponent(location.pathname.slice(new URL('../',guardURL).pathname.length));
    const r=await Auth.call('checkServicePath',{path});
    if(!r.success){document.body.replaceChildren(UI.el('main',{class:'panel',text:r.error==='FORBIDDEN'?'คุณไม่มีสิทธิ์ใช้บริการนี้':'ยังตรวจสอบสิทธิ์ไม่ได้'},[UI.el('a',{href:new URL('../dashboard.html',guardURL).href,text:'กลับหน้ารวมบริการ',class:'button'})]));}
    document.documentElement.style.visibility='visible';
    if(r.success){document.dispatchEvent(new Event('portal:authorized'));setInterval(async()=>{const r=await Auth.call('checkServicePath',{path});if(!r.success){document.body.textContent='สิทธิ์เปลี่ยนแปลงหรือเชื่อมต่อไม่ได้ กรุณากลับหน้ารวมบริการ';}},30000);}
  }
  const guardURL=document.currentScript.src;
  window.addEventListener('DOMContentLoaded',()=>run().catch(()=>{document.body.textContent='ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาโหลดหน้าใหม่';document.documentElement.style.visibility='visible';}),{once:true});
})();
