const $ = id => document.getElementById(id);
let notes = [], selected = null, dirty = false;
let refreshSequence = 0;
function feedback(message) { $("feedback").textContent = message; }
function counts() { $("word-count").textContent = `${$("editor").value.trim().split(/\s+/).filter(Boolean).length} words`; }
function links() {
  $("note-links").replaceChildren();
  for (const match of $("editor").value.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)) {
    const button = document.createElement("button"); button.textContent = `↗ ${match[1]}`;
    button.onclick = () => { const note = notes.find(n => n.path.replace(/\.md$/, "") === match[1] || n.path.split("/").pop().replace(/\.md$/, "") === match[1]); if (note) open(note); else feedback("Note not found"); };
    $("note-links").append(button);
  }
}
function renderList() {
  $("note-list").replaceChildren();
  $("note-count").textContent = notes.length;
  const query = $("search").value.toLowerCase();
  for (const note of notes.filter(n => (n.path + n.content).toLowerCase().includes(query))) {
    const button = document.createElement("button"); button.className = "note-item" + (selected?.path === note.path ? " active" : "");
    button.textContent = `◇  ${note.path.split("/").pop().replace(/\.md$/, "")}`;
    if (note.path.includes("/")) { const folder = document.createElement("small"); folder.textContent = note.path.slice(0, note.path.lastIndexOf("/")); button.append(folder); }
    button.onclick = () => open(note); $("note-list").append(button);
  }
}
function open(note, force = false) {
  if (dirty && !force && !confirm("Discard your unsaved draft?")) return;
  selected = { ...note }; dirty = false;
  $("note-path").value = note.path; $("note-path").disabled = true;
  $("editor").value = note.content; $("editor").disabled = false;
  $("breadcrumb").textContent = note.path.includes("/") ? note.path.slice(0, note.path.lastIndexOf("/")) : "Notes";
  $("save-state").textContent = note.revision ? "Saved" : "Unsaved";
  $("save-note").disabled = Boolean(note.revision);
  counts(); links(); renderList();
}
async function refresh() {
  const sequence = ++refreshSequence;
  const response = await fetch("/notes"); if (!response.ok) throw Error("Could not refresh notes");
  const data = await response.json(); if (sequence !== refreshSequence) return;
  notes = data.notes;
  if (selected) {
    const latest = notes.find(n => n.path === selected.path);
    if (latest && latest.revision !== selected.revision) {
      if (dirty) { $("save-state").textContent = "Updated by Petal · draft kept"; feedback("Petal updated this note. Your draft is safe; reload and merge before saving."); }
      else open(latest, true);
    }
  } else if (notes.length) open(notes[0], true);
  renderList();
}
$("search").oninput = renderList;
$("editor").oninput = () => { dirty = true; $("save-note").disabled = false; $("save-state").textContent = "Unsaved"; counts(); links(); };
$("new-note").onclick = () => {
  if (dirty && !confirm("Discard your unsaved draft?")) return;
  const path = prompt("Note path", "Ideas/Untitled.md");
  if (!path) return;
  const existing = notes.find(n => n.path === path); if (existing) { open(existing, true); return; }
  open({ path: path.endsWith(".md") ? path : path + ".md", content: "", revision: null }, true);
  dirty = true; $("save-note").disabled = false; $("editor").focus();
};
$("save-note").onclick = async () => {
  if (!selected) return;
  const path = selected.path, content = $("editor").value, revision = selected.revision;
  $("save-note").disabled = true;
  try {
    const response = await fetch("/note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, content, revision }) });
    const data = await response.json(); if (!response.ok) throw Error(data.error);
    if (selected?.path === path) {
      selected.revision = data.revision;
      if ($("editor").value === content) open(data, true);
      else { dirty = true; $("save-note").disabled = false; }
    }
    feedback(`Saved · ${data.path}`); await refresh();
  } catch (error) { feedback(error.message); $("save-state").textContent = "Draft preserved · save needs attention"; $("save-note").disabled = false; }
};
window.addEventListener("vault-changed", () => refresh().catch(error => feedback(error.message)));
window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
refresh().catch(error => feedback(error.message));
