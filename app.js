import { VALUES } from './data.js';

/* ═══════════════ Constants & state ═══════════════ */

const CATS = {
  very:   { label: 'Very important',  order: 0 },
  imp:    { label: 'Important',       order: 1 },
  unsure: { label: 'Unsure',          order: 2 },
  not:    { label: 'Not important',   order: 3 },
};
const SWIPE_DIR = { right: 'very', up: 'imp', left: 'not', down: 'unsure' };
const STORE_KEY = 'values-card-sort/v1';

let store = load();
let screen = 'welcome';
let reviewReturnsToSort = false;
let reportSnapshot = null; // non-null when viewing an archived sort

function freshSort() {
  const order = VALUES.map(v => v.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    startedAt: new Date().toISOString(),
    completedAt: null,
    order,
    index: 0,
    choices: {},
    notes: {},
    custom: [],
    top: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupted state falls through to fresh */ }
  return { v: 1, current: null, archive: [] };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
  catch { toast('Could not save — storage unavailable'); }
}

function cardById(id, sort = store.current) {
  return VALUES.find(v => v.id === id) || sort?.custom.find(c => c.id === id) || null;
}
function deckSize(sort = store.current) { return sort.order.length; }
function isComplete(sort = store.current) { return !!sort && sort.index >= deckSize(sort); }

/* ═══════════════ DOM helpers ═══════════════ */

const $ = sel => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function confirmDialog(title, text, okLabel = 'Yes') {
  return new Promise(resolve => {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-ok').textContent = okLabel;
    const dlg = $('#dlg-confirm');
    dlg.onclose = () => resolve(dlg.returnValue === 'ok');
    dlg.showModal();
  });
}

/* ═══════════════ Router ═══════════════ */

function show(name) {
  screen = name;
  for (const v of document.querySelectorAll('.view')) v.hidden = true;
  $(`#view-${name}`).hidden = false;
  window.scrollTo(0, 0);
  if (name === 'welcome') renderWelcome();
  if (name === 'sort') renderSort(true);
  if (name === 'review') renderReview();
  if (name === 'report') renderReport();
}

/* ═══════════════ Welcome ═══════════════ */

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderWelcome() {
  const cur = store.current;
  const btnStart = $('#btn-start'), btnCont = $('#btn-continue'),
        btnReview = $('#btn-review-current'), btnRestart = $('#btn-restart');
  btnCont.hidden = btnReview.hidden = btnRestart.hidden = true;
  btnStart.hidden = false;
  if (cur && !isComplete(cur)) {
    btnCont.textContent = `Continue sorting — ${cur.index} of ${deckSize(cur)} done`;
    btnCont.hidden = false;
    btnStart.hidden = true;
    btnRestart.hidden = false;
    if (cur.index > 0) btnReview.hidden = false;
  } else if (cur && isComplete(cur)) {
    btnCont.textContent = 'See my piles & report';
    btnCont.hidden = false;
    btnStart.hidden = true;
    btnRestart.hidden = false;
  }
  const past = $('#past-sorts');
  const list = $('#past-sorts-list');
  list.textContent = '';
  past.hidden = store.archive.length === 0;
  for (let i = store.archive.length - 1; i >= 0; i--) {
    const s = store.archive[i];
    const li = el('li');
    const b = el('button');
    b.append(el('span', 'past-date', fmtDate(s.completedAt || s.startedAt)));
    const names = (s.top.length ? s.top : s.order.filter(id => s.choices[id] === 'very'))
      .slice(0, 4).map(id => cardById(id, s)?.name).filter(Boolean).join(' · ');
    b.append(el('span', 'past-preview', names || '—'));
    b.addEventListener('click', () => { reportSnapshot = s; show('report'); });
    li.append(b);
    list.append(li);
  }
}

$('#btn-start').addEventListener('click', () => {
  store.current = freshSort();
  save();
  show('sort');
});
$('#btn-continue').addEventListener('click', () => {
  reportSnapshot = null;
  if (isComplete()) { reviewReturnsToSort = false; show('review'); }
  else show('sort');
});
$('#btn-review-current').addEventListener('click', () => { reviewReturnsToSort = true; show('review'); });
$('#btn-restart').addEventListener('click', async () => {
  const done = isComplete();
  const ok = await confirmDialog(
    'Start a new sort?',
    done ? 'Your current sort will be saved under “Past sorts”.'
         : 'Your unfinished sort will be discarded — it isn’t complete, so it won’t be archived.',
    done ? 'Save & start new' : 'Discard & start new');
  if (!ok) return;
  if (done) store.archive.push(store.current);
  store.current = freshSort();
  save();
  show('sort');
});

/* ═══════════════ Sort screen ═══════════════ */

const activeCard = $('#active-card');
let dragState = null;
let animating = false;

function currentCard() {
  const cur = store.current;
  return cur && cur.index < deckSize(cur) ? cardById(cur.order[cur.index]) : null;
}

function renderSort(enter = false) {
  const cur = store.current;
  if (!cur) { show('welcome'); return; }
  if (isComplete(cur)) { finishSort(); return; }
  const card = currentCard();
  const n = deckSize(cur);
  $('#progress-fill').style.width = `${(cur.index / n) * 100}%`;
  $('#progress-text').textContent = `${cur.index + 1} of ${n}`;
  $('#btn-undo').disabled = cur.index === 0;
  $('#card-number').textContent = String(card.id).startsWith('x') ? 'yours' : `№ ${card.id}`;
  $('#card-word').textContent = card.name;
  $('#card-blurb').textContent = card.blurb;
  const noteBtn = $('#btn-card-note');
  const note = cur.notes[card.id];
  $('#card-note-label').textContent = note ? note : 'Add a thought';
  noteBtn.classList.toggle('has-note', !!note);
  activeCard.style.transform = '';
  activeCard.style.opacity = '';
  activeCard.classList.remove('flying', 'settling', 'dragging', 'skipping');
  setStamp(null);
  if (enter) {
    activeCard.classList.remove('entering');
    void activeCard.offsetWidth;
    activeCard.classList.add('entering');
  }
  const ghost1 = $('.card-ghost-1'), ghost2 = $('.card-ghost-2');
  ghost1.style.visibility = cur.index + 1 < n ? '' : 'hidden';
  ghost2.style.visibility = cur.index + 2 < n ? '' : 'hidden';
}

function setStamp(cat) {
  const stamp = $('#card-stamp');
  for (const z of document.querySelectorAll('.zone-hint')) z.classList.toggle('hot', !!cat && z.dataset.zone === cat);
  if (!cat) { stamp.classList.remove('on'); return; }
  stamp.dataset.cat = cat;
  stamp.textContent = CATS[cat].label;
  stamp.classList.add('on');
}

function assign(cat, flyVector) {
  if (animating || !currentCard()) return;
  animating = true;
  const cur = store.current;
  cur.choices[cur.order[cur.index]] = cat;
  cur.index++;
  save();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const done = () => {
    animating = false;
    if (isComplete()) finishSort();
    else renderSort(true);
  };
  if (reduced) { done(); return; }
  setStamp(cat);
  const [dx, dy] = flyVector;
  activeCard.classList.remove('dragging', 'settling');
  activeCard.classList.add('flying');
  const rot = dx === 0 ? 0 : (dx > 0 ? 18 : -18);
  activeCard.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
  setTimeout(done, 230);
}

const FLY = { very: [520, -40], not: [-520, -40], imp: [0, -640], unsure: [0, 640] };

for (const btn of document.querySelectorAll('.pilebtn')) {
  btn.addEventListener('click', () => assign(btn.dataset.cat, FLY[btn.dataset.cat]));
}

$('#btn-skip').addEventListener('click', skipCard);
function skipCard() {
  const cur = store.current;
  if (animating || !currentCard()) return;
  if (cur.index >= cur.order.length - 1) {
    toast('This is the last card — nowhere left to skip to');
    return;
  }
  const [id] = cur.order.splice(cur.index, 1);
  cur.order.push(id);
  save();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { renderSort(true); return; }
  animating = true;
  activeCard.classList.remove('dragging', 'settling', 'entering');
  activeCard.classList.add('skipping');
  setTimeout(() => { animating = false; renderSort(true); }, 240);
}

$('#btn-undo').addEventListener('click', () => {
  const cur = store.current;
  if (animating || !cur || cur.index === 0) return;
  cur.index--;
  delete cur.choices[cur.order[cur.index]];
  save();
  renderSort(true);
});

$('#btn-sort-back').addEventListener('click', () => show('welcome'));
$('#btn-piles').addEventListener('click', () => { reviewReturnsToSort = true; show('review'); });

/* Keyboard support (external keyboards happen on iPads) */
document.addEventListener('keydown', e => {
  if (screen !== 'sort' || document.querySelector('dialog[open]')) return;
  const map = { ArrowRight: 'very', ArrowUp: 'imp', ArrowLeft: 'not', ArrowDown: 'unsure' };
  if (map[e.key]) { e.preventDefault(); assign(map[e.key], FLY[map[e.key]]); }
  if (e.key === 's') { e.preventDefault(); skipCard(); }
  if (e.key === 'z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#btn-undo').click(); }
});

/* Drag gesture */
activeCard.addEventListener('pointerdown', e => {
  if (animating || e.target.closest('button')) return;
  activeCard.setPointerCapture(e.pointerId);
  dragState = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
  activeCard.classList.remove('settling', 'entering');
  activeCard.classList.add('dragging');
});
activeCard.addEventListener('pointermove', e => {
  if (!dragState) return;
  dragState.dx = e.clientX - dragState.x0;
  dragState.dy = e.clientY - dragState.y0;
  const { dx, dy } = dragState;
  activeCard.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`;
  setStamp(dirOf(dx, dy));
});
function dirOf(dx, dy) {
  const TH = 80;
  if (Math.hypot(dx, dy) < TH) return null;
  return Math.abs(dx) > Math.abs(dy) ? SWIPE_DIR[dx > 0 ? 'right' : 'left'] : SWIPE_DIR[dy > 0 ? 'down' : 'up'];
}
function endDrag() {
  if (!dragState) return;
  const { dx, dy } = dragState;
  dragState = null;
  activeCard.classList.remove('dragging');
  const cat = dirOf(dx, dy);
  if (cat) {
    const scale = 900 / Math.max(1, Math.hypot(dx, dy));
    assign(cat, [dx * scale, dy * scale]);
  } else {
    setStamp(null);
    activeCard.classList.add('settling');
    activeCard.style.transform = '';
  }
}
activeCard.addEventListener('pointerup', endDrag);
activeCard.addEventListener('pointercancel', endDrag);

function finishSort() {
  const cur = store.current;
  if (!cur.completedAt) {
    cur.completedAt = new Date().toISOString();
    save();
    toast('All 83 sorted ✦ nice work');
  }
  reviewReturnsToSort = false;
  show('review');
}

/* Note during sort */
$('#btn-card-note').addEventListener('click', () => {
  const card = currentCard();
  if (card) openNote(card);
});
function openNote(card) {
  $('#note-title').textContent = card.name;
  $('#note-blurb').textContent = card.blurb;
  const ta = $('#note-text');
  ta.value = store.current.notes[card.id] || '';
  const dlg = $('#dlg-note');
  dlg.onclose = () => {
    if (dlg.returnValue !== 'save') return;
    const v = ta.value.trim();
    if (v) store.current.notes[card.id] = v;
    else delete store.current.notes[card.id];
    save();
    if (screen === 'sort') renderSort(false);
  };
  dlg.showModal();
}

/* ═══════════════ Add your own value ═══════════════ */

function openAdd() {
  $('#add-name').value = '';
  $('#add-blurb').value = '';
  const dlg = $('#dlg-add');
  dlg.onclose = () => {
    if (dlg.returnValue !== 'save') return;
    const name = $('#add-name').value.trim();
    if (!name) { toast('The card needs a name'); return; }
    const blurb = $('#add-blurb').value.trim() || '—';
    const cur = store.current;
    const id = 'x' + (cur.custom.length + 1) + '-' + Math.random().toString(36).slice(2, 6);
    cur.custom.push({ id, name, blurb });
    if (isComplete(cur)) {
      cur.choices[id] = 'very';
      cur.order.push(id);
      cur.index = cur.order.length;
      save();
      renderReview();
      openDetail(id);
    } else {
      cur.order.push(id);
      save();
      if (screen === 'sort') renderSort(false);
      toast(`“${name}” added to the deck`);
    }
  };
  dlg.showModal();
}
$('#btn-add-value').addEventListener('click', openAdd);
$('#btn-review-add').addEventListener('click', openAdd);

/* ═══════════════ Review ═══════════════ */

function renderReview() {
  const cur = store.current;
  if (!cur) { show('welcome'); return; }
  $('#review-hint').hidden = Object.keys(cur.choices).length === 0;

  // Core values shortlist
  cur.top = cur.top.filter(id => cur.choices[id]);
  const topWrap = $('#top-values');
  const topList = $('#top-list');
  topList.textContent = '';
  topWrap.hidden = cur.top.length === 0;
  cur.top.forEach(id => {
    const card = cardById(id);
    const li = el('li', 'top-item');
    li.dataset.id = id;
    li.append(el('span', 'top-item-name', card.name));
    const handle = el('span', 'top-item-handle', '☰');
    handle.addEventListener('pointerdown', e => startReorder(e, li));
    li.append(handle);
    li.addEventListener('click', e => { if (!e.target.closest('.top-item-handle')) openDetail(id); });
    topList.append(li);
  });

  // Piles
  const wrap = $('#pile-columns');
  wrap.textContent = '';
  for (const [key, meta] of Object.entries(CATS)) {
    const ids = cur.order.filter(id => cur.choices[id] === key);
    const col = el('section', 'pile-col');
    col.dataset.cat = key;
    const head = el('div', 'pile-col-head');
    head.append(el('h2', 'pile-col-title', meta.label));
    head.append(el('span', 'pile-col-count', String(ids.length)));
    col.append(head);
    const cardsWrap = el('div', 'pile-cards');
    if (!ids.length) cardsWrap.append(el('p', 'pile-empty', 'nothing here yet'));
    for (const id of ids) {
      const card = cardById(id);
      const chip = el('button', 'pile-chip');
      chip.append(el('span', 'pile-chip-name', card.name));
      const icons = el('span', 'pile-chip-icons');
      if (cur.top.includes(id)) icons.append(el('span', 'pile-chip-star', '★'));
      if (cur.notes[id]) icons.append(el('span', null, '✎'));
      chip.append(icons);
      chip.addEventListener('click', () => openDetail(id));
      cardsWrap.append(chip);
    }
    col.append(cardsWrap);
    wrap.append(col);
  }
}

/* Drag-to-rank for the shortlist */
function startReorder(e, li) {
  e.preventDefault();
  const list = $('#top-list');
  li.classList.add('drag-active');
  li.setPointerCapture(e.pointerId);
  let baseY = e.clientY;
  const onMove = ev => {
    li.style.transform = `translateY(${ev.clientY - baseY}px)`;
    const rect = li.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    for (const other of list.children) {
      if (other === li) continue;
      const r = other.getBoundingClientRect();
      if (mid > r.top && mid < r.bottom) {
        if (mid < r.top + r.height / 2) list.insertBefore(li, other);
        else list.insertBefore(li, other.nextSibling);
        baseY = ev.clientY; // rebase so the row keeps tracking the finger after the swap
        li.style.transform = '';
        return;
      }
    }
  };
  const onUp = () => {
    li.classList.remove('drag-active');
    li.style.transform = '';
    li.removeEventListener('pointermove', onMove);
    li.removeEventListener('pointerup', onUp);
    li.removeEventListener('pointercancel', onUp);
    store.current.top = [...list.children].map(n => n.dataset.id).map(x => (isNaN(+x) ? x : +x));
    save();
    renderReview();
  };
  li.addEventListener('pointermove', onMove);
  li.addEventListener('pointerup', onUp);
  li.addEventListener('pointercancel', onUp);
}

/* Detail dialog */
function openDetail(id) {
  const cur = store.current;
  const card = cardById(id);
  if (!card) return;
  $('#detail-title').textContent = card.name;
  $('#detail-blurb').textContent = card.blurb;
  const star = $('#detail-star');
  let starred = cur.top.includes(id);
  star.classList.toggle('on', starred);
  star.onclick = () => { starred = !starred; star.classList.toggle('on', starred); };
  let chosen = cur.choices[id];
  const seg = $('#detail-cats');
  seg.textContent = '';
  for (const [key, meta] of Object.entries(CATS)) {
    const opt = el('button', 'seg-opt', meta.label);
    opt.type = 'button';
    opt.dataset.cat = key;
    opt.setAttribute('role', 'radio');
    opt.setAttribute('aria-checked', String(key === chosen));
    opt.addEventListener('click', () => {
      chosen = key;
      for (const o of seg.children) o.setAttribute('aria-checked', String(o.dataset.cat === key));
    });
    seg.append(opt);
  }
  const ta = $('#detail-note');
  ta.value = cur.notes[id] || '';
  const del = $('#detail-delete');
  del.hidden = !String(id).startsWith('x');
  del.onclick = async () => {
    const ok = await confirmDialog('Remove this card?', `“${card.name}” is a card you added; removing it deletes its note too.`, 'Remove');
    if (!ok) return;
    cur.custom = cur.custom.filter(c => c.id !== id);
    cur.order = cur.order.filter(x => x !== id);
    delete cur.choices[id];
    delete cur.notes[id];
    cur.top = cur.top.filter(x => x !== id);
    if (cur.index > cur.order.length) cur.index = cur.order.length;
    save();
    $('#dlg-detail').close('deleted');
    renderReview();
  };
  const dlg = $('#dlg-detail');
  dlg.onclose = () => {
    if (dlg.returnValue !== 'save') return;
    if (chosen) cur.choices[id] = chosen;
    const v = ta.value.trim();
    if (v) cur.notes[id] = v;
    else delete cur.notes[id];
    cur.top = cur.top.filter(x => x !== id);
    if (starred) cur.top.push(id);
    save();
    renderReview();
  };
  dlg.showModal();
}

$('#btn-review-back').addEventListener('click', () => {
  if (reviewReturnsToSort && !isComplete()) show('sort');
  else show('welcome');
});
$('#btn-to-report').addEventListener('click', () => { reportSnapshot = null; show('report'); });

/* ═══════════════ Report ═══════════════ */

function reportData() {
  return reportSnapshot || store.current;
}

function renderReport() {
  const s = reportData();
  if (!s) { show('welcome'); return; }
  const doc = $('#report-doc');
  doc.textContent = '';
  doc.append(el('h1', 'report-title', 'Personal Values Card Sort'));
  const progressNote = s.completedAt ? '' : ` · in progress, ${s.index} of ${s.order.length} sorted`;
  doc.append(el('p', 'report-date', (s.completedAt ? 'Completed ' : 'Started ') + fmtDate(s.completedAt || s.startedAt) + progressNote));

  const addSection = (catKey, title, ids, ranked = false) => {
    if (!ids.length) return;
    const sec = el('section', 'report-section');
    sec.dataset.cat = catKey;
    sec.append(el('h2', 'report-section-title', title));
    const ul = el('ol', 'report-list');
    ids.forEach((id, i) => {
      const card = cardById(id, s);
      if (!card) return;
      const li = el('li', 'report-item');
      const line = el('div', 'report-item-line');
      if (ranked) line.append(el('span', 'report-rank', `${i + 1}.`));
      line.append(el('span', 'report-item-name', card.name));
      line.append(el('span', 'report-item-blurb', card.blurb));
      li.append(line);
      if (s.notes[id]) li.append(el('p', 'report-item-note', s.notes[id]));
      ul.append(li);
    });
    sec.append(ul);
    doc.append(sec);
  };

  if (s.top.length) addSection('top', '★ Core values — ranked', s.top, true);
  for (const [key, meta] of Object.entries(CATS)) {
    const ids = s.order.filter(id => s.choices[id] === key && !s.top.includes(id));
    const all = s.order.filter(id => s.choices[id] === key);
    addSection(key, `${meta.label} (${all.length})`, ids);
  }
  doc.append(el('p', 'report-foot',
    'Made with the Personal Values Card Sort (Miller, C’de Baca, Matthews & Wilbourne, University of New Mexico, 2001 — public domain). Sorted into: very important / important / not important / unsure.'));
}

function reportText() {
  const s = reportData();
  const lines = ['PERSONAL VALUES CARD SORT',
    (s.completedAt ? 'Completed ' : 'Started ') + fmtDate(s.completedAt || s.startedAt)
      + (s.completedAt ? '' : ` (in progress, ${s.index} of ${s.order.length} sorted)`), ''];
  const block = (title, ids, ranked) => {
    if (!ids.length) return;
    lines.push(title.toUpperCase());
    ids.forEach((id, i) => {
      const card = cardById(id, s);
      if (!card) return;
      lines.push(`${ranked ? `${i + 1}. ` : '• '}${card.name} — ${card.blurb}`);
      if (s.notes[id]) lines.push(`  note: ${s.notes[id]}`);
    });
    lines.push('');
  };
  if (s.top.length) block('★ Core values (ranked)', s.top, true);
  for (const [key, meta] of Object.entries(CATS)) {
    block(meta.label, s.order.filter(id => s.choices[id] === key && !s.top.includes(id)), false);
  }
  return lines.join('\n');
}

$('#btn-report-back').addEventListener('click', () => {
  if (reportSnapshot) { reportSnapshot = null; show('welcome'); }
  else show('review');
});
$('#btn-share').addEventListener('click', async () => {
  const text = reportText();
  const file = new File([text], 'values-card-sort.txt', { type: 'text/plain' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Values Card Sort' });
    } else if (navigator.share) {
      await navigator.share({ title: 'Values Card Sort', text });
    } else {
      await navigator.clipboard.writeText(text);
      toast('Sharing unavailable — copied to clipboard instead');
    }
  } catch (err) {
    if (err?.name !== 'AbortError') toast('Could not share — try Copy text');
  }
});
$('#btn-print').addEventListener('click', () => {
  try { window.print(); }
  catch { toast('Printing unavailable here — open the app in Safari to print'); }
});
$('#btn-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(reportText()); toast('Copied — paste it anywhere'); }
  catch { toast('Copy failed'); }
});
$('#btn-backup').addEventListener('click', async () => {
  const json = JSON.stringify(store, null, 2);
  const file = new File([json], 'values-backup.json', { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Values backup' });
      return;
    }
  } catch (err) { if (err?.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'values-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ═══════════════ Backup import ═══════════════ */

$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || data.v !== 1 || !('current' in data) || !Array.isArray(data.archive)) throw new Error('bad shape');
    const ok = await confirmDialog('Restore backup?', 'This replaces everything currently in the app with the backup’s contents.', 'Restore');
    if (!ok) return;
    store = data;
    save();
    renderWelcome();
    toast('Backup restored');
  } catch {
    toast('That file doesn’t look like a values backup');
  }
});

/* ═══════════════ Boot ═══════════════ */

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
show('welcome');
