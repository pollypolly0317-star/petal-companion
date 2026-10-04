import {isShowcase} from './runtime.js';
import {t, getLanguage, applyLanguage, storage} from './i18n.js';
const $ = id => document.getElementById(id);
let mood = 'fried', joke = -1, sample = 'mood', pat = 0, speech = 'inbox', busy = false;
let quiet = storage.get('quiet', false);
function bubble(key) { speech = key; $('buddy-speech').textContent = t(key); }
function renderSample() {
  $('sample-user').textContent = t(sample === 'mood' ? mood + 'User' : sample + 'User');
  $('sample-reply').textContent = t(sample === 'mood' ? mood + 'Reply' : sample === 'joke' ? 'joke' + joke : 'focusReply');
}
function view(name) {
  $('home-view').hidden = name !== 'home'; $('notes-view').hidden = name !== 'notes';
  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === name);
    if (el.dataset.view === name) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
}
function goTry(focus = false) {
  view('home'); $('experience').scrollIntoView({behavior:'smooth',block:'start'});
  if (focus) { sample = 'focus'; renderSample(); $('focus-task').focus({preventScroll:true}); }
}
document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => {view(el.dataset.view);window.scrollTo({top:0,behavior:'smooth'});});
document.querySelectorAll('[data-action=try]').forEach(el => el.onclick = () => goTry());
document.querySelectorAll('[data-action=focus]').forEach(el => el.onclick = () => goTry(true));
$('locale-toggle').onclick = () => applyLanguage(getLanguage() === 'en' ? 'zh-CN' : 'en');
document.querySelectorAll('[data-mood]').forEach(el => el.onclick = () => {
  mood = el.dataset.mood; sample = 'mood'; renderSample();
  document.querySelectorAll('[data-mood]').forEach(button => button.setAttribute('aria-pressed',button === el));
  bubble(mood === 'okay' ? 'pat1' : 'pat3');
});
$('pet-buddy').onclick = () => {
  bubble('pat' + (pat++ % 3 + 1));
  $('hero-pet').classList.remove('patted'); document.querySelector('.hero').classList.remove('patting');
  requestAnimationFrame(() => requestAnimationFrame(() => {$('hero-pet').classList.add('patted');document.querySelector('.hero').classList.add('patting');}));
};
$('recharge').onclick = () => {sample='joke';joke=(joke+1)%3;renderSample();bubble('pat2');};
function renderQuiet() {document.body.dataset.quiet=String(quiet);$('quiet-mode').setAttribute('aria-pressed',quiet);}
$('quiet-mode').onclick = () => {quiet=!quiet;storage.set('quiet',quiet);renderQuiet();$('feedback').textContent=t(quiet?'quietOn':'quietOff');window.dispatchEvent(new Event('petal-quiet'));};
renderQuiet();

const DURATION = 25 * 60 * 1000;
let timer = storage.get('focus:v1', {remaining:DURATION,deadline:null,task:''});
if (!timer || typeof timer.remaining !== 'number' || timer.remaining < 0 || timer.remaining > DURATION || (timer.deadline !== null && !Number.isFinite(timer.deadline))) timer = {remaining:DURATION,deadline:null,task:''};
$('focus-task').value = typeof timer.task === 'string' ? timer.task.slice(0,160) : '';
function persistTimer() {storage.set('focus:v1',timer);}
function renderTimer() {
  const remaining = timer.deadline ? Math.max(0,timer.deadline-Date.now()) : timer.remaining;
  if (timer.deadline && remaining === 0) {timer.deadline=null;timer.remaining=0;persistTimer();}
  const seconds = Math.ceil(remaining/1000);
  $('timer-display').textContent = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
  $('focus-toggle').querySelector('span').textContent = t(timer.deadline?'pauseFocus':remaining===0?'againFocus':remaining<DURATION?'resumeFocus':'startFocus');
  const icon=$('focus-toggle').querySelector('use'), href='./assets/icons.svg#'+(timer.deadline?'Pause':'Play');
  if(icon.getAttribute('href')!==href)icon.setAttribute('href',href);
  $('focus-message').textContent = t(timer.deadline?'focusRunning':remaining===0?'focusDone':remaining<DURATION?'focusPaused':'calmerYou');
}
$('focus-toggle').onclick = () => {
  if (timer.deadline) {timer.remaining=Math.max(0,timer.deadline-Date.now());timer.deadline=null;}
  else {if(timer.remaining===0)timer.remaining=DURATION;timer.deadline=Date.now()+timer.remaining;}
  persistTimer();renderTimer();
};
$('focus-reset').onclick = () => {timer.remaining=DURATION;timer.deadline=null;persistTimer();renderTimer();};
$('focus-task').oninput = () => {timer.task=$('focus-task').value;persistTimer();};
setInterval(renderTimer,1000);renderTimer();

let breathStart=null, breathElapsed=0, breathInterval=null;
function renderBreath() {
  const elapsed=breathStart===null?breathElapsed:Math.min(60,(Date.now()-breathStart)/1000);
  const running=breathStart!==null, phase=elapsed%10<4?'inhale':'exhale';
  $('breathing-circle').className='breathing-circle'+(running?' '+phase:'');
  $('breathing-phase').textContent=t(elapsed>=60?'breathDone':running?phase:'breathReady');
  $('breathing-count').textContent=elapsed>=60?t('breathComplete'):running?t('breathSeconds',{n:Math.ceil(60-elapsed)}):t('breathMinute');
  $('breathing-progress').value=elapsed;
  $('breathing-toggle').textContent=t(running?'stopBreath':'startBreath');
  if(elapsed>=60 && running){breathElapsed=60;breathStart=null;clearInterval(breathInterval);renderBreath();}
}
function stopBreath() {breathStart=null;breathElapsed=0;clearInterval(breathInterval);renderBreath();}
$('open-breathing').onclick=()=>{stopBreath();$('breathing-dialog').showModal();};
$('breathing-toggle').onclick=()=>{
  if(breathStart!==null){stopBreath();return;}
  breathElapsed=0;breathStart=Date.now();renderBreath();breathInterval=setInterval(renderBreath,200);
};
$('breathing-dialog').addEventListener('close',stopBreath);
document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>$(el.dataset.close).close());
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{
  if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}
}));
document.querySelectorAll('[data-action=video]').forEach(el=>el.onclick=()=>{$('video-dialog').showModal();$('demo-video').play().catch(()=>{});});
$('video-dialog').addEventListener('close',()=>$('demo-video').pause());
$('open-family').onclick=()=>$('family-dialog').showModal();

window.petalReadiness={audio_ready:false,chat_ready:false};
function readinessText() {if(isShowcase)return t('showcaseVoice');const r=window.petalReadiness;return t(!r.chat_ready?(r.audio_ready?'modelsAudioOnly':'modelsOffline'):r.audio_ready?'modelsReady':'modelsChatOnly');}
async function refreshStatus() {
  if(isShowcase){$('status').textContent=t('showcaseVoice');$('local-app-link').hidden=false;$('chat-input').disabled=true;$('send-message').disabled=true;return;}
  try {const res=await fetch('/companion-status');if(!res.ok)throw Error();window.petalReadiness=await res.json();}
  catch {window.petalReadiness={audio_ready:false,chat_ready:false};}
  if(!busy&&!window.petalVoiceActive)$('status').textContent=readinessText();
  window.dispatchEvent(new Event('petal-readiness'));
}
$('open-chat').onclick=()=>{$('chat-dialog').showModal();refreshStatus();};
setInterval(()=>{if($('chat-dialog').open)refreshStatus();},20000);
refreshStatus();
function addMessage(role,text) {
  const entry=document.createElement('div');entry.className=role==='user'?'user-message':'';
  const label=document.createElement('small');label.textContent=role==='user'?t('you'):'PETAL';
  const content=document.createElement('span');content.textContent=text;entry.append(label,content);$('conversation').append(entry);entry.scrollIntoView({block:'nearest'});return entry;
}
$('chat-form').onsubmit=async event=>{
  event.preventDefault();const text=$('chat-input').value.trim();if(!text||busy||window.petalVoiceActive)return;
  if(!window.petalReadiness.chat_ready){$('status').textContent=readinessText();refreshStatus();return;}
  busy=true;window.petalChatBusy=true;$('send-message').disabled=true;$('start').disabled=true;$('chat-input').value='';addMessage('user',text);$('status').textContent=t('thinking');
  try {
    const response=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    const data=await response.json();if(!response.ok)throw Error(data.error||'localError');
    addMessage('assistant',data.response);if(data.tools?.length)window.dispatchEvent(new Event('vault-changed'));$('status').textContent=readinessText();
  } catch {$('status').textContent=t('chatError');if(!$('chat-input').value)$('chat-input').value=text;}
  finally {busy=false;window.petalChatBusy=false;$('send-message').disabled=false;window.dispatchEvent(new Event('petal-readiness'));}
};
$('chat-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('chat-form').requestSubmit();}});
window.addEventListener('petal-language',()=>{renderSample();bubble(speech);renderTimer();renderBreath();if(!busy&&!window.petalVoiceActive)$('status').textContent=readinessText();});
renderSample();bubble(speech);renderBreath();
