// Session storage is a convenience only. The server owns identity and permissions.
const Auth=(()=>{
  let timer,checking=false,loggingOut=false,lastActivity=Date.now(),lastSent=0,challengeId='',activeService='';
  function getDeviceId(){let id=localStorage.getItem('pr_device_id');if(!id){id=crypto.randomUUID();localStorage.setItem('pr_device_id',id);}return id;}
  function getSession(){try{return JSON.parse(sessionStorage.getItem('pr_session'));}catch{return null;}}
  function saveSession(d){sessionStorage.setItem('pr_session',JSON.stringify({token:d.sessionToken,username:d.username,displayName:d.displayName,email:d.email,role:d.role,lastActivity:Date.now()}));}
  async function apiCall(action,data={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
    try{
      const res=await fetch(CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...data,action}),signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'follow'});
      if(!res.ok)return {success:false,error:'NETWORK_ERROR'};
      const result=await res.json();return result&&typeof result.success==='boolean'?result:{success:false,error:'SERVER_ERROR'};
    }catch{return {success:false,error:'NETWORK_ERROR'};}finally{clearTimeout(timeout);}
  }
  function credentials(){return {sessionToken:getSession()?.token};}
  async function call(action,data={}){return apiCall(action,{...data,...credentials()});}
  function updateLastActivity(){if(Date.now()-lastActivity<1000)return;lastActivity=Date.now();const s=getSession();if(s){s.lastActivity=lastActivity;sessionStorage.setItem('pr_session',JSON.stringify(s));}document.getElementById('sessionWarning')?.remove();}
  function block(message){let e=document.getElementById('connectionBlock');if(!e){e=document.createElement('div');e.id='connectionBlock';e.style.cssText='position:fixed;inset:0;z-index:999999;background:#eef3ff;display:grid;place-content:center;padding:24px;text-align:center;font-family:sans-serif';const p=document.createElement('p'),b=document.createElement('button');p.textContent=message;b.textContent='ลองเชื่อมต่อใหม่';b.onclick=()=>location.reload();e.append(p,b);document.body.append(e);}}
  async function logout(reason='manual'){
    if(loggingOut)return;loggingOut=true;clearInterval(timer);
    const token=getSession()?.token;sessionStorage.removeItem('pr_session');
    if(token)void apiCall('logout',{sessionToken:token});
    location.href=CONFIG.PAGES.LOGIN+'?reason='+encodeURIComponent(reason);
  }
  function startGuard(){
    clearInterval(timer);lastActivity=getSession()?.lastActivity||Date.now();
    ['pointerdown','pointermove','keydown','scroll','touchstart'].forEach(evt=>document.addEventListener(evt,updateLastActivity,{passive:true}));
    timer=setInterval(async()=>{
      if(checking)return;
      if(Date.now()-lastActivity>=CONFIG.SESSION_TIMEOUT){logout('timeout');return;}
      if(Date.now()-lastActivity>CONFIG.SESSION_TIMEOUT-120000&&!document.getElementById('sessionWarning')){
        const e=document.createElement('div');e.id='sessionWarning';e.setAttribute('role','status');e.textContent='เซสชันใกล้หมดอายุ กรุณาทำรายการเพื่อต่ออายุ';e.style.cssText='position:fixed;bottom:16px;left:16px;background:#172554;color:white;padding:16px;z-index:99999;border-radius:16px';document.body.append(e);
      }
      checking=true;const active=lastActivity>lastSent;const sentActivity=lastActivity;
      const r=await call('heartbeat',{active});checking=false;
      if(r.success&&r.valid){if(active)lastSent=sentActivity;document.getElementById('connectionBlock')?.remove();if(activeService){const gate=await call('checkService',{serviceId:activeService});if(!gate.success)block('บริการนี้ยังไม่อนุญาตให้เข้าถึง กรุณากลับหน้ารวมบริการหรือติดต่อผู้ดูแล');}}
      else if(['UNAUTHORIZED','SESSION_EXPIRED'].includes(r.error))logout('invalid');
      else block('ยังตรวจสอบสิทธิ์ไม่ได้ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
    },CONFIG.HEARTBEAT_INTERVAL);
  }
  async function requireAuth(){
    const s=getSession();if(!s?.token){location.replace(CONFIG.PAGES.LOGIN+'?reason=noauth');return false;}
    if(Date.now()-s.lastActivity>=CONFIG.SESSION_TIMEOUT){logout('timeout');return false;}
    const r=await call('checkSession');
    if(!r.success||!r.valid){if(['UNAUTHORIZED','SESSION_EXPIRED'].includes(r.error))logout('invalid');else block('ยังตรวจสอบสิทธิ์ไม่ได้ กรุณาลองใหม่');return false;}
    sessionStorage.setItem('pr_session',JSON.stringify({...s,...r.user}));startGuard();return true;
  }
  async function requireService(id){if(!await requireAuth())return false;const r=await call('checkService',{serviceId:id});if(!r.success){block(r.error==='FORBIDDEN'?'คุณไม่มีสิทธิ์ใช้บริการนี้ กรุณาติดต่อผู้ดูแล':'ยังตรวจสอบสิทธิ์ไม่ได้');return false;}activeService=id;return true;}
  async function login(username,password){const r=await apiCall('login',{username,password,deviceId:getDeviceId()});if(r.success)challengeId=r.challengeId;return r;}
  async function verifyOTP(username,otp){const r=await apiCall('verifyOTP',{username,otp,challengeId,deviceId:getDeviceId()});if(r.success){saveSession(r);startGuard();}return r;}
  async function resendOTP(username){const r=await apiCall('resendOTP',{username,challengeId,deviceId:getDeviceId()});if(r.success)challengeId=r.challengeId;return r;}
  return {getDeviceId,getSession,apiCall,call,login,verifyOTP,resendOTP,logout,requireAuth,requireService,updateLastActivity,
    requestAccess:data=>apiCall('requestAccess',data),checkStatus:email=>apiCall('checkStatus',{email})};
})();
