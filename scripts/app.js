import { initFirebase, signInAndSync } from './firebaseConfig.js'

/*
  Simplified single-file app behavior.
  - Time-of-day theming with manual override
  - Sample schedule preloaded
  - Timeline rendering, add/edit/delete blocks
  - Now indicator and current block highlight
  - Tasks for the current block, top-3 priorities and notes
  - Autosave to localStorage and simple cloud placeholder
*/

const STORAGE_KEY = 'mood-prod-v1'

const defaultState = {
  settings: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    manualMode: false,
    forcedMode: null, // 'morning'|'afternoon'|'evening'|'night'
  },
  schedule: [
    {id: id(), name: 'Sleep', start: '00:00', end: '04:30', category: 'Sleep'},
    {id: id(), name: 'Productivity', start: '05:00', end: '06:00', category: 'Productivity'},
    {id: id(), name: 'School', start: '06:00', end: '15:00', category: 'School'},
    {id: id(), name: 'Gym', start: '15:00', end: '16:00', category: 'Gym'},
    {id: id(), name: 'Homework', start: '16:00', end: '18:00', category: 'Homework'},
    {id: id(), name: 'Robotics', start: '18:00', end: '20:00', category: 'Robotics'},
    {id: id(), name: 'ECs or Studying', start: '20:00', end: '23:00', category: 'ECs'},
  ],
  tasks: {}, // blockId -> [{id,text,done}]
  priorities: ['Focus on key task','Deep work','Plan tomorrow'],
  notes: '',
  progress: {completedTasks:0, focusMinutes:0, blocksCompleted:0}
}

let state = loadState()

// DOM refs
const timelineEl = document.getElementById('timeline')
const addBlockBtn = document.getElementById('addBlockBtn')
const modeLabel = document.getElementById('modeLabel')
const manualToggle = document.getElementById('manualModeToggle')
const modeBody = document.body
const startFocusBtn = document.getElementById('startFocusBtn')
const currentBlockName = document.getElementById('currentBlockName')
const currentBlockTime = document.getElementById('currentBlockTime')
const countdownEl = document.getElementById('countdown')
const tasksListEl = document.getElementById('tasksList')
const addTaskBtn = document.getElementById('addTaskBtn')
const newTaskInput = document.getElementById('newTaskInput')
const prioritiesList = document.getElementById('prioritiesList')
const dayNotes = document.getElementById('dayNotes')
const syncBtn = document.getElementById('syncBtn')

// Setup
initFirebase()
renderAll()
setupIntervals()

// Event listeners
addBlockBtn.addEventListener('click', onAddBlock)
manualToggle.checked = state.settings.manualMode
manualToggle.addEventListener('change', (e)=>{
  state.settings.manualMode = e.target.checked
  if(!e.target.checked) state.settings.forcedMode = null
  saveState()
  renderMode()
})

syncBtn.addEventListener('click', async()=>{
  await signInAndSync()
})

addTaskBtn.addEventListener('click', ()=>{
  const txt = newTaskInput.value.trim(); if(!txt) return;
  const cb = getCurrentBlock()
  if(!cb){
    // create an Inbox bucket for unassigned tasks
    const inboxId = 'inbox'
    state.tasks[inboxId] = state.tasks[inboxId] || []
    state.tasks[inboxId].push({id:id(), text: txt, done:false})
    saveState(); renderTasks(); updateProgressCounts()
    newTaskInput.value = ''
    // brief hint to user
    const hint = document.getElementById('contextHint')
    if(hint) hint.innerHTML = `<span class="pill">Inbox</span> <strong>Task saved to Inbox</strong>`
    return
  }
  addTask(cb.id, txt)
  newTaskInput.value = ''
})

dayNotes.addEventListener('input', ()=>{ state.notes = dayNotes.value; saveState() })

// Priority edits are contenteditable; save on blur
prioritiesList.addEventListener('blur', (e)=>{
  const items = Array.from(prioritiesList.querySelectorAll('[data-priority-index]')).map(li=>li.textContent.trim())
  state.priorities = items
  saveState()
}, true)

function renderAll(){
  renderMode()
  renderTimeline()
  renderCurrentBlock()
  renderTasks()
  renderPriorities()
  dayNotes.value = state.notes || ''
  renderContextHint()
}

function renderMode(){
  const mode = getMode()
  modeLabel.textContent = mode[0].toUpperCase() + mode.slice(1)
  document.body.setAttribute('data-mode', mode)
}

function getMode(){
  if(state.settings.manualMode && state.settings.forcedMode) return state.settings.forcedMode
  const now = new Date()
  const h = now.getHours(); const m = now.getMinutes(); const mins = h*60 + m
  // Morning 5:00 - 11:59
  if(mins >= 5*60 && mins <= 11*60+59) return 'morning'
  // Afternoon 12:00 - 16:59
  if(mins >= 12*60 && mins <= 16*60+59) return 'afternoon'
  // Evening 17:00 - 20:59
  if(mins >= 17*60 && mins <= 20*60+59) return 'evening'
  // Night else
  return 'night'
}

function renderTimeline(){
  timelineEl.innerHTML = ''
  state.schedule.forEach(block=>{
    const el = document.createElement('div')
    el.className = 'block'
    el.dataset.id = block.id
    el.dataset.category = block.category
    el.innerHTML = `
      <div class="block-head"><strong>${escapeHtml(block.name)}</strong>
        <div class="meta">${block.start} → ${block.end} • ${block.category}</div>
      </div>
      <div class="actions">
        <button class="btn small edit" aria-label="Edit block">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          <span>Edit</span>
        </button>
        <button class="btn small del" aria-label="Delete block">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
          <span>Delete</span>
        </button>
      </div>`
    el.querySelector('.del').addEventListener('click', ()=>{ 
      if(confirm('Delete block?')){ 
        // animate out then remove
        el.classList.remove('fade-in')
        el.classList.add('fade-out')
        setTimeout(()=>{ state.schedule = state.schedule.filter(b=>b.id!==block.id); saveState(); renderAll() }, 260)
      }
    })
    el.querySelector('.edit').addEventListener('click', ()=>{ onEditBlock(block) })
    el.addEventListener('click', ()=>{ // jump to block
      state.settings.forcedBlock = block.id
      renderCurrentBlock()
      renderTasks()
    })
    // animate in
    el.classList.add('fade-in')
    timelineEl.appendChild(el)
  })
  // show empty state helper
  const empty = document.getElementById('timelineEmpty')
  if(empty) empty.style.display = state.schedule.length ? 'none' : 'block'
}

function onAddBlock(){
  openBlockEditor(null)
}

function onEditBlock(block){
  openBlockEditor(block)
}

// Block editor modal functions
const blockEditor = {
  modal: document.getElementById('blockEditorModal'),
  form: document.getElementById('blockEditorForm'),
  idInput: document.getElementById('blockIdInput'),
  nameInput: document.getElementById('blockNameInput'),
  startInput: document.getElementById('blockStartInput'),
  endInput: document.getElementById('blockEndInput'),
  categoryInput: document.getElementById('blockCategoryInput'),
  colorInput: document.getElementById('blockColorInput'),
  recurringInput: document.getElementById('blockRecurringInput'),
  saveBtn: document.getElementById('saveBlockBtn'),
  cancelBtn: document.getElementById('cancelBlockBtn'),
  title: document.getElementById('modalTitle')
}

function openBlockEditor(block){
  // populate fields (block may be null for new)
  if(block){
    blockEditor.title.textContent = 'Edit Block'
    blockEditor.idInput.value = block.id
    blockEditor.nameInput.value = block.name
    blockEditor.startInput.value = block.start
    blockEditor.endInput.value = block.end
    blockEditor.categoryInput.value = block.category || ''
    blockEditor.colorInput.value = block.color || '#7c3aed'
    blockEditor.recurringInput.checked = !!block.recurring
  } else {
    blockEditor.title.textContent = 'Add Block'
    blockEditor.idInput.value = ''
    blockEditor.nameInput.value = ''
    blockEditor.startInput.value = '09:00'
    blockEditor.endInput.value = '10:00'
    blockEditor.categoryInput.value = ''
    blockEditor.colorInput.value = '#7c3aed'
    blockEditor.recurringInput.checked = false
  }
  blockEditor.modal.setAttribute('aria-hidden', 'false')
}

function closeBlockEditor(){
  blockEditor.modal.setAttribute('aria-hidden', 'true')
}

// cancel handler
blockEditor.cancelBtn.addEventListener('click', (e)=>{ e.preventDefault(); closeBlockEditor() })

// form submit -> save block
blockEditor.form.addEventListener('submit', (e)=>{
  e.preventDefault()
  const idVal = blockEditor.idInput.value || null
  const name = blockEditor.nameInput.value.trim()
  const start = blockEditor.startInput.value
  const end = blockEditor.endInput.value
  const category = startCase(blockEditor.categoryInput.value.trim() || 'General')
  const color = blockEditor.colorInput.value
  const recurring = !!blockEditor.recurringInput.checked
  if(!name || !start || !end){ alert('Please fill name, start and end times'); return }

  if(idVal){
    // update existing
    const block = state.schedule.find(b=>b.id===idVal)
    if(block){ block.name = startCase(name); block.start = start; block.end = end; block.category = category; block.color = color; block.recurring = recurring }
  } else {
    const newBlock = { id: id(), name: startCase(name), start, end, category, color, recurring }
    state.schedule.push(newBlock)
  }
  saveState(); renderAll(); closeBlockEditor()
})

function renderCurrentBlock(){
  const cb = getCurrentBlock()
  if(cb){
    currentBlockName.textContent = cb.name
    currentBlockTime.textContent = `${cb.start} → ${cb.end}`
  } else {
    currentBlockName.textContent = 'No active block'
    currentBlockTime.textContent = ''
    countdownEl.textContent = '--:--:--'
  }
}

function renderTasks(){
  tasksListEl.innerHTML = ''
  const cb = getCurrentBlock()
  // If no current block, show Inbox tasks
  let tasks = []
  let ownerLabel = null
  if(!cb){
    ownerLabel = 'Inbox'
    tasks = state.tasks['inbox'] || []
  } else {
    ownerLabel = cb.name
    tasks = state.tasks[cb.id] || []
  }
  // update tasks header to indicate owner
  const tasksSectionTitle = document.querySelector('.tasks h4')
  if(tasksSectionTitle) tasksSectionTitle.textContent = `Tasks — ${ownerLabel}`
  tasks.forEach(t=>{
    const li = document.createElement('li')
    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = !!t.done
    const span = document.createElement('span'); span.textContent = t.text
    if(t.done) span.classList.add('task-done')
    chk.addEventListener('change', ()=>{ t.done = chk.checked; if(t.done) span.classList.add('task-done'); else span.classList.remove('task-done'); saveState(); updateProgressCounts() })
    const del = document.createElement('button'); del.textContent='✕'; del.className='btn small'; del.addEventListener('click', ()=>{ state.tasks[cb.id] = state.tasks[cb.id].filter(x=>x.id!==t.id); saveState(); renderTasks(); updateProgressCounts() })
    li.appendChild(chk); li.appendChild(span); li.appendChild(del); tasksListEl.appendChild(li)
    li.classList.add('fade-in')
  })
}

function addTask(blockId, text){
  state.tasks[blockId] = state.tasks[blockId] || []
  state.tasks[blockId].push({id:id(),text,done:false})
  saveState(); renderTasks(); updateProgressCounts()
}

function getCurrentBlock(){
  const now = new Date(); const mins = now.getHours()*60 + now.getMinutes()
  for(const b of state.schedule){
    const s = parseTime(b.start); const e = parseTime(b.end)
    // support overnight
    if(e<=s){ // overnight
      if(mins >= s || mins < e) return b
    } else {
      if(mins >= s && mins < e) return b
    }
  }
  return null
}

function updateNowIndicator(){
  // Simple highlight of blocks containing now
  const cb = getCurrentBlock()
  document.querySelectorAll('.timeline .block').forEach(el=>{
    if(cb && el.dataset.id === cb.id) el.style.outline = `2px solid var(--accent)`
    else el.style.outline = 'none'
  })
  // Countdown
  if(cb){
    const e = parseTime(cb.end); const now = new Date(); const minsNow = now.getHours()*60 + now.getMinutes();
    let rem = e - minsNow; if(e <= parseTime(cb.start)) { // overnight
      rem = (24*60 - minsNow) + e
    }
    if(rem < 0) rem = 0
    const hh = Math.floor(rem/60); const mm = Math.floor(rem%60); const ss = 0
    countdownEl.textContent = `${pad(hh)}:${pad(mm)}:${pad(ss)}`
  }
  renderCurrentBlock()
  renderContextHint()
}

function renderContextHint(){
  const el = document.getElementById('contextHint')
  if(!el) return
  const now = new Date(); const minsNow = now.getHours()*60 + now.getMinutes()
  // find current block
  const cb = getCurrentBlock()
  if(cb){
    // show right now
    el.innerHTML = `<span class="pill">Right now</span> <strong>${escapeHtml(cb.name)}</strong> <span class="muted">(until ${cb.end})</span>`
    return
  }
  // otherwise find next upcoming block today
  let upcoming = null
  // sort schedule by start minutes
  const ordered = state.schedule.slice().sort((a,b)=> parseTime(a.start) - parseTime(b.start))
  for(const b of ordered){
    const s = parseTime(b.start)
    // find the next start strictly after now
    if(s > minsNow){ upcoming = b; break }
  }
  if(upcoming){
    el.innerHTML = `<span class="pill">Next</span> <strong>${escapeHtml(upcoming.name)}</strong> <span class="muted">at ${upcoming.start}</span>`
    return
  }
  // else, nothing upcoming today
  el.innerHTML = `<span class="pill">Today</span> <strong>No more scheduled blocks</strong> <span class="muted">— enjoy your evening</span>`
}

function setupIntervals(){
  renderMode(); updateNowIndicator(); setInterval(()=>{ renderMode(); updateNowIndicator(); }, 30*1000)
}

function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }catch(e){console.error('save failed',e)}
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY)
    if(raw) return JSON.parse(raw)
  }catch(e){console.error('load failed', e)}
  return structuredClone(defaultState)
}

function renderPriorities(){
  prioritiesList.innerHTML = ''
  state.priorities.forEach((p,i)=>{
    const li = document.createElement('li'); li.dataset.priorityIndex = i; li.contentEditable = true; li.className='priority'; li.textContent = p
    prioritiesList.appendChild(li)
  })
}

function updateProgressCounts(){
  const completed = Object.values(state.tasks).flat().filter(t=>t.done).length
  state.progress.completedTasks = completed
  document.getElementById('completedCount').textContent = completed
  document.getElementById('focusMinutes').textContent = state.progress.focusMinutes
  document.getElementById('blocksCompleted').textContent = state.progress.blocksCompleted
  saveState()
}

// Utility helpers
function id(){ return Math.random().toString(36).slice(2,9) }
function parseTime(t){ const [h,m]=t.split(':').map(Number); return h*60 + (m||0) }
function pad(n){ return String(n).padStart(2,'0') }
function startCase(s){ return s.replace(/(^|\s)\S/g, l=>l.toUpperCase()) }
function endTimeFix(t){ return t.indexOf(':')>-1 ? t : (t+':00') }
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }

// small helpers for developer convenience
window._moodApp = { state, saveState }
