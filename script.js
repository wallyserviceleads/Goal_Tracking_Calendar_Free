/* Goal Tracking Calendar (Free, Original + Fixes)
   - Re-editable daily entries via Day Editor dialog
   - Import/Export code removed
   - Help section lives in Settings
   - Logo shown in header (handled in index.html)
*/
'use strict';

(function(){
  const cfg = window.APP_CONFIG || {};
  const $  = (sel)=>document.querySelector(sel);
  const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

  // Elements
  const settingsBtn   = $("#settingsBtn");
  const settingsModal = $("#settingsModal");
  const closeSettings = $("#closeSettings");
  const saveSettings  = $("#saveSettings");

  const goalSummary   = $("#goalSummary");
  const goalNameInp   = $("#goalName");
  const goalAmountInp = $("#goalAmount");
  const goalStartInp  = $("#goalStart");
  const goalEndInp    = $("#goalEnd");
  const themeToggle   = $("#themeToggle");

  const monthLabel = $("#monthLabel");
  const grid       = $("#calendarGrid");
  const prevBtn    = $("#prevMonth");
  const nextBtn    = $("#nextMonth");

  const kpiDaily     = $("#kpiDaily");
  const kpiWeekly    = $("#kpiWeekly");
  const kpiMonthly   = $("#kpiMonthly");
  const kpiQuarterly = $("#kpiQuarterly");
  const kpiYTD       = $("#kpiYTD");

  // Storage
  const SETTINGS_KEY = "gtc_v2_settings";
  const DATA_KEY     = "gtc_v2_data"; // 'YYYY-MM-DD' -> [{label, amount}]

  const loadJSON = (k,f)=>{ try{const r=localStorage.getItem(k); return r?JSON.parse(r):f;}catch{return f;} };
  const saveJSON = (k,v)=>{ try{localStorage.setItem(k, JSON.stringify(v)); }catch{} };

  // State
  let current = new Date(); current.setDate(1);
  let settings = loadJSON(SETTINGS_KEY, {
    goalName:  cfg.DEFAULT_GOAL_NAME  || "Goal",
    goalAmount:Number(cfg.DEFAULT_GOAL_AMOUNT || 500000),
    goalStart: cfg.DEFAULT_GOAL_START || "",
    goalEnd:   cfg.DEFAULT_GOAL_END   || "",
    theme:     cfg.DEFAULT_THEME      || "dark",
    weekdays:  {0:false,1:true,2:true,3:true,4:true,5:true,6:true}, // Sun..Sat
  });
  let store = loadJSON(DATA_KEY, {});

  // Theme
  function applyTheme(){
    const theme = settings.theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  }

  // Helpers
  const iso      = (d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseISO = (s)=> s ? new Date(s+"T00:00:00") : null;
  const sod      = (d)=>{ const x=new Date(d); x.setHours(0,0,0,0); return x; };
  const eod      = (d)=>{ const x=new Date(d); x.setHours(23,59,59,999); return x; };
  const dim      = (y,m)=> new Date(y,m+1,0).getDate();
  const money    = (n=0)=>"$"+(Math.round(+n)||0).toLocaleString();

  function workingDaysInRange(start, end, mask){
    if(!start||!end) return 0;
    const s=sod(start), e=eod(end);
    if(e<s) return 0;
    let c=0, cur=new Date(s);
    while(cur<=e){ if(mask[cur.getDay()]) c++; cur.setDate(cur.getDate()+1); }
    return c;
  }
  function workingDaysInMonth(date, mask){
    const y=date.getFullYear(), m=date.getMonth();
    let c=0; for(let d=1; d<=dim(y,m); d++){ if(mask[new Date(y,m,d).getDay()]) c++; }
    return c;
  }

  function entries(date){ const a=store[iso(date)]; return Array.isArray(a)?a:[]; }
  function setEntries(date, arr){
    const clean = (arr||[]).map(e=>({label:String(e.label||'Sale').slice(0,64), amount:Math.max(0,Math.round(+e.amount||0))})).filter(e=>e.amount>0);
    if(clean.length) store[iso(date)] = clean; else delete store[iso(date)];
    saveJSON(DATA_KEY, store);
  }
  function total(date){ return entries(date).reduce((s,e)=>s+(+e.amount||0),0); }

  function updateGoalSummary(){
    const name = settings.goalName || "Goal";
    const amt = money(settings.goalAmount||0);
    let range = "no range";
    if(settings.goalStart && settings.goalEnd) range = `${settings.goalStart} → ${settings.goalEnd}`;
    else if(settings.goalStart) range = `from ${settings.goalStart}`;
    else if(settings.goalEnd) range = `until ${settings.goalEnd}`;
    goalSummary.textContent = `${name} — ${amt} (${range})`;
  }

  function render(){
    applyTheme();
    updateGoalSummary();

    const y=current.getFullYear(), m=current.getMonth();
    monthLabel.textContent = new Date(y,m,1).toLocaleString(undefined,{month:'long',year:'numeric'});
    grid.innerHTML = "";

    const mask = settings.weekdays || {0:false,1:true,2:true,3:true,4:true,5:true,6:true};
    const start = parseISO(settings.goalStart);
    const end   = parseISO(settings.goalEnd);

    const workInRange = workingDaysInRange(start, end, mask);
    const daily   = workInRange>0 ? (Number(settings.goalAmount||0)/workInRange) : 0;
    const weekly  = daily * [0,1,2,3,4,5,6].filter(d=>mask[d]).length;
    const monthly = daily * workingDaysInMonth(current, mask);

    // Quarter
    const qStartMonth = Math.floor(m/3)*3;
    const qStart = new Date(y,qStartMonth,1);
    const qEnd   = new Date(y,qStartMonth+3,0);
    const qDays  = workingDaysInRange(qStart, qEnd, mask);
    const quarterly = daily * qDays;

    // Range progress
    let progress = 0;
    const s = start? sod(start):null, e = end? eod(end):null;
    for(const [k,arr] of Object.entries(store)){
      const d = new Date(k);
      if((!s||d>=s)&&(!e||d<=e)){
        progress += (Array.isArray(arr)?arr:[]).reduce((sum,x)=>sum+(+x.amount||0),0);
      }
    }

    kpiDaily.textContent     = money(daily);
    kpiWeekly.textContent    = money(weekly);
    kpiMonthly.textContent   = money(monthly);
    kpiQuarterly.textContent = money(quarterly);
    kpiYTD.textContent       = money(progress);

    // Headers
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(h=>{
      const div=document.createElement('div'); div.className='day';
      div.innerHTML=`<div class="date"><strong>${h}</strong></div>`; grid.appendChild(div);
    });

    // Pad to first day
    const firstDay = new Date(y,m,1).getDay();
    for(let i=0;i<firstDay;i++){
      const pad=document.createElement('div'); pad.className='day'; pad.innerHTML='<div class="date"> </div>'; grid.appendChild(pad);
    }

    // Days
    const days = dim(y,m);
    let weekSum = 0;
    for(let d=1; d<=days; d++){
      const date = new Date(y,m,d);
      const wd   = date.getDay();
      const isWork = !!mask[wd];
      const cell = document.createElement('div'); cell.className='day'; cell.dataset.date = iso(date);

      const pace = (isWork && isFinite(daily) && daily>0) ? `<span class="pace"><span class="pill goal"></span>${money(daily)}</span>` : "";
      cell.innerHTML = `<div class="date"><span>${d}</span>${pace}</div>`;

      const list = document.createElement('div'); list.className='items';
      const arr = entries(date);
      if(arr.length){
        arr.forEach(e=>{
          const label = (e.label||'Entry').replace(/[<>&]/g, s=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[s]));
          const row = document.createElement('div'); row.className='item';
          row.innerHTML = `<span>${label}</span><span class="amount">${money(e.amount)}</span>`;
          list.appendChild(row);
        });
      }
      cell.appendChild(list);

      if(isWork){
        const tot = total(date); weekSum += tot;
        const t = document.createElement('div'); t.className='total'; t.innerHTML=`<span>Total</span><span>${money(tot)}</span>`;
        cell.appendChild(t);
      }

      // OPEN DAY EDITOR (replaces old prompt flow)
      cell.addEventListener('click', ()=> dayEditor.openFor(date));

      grid.appendChild(cell);

      // Week subtotal rows
      if (wd===6 || d===days){
        const weekRow = document.createElement('div'); weekRow.className='week-row';
        weekRow.innerHTML = `<div>Week subtotal</div><div>${money(weekSum)}</div>`;
        grid.appendChild(weekRow); weekSum = 0;
      }
    }
  }

  // Day editor
  const dayEditor = (function(){
    const dlg   = $("#dayEditor");
    const list  = $("#entriesList");
    const title = $("#dayEditorTitle");
    const addBtn  = $("#addEntryBtn");
    const saveBtn = $("#saveDayBtn");
    let editingDate = null;

    function rowTemplate(label='', amount=''){
      const wrap = document.createElement('div');
      wrap.className = 'entry-row';
      wrap.innerHTML = `
        <input type="text" class="entry-label" placeholder="Label" value="${(label||'').replace(/"/g,'&quot;')}" />
        <input type="number" class="entry-amount" placeholder="Amount" min="0" step="1" value="${amount||''}" />
        <button type="button" class="icon-btn entry-del" title="Delete">🗑️</button>
      `;
      wrap.querySelector('.entry-del').addEventListener('click', ()=> wrap.remove());
      return wrap;
    }

    function openFor(date){
      editingDate = new Date(date);
      title.textContent = `Edit ${iso(editingDate)}`;
      list.innerHTML = '';
      const arr = entries(editingDate);
      if(arr.length){
        arr.forEach(e=> list.appendChild(rowTemplate(e.label, e.amount)));
      } else {
        list.appendChild(rowTemplate('', ''));
      }
      dlg.showModal();
    }

    addBtn.addEventListener('click', ()=> list.appendChild(rowTemplate('', '')));

    saveBtn.addEventListener('click', ()=>{
      const rows = Array.from(list.querySelectorAll('.entry-row'));
      const clean = rows.map(r=>{
        const label = r.querySelector('.entry-label').value.trim() || 'Entry';
        const amount = Math.max(0, Math.round(Number(r.querySelector('.entry-amount').value||0)));
        return {label, amount};
      }).filter(x=>x.amount>0);
      setEntries(editingDate, clean);
      render();
      dlg.close();
    });

    return { openFor };
  })();

  // Navigation
  prevBtn.addEventListener('click', ()=>{ current.setMonth(current.getMonth()-1); render(); });
  nextBtn.addEventListener('click', ()=>{ current.setMonth(current.getMonth()+1); render(); });

  // Settings
  function initSettingsBindings(){
    goalNameInp.value   = settings.goalName || "";
    goalAmountInp.value = Number(settings.goalAmount||0) || "";
    goalStartInp.value  = settings.goalStart || "";
    goalEndInp.value    = settings.goalEnd || "";
    themeToggle.checked = settings.theme === "light";
    const cont  = settingsModal.querySelector(".weekday-toggles");
    const boxes = Array.from(cont.querySelectorAll("input[type=checkbox][data-wd]"));
    boxes.forEach(cb=>{ const wd = Number(cb.dataset.wd); cb.checked = !!settings.weekdays[wd]; });
  }
  settingsBtn.addEventListener("click", ()=>{ initSettingsBindings(); settingsModal.showModal(); });
  closeSettings.addEventListener("click", ()=> settingsModal.close());

  saveSettings.addEventListener("click", (ev)=>{
    ev.preventDefault();
    settings.goalName   = (goalNameInp.value||"Goal").trim();
    settings.goalAmount = Number(goalAmountInp.value||0) || 0;
    settings.goalStart  = goalStartInp.value || "";
    settings.goalEnd    = goalEndInp.value   || "";
    settings.theme      = themeToggle.checked ? "light" : "dark";
    const boxes = Array.from(settingsModal.querySelectorAll("input[type=checkbox][data-wd]"));
    const mask = {...settings.weekdays};
    boxes.forEach(cb=> mask[Number(cb.dataset.wd)] = !!cb.checked);
    settings.weekdays = mask;
    saveJSON(SETTINGS_KEY, settings);
    render();
    settingsModal.close();
  });

  // Reset (kept; Import/Export removed)
  $("#resetBtn").addEventListener("click", ()=>{
    if(!confirm("Clear all locally saved data and settings?")) return;
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(DATA_KEY);
    settings = {
      goalName:  cfg.DEFAULT_GOAL_NAME  || "Goal",
      goalAmount:Number(cfg.DEFAULT_GOAL_AMOUNT || 500000),
      goalStart: cfg.DEFAULT_GOAL_START || "",
      goalEnd:   cfg.DEFAULT_GOAL_END   || "",
      theme:     cfg.DEFAULT_THEME      || "dark",
      weekdays:  {0:false,1:true,2:true,3:true,4:true,5:true,6:true},
    };
    store = {};
    saveJSON(SETTINGS_KEY, settings);
    saveJSON(DATA_KEY, store);
    render(); settingsModal.close();
  });

  // Boot
  render();
})();