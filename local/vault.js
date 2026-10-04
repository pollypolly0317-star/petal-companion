import {listNotes,saveNote} from './runtime.js';
import {t,getLanguage} from './i18n.js';
const $=id=>document.getElementById(id);
let notes=[],selected=null,dirty=false,refreshSequence=0,saving=false;
function feedback(message){$('feedback').textContent=message;}
function counts(){const text=$('editor').value.trim();$('word-count').textContent=t('words',{n:getLanguage()==='zh-CN'?[...text].length:text.split(/\s+/).filter(Boolean).length});}
function links(){
  $('note-links').replaceChildren();
  for(const match of $('editor').value.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)){
    const button=document.createElement('button');button.textContent='↗ '+match[1];
    button.onclick=()=>{const note=notes.find(n=>n.path.replace(/\.md$/,'')===match[1]||n.path.split('/').pop().replace(/\.md$/,'')===match[1]);if(note)open(note);else feedback(t('noteMissing'));};$('note-links').append(button);
  }
}
function renderList(){
  $('note-list').replaceChildren();$('note-count').textContent=notes.length;
  const query=$('search').value.toLowerCase(),filtered=notes.filter(n=>(n.path+n.content).toLowerCase().includes(query));
  for(const note of filtered){
    const button=document.createElement('button');button.className='note-item'+(selected?.path===note.path?' active':'');button.textContent=note.path.split('/').pop().replace(/\.md$/,'');
    if(note.path.includes('/')){const folder=document.createElement('small');folder.textContent=note.path.slice(0,note.path.lastIndexOf('/'));button.append(folder);}
    button.onclick=()=>open(note);$('note-list').append(button);
  }
  if(!filtered.length){const empty=document.createElement('p');empty.className='list-empty';empty.textContent=t(query?'noMatches':'noNotes');$('note-list').append(empty);}
}
function open(note,force=false){
  if(dirty&&!force&&!confirm(t('discard')))return;
  selected={...note};dirty=false;$('note-empty').hidden=true;$('note-editor-shell').hidden=false;
  $('note-path').value=note.path;$('editor').value=note.content;$('editor').disabled=false;
  $('breadcrumb').textContent=note.path.includes('/')?note.path.slice(0,note.path.lastIndexOf('/')):t('littleNotes');
  $('save-state').textContent=t(note.revision?'saved':'unsaved');$('save-note').disabled=Boolean(note.revision);counts();links();renderList();
}
async function refresh(){
  const sequence=++refreshSequence;
  const data=await listNotes();if(sequence!==refreshSequence)return;notes=data.notes;
  if(selected){const latest=notes.find(n=>n.path===selected.path);if(latest&&latest.revision!==selected.revision){if(dirty){$('save-state').textContent=t('draftKept');feedback(t('conflict'));}else open(latest,true);}}
  else if(notes.length)open(notes[0],true);renderList();
}
$('search').oninput=renderList;
$('editor').oninput=()=>{dirty=true;$('save-note').disabled=saving;$('save-state').textContent=t('unsaved');counts();links();};
function newNote(){
  if(dirty&&!confirm(t('discard')))return;
  $('new-note-path').value='';$('new-note-error').textContent='';$('new-note-dialog').showModal();
}
$('new-note').onclick=newNote;$('new-note-empty').onclick=newNote;
$('new-note-form').onsubmit=event=>{
  event.preventDefault();let path=$('new-note-path').value.trim();
  if(!path||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\\:*?"<>|]/.test(path)){$('new-note-error').textContent=t('noteInvalid');return;}
  if(!path.endsWith('.md'))path+='.md';
  if(notes.some(n=>n.path===path)){$('new-note-error').textContent=t('noteExists');return;}
  $('new-note-dialog').close();open({path,content:'',revision:null},true);dirty=true;$('save-note').disabled=false;$('editor').focus();
};
$('save-note').onclick=async()=>{
  if(!selected||saving)return;const path=selected.path,content=$('editor').value,revision=selected.revision;
  saving=true;$('save-note').disabled=true;$('save-state').textContent=t('saving');
  try{
    const data=await saveNote({path,content,revision});
    if(selected?.path===path){selected.revision=data.revision;if($('editor').value===content)open(data,true);else{dirty=true;$('save-note').disabled=false;$('save-state').textContent=t('unsaved');}}
    feedback(t('savedPath',{path:data.path}));await refresh();
  }catch(error){feedback(error.conflict?t('conflict'):error.message);$('save-state').textContent=t('draftKept');$('save-note').disabled=false;}
  finally{saving=false;if(dirty)$('save-note').disabled=false;}
};
window.addEventListener('vault-changed',()=>refresh().catch(error=>feedback(error.message)));
window.addEventListener('petal-language',()=>{renderList();counts();if(selected){$('save-state').textContent=t(dirty?'unsaved':'saved');if(!selected.path.includes('/'))$('breadcrumb').textContent=t('littleNotes');}});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
refresh().catch(error=>feedback(error.message));

window.addEventListener('storage',event=>{if(event.key==='petal:showcase-notes:v1')refresh().catch(error=>feedback(error.message));});
