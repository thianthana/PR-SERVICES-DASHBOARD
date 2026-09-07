// PR Portal 3.0 — replace the original Apps Script code; add Crypto.gs too.
// Configure Script Properties, then run migratePortal(). Never put secrets in Git.
const PORTAL_SCHEMA = {
  Users: ['username','password_hash','salt','email','role','display_name','status','position','purpose','created_at'],
  Sessions: ['username','session_token','device_id','created_at','last_active'],
  Services: ['id','name','description','path','icon','enabled','sort_order','version'],
  Access: ['username','mode','service_ids','version'],
  Challenges: ['username','kind','digest','expires','attempts','device','challenge_id','sent_at'],
  RateLimits: ['key','until','count'],
  Audit: ['time','actor','action','target']
};
const GENERIC_RESET = {success:true,message:'หากข้อมูลตรงกับบัญชีที่ใช้งานได้ ระบบจะส่งอีเมลให้ กรุณาตรวจกล่องจดหมายและสแปม'};
function prop_(key) { return PropertiesService.getScriptProperties().getProperty(key); }
function secret_() { const s=prop_('PORTAL_SECRET'); if(!/^[a-f0-9]{64,}$/i.test(s||'')) throw Error('SETUP_REQUIRED'); return s; }
function db_() { const id=prop_('SPREADSHEET_ID'); if(!id) throw Error('SETUP_REQUIRED'); return SpreadsheetApp.openById(id); }
function sheet_(name) { const s=db_().getSheetByName(name); if(!s) throw Error('SETUP_REQUIRED'); return s; }
function rows_(name) {
  const v=sheet_(name).getDataRange().getValues(), h=v[0];
  return v.slice(1).map((r,i)=>Object.assign({_row:i+2},...h.map((k,j)=>({[k]:r[j]})))).filter(r=>r[h[0]]!=='');
}
function text_(v,max) { if(typeof v!=='string'||v.length>(max||200)) throw Error('INVALID_INPUT'); return v.trim(); }
function lower_(v) { return text_(v).toLowerCase(); }
function email_(v) { const e=lower_(v); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw Error('INVALID_INPUT'); return e; }
function safeCell_(v) { return typeof v==='string'&&/^[=+@\-]/.test(v)?"'"+v:v; }
function put_(name, obj) {
  const s=sheet_(name), headers=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  const old=obj._row?s.getRange(obj._row,1,1,headers.length).getValues()[0]:[];
  const values=headers.map((k,i)=>safeCell_(obj[k]===undefined?(old[i]===undefined?'':old[i]):obj[k]));
  s.getRange(obj._row||s.getLastRow()+1,1,1,headers.length).setValues([values]);
}
function remove_(name,predicate) { rows_(name).filter(predicate).sort((a,b)=>b._row-a._row).forEach(r=>sheet_(name).deleteRow(r._row)); }
function audit_(actor,action,target) { put_('Audit',{time:new Date(),actor,action,target}); }
function digest_(value) { return Utilities.computeHmacSha256Signature(String(value),secret_()).map(b=>(b&255).toString(16).padStart(2,'0')).join(''); }
function token_(purpose) {
  const p=PropertiesService.getScriptProperties(), n=Number(p.getProperty('TOKEN_COUNTER')||0)+1;
  p.setProperty('TOKEN_COUNTER',String(n));
  return digest_(purpose+'|'+n+'|'+Date.now()+'|'+Utilities.getUuid());
}
function equal_(a,b) { a=String(a);b=String(b);let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0; }
function pbkdf_(password,salt,iterations) {
  const bytes=[]; for(let i=0;i<salt.length;i+=2)bytes.push(parseInt(salt.slice(i,i+2),16));
  const h=()=>PortalCrypto.hmac(PortalCrypto.sha256,password);
  let u=h().update(bytes.concat([0,0,0,1])).digest(), result=u.slice();
  for(let i=1;i<iterations;i++){u=h().update(u).digest();for(let j=0;j<32;j++)result[j]^=u[j];}
  return result.map(b=>b.toString(16).padStart(2,'0')).join('');
}
function newPassword_(password) {
  if(typeof password!=='string'||password.length<15||password.length>128)throw Error('PASSWORD_POLICY');
  const salt=token_('salt').slice(0,32);
  return {salt,password_hash:'pbkdf2-sha256$600000$'+digest_(pbkdf_(password,salt,600000))};
}
function verifyPassword_(password,user) {
  if(typeof password!=='string'||password.length>128)return false;
  if(String(user.password_hash).startsWith('pbkdf2-sha256$600000$'))return equal_(user.password_hash.split('$')[2],digest_(pbkdf_(password,user.salt,600000)));
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,password+user.salt).map(b=>(b&255).toString(16).padStart(2,'0')).join('');
  return equal_(hash,user.password_hash); // Legacy passwords require reset before a new session is issued.
}
function rate_(key,max,minutes) {
  const now=Date.now(); let r=rows_('RateLimits').find(r=>r.key===key);
  if(r&&new Date(r.until).getTime()>now&&Number(r.count)>=max)return false;
  if(!r||new Date(r.until).getTime()<=now)r=Object.assign(r||{},{key,until:new Date(now+minutes*60000),count:0});
  r.count=Number(r.count)+1;put_('RateLimits',r);return true;
}
function user_(name) { return rows_('Users').find(u=>String(u.username).toLowerCase()===String(name).toLowerCase()); }
function active_(u) { return u&&u.status==='active'; }
function publicUser_(u) { return {username:u.username,displayName:u.display_name||u.username,email:u.email,role:u.role,status:u.status}; }
function session_(body,touch) {
  if(typeof body.sessionToken!=='string'||body.sessionToken.length!==64)throw Error('UNAUTHORIZED');
  const s=rows_('Sessions').find(s=>equal_(s.session_token,digest_(body.sessionToken)));
  if(!s)throw Error('UNAUTHORIZED');
  const u=user_(s.username), now=Date.now();
  if(!active_(u)||!Number.isFinite(new Date(s.last_active).getTime())||!Number.isFinite(new Date(s.created_at).getTime())||now-new Date(s.last_active).getTime()>=15*60000||now-new Date(s.created_at).getTime()>=8*3600000){remove_('Sessions',r=>r.username===s.username);throw Error('SESSION_EXPIRED');}
  if(touch===true){s.last_active=new Date();put_('Sessions',s);}
  return u;
}
function admin_(b) { const u=session_(b,false);if(u.role!=='admin')throw Error('FORBIDDEN');return u; }
function access_(u) { const a=rows_('Access').find(a=>a.username===u.username);return a||{username:u.username,mode:'selected',service_ids:'[]',version:0}; }
function allowed_(u,s) { if(s.enabled!==true&&s.enabled!=='true')return false;if(u.role==='admin')return true;const a=access_(u);return a.mode==='all'||JSON.parse(a.service_ids||'[]').includes(s.id); }
function requireService_(body,id) { const u=session_(body,false),s=rows_('Services').find(s=>s.id===id);if(!s||!allowed_(u,s))throw Error('FORBIDDEN');return {user:u,service:s}; }
function sendCode_(u,code,kind,minutes) {
  if(MailApp.getRemainingDailyQuota()<1)throw Error('MAIL_UNAVAILABLE');
  const label=kind==='reset'?'รหัสผ่านชั่วคราวสำหรับตั้งรหัสใหม่':'รหัสยืนยันการเข้าสู่ระบบ';
  // No secret in subject, body, preheader, filename or HTML. Attachments can still be previewed by some clients.
  MailApp.sendEmail({to:u.email,subject:'PR Portal — คำขอยืนยันบัญชี',
    body:'มีคำขอยืนยันบัญชี PR Portal ของคุณ\nเปิดไฟล์แนบเพื่อดู '+label+' ซึ่งมีอายุ '+minutes+' นาที\nหากไม่ได้ทำรายการ โปรดละเว้นอีเมลนี้และติดต่อผู้ดูแล\nอย่าส่งต่อไฟล์แนบ และตั้งค่ามือถือให้ซ่อนเนื้อหาการแจ้งเตือน',
    attachments:[Utilities.newBlob(label+'\n\n'+code+'\n\nใช้ได้ครั้งเดียว ภายใน '+minutes+' นาที\nชื่อผู้ใช้: '+u.username,'text/plain','PR-Portal-access.txt')]});
}
function issue_(u,kind,device) {
  const code=kind==='reset'?'P!'+token_('reset').slice(0,24)+'a9':String(parseInt(token_('otp').slice(0,12),16)%1000000).padStart(6,'0');
  const minutes=kind==='reset'?15:5, challengeId=token_('challenge');
  // Keep old challenge if delivery fails. New one is stored only after send succeeds.
  try{sendCode_(u,code,kind,minutes);}catch(e){throw Error('MAIL_UNAVAILABLE');}
  remove_('Challenges',c=>c.username===u.username&&c.kind===kind);
  put_('Challenges',{username:u.username,kind,digest:digest_(code),expires:new Date(Date.now()+minutes*60000),attempts:0,device:device||'',challenge_id:digest_(challengeId),sent_at:new Date()});
  return challengeId;
}
function challenge_(u,kind,code,device,id) {
  const c=rows_('Challenges').find(c=>c.username===u.username&&c.kind===kind);
  if(!c||!Number.isFinite(new Date(c.expires).getTime())||new Date(c.expires).getTime()<=Date.now()||Number(c.attempts)>=5)throw Error('CODE_INVALID');
  if(kind==='otp'&&(!equal_(c.device,device||'')||!equal_(c.challenge_id,digest_(id||''))))throw Error('CODE_INVALID');
  c.attempts=Number(c.attempts)+1;put_('Challenges',c);
  if(!equal_(c.digest,digest_(code||'')))throw Error('CODE_INVALID');
  return c;
}
function login_(b) {
  const name=lower_(b.username),device=text_(b.deviceId,100);
  if(!rate_('login:'+name,5,30))throw Error('ACCOUNT_LOCKED');
  const u=user_(name);if(!active_(u)||!verifyPassword_(b.password,u))throw Error('INVALID_CREDENTIALS');
  if(!String(u.password_hash).startsWith('pbkdf2-sha256$'))throw Error('PASSWORD_RESET_REQUIRED');
  if(!rate_('otp-mail:'+name,3,15))throw Error('RATE_LIMITED');
  const challengeId=issue_(u,'otp',device);
  return {success:true,step:'OTP_REQUIRED',challengeId,maskedEmail:String(u.email).replace(/^(.).*(@.*)$/,'$1***$2'),displayName:u.display_name};
}
function verifyOTP_(b) {
  const u=user_(lower_(b.username));if(!active_(u))throw Error('CODE_INVALID');
  challenge_(u,'otp',text_(b.otp,6),text_(b.deviceId,100),text_(b.challengeId,64));
  remove_('Challenges',c=>c.username===u.username&&c.kind==='otp');
  remove_('RateLimits',r=>r.key==='login:'+String(u.username).toLowerCase());
  remove_('Sessions',s=>s.username===u.username);
  const token=token_('session');put_('Sessions',{username:u.username,session_token:digest_(token),device_id:b.deviceId,created_at:new Date(),last_active:new Date()});
  audit_(u.username,'login','self');
  return Object.assign({success:true,sessionToken:token},publicUser_(u));
}
function resend_(b) {
  const u=user_(lower_(b.username));if(!active_(u))throw Error('CODE_INVALID');
  const c=rows_('Challenges').find(c=>c.username===u.username&&c.kind==='otp');
  if(!c||!equal_(c.device,b.deviceId)||!equal_(c.challenge_id,digest_(b.challengeId||'')))throw Error('CODE_INVALID');
  if(Date.now()-new Date(c.sent_at).getTime()<60000||!rate_('otp-mail:'+String(u.username).toLowerCase(),3,15))throw Error('RATE_LIMITED');
  return {success:true,challengeId:issue_(u,'otp',b.deviceId)};
}
function forgot_(b) {
  const email=email_(b.email);
  if(!rate_('reset:'+email,3,60)||!rate_('reset-global',30,60))return GENERIC_RESET;
  const u=rows_('Users').find(u=>String(u.email).toLowerCase()===email);
  if(active_(u)){try{issue_(u,'reset','');audit_(u.username,'reset-request','self');}catch(e){audit_('system','reset-mail-failed',u.username);}}
  return GENERIC_RESET;
}
function reset_(b) {
  const email=email_(b.email);
  if(!rate_('reset-check:'+email,10,30))throw Error('RATE_LIMITED');
  const u=rows_('Users').find(u=>String(u.email).toLowerCase()===email);if(!active_(u))throw Error('CODE_INVALID');
  challenge_(u,'reset',text_(b.temporaryPassword,100));
  if(b.newPassword===b.temporaryPassword)throw Error('PASSWORD_POLICY');
  const fresh=newPassword_(b.newPassword);
  // Consume reset before writing password: failure cannot permit token reuse.
  remove_('Challenges',c=>c.username===u.username);
  remove_('Sessions',s=>s.username===u.username);
  put_('Users',Object.assign(u,fresh));
  remove_('RateLimits',r=>r.key==='login:'+String(u.username).toLowerCase());
  audit_(u.username,'password-reset','self');
  return {success:true};
}
function saveService_(b) {
  const actor=admin_(b),d=b.service||{},id=text_(d.id,50),path=text_(d.path,160);
  if(!/^[a-z][a-z0-9-]{1,49}$/.test(id)||!validPath_(path))throw Error('INVALID_INPUT');
  if(!['media','survey','document','calendar','payment','support','folder','chart'].includes(d.icon))throw Error('INVALID_INPUT');
  if(typeof d.enabled!=='boolean'||!Number.isInteger(d.sort_order)||Math.abs(d.sort_order)>10000)throw Error('INVALID_INPUT');
  const list=rows_('Services'), old=list.find(s=>s.id===id);
  if(Number(d.version)!==Number(old?old.version:0))throw Error('CONFLICT');
  if(list.some(s=>s.path===path&&s.id!==id))throw Error('DUPLICATE_PATH');
  const name=text_(d.name,80);if(!name)throw Error('INVALID_INPUT');
  put_('Services',{_row:old&&old._row,id,name,description:text_(d.description,180),path,icon:d.icon,enabled:d.enabled,sort_order:d.sort_order,version:Number(old?old.version:0)+1});
  audit_(actor.username,'save-service',id);return {success:true};
}
function validPath_(p) { return /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.html$/.test(p)&&!/(^|\/)(index|login|dashboard|admin|reset-password)\.html$/i.test(p); }
function saveAccess_(b) {
  const actor=admin_(b),u=user_(text_(b.targetUsername));if(!u)throw Error('NOT_FOUND');
  if(u.role==='admin')throw Error('ADMIN_ALWAYS_ALL');
  const a=access_(u);if(Number(b.version)!==Number(a.version))throw Error('CONFLICT');
  if(!['all','selected'].includes(b.mode)||!Array.isArray(b.serviceIds)||b.serviceIds.length>200)throw Error('INVALID_INPUT');
  const ids=rows_('Services').map(s=>s.id);if(b.serviceIds.some(id=>!ids.includes(id)))throw Error('INVALID_INPUT');
  put_('Access',{_row:a._row,username:u.username,mode:b.mode,service_ids:JSON.stringify([...new Set(b.serviceIds)]),version:Number(a.version)+1});
  audit_(actor.username,'save-access',u.username);return {success:true};
}
function requestAccess_(b) {
  const email=email_(b.email), fullName=text_(b.fullName,100),position=text_(b.position,100),purpose=text_(b.purpose||'',300);
  if(!fullName||!position)throw Error('INVALID_INPUT');
  if(!rate_('register-global',20,60))throw Error('RATE_LIMITED');
  if(!rows_('Users').some(u=>String(u.email).toLowerCase()===email||u.username===email)){
    put_('Users',{username:email,password_hash:'!pending',salt:'',email,role:'user',display_name:fullName,status:'pending',position,purpose,created_at:new Date()});
  }
  return {success:true};
}
function approve_(b,reject) {
  const actor=admin_(b),u=user_(text_(b.targetUsername));if(!u||u.status!=='pending')throw Error('CONFLICT');
  // Apply selected grants first; fail closed on partial failure.
  if(!reject)saveAccess_(Object.assign({},b,{mode:b.mode||'selected',serviceIds:b.serviceIds||[],version:b.version||0}));
  u.status=reject?'disabled':'active';put_('Users',u);audit_(actor.username,reject?'reject':'approve',u.username);
  let mailSent=true;if(!reject){try{issue_(u,'reset','');}catch(e){mailSent=false;}}
  return {success:true,mailSent};
}
function route_(b) {
  switch(b.action){
    case 'login':return login_(b);
    case 'verifyOTP':return verifyOTP_(b);
    case 'resendOTP':return resend_(b);
    case 'forgotPassword':return forgot_(b);
    case 'resetPassword':return reset_(b);
    case 'checkSession':case 'heartbeat':{const u=session_(b,b.action==='heartbeat'&&b.active===true);return {success:true,valid:true,user:publicUser_(u)};}
    case 'logout':{const u=session_(b,false);remove_('Sessions',s=>s.username===u.username);return {success:true};}
    case 'getPortal':{const u=session_(b,false);return {success:true,user:publicUser_(u),services:rows_('Services').filter(s=>allowed_(u,s)).sort((a,b)=>a.sort_order-b.sort_order).map(s=>{const {_row,...v}=s;return v;})};}
    case 'checkService':{const r=requireService_(b,text_(b.serviceId,50));return {success:true,path:r.service.path};}
    case 'checkServicePath':{const u=session_(b,false),s=rows_('Services').find(s=>s.path===text_(b.path,160));if(!s||!allowed_(u,s))throw Error('FORBIDDEN');return {success:true};}
    case 'adminData':{admin_(b);return {success:true,users:rows_('Users').map(u=>Object.assign(publicUser_(u),{position:u.position,access:access_(u)})),services:rows_('Services')};}
    case 'saveService':return saveService_(b);
    case 'saveAccess':return saveAccess_(b);
    case 'approveRequest':return approve_(b,false);
    case 'rejectRequest':return approve_(b,true);
    case 'requestAccess':return requestAccess_(b);
    case 'checkStatus':return {success:true,found:false,message:'กรุณาตรวจอีเมลสำหรับผลการอนุมัติ หรือติดต่อผู้ดูแลระบบ'};
    default:throw Error('INVALID_ACTION');
  }
}
function doPost(e) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return json_({success:false,error:'BUSY'});
  try{
    secret_();const raw=e&&e.postData&&e.postData.contents;if(!raw||raw.length>20000)throw Error('INVALID_INPUT');
    const b=JSON.parse(raw);if(!b||Array.isArray(b)||typeof b!=='object')throw Error('INVALID_INPUT');
    return json_(route_(b));
  }catch(e){
    const safe=['SETUP_REQUIRED','INVALID_INPUT','UNAUTHORIZED','SESSION_EXPIRED','FORBIDDEN','PASSWORD_POLICY','PASSWORD_RESET_REQUIRED','CODE_INVALID','ACCOUNT_LOCKED','INVALID_CREDENTIALS','RATE_LIMITED','MAIL_UNAVAILABLE','CONFLICT','DUPLICATE_PATH','ADMIN_ALWAYS_ALL','NOT_FOUND','INVALID_ACTION'];
    return json_({success:false,error:safe.includes(e.message)?e.message:'SERVER_ERROR'});
  }finally{lock.releaseLock();}
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function doGet(){return json_({status:'PR Portal API',version:'3.0'});}
function migratePortal() {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    secret_();const ss=db_();
    Object.keys(PORTAL_SCHEMA).forEach(name=>{
      let s=ss.getSheetByName(name);if(!s)s=ss.insertSheet(name);
      if(s.getLastRow()===0)s.appendRow(PORTAL_SCHEMA[name]);
      const existing=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
      if(PORTAL_SCHEMA[name].some(h=>!existing.includes(h)))throw Error('Header mismatch: '+name);
    });
    const seenNames=new Set(),seenEmails=new Set();
    rows_('Users').forEach(u=>{const name=String(u.username).toLowerCase(),email=String(u.email).toLowerCase();if(!name||!email||seenNames.has(name)||seenEmails.has(email))throw Error('Duplicate/empty username or email: fix Users before migration');seenNames.add(name);seenEmails.add(email);});
    if(rows_('Services').length===0){
      put_('Services',{id:'media',name:'งานสื่อประชาสัมพันธ์',description:'จัดการสื่อและติดตามงานประชาสัมพันธ์',path:'service-media.html',icon:'media',enabled:true,sort_order:1,version:1});
      put_('Services',{id:'survey',name:'ระบบแบบสอบถาม',description:'สร้างแบบสอบถามและดูผลตอบรับ',path:'service-survey.html',icon:'survey',enabled:true,sort_order:2,version:1});
    }
    // Existing users start with no grants, except admins. Never grant future services implicitly.
    rows_('Users').forEach(u=>{if(!rows_('Access').some(a=>a.username===u.username))put_('Access',{username:u.username,mode:'selected',service_ids:'[]',version:1});});
    // Revoke old raw-token sessions/OTP only on first migration.
    if(prop_('PORTAL_SCHEMA_VERSION')!=='3'){
      remove_('Sessions',()=>true);const old=ss.getSheetByName('OTP');if(old&&old.getLastRow()>1)old.getRange(2,1,old.getLastRow()-1,old.getLastColumn()).clearContent();
      PropertiesService.getScriptProperties().setProperty('PORTAL_SCHEMA_VERSION','3');
    }
  }finally{lock.releaseLock();}
}
function cleanupPortal(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);try{
    remove_('Challenges',r=>new Date(r.expires).getTime()<Date.now());
    remove_('RateLimits',r=>new Date(r.until).getTime()<Date.now());
    remove_('Sessions',r=>Date.now()-new Date(r.last_active).getTime()>15*60000);
    remove_('Audit',r=>Date.now()-new Date(r.time).getTime()>90*86400000);
  }finally{lock.releaseLock();}
}
