export const isShowcase = document.querySelector('meta[name="petal-mode"]')?.content === 'showcase';
const NOTES_KEY='petal:showcase-notes:v1';
function browserNotes(){return JSON.parse(localStorage.getItem(NOTES_KEY)||'[]');}
export async function listNotes(){
  if(isShowcase)return {notes:browserNotes().sort((a,b)=>a.path.localeCompare(b.path))};
  const response=await fetch('/notes');if(!response.ok)throw Error('Could not load notes.');return response.json();
}
export async function saveNote(note){
  if(isShowcase){
    const notes=browserNotes(),index=notes.findIndex(n=>n.path===note.path),previous=notes[index];
    if((previous?.revision??null)!==note.revision){const error=Error('This note changed in another tab. Copy your draft before reloading.');error.conflict=true;throw error;}
    const result={path:note.path,content:note.content,revision:crypto.randomUUID()};
    if(index<0)notes.push(result);else notes[index]=result;
    localStorage.setItem(NOTES_KEY,JSON.stringify(notes));return result;
  }
  const response=await fetch('/note',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(note)});
  const data=await response.json();if(!response.ok){const error=Error(data.error);error.conflict=response.status===409;throw error;}return data;
}
