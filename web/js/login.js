let currentUsername='';
function view(name){['login','otp','forgot','reset','register'].forEach(v=>document.getElementById(v+'View').hidden=v!==name);UI.message('');document.querySelector('#'+name+'View input')?.focus();}
function fields(form){return Object.fromEntries(new FormData(form));}
function submit(id,fn){const f=document.getElementById(id);f.onsubmit=e=>{e.preventDefault();UI.busy(f.querySelector('[type=submit]'),()=>fn(f,fields(f)));};}
document.getElementById('forgotLink').onclick=()=>view('forgot');
document.getElementById('registerLink').onclick=()=>view('register');
document.getElementById('statusLink').onclick=()=>UI.message('หลังอนุมัติ ระบบจะส่งอีเมลพร้อมวิธีตั้งรหัสผ่าน หากยังไม่ได้รับ กรุณาติดต่อผู้ดูแลระบบ');
document.getElementById('haveCode').onclick=()=>{const email=document.querySelector('#forgotForm [name=email]').value;view('reset');document.querySelector('#resetForm [name=email]').value=email;};
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>view('login'));
submit('loginForm',async(f,d)=>{const r=await Auth.login(d.username,d.password);f.elements.password.value='';if(!r.success){UI.error(r);return;}currentUsername=d.username;view('otp');document.getElementById('otpInfo').textContent='ส่งอีเมลไปที่ '+r.maskedEmail;});
submit('otpForm',async(f,d)=>{const r=await Auth.verifyOTP(currentUsername,d.otp);if(!r.success){UI.error(r);return;}location.replace(CONFIG.PAGES.DASHBOARD);});
document.getElementById('resend').onclick=e=>UI.busy(e.currentTarget,async()=>{const r=await Auth.resendOTP(currentUsername);if(r.success)UI.message('ส่งรหัสใหม่แล้ว กรุณาเปิดไฟล์แนบฉบับล่าสุด');else UI.error(r);});
submit('forgotForm',async(f,d)=>{const r=await Auth.apiCall('forgotPassword',d);if(!r.success){UI.error(r);return;}view('reset');document.querySelector('#resetForm [name=email]').value=d.email;UI.message(r.message);});
submit('resetForm',async(f,d)=>{if(d.newPassword!==d.confirmPassword){UI.message('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน',true);return;}const r=await Auth.apiCall('resetPassword',{email:d.email,temporaryPassword:d.temporaryPassword,newPassword:d.newPassword});if(!r.success){UI.error(r);return;}f.reset();sessionStorage.removeItem('pr_session');view('login');UI.message('ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบใหม่ เซสชันเดิมถูกยกเลิกแล้ว');});
submit('registerForm',async(f,d)=>{const r=await Auth.requestAccess(d);if(!r.success){UI.error(r);return;}f.reset();view('login');UI.message('รับคำขอแล้ว หากผ่านการอนุมัติจะได้รับอีเมลสำหรับตั้งรหัสผ่าน ชื่อผู้ใช้สำหรับบัญชีใหม่คืออีเมลเต็ม');});
const reason=new URLSearchParams(location.search).get('reason');
if(reason&&reason!=='manual')UI.message('กรุณาเข้าสู่ระบบอีกครั้งเพื่อยืนยันตัวตน');
if(location.hash==='#reset')view('forgot');
