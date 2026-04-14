/**
 * EAM Design Doc CU Importer — v1.19.21 (CSV-only)
 * Last Updated: 2026-04-9
 * Made by Elijah Rademaker - erademaker@trccompanies.com
 * To-Do:
 * - Look into the ModifyDD network call to bulk instant add via the save function called by SAP in the Network sources.
 * - Preview progress counter.
 * - Static site for Bookmarklet to pull from without requiring sharepoint login access.
 * - See if I can optimize the speed of preview.
 */
(function () {

  // Root and State
const IMPORTER_VERSION = '1.19.21';

// PAGE-WIDE DARK MODE
(function(){

function applyRowLevels(root=document){
  root.querySelectorAll('tr').forEach(tr=>{
    const td=tr.querySelector('td.level');
    if(td) tr.dataset.eamLevel=td.textContent.trim();
  });
}

function ensureStyles(){
  if(document.getElementById('__eam_dark_styles')) return;
  const s=document.createElement('style');
  s.id='__eam_dark_styles';
  s.textContent=`
/* ROOT */
body[data-eam-dark="1"]{background:#0f1419!important;color:#e6edf3!important}

/* NAVBAR */
body[data-eam-dark="1"] #left-navbar .nav-link,
body[data-eam-dark="1"] #left-navbar .dropdown-toggle{color:#e6edf3!important}

/* STICKY DESIGN DOC TOOLBAR – override inline white */
body[data-eam-dark="1"] #DDMainDiv .sticky-top,
body[data-eam-dark="1"] #DDMainDiv .sticky-top[style]{
  background:#161b22!important;
  color:#e6edf3!important;
  border-color:#30363d!important;
}

/* PANELS / CARDS */
body[data-eam-dark="1"] .card,
body[data-eam-dark="1"] .card-header,
body[data-eam-dark="1"] .card-body{
  background:#161b22!important;
  color:#e6edf3!important;
  border-color:#30363d!important;
}

body[data-eam-dark="1"] .card *,
body[data-eam-dark="1"] .form-check-label,
body[data-eam-dark="1"] .form-check-label *{color:#e6edf3!important}

/* ===== MODAL DARK MODE FIX ===== */
body[data-eam-dark="1"] .modal-backdrop.show {
  opacity: 0.55 !important;
}

body[data-eam-dark="1"] .modal-content {
  background:#161b22 !important;
  color:#e6edf3 !important;
  border-color:#30363d !important;
}

body[data-eam-dark="1"] .modal-header,
body[data-eam-dark="1"] .modal-footer {
  background:#1f242c !important;
  color:#e6edf3 !important;
  border-color:#30363d !important;
}

body[data-eam-dark="1"] .modal-body {
  background:#161b22 !important;
  color:#e6edf3 !important;
}

/* Override inline styles like style="color:green" */
body[data-eam-dark="1"] .modal-body [style*="color"] {
  color: inherit !important;
}

body[data-eam-dark="1"] .modal .close,
body[data-eam-dark="1"] .modal .close span {
  color:#ffffff !important;
  opacity:0.85;
}
body[data-eam-dark="1"] .modal .close:hover {
  opacity:1;
}

/* TABLE LEVELS */
body[data-eam-dark="1"] tr[data-eam-level="1"],
body[data-eam-dark="1"] tr[data-eam-level="2"]{background:#223044!important}
body[data-eam-dark="1"] tr[data-eam-level="3"]{background:#171e26!important}
body[data-eam-dark="1"] tr[data-eam-level="4"]{background:#10151c!important}
body[data-eam-dark="1"] tr:not([data-eam-level="4"]):hover{background:#222f42!important;color:#fff!important}

/* TABLE TEXT */
body[data-eam-dark="1"] td,
body[data-eam-dark="1"] th{color:#e6edf3!important}
body[data-eam-dark="1"] td *{color:inherit!important}

/* TABLE BORDERS – remove white */
body[data-eam-dark="1"] table,
body[data-eam-dark="1"] .table,
body[data-eam-dark="1"] .table-bordered,
body[data-eam-dark="1"] .table-bordered td,
body[data-eam-dark="1"] .table-bordered th{
  border-color:#30363d!important;
}

body[data-eam-dark="1"] .table-striped tbody tr{
  border-top:1px solid #30363d!important;
}

/* INPUTS */
body[data-eam-dark="1"] input,
body[data-eam-dark="1"] select{
  background:#1f2a38!important;
  color:#e6edf3!important;
  border-color:#30363d!important;
}

/* ICONS */
body[data-eam-dark="1"] svg{fill:currentColor!important}



/* ===== ALERT COLOR INVERSION ===== */
body[data-eam-dark="1"] .alert {
  border-color:#30363d !important;
}

body[data-eam-dark="1"] .alert-primary {
  background:#0f2a44 !important;     /* dark blue */
  color:#cfe6ff !important;
}

body[data-eam-dark="1"] .alert-warning {
  background:#4a3b00 !important;
  color:#fff3c4 !important;
}

body[data-eam-dark="1"] .alert-info {
  background:#0b3a4a !important;
  color:#cfefff !important;
}

body[data-eam-dark="1"] .alert-success {
  background:#0f3d26 !important;
  color:#d1f2dd !important;
}

body[data-eam-dark="1"] .alert-danger {
  background:#4a1212 !important;
  color:#ffd6d6 !important;
}

body[data-eam-dark="1"] .alert .close,
body[data-eam-dark="1"] .alert .close span {
  color:#ffffff !important;
  opacity:0.85;
}

/* SCROLLBAR */
body[data-eam-dark="1"]{scrollbar-color:#30363d #0f1419}
body[data-eam-dark="1"] ::-webkit-scrollbar-thumb{background:#30363d}
`;
  document.head.appendChild(s);
}

function toggle(){
  ensureStyles();
  if(document.body.dataset.eamDark==='1'){
    delete document.body.dataset.eamDark;
    localStorage.setItem('__eam_dark','0');
  }else{
    document.body.dataset.eamDark='1';
    localStorage.setItem('__eam_dark','1');
    applyRowLevels();
  }
}

/* DEFAULT LIGHT */
delete document.body.dataset.eamDark;
if(localStorage.getItem('__eam_dark')==='1'){
  document.body.dataset.eamDark='1';ensureStyles();applyRowLevels();
}

new MutationObserver(()=>applyRowLevels()).observe(document.body,{childList:true,subtree:true});

const t=setInterval(()=>{
  const h=document.getElementById('__cu_hdr');if(!h) return;
  let b=document.getElementById('__cu_theme_toggle');
  if(!b){b=document.createElement('span');b.id='__cu_theme_toggle';b.style.cursor='pointer';b.style.marginRight='8px';h.insertBefore(b,h.firstChild)}
  const sync=()=>b.textContent=(document.body.dataset.eamDark==='1'?'☀️':'🌙');
  b.onclick=()=>{toggle();sync()};sync();clearInterval(t)
},100);
})();
// ===== END EAM PAGE-WIDE DARK MODE =====

  const ROOT = (() => { try { return window.top; } catch { return window; } })();

  ROOT.__cu_altTarget = (ROOT.__cu_altTarget === undefined) ? null : ROOT.__cu_altTarget; // no default highlight
  ROOT.__cu_frames    = ROOT.__cu_frames || new Set();
  ROOT.__cu_altStats  = ROOT.__cu_altStats || { applied: 0, committed: 0, hidden: 0, frames: 0, rewrites: 0 };
  ROOT.__cu_ui        = ROOT.__cu_ui || { collapsed: false };

  const log  = (...a) => console.log('[CU-Importer]', ...a);
  const warn = (...a) => console.warn('[CU-Importer]', ...a);
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  // ALT Helpers

  const TOP_ALT_RE = /(Alternative\s*)(\d+)/i;
  const ALT_TOKEN_RE_GLOBAL = /\bALT\s*\d+\b/gi;
  const ALT_LBL_DET = /\bL(\d{1,})\s+ALT\s*\d+\b/i;

  function stripAltTokens(text){
    return String(text).replace(ALT_TOKEN_RE_GLOBAL, '').replace(/\s{2,}/g, ' ').trim();
  }
  function setHeaderAlternative(text, toAlt){
    let out = String(text);
    if (TOP_ALT_RE.test(out)) out = out.replace(TOP_ALT_RE, (_, p1) => `${p1}${toAlt}`);
    return stripAltTokens(out);
  }
  function setLocationAltNoSpace(text, toAlt){
    const s = String(text).trim();
    if (ALT_LBL_DET.test(s)) return s.replace(ALT_TOKEN_RE_GLOBAL, `ALT${toAlt}`);
    const base = s.replace(/\s+/g, ' ').trim();
    return `${base} ALT${toAlt}`;
  }

  // Visual Apply + Commit

  function commitEditable(el){
    try {
      el.focus();
      const sel = el.ownerDocument.getSelection?.();
      if (sel){
        const range = el.ownerDocument.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      ['keydown','keypress','keyup'].forEach(type => el.dispatchEvent(new KeyboardEvent(type, { bubbles: true, key: 'Enter', code: 'Enter' })));
      el.blur();
      const row = el.closest('tr');
      row?.classList?.add('dirty','edited');
      row?.setAttribute?.('data-dirty','true');
      ROOT.__cu_altStats.committed += 1;
    } catch (e) {
      warn('commitEditable failed', e);
    }
  }

  function syncHiddenNear(row, newText){
    let updated = 0;
    try {
      const inputs = row.querySelectorAll('input[type="hidden"], input:not([type])');
      for (const inp of inputs){
        const v = (inp.value || '').trim();
        if (!v) continue;
        if (ALT_LBL_DET.test(v) || /Alternative\s*\d+/i.test(v)){
          inp.value = newText;
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          updated += 1;
        }
      }
    } catch { /* no-op */ }
    ROOT.__cu_altStats.hidden += updated;
    return updated;
  }

  function visualApplyInFrame(win, toAlt){
  let changed = 0;
  try { const doc = win.document; const rows = Array.from(doc.querySelectorAll('tr.cu_Parent'));
    for (const tr of rows){ const lvl = Number((tr.querySelector('td.level')?.textContent||'').trim()); if (lvl!==2) continue; const cell = tr.querySelector('.tblCUITXTEditable'); if (!cell) continue; const before = cell.textContent||''; const m = before.match(/^(L\d{1,3})/i); const loc = m ? m[1].toUpperCase().replace(/L(\d{1,3})/,(_,d)=>'L'+String(d).padStart(3,'0')) : 'L001'; const after = loc+' ALT'+String(toAlt); if (after!==before){ cell.textContent = after; commitEditable(cell); syncHiddenNear(tr, after); changed++; } }
  } catch(e){ warn('visualApplyInFrame failed', e); }
  ROOT.__cu_altStats.applied += changed; return changed; }

  function visualApplyAll(toAlt){
    ROOT.__cu_altStats.applied   = 0;
    ROOT.__cu_altStats.committed = 0;
    ROOT.__cu_altStats.hidden    = 0;
    let total = 0;
    total += visualApplyInFrame(ROOT, toAlt);
    for (const f of ROOT.__cu_frames){
      try { total += visualApplyInFrame(f, toAlt); } catch {}
    }
    return total;
  }

  // Background Shim for /CU/ModifyDD (rewrite DD payload)

  function currentAltFromDD(dd){
    try {
      const k = dd?.IS_CUDESIGN?.KTEXT || '';
      const m = k.match(TOP_ALT_RE);
      if (m) return Number(m[2]);
    } catch {}
    return null;
  }

  function applyAltToDD(dd, toAlt){ if (!dd) return dd; try { if (dd.IS_CUDESIGN && typeof dd.IS_CUDESIGN.KTEXT==='string'){ dd.IS_CUDESIGN.KTEXT = setHeaderAlternative(dd.IS_CUDESIGN.KTEXT, toAlt); } const items = dd.IT_AFCU && (dd.IT_AFCU.item || dd.IT_AFCU.Item || dd.IT_AFCU.ITEM); if (Array.isArray(items)){ for (const it of items){ const txt = it && typeof it.CUITXT==='string' ? it.CUITXT : ''; if (txt && ALT_LBL_DET.test(txt)) it.CUITXT = setLocationAltNoSpace(txt, toAlt); } } else if (items && typeof items==='object'){ const txt = items && typeof items.CUITXT==='string' ? items.CUITXT : ''; if (txt && ALT_LBL_DET.test(txt)) items.CUITXT = setLocationAltNoSpace(txt, toAlt); } } catch(e){ warn('applyAltToDD failed', e); } return dd; }
function __normName(s){ return String(s||'').trim().toUpperCase().replace(/\s+/g,' ');} function readDOMLevel2CmplxMap(hostWin){ const map=Object.create(null); function scan(win){ try{ const doc=win.document; const parents=Array.from(doc.querySelectorAll('tr.cu_Parent')); for (const tr of parents){ const lvl=Number((tr.querySelector('td.level')?.textContent||'').trim()); if (lvl!==2) continue; const name=__normName(tr.querySelector('td.tblCUITXTEditable')?.textContent||''); const inp=tr.querySelector('input.Input_COMPLF'); const raw=inp && inp.value ? String(inp.value).replace(/,/g,'').trim() : ''; const val = raw!=='' ? Number(raw) : null; if (name && val!=null && isFinite(val)) map[name]=String(val); } }catch(e){} } scan(hostWin); try{ if (hostWin.top && hostWin.top.__cu_frames){ for (const f of hostWin.top.__cu_frames){ try{ scan(f);}catch(e){} } } }catch(e){} return map; } function applyCmplxToDD(dd, hostWin){ try{ if(!dd) return dd; const items=dd.IT_AFCU && (dd.IT_AFCU.item||dd.IT_AFCU.Item||dd.IT_AFCU.ITEM); if(!items) return dd; const cmap=readDOMLevel2CmplxMap(hostWin); function patch(it){ const nm=__normName(it&&it.CUITXT); const factor=cmap[nm]; if (factor!=null) it.COMPLF=factor; } if (Array.isArray(items)) for (const it of items) patch(it); else if (typeof items==='object') patch(items); }catch(e){ warn('applyCmplxToDD failed', e);} return dd; }

  function parseFromStringBody(bodyStr){
    try { const usp = new URLSearchParams(bodyStr); const raw = usp.get('DD'); if (!raw) return null; const dd = JSON.parse(decodeURIComponent(raw)); return { kind:'string', usp, dd }; } catch { return null; }
  }
  function parseFromFormData(fd){
    try { const raw = fd.get('DD'); if (!raw) return null; const dd = JSON.parse(raw); return { kind:'form', fd, dd }; } catch { return null; }
  }
  function parseFromURLParams(params){
    try { const raw = params.get('DD'); if (!raw) return null; const dd = JSON.parse(decodeURIComponent(raw)); return { kind:'urlparams', params, dd }; } catch { return null; }
  }
  function serializeCtx(ctx){ try { if (ctx.kind==='string'){ const js=JSON.stringify(ctx.dd); ctx.usp.set('DD', js); return ctx.usp.toString(); } if (ctx.kind==='form'){ ctx.fd.set('DD', JSON.stringify(ctx.dd)); return ctx.fd; } if (ctx.kind==='urlparams'){ const js=JSON.stringify(ctx.dd); ctx.params.set('DD', js); return ctx.params.toString(); } } catch(e){ warn('serializeCtx failed', e); } return null; }

  function tryRewriteBody(body, hostWin){
  try { if (hostWin && hostWin.top && hostWin.top.__cu_shim_enabled===false) return body; } catch(e){}
    try {
      if (typeof body === 'string'){
        const ctx = parseFromStringBody(body); if (!ctx) return body;
        const ddAlt = currentAltFromDD(ctx.dd);
        const toAlt = (hostWin.top.__cu_altTarget || ddAlt || 1);
        applyAltToDD(ctx.dd, toAlt); applyCmplxToDD(ctx.dd, hostWin);
        hostWin.top.__cu_altStats.rewrites += 1;
        return serializeCtx(ctx);
      }
      if (body instanceof hostWin.FormData){
        const ctx = parseFromFormData(body); if (!ctx) return body;
        const ddAlt = currentAltFromDD(ctx.dd);
        const toAlt = (hostWin.top.__cu_altTarget || ddAlt || 1);
        applyAltToDD(ctx.dd, toAlt); applyCmplxToDD(ctx.dd, hostWin);
        hostWin.top.__cu_altStats.rewrites += 1;
        return serializeCtx(ctx);
      }
      if (body instanceof hostWin.URLSearchParams){
        const ctx = parseFromURLParams(body); if (!ctx) return body;
        const ddAlt = currentAltFromDD(ctx.dd);
        const toAlt = (hostWin.top.__cu_altTarget || ddAlt || 1);
        applyAltToDD(ctx.dd, toAlt); applyCmplxToDD(ctx.dd, hostWin);
        hostWin.top.__cu_altStats.rewrites += 1;
        return serializeCtx(ctx);
      }
    } catch (e) { warn('tryRewriteBody failed', e); }
    return body;
  }

  function installShimInto(win){
    try {
      if (!win || win.__cu_modifydd_patched) return;
      win.__cu_modifydd_patched = true;
      ROOT.__cu_frames.add(win);
      ROOT.__cu_altStats.frames = ROOT.__cu_frames.size;

      const _fetch = win.fetch?.bind(win);
      if (_fetch){
        win.fetch = async function(input, init={}){
          try {
            const url = typeof input === 'string' ? input : input?.url;
            if (url && /\/CU\/ModifyDD(\?|$)/i.test(url)){
              if (init){ init.body = tryRewriteBody(init.body, win); }
            }
          } catch (e) { warn('fetch shim error', e); }
          return _fetch(input, init);
        };
      }

      const XO = win.XMLHttpRequest?.prototype?.open;
      const XS = win.XMLHttpRequest?.prototype?.send;
      if (XO && XS){
        win.XMLHttpRequest.prototype.open = function(method, url, ...rest){
          this.__cu_is_modifydd = url && /\/CU\/ModifyDD(\?|$)/i.test(url);
          return XO.call(this, method, url, ...rest);
        };
        win.XMLHttpRequest.prototype.send = function(body){
  try { if (this.__cu_is_modifydd){ body = tryRewriteBody(body, win); } } catch(e){ warn('xhr shim error', e); }
  try { return XS.call(this, body); } catch(err){ try{ if (this.__cu_is_modifydd && body && typeof body!=='string' && !(body instanceof win.FormData)){ return XS.call(this, String(body)); } }catch(e2){} throw err; }
};
      }
    } catch (e) { warn('installShimInto failed', e); }
  }

  function installEverywhere(){
    installShimInto(ROOT);
    const ifr = ROOT.document.getElementsByTagName('iframe');
    for (const f of ifr){
      try {
        if (!f.contentWindow) continue;
        void f.contentWindow.location.href; // same-origin check
        installShimInto(f.contentWindow);
      } catch {}
    }
  }

  // Importer API (CSV only)

  const GET_CU_URL_TEMPLATE = (
    window.GET_CU_URL_TEMPLATE ||
    "http://eamdashboard/CU/GetCUData?Search=CUCU{CU}&Commodity=ELE%20DIST&Grounded=G"
  );

  const CU_CACHE_TTL_MS = 15 * 60 * 1000;
  ROOT.CU_HTML_CACHE = ROOT.CU_HTML_CACHE || Object.create(null);
  const logWarn = (...a) => console.warn('CU-Add:', ...a);

  function normalizeDigits(cu){ return String(cu).trim().replace(/^CU/i, ''); }
  function toCUName(cu){ return 'CU' + normalizeDigits(cu); }
  function padLoc(n){ return String(n).padStart(3, '0'); }
  function normalizeLocationName(input){
    const s = String(input).trim().toUpperCase();
    if (/^L\d{3}\s+ALT\d+$/.test(s)) return s;
    const m = s.match(/^(?:LOC\s*)?(\d+)$/);
    if (m) return `L${padLoc(m[1])} ALT1`;
    return s;
  }

  function findLocationRowExact(locationName){
    const name = normalizeLocationName(locationName);
    const parents = Array.from(document.querySelectorAll('tr.cu_Parent'));
    let hit = parents.find(r => r.querySelector('.tblCUITXTEditable')?.textContent.trim().toUpperCase() === name);
    if (hit) return hit;
    return parents.find(r => (r.querySelector('.tblCUITXTEditable')?.textContent || '').trim().toUpperCase().includes(name));
  }

  function getDirectRowsUnderParent(parentGuid){
    const all = Array.from(document.querySelectorAll('tr.child, tr.cu_Parent'));
    return all.filter(tr => tr.dataset && tr.dataset.supid === parentGuid);
  }

  function getCUIdFromRow(tr){
    const td5 = tr.querySelector('td:nth-child(5)');
    const t = (td5?.textContent || '').trim().toUpperCase();
    if (/^CU\d{3,}$/.test(t)) return t;
    const any = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim().toUpperCase());
    const hit = any.find(x => /^CU\d{3,}$/.test(x));
    return hit || null;
  }

  function normalizeActionName(s){
    if (!s) return '';
    const v = String(s).trim().toUpperCase();
    if (["R","RET","REM","RET REM","RET REMOVE","REMOVE"].includes(v)) return 'RET REM';
    if (["I","ADD","INSTALL"].includes(v)) return 'INSTALL';
    return v;
  }

  function getRowActionValue(tr){
    const sel = tr.querySelector('select.CUActionSelect');
    if (sel){
      const txt = (sel.selectedOptions[0]?.textContent || sel.value || '').trim();
      return normalizeActionName(txt);
    }
    const guess = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()).find(x => x && /INSTALL|RET/i.test(x));
    return normalizeActionName(guess || '');
  }

  function cacheGet(d){ const e = ROOT.CU_HTML_CACHE[d]; if (!e) return null; if ((Date.now()-e.ts) > CU_CACHE_TTL_MS){ delete ROOT.CU_HTML_CACHE[d]; return null; } return e.html; }
  function cacheSet(d,h){ ROOT.CU_HTML_CACHE[d] = { html: h, ts: Date.now() }; }

  function makeCuUrl(cuDigits, { commodity='ELE%20DIST', grounded='G', extra='' }={}){
    const digits = normalizeDigits(cuDigits);
    let base = GET_CU_URL_TEMPLATE.replace(/([&?])Search=[^&]*/i, '$1').replace(/[&?]$/, '');
    const sep = base.includes('?') ? '&' : '?';
    let url = `${base}${sep}Search=${encodeURIComponent('CUCU' + digits)}`;
    if (!/Commodity=/i.test(url)) url += `&Commodity=${commodity}`;
    if (!/Grounded=/i.test(url)) url += `&Grounded=${grounded}`;
    if (extra) url += `&${extra.replace(/^\?*&?/, '')}`;
    url += `&_=${Date.now()}`;
    return url;
  }

  function fetchCUResultHtml(cuNumber){
    const digits = normalizeDigits(cuNumber);
    const cached = cacheGet(digits);
    if (cached) return Promise.resolve(cached);
    const url = makeCuUrl(digits);
    return fetch(url, { method: 'GET', credentials: 'same-origin', headers: { 'x-requested-with': 'XMLHttpRequest' } })
      .then(r => r.text())
      .then(html => { cacheSet(digits, html); return html; })
      .catch(e => { logWarn('Fetch failed', { digits, e }); throw e; });
  }

  function preloadCU(cu){ return fetchCUResultHtml(cu).then(_ => true).catch(_ => false); }
  async function preloadCUs(cuList, concurrency=6){
    const ids = Array.isArray(cuList) ? cuList : String(cuList).split(/[\,\s]+/).filter(Boolean);
    const queue = ids.map(normalizeDigits);
    let inFlight = 0, i = 0, ok = 0, fail = 0;
    return new Promise(resolve => {
      const next = () => {
        while (inFlight < concurrency && i < queue.length){
          const cu = queue[i++];
          inFlight++;
          preloadCU(cu).then(s => { s ? ok++ : fail++; }).finally(() => {
            inFlight--; (i >= queue.length && inFlight === 0) ? resolve({ ok, fail, total: ids.length }) : next();
          });
        }
      };
      next();
    });
  }

  function extractDescriptionFromCUHtml(html, digits){
    try {
      const div = document.createElement('div');
      div.innerHTML = html;
      const tr = div.querySelector(`#cutbl tbody tr[data-copy="${digits}"]`);
      if (!tr) return '';
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()).filter(Boolean);
      const desc = tds.find(x => !/^(?:CU\d{3,}|\d+[\w\s\-]*)$/.test(x) && x.length > 2) || tds[1] || '';
      return desc;
    } catch { return ''; }
  }

  function createDataTransfer(){
    const store = {};
    return {
      setData: (t,v) => { store[t] = String(v); },
      getData: (t) => store[t] || '',
      clearData: (t) => { if (t) delete store[t]; else for (const k in store) delete store[k]; },
      dropEffect: 'copy', effectAllowed: 'all', files: [], items: [], types: []
    };
  }
  function fireDragEvent(type, el, dt){
    const evt = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'dataTransfer', { value: dt });
    el.dispatchEvent(evt);
    return evt;
  }
  function simulateDnD(sourceEl, targets){
    const dt = createDataTransfer();
    fireDragEvent('dragstart', sourceEl, dt);
    for (const t of targets){ fireDragEvent('dragenter', t, dt); fireDragEvent('dragover', t, dt); }
    const dropTarget = targets[targets.length - 1];
    fireDragEvent('drop', dropTarget, dt);
    fireDragEvent('dragend', sourceEl, dt);
  }

  async function setQuantityOnRow_exact(tr, qty){
    const input = tr.querySelector('input.Input_AUFKT');
    if (!input){ logWarn('Qty input .Input_AUFKT not found'); return false; }
    const val = Number(qty);
    if (!Number.isFinite(val) || val < 0){ logWarn('Invalid qty:', qty); return false; }
    input.scrollIntoView({ block: 'nearest' });
    input.focus();
    input.value = '';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    input.value = String(val);
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.blur();
    await sleep(80);
    const now = Number(input.value);
    if (now !== val) logWarn('Qty verify mismatch. UI:', now, 'expected:', val);
    return now === val;
  }

  async function setActionOnRow_exact(tr, action){
    const select = tr.querySelector('select.CUActionSelect');
    if (!select){ logWarn('Action select .CUActionSelect not found'); return false; }
    const target = normalizeActionName(action);
    let opt = Array.from(select.options).find(o => (o.value || '').trim().toUpperCase() === target);
    if (!opt) opt = Array.from(select.options).find(o => (o.textContent || '').trim().toUpperCase() === target);
    if (!opt){ logWarn(`Action "${action}" not found in options`); return false; }
    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.blur?.();
    await sleep(60);
    const shown = (select.selectedOptions[0]?.textContent || '').trim().toUpperCase();
    if (shown !== target && select.value.toUpperCase() !== target){
      logWarn('Action verify mismatch. UI shows:', shown, 'value:', select.value, 'expected:', target);
      return false;
    }
    return true;
  }

  function findChildRowByCU(parentGuid, cuNumberOrName){
    const want = ('CU' + String(cuNumberOrName).trim().replace(/^CU/i, '')).toUpperCase();
    return getDirectRowsUnderParent(parentGuid).find(tr => {
      const idText = (getCUIdFromRow(tr) || '').toUpperCase();
      if (idText === want) return true;
      const dc = tr.getAttribute('data-copy') || tr.dataset.copy;
      if (dc && ('CU' + dc).toUpperCase() === want) return true;
      return false;
    }) || null;
  }

  function findChildRowByCUAndAction(parentGuid, cuNumberOrName, action){
    const want = ('CU' + String(cuNumberOrName).trim().replace(/^CU/i, '')).toUpperCase();
    const act  = normalizeActionName(action);
    return getDirectRowsUnderParent(parentGuid).find(tr => {
      const idText = (getCUIdFromRow(tr) || '').toUpperCase();
      if (idText !== want) return false;
      return getRowActionValue(tr) === act;
    }) || null;
  }

  // --- Wait for the specific newly inserted CU row instance
  async function waitForNewCUChildRow(parentGuid, cuDigits, { timeoutMs = 9000 } = {}){
    const want = ('CU' + String(cuDigits)).toUpperCase();
    const snapshot = new Set(
      getDirectRowsUnderParent(parentGuid)
        .filter(tr => (getCUIdFromRow(tr) || '').toUpperCase() === want)
        .map(tr => tr.dataset.cuguid || tr.outerHTML)
    );
    return new Promise(resolve => {
      const deadline = Date.now() + timeoutMs;
      const tick = () => {
        const nowRows = getDirectRowsUnderParent(parentGuid)
          .filter(tr => (getCUIdFromRow(tr) || '').toUpperCase() === want);
        const fresh = nowRows.find(tr => !snapshot.has(tr.dataset.cuguid || tr.outerHTML));
        if (fresh) return resolve(fresh);
        if (Date.now() > deadline) return resolve(null);
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  async function addCU_byFetchAndDrag(locationName, cuNumber, options = {}){
    const { qty=null, action=null, updateIfExists=true, timeoutMs=9000 } = options;
    const locName = normalizeLocationName(locationName);
    const parentRow = findLocationRowExact(locName);
    if (!parentRow){ console.error('Location not found:', locName); return false; }

    const parentGuid    = parentRow.dataset.cuguid;
    const digits        = normalizeDigits(cuNumber);
    const desiredAction = normalizeActionName(action);

    // (1) If row with exact CU+Action already exists, update qty and return
    if (desiredAction){
      const existing = findChildRowByCUAndAction(parentGuid, digits, desiredAction);
      if (existing){
        if (qty != null) await setQuantityOnRow_exact(existing, qty);
        return true;
      }
    }
    // If updateIfExists and action not specified, update qty on any row with same CU
    if (updateIfExists && !desiredAction){
      const anyRow = findChildRowByCU(parentGuid, digits);
      if (anyRow){ if (qty != null) await setQuantityOnRow_exact(anyRow, qty); return true; }
    }

    // (2) Fetch CU search result HTML and mount hidden host
    const html  = cacheGet(digits) || await fetchCUResultHtml(digits);
    const host  = document.createElement('div');
    host.id     = '__cutbl_host_' + Date.now();
    host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;';
    host.innerHTML = html;
    document.body.appendChild(host);

    try {
      const srcRow = host.querySelector(`#cutbl tbody tr[data-copy="${digits}"]`);
      if (!srcRow){ console.error('CU not found in fetched table:', digits); return false; }

      const container  = document.querySelector('#testgrd1') || parentRow.parentElement;
      const candidates = [
        container,
        parentRow,
        parentRow.querySelector('.tblCUITXTEditable') || parentRow.cells?.[0] || parentRow,
        parentRow.querySelector('.HasChild')        || parentRow.cells?.[1] || parentRow
      ].filter(Boolean);

      // (3) Wait for the **new** CU row instance, not just any CU row
      const insertedRowPromise = waitForNewCUChildRow(parentGuid, digits, { timeoutMs });
      simulateDnD(srcRow, candidates);
      const insertedRow = await insertedRowPromise; // may be null if UI merged

      // (4) Select target row deterministically
      let targetRow = insertedRow;
      if (!targetRow){
        // If UI merged duplicate instead of inserting, fall back to a CU row (prefer default action row)
        const fallback = findChildRowByCU(parentGuid, digits);
        if (!fallback){ console.warn(`DnD fired but no new row detected under ${locName}`); return false; }
        targetRow = fallback;
      }

      // (5) Set Action first, then Qty (some UIs reset qty on action change)
      if (desiredAction) await setActionOnRow_exact(targetRow, desiredAction);
      if (qty != null)   await setQuantityOnRow_exact(targetRow, qty);

      console.log(`Added ${toCUName(digits)} (${desiredAction || 'ACTION?'}) under ${locName}`);
      return true;
    } finally {
      try { document.body.removeChild(host); } catch {}
    }
  }

  async function addCUs_byFetchAndDrag(locationName, cuList, options = {}){
    const items = Array.isArray(cuList) ? cuList : String(cuList).split(/[\,\s]+/).filter(Boolean);
    for (const it of items){
      if (typeof it === 'object' && it.cu){
        await addCU_byFetchAndDrag(locationName, it.cu, { ...options, qty: it.qty, action: it.action });
      } else {
        await addCU_byFetchAndDrag(locationName, it, options);
      }
    }
  }

  async function addByMap_byFetchAndDrag(mapObj, options = {}){
    const allCUs = Array.from(new Set(Object.values(mapObj).flat().map(normalizeDigits)));
    const preloadStats = await preloadCUs(allCUs, options.preloadConcurrency ?? 8);
    console.log(`Preloaded: ${preloadStats.ok}/${preloadStats.total} (failed: ${preloadStats.fail})`);
    const results = {};
    for (const [loc, list] of Object.entries(mapObj)){
      let ok = 0, fail = 0;
      for (const it of list){
        try {
          const { cu, qty, action } = (typeof it === 'object' ? it : { cu: it });
          const added = await addCU_byFetchAndDrag(loc, cu, { ...options, qty, action });
          added ? ok++ : fail++;
        } catch (e) { fail++; console.warn(`Error adding to ${loc}`, e); }
      }
      results[loc] = { ok, fail, total: list.length };
    }
    console.table(results);
    console.log('Finished all mapped locations.');
    return results;
  }

  // CSV & Preview

  function parseCsv(text){
    const lines = text.split(/\r?\n/).map(l => l.trim());
    if (!lines.filter(Boolean).length) return { headers: [], rows: [] };
    const headers = (lines[0] || '').split(',').map(h => h.trim());
    const rows = lines.slice(1).filter(Boolean).map(l => {
      const parts = l.split(',');
      const obj = {}; headers.forEach((h, i) => obj[h] = (parts[i] ?? '').trim());
      return obj;
    });
    return { headers, rows };
  }

  function normalizeJobFromCsvRow(row){
    const get = (k) => row[k] ?? row[k?.toUpperCase?.()] ?? row[k?.toLowerCase?.()] ?? '';
    const loc       = normalizeLocationName(get('Location'));
    const cuRaw     = get('CU');
    const qtyRaw    = get('Qty');
    const actionRaw = get('Action');
    return {
      location: loc,
      cu: normalizeDigits(cuRaw),
      qty: qtyRaw === '' || qtyRaw == null ? null : Number(qtyRaw),
      action: actionRaw ? String(actionRaw).trim() : null
    };
  }

  async function validateCUExists(cuDigits){
    try {
      const html = await fetchCUResultHtml(cuDigits);
      const needle = `data-copy=\"${normalizeDigits(cuDigits)}\"`;
      return html.includes(needle) || html.toUpperCase().includes(('CU' + normalizeDigits(cuDigits)).toUpperCase());
    } catch { return false; }
  }

  async function getCUDescriptionIfValid(cuDigits){
    try {
      const digits = normalizeDigits(cuDigits);
      const html   = await fetchCUResultHtml(digits);
      const ok     = html.includes(`data-copy=\"${digits}\"`) || html.toUpperCase().includes(("CU" + digits).toUpperCase());
      if (!ok) return '';
      return extractDescriptionFromCUHtml(html, digits) || '';
    } catch { return ''; }
  }

  function validateJobFormat(job){
    const errors = [];
    if (!/^L\d{3}\sALT\d+$/.test(job.location)) errors.push('Location must be like "L001 ALT1"');
    if (!/^\d{3,}$/.test(job.cu)) errors.push('CU must be digits (e.g., 100417)');
    if (job.qty != null && (!Number.isFinite(job.qty) || job.qty < 0)) errors.push('Qty must be a non-negative number');
    if (!job.action) errors.push('Action is required (INSTALL or RET REM)');
    return errors;
  }

  async function previewCsvJobs(csvText){
    const { headers, rows } = parseCsv(csvText);
    const jobs = rows.map(normalizeJobFromCsvRow);
    const preview = [];
    for (let i = 0; i < jobs.length; i++){
      const j = jobs[i];
      const errs = validateJobFormat(j);
      const serverOk = await validateCUExists(j.cu);
      if (!serverOk) errs.push('CU not found by strict CUCU search');
      let desc = '';
      if (serverOk && errs.length === 0){ desc = await getCUDescriptionIfValid(j.cu); }
      preview.push({ idx: i+1, ...j, description: desc, valid: errs.length === 0, errors: errs });
    }
    return { headers, preview };
  }

  async function runJobs(previewRows, opts={}){
    const timeoutMs = opts.timeoutMs ?? 9000;
    const rows = previewRows.filter(r => r.valid);
    let ok = 0, fail = 0; const failedDetails = [];
    for (const r of rows){
      try {
        const added = await addCU_byFetchAndDrag(r.location, r.cu, { qty: r.qty, action: r.action, timeoutMs });
        if (added){ ok++; } else { fail++; failedDetails.push(r); }
        if (opts.onProgress) opts.onProgress({ row: r, ok, fail });
      } catch (e) {
        fail++; failedDetails.push(r);
        if (opts.onProgress) opts.onProgress({ row: r, ok, fail, error: e });
      }
    }
    const invalids = previewRows.filter(r => !r.valid);
    return { ok, fail, total: rows.length, invalids, failedDetails };
  }

  // Overlay UI (CSV only) + spinner on Preview + ALT header + Minimize

  function ensureStyles(){
    if (ROOT.document.getElementById('__cu_styles')) return;
    const style = ROOT.document.createElement('style');
    style.id = '__cu_styles';
    style.textContent = `
      @keyframes __cu_spin { to { transform: rotate(360deg); } }
      .__cu_spin { display:inline-block; width:14px; height:14px; margin-right:8px;
        border:2px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%;
        animation: __cu_spin .9s linear infinite; vertical-align: -2px; }
      button.__cu_btn_disabled { opacity:.65; cursor:not-allowed; }
    
 @keyframes __cmplx_flash_fade { 0% { box-shadow: inset 0 0 0 2px #6f42c1; } 60% { box-shadow: inset 0 0 0 2px rgba(111,66,193,.45); } 100% { box-shadow: inset 0 0 0 0 rgba(0,0,0,0); } }
 tr.__cmplx_flash { animation: __cmplx_flash_fade 2.2s ease-out forwards; }
 tr.__cu_parent_selected{ outline:2px dashed #ffb703; outline-offset:-2px; background:rgba(255,183,3,.08); position:relative; }
 tr.__cu_parent_selected::after{ content:'selected'; position:absolute; right:6px; top:6px; background:#ffb703; color:#111; font-size:10px; padding:1px 4px; border-radius:3px; }`;
    ROOT.document.head.appendChild(style);
  }

  function showCUOverlay(){
    ensureStyles();

    let el = ROOT.document.getElementById('__cu_overlay');
    if (el){ el.style.display = 'block'; applyCollapsedState(el, ROOT.__cu_ui.collapsed); return; }

    el = ROOT.document.createElement('div');
    el.id = '__cu_overlay';
    el.style.cssText = [
      'position:fixed','right:20px','bottom:20px','width:560px','z-index:2147483647','background:#111','color:#fff',
      'border-radius:10px','box-shadow:0 8px 24px rgba(0,0,0,.35)','font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial',
      'display:flex','flex-direction:column','max-height:calc(100vh - 40px)'
    ].join(';');

    el.innerHTML = `
      <div id="__cu_hdr" style="cursor:move; user-select:none; padding:8px 10px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222; border-top-left-radius:10px; border-top-right-radius:10px; background:#1a1a1a">
        <b>EAM CU Import — v${IMPORTER_VERSION}</b>
        <div style="display:flex; gap:8px; align-items:center">
          <button id="__cu_sel_toggle" class="__selbtn" style="background:#666; color:#fff; border:0; border-radius:6px; padding:2px 8px; cursor:pointer" title="Select Level 2 Locations">Select</button>
 <button id="__cu_sel_all" class="__selallbtn" style="background:#555; color:#fff; border:0; border-radius:6px; padding:2px 8px; cursor:pointer" title="Select all Level 2 locations">All</button>
 <button id="__cu_sel_delete" class="__delbtn" style="background:#b00020; color:#fff; border:0; border-radius:6px; padding:2px 8px; cursor:pointer" title="Delete CU children under selected locations" disabled>🗑</button>
 <span style="opacity:.9; font-size:12px">ALT:</span>
          <button id="__alt1" class="__altbtn" style="background:#444; color:#fff; border:0; border-radius:6px; padding:2px 8px; cursor:pointer">1</button>
          <button id="__alt2" class="__altbtn" style="background:#444; color:#fff; border:0; border-radius:6px; padding:2px 8px; cursor:pointer">2</button>
          <button id="__alt3" class="__altbtn" style="background:#444; color:#fff; border:0; border-radius:6px; padding:2px 8px; cursor:pointer">3</button>
          <button id="__cu_min"   style="background:#333; color:#fff; border:0; border-radius:6px; padding:2px 8px; cursor:pointer" title="Minimize">–</button>
          <button id="__cu_close" style="background:#c62828; color:#fff; border:0; border-radius:6px; padding:2px 8px; cursor:pointer" title="Close">×</button>
        </div>
      </div>

      <div id="__cu_body" style="padding:12px; overflow:auto; flex:1 1 auto; min-height:0;">
        <div id="__cu_csv_mode" style="margin-bottom:8px; background:#0c0c0c; padding:8px; border-radius:8px">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            <input type="file" id="__cu_csv" accept=".csv" style="flex:1;" />
          </div>
          <small style="opacity:.8">CSV columns: Location, CU, Qty, Action, CMPLX</small>
        </div>

        <div style="display:flex; gap:8px; align-items:center; margin:8px 0; flex-wrap:wrap">
          <button id="__cu_preview" style="flex:1; background:#2c7be5; border:0; color:#fff; border-radius:6px; padding:8px; cursor:pointer">Preview</button>
          <button id="__cu_run"     style="flex:1; background:#28a745; border:0; color:#fff; border-radius:6px; padding:8px; cursor:pointer" disabled class="__cu_btn_disabled">Awaiting Preview</button>
        </div>

        <div id="__cu_invalid_section" style="display:none; background:#1d1414; border:1px solid #522; color:#ffb4b4; border-radius:8px; padding:8px; margin:8px 0">
          <b>Invalid rows (not added):</b>
          <div id="__cu_invalid_list" style="margin-top:6px; font-size:12px; white-space:pre-wrap"></div>
        </div>

        <div id="__cu_counts" style="margin:6px 0; opacity:.95"></div>
        <div id="__cu_preview_box" style="display:none; background:#000; border-radius:8px; padding:6px; max-height:36vh; overflow:auto; margin-top:8px"></div>
      </div>

      <div id="__cu_progress_wrap" style="padding:12px; border-top:1px solid #222;">
        <div id="__cu_progress_bar" title="Click to toggle debug log" style="height:18px; background:#222; border-radius:8px; overflow:hidden; cursor:pointer; position:relative">
          <div id="__cu_progress_fill" style="height:100%; width:0%; background:linear-gradient(90deg,#34c759,#149c2f); transition:width .2s ease;"></div>
          <div id="__cu_progress_text" style="position:absolute; left:8px; top:0; height:100%; display:flex; align-items:center; font-size:12px; color:#fff; opacity:.95">0%</div>
        </div>
        <pre id="__cu_log" style="display:none; background:#000; border-radius:6px; padding:8px; max-height:26vh; overflow:auto; margin-top:8px; color:#eee;"></pre>
      </div>
    `;

    ROOT.document.body.appendChild(el);

    // Drag horizontally (header)
    (function(){
      const hdr = el.querySelector('#__cu_hdr');
      let dragging=false, sx=0, sl=0;
      hdr.addEventListener('mousedown', e => {
        dragging = true; sx = e.clientX; sl = el.offsetLeft || (parseInt(el.style.left)||0);
        e.preventDefault();
        const mm = (ev) => { if (!dragging) return; el.style.left = (sl + ev.clientX - sx) + 'px'; };
        const mu = () => { dragging=false; ROOT.removeEventListener('mousemove', mm); ROOT.removeEventListener('mouseup', mu); };
        ROOT.addEventListener('mousemove', mm); ROOT.addEventListener('mouseup', mu);
      });
    })();

    // Logger helpers (overlay console under progress bar)
    function logPane(){ return ROOT.document.getElementById('__cu_log'); }
    function nowText(){ const d=new Date(); return d.toLocaleTimeString(); }
    function writeLog(kind, msg){ const pre = logPane(); if (!pre) return; pre.textContent += `[${nowText()}] ${kind} | ${msg}\n`; pre.scrollTop = pre.scrollHeight; }
    const OLog = { phase:(m)=>writeLog('PHASE',m), info:(m)=>writeLog('INFO ',m), warn:(m)=>writeLog('WARN ',m), fail:(m)=>writeLog('FAIL ',m) };
 try { ROOT.__cu_OLog = OLog; } catch(e){}

    // Toggle log on progress bar click
    el.querySelector('#__cu_progress_bar').onclick = () => {
      const pre = logPane(); pre.style.display = (pre.style.display === 'none' ? 'block' : 'none');
    };

    // ALT buttons
    function renderALTButtons(){ ['__alt1','__alt2','__alt3'].forEach(id => { const b=el.querySelector('#'+id); const sel=(ROOT.__cu_altTarget===Number(id.slice(-1))); b.style.background = sel ? '#2c7be5' : '#444'; }); }
    function logAltStats(n){ const st=ROOT.__cu_altStats; OLog.info(`ALT set to ${n}; applied:${st.applied} | committed:${st.committed} | hidden:${st.hidden} | frames:${st.frames}`); }
    function pickALT(n){ ROOT.__cu_altTarget = n; const total = visualApplyAll(n); log('ALT apply', { n, total }); renderALTButtons(); logAltStats(n); }
    el.querySelector('#__alt1').onclick = ()=> pickALT(1);
    el.querySelector('#__alt2').onclick = ()=> pickALT(2);
    el.querySelector('#__alt3').onclick = ()=> pickALT(3);
    renderALTButtons();

    // Progress helper for Run
    function setProgress(done,total,failed){
      const d = Number(done)||0, t = Number(total)||0, f = Number(failed)||0;
      const percent = t ? Math.round((d/t)*100) : 0;
      const fill = ROOT.document.getElementById('__cu_progress_fill');
      const text = ROOT.document.getElementById('__cu_progress_text');
      if (!fill || !text) return;
      fill.style.width = percent+'%';
      fill.style.background = f>0 ? 'linear-gradient(90deg,#34c759,#34c759 70%, #b00020)' : 'linear-gradient(90deg,#34c759,#149c2f)';
      text.textContent = `${percent}% (${d}/${t})`;
    }

    // --- Preview spinner ---
    const btnPreview = el.querySelector('#__cu_preview');
    function setPreviewLoading(isLoading){
      if (isLoading){
        btnPreview.disabled = true;
        btnPreview.classList.add('__cu_btn_disabled');
        btnPreview.innerHTML = '<span class="__cu_spin"></span>Previewing…';
      } else {
        btnPreview.disabled = false;
        btnPreview.classList.remove('__cu_btn_disabled');
        btnPreview.textContent = 'Preview';
      }
    }

    // Preview / Run actions
    let previewRows = [];

    async function buildPreviewFromCSV(){
      ROOT.document.getElementById('__cu_invalid_section').style.display = 'none';
      ROOT.document.getElementById('__cu_invalid_list').textContent = '';
      setProgress(0,0,0);

      const file = ROOT.document.getElementById('__cu_csv').files?.[0];
      if (!file){ alert('Choose a CSV first.'); return; }

      setPreviewLoading(true);
      try {
        const csvText = await file.text();
        OLog.phase('Preview start');
        const btnPrev = el.querySelector('#__cu_preview');
const countsEl = ROOT.document.getElementById('__cu_counts');
const { preview } = await (async function(){
  const res = await previewCsvJobs(csvText, { onPreviewProgress: function(i,total){ try{ if(btnPrev) btnPrev.innerHTML = '<span class="__cu_spin"></span>Previewing… (' + i + '/' + total + ')'; }catch(e){} try{ if(countsEl) countsEl.innerHTML = '<b>Preview:</b> Processing ' + i + '/' + total; }catch(e){} } });
  return res;
})();
        previewRows = preview;

        const box = ROOT.document.getElementById('__cu_preview_box');
        const validCount = preview.filter(p=>p.valid).length;
        const total = preview.length;
        const invalid = total - validCount;
        ROOT.document.getElementById('__cu_counts').innerHTML = `<b>Preview:</b> Total ${total} | Valid ${validCount} | Invalid ${invalid} (CU+Action distinct)`;

        const rowsHtml = preview.map(p => {
          const errs = p.errors?.length ? `<div style=\"color:#ffb4b4\">${p.errors.join('; ')}<\/div>` : '';
          const okBadge = p.valid ? '<span style=\"color:#9f9\">VALID<\/span>' : '<span style=\"color:#f99\">INVALID<\/span>';
          const desc = p.valid && p.description ? `<div style=\"color:#bbb; font-size:11px; font-style:italic; margin-top:2px\">${p.description.replace(/</g,'<')}<\/div>` : '';
          return `\n<tr>\n <td style=\"padding:6px 4px; border-bottom:1px solid #222\">${p.idx}<br>${desc}<\/td>\n <td style=\"padding:6px 4px; border-bottom:1px solid #222\">${p.location}<\/td>\n <td style=\"padding:6px 4px; border-bottom:1px solid #222\">CU${p.cu}<\/td>\n <td style=\"padding:6px 4px; border-bottom:1px solid #222\">${p.qty ?? ''}<\/td>\n <td style=\"padding:6px 4px; border-bottom:1px solid #222\">${p.action ?? ''}<\/td>\n <td style=\"padding:6px 4px; border-bottom:1px solid #222\">${okBadge}${errs}<\/td>\n<\/tr>`;
        }).join('');

        box.innerHTML = `\n<table style=\"width:100%; border-collapse:collapse; font-size:12px\">\n<thead><tr>\n<th style=\"text-align:left; border-bottom:1px solid #333; padding:4px\">#<\/th>\n<th style=\"text-align:left; border-bottom:1px solid #333; padding:4px\">Location<\/th>\n<th style=\"text-align:left; border-bottom:1px solid #333; padding:4px\">CU<\/th>\n<th style=\"text-align:left; border-bottom:1px solid #333; padding:4px\">Qty<\/th>\n<th style=\"text-align:left; border-bottom:1px solid #333; padding:4px\">Action<\/th>\n<th style=\"text-align:left; border-bottom:1px solid #333; padding:4px\">Status<\/th>\n<\/tr><\/thead><tbody>${rowsHtml}<\/tbody><\/table>`;
        box.style.display = '';
        OLog.phase('Preview complete');
      } finally {
        setPreviewLoading(false);
      }
    }

    btnPreview.onclick = async () => {
      const pre = logPane(); if (pre) pre.textContent = '';
      await buildPreviewFromCSV();
    };

    el.querySelector('#__cu_run').onclick = async () => {
      if (!previewRows.length){ await buildPreviewFromCSV(); if (!previewRows.length) return; }
      const pre = logPane(); if (pre) pre.textContent = '';
      ROOT.document.getElementById('__cu_invalid_section').style.display = 'none';
      ROOT.document.getElementById('__cu_invalid_list').textContent = '';
      setProgress(0, previewRows.filter(p=>p.valid).length, 0);
      const totalsValid = previewRows.filter(p=>p.valid).length;
      let lastOk=0, lastFail=0;
      OLog.phase('Run start');
      const res = await runJobs(previewRows, { onProgress: ({row,ok,fail}) => {
        setProgress(ok+fail, totalsValid, fail);
        const label = `${row.location} - CU${row.cu} ${row.qty!=null?('x'+row.qty):''} ${row.action||''}`.trim();
        if (fail>lastFail){ OLog.fail('FAIL '+label); } else if (ok>lastOk){ OLog.info('OK '+label); }
        lastOk=ok; lastFail=fail;
      }});
      const invalids = res.invalids || [];
      OLog.phase(`Run done. OK:${res.ok} FAIL:${res.fail} INVALID:${invalids.length}`);
      if (invalids.length){
        const list = invalids.map(x => `#${x.idx} ${x.location} CU${x.cu} ${x.qty ?? ''} ${x.action ?? ''} -- ${(x.errors || []).join('; ')}`).join('\n');
        ROOT.document.getElementById('__cu_invalid_list').textContent = list;
        ROOT.document.getElementById('__cu_invalid_section').style.display = '';
        alert('Some rows were invalid and not added. Please check the invalid section above the progress bar.');
      }
    };

    // Minimize / Close
    el.querySelector('#__cu_min').onclick   = () => { ROOT.__cu_ui.collapsed = !ROOT.__cu_ui.collapsed; applyCollapsedState(el, ROOT.__cu_ui.collapsed); };
    el.querySelector('#__cu_close').onclick = function(){ try{ ROOT.__cu_killed=true; ROOT.__cu_shim_enabled=false; }catch(e){} try{ const ov=ROOT.document.getElementById('__cu_overlay'); if (ov&&ov.parentNode) ov.parentNode.removeChild(ov);}catch(e){} };

    applyCollapsedState(el, ROOT.__cu_ui.collapsed);
  
 // Selection Mode in header + logs
 if (!ROOT.__cu_sel_set) ROOT.__cu_sel_set = new Set();
 ROOT.__cu_sel_mode = !!ROOT.__cu_sel_mode;
 function __isLevel2ParentRow(tr){ try{ return tr && tr.classList.contains('cu_Parent') && Number((tr.querySelector('td.level')?.textContent||'').trim())===2; }catch(e){ return false; } }
 function __toggleSelectRow(tr){ const id = tr?.dataset?.cuguid; if (!id || !__isLevel2ParentRow(tr)) return; try{ OLog.info('Select toggle for '+id); }catch(e){} if (ROOT.__cu_sel_set.has(id)){ ROOT.__cu_sel_set.delete(id); tr.classList.remove('__cu_parent_selected'); } else { ROOT.__cu_sel_set.add(id); tr.classList.add('__cu_parent_selected'); tr.style.position = tr.style.position || 'relative'; } try{ el.querySelector('#__cu_sel_delete').disabled = (ROOT.__cu_sel_set.size===0); OLog.info('Select total = '+ROOT.__cu_sel_set.size); }catch(e){} }
 function __selClickHandler(ev){ if (!ROOT.__cu_sel_mode) return; let tr = ev.target && (ev.target.closest && ev.target.closest('tr')); if (__isLevel2ParentRow(tr)){ ev.preventDefault(); ev.stopPropagation(); __toggleSelectRow(tr); } }
 function __getL2Parents(){ try{ return Array.from(ROOT.document.querySelectorAll('tr.cu_Parent')).filter(function(tr){ try{ return Number((tr.querySelector('td.level')?.textContent||'').trim())===2; }catch(e){return false;} }); }catch(e){ return []; } }
 function enableSelectMode(){ ROOT.__cu_sel_mode=true; try{ ROOT.addEventListener('click', __selClickHandler, true); }catch(e){} try{ ROOT.document.body.style.cursor='crosshair'; }catch(e){} try{ OLog.phase('Selection mode: ENABLED'); }catch(e){} renderSelBtn();

    // Global: EXACT parent display name (no trim)
    try { ROOT.__parentNameFromGuid = function(guid){ try { var tr = ROOT.document.querySelector("tr.cu_Parent[data-cuguid='"+guid+"']"); var name = tr?.querySelector("td.tblCUITXTEditable")?.textContent; return (name==null ? guid : name); } catch(e){ return guid; } }; ROOT.__parentNameFromGuid_alias = ROOT.__parentNameFromGuid; } catch(e){}
 }
 function disableSelectMode(){ ROOT.__cu_sel_mode=false; try{ ROOT.removeEventListener('click', __selClickHandler, true); }catch(e){} try{ ROOT.document.body.style.cursor=''; }catch(e){} try{ OLog.phase('Selection mode: DISABLED'); }catch(e){} renderSelBtn(); }
 function clearSelectionHighlights(){ try{ Array.from(ROOT.document.querySelectorAll('tr.__cu_parent_selected')).forEach(function(r){ r.classList.remove('__cu_parent_selected'); }); }catch(e){} }
 function renderSelBtn(){ try{ const b=el.querySelector('#__cu_sel_toggle'); if (!b) return; b.style.background = ROOT.__cu_sel_mode ? '#2c7be5' : '#666'; b.textContent = ROOT.__cu_sel_mode ? 'Selecting…' : 'Select'; }catch(e){} }
 async function contextDeleteRow(tr, timeout=3000){ try{ const rect=tr.getBoundingClientRect(); const cx=Math.max(0, Math.floor(rect.left+rect.width/2)); const cy=Math.max(0, Math.floor(rect.top+rect.height/2)); const ev = new MouseEvent('contextmenu', {bubbles:true, cancelable:true, view:tr.ownerDocument.defaultView, button:2, clientX:cx, clientY:cy}); tr.dispatchEvent(ev); const doc=tr.ownerDocument; const deadline=Date.now()+timeout; while(Date.now()<deadline){ const menu=doc.querySelector('#dd-menu'); const li = menu && menu.querySelector('li[data-action="delete"]'); const visible = menu && getComputedStyle(menu).display!=='none'; if (li && visible){ li.click(); await sleep(80); return true; } await sleep(60);} }catch(e){} return false; }
 async function waitForRowRemoval(tr, timeout=4000){ const start=Date.now(); while(Date.now()-start<timeout){ if(!ROOT.document.body.contains(tr)) return true; await sleep(60);} return !ROOT.document.body.contains(tr); }
 function tryClickDeleteOnRow(tr){ try{ const del = tr.querySelector('button.DeleteCU, a.DeleteCU, .glyphicon-trash, .fa-trash, [title*="Delete" i], [alt*="Delete" i], .delete, .remove, [class*="trash"]'); if (del){ del.click(); return true; } }catch(e){} return false; }
 async function deleteChildrenUnder(parentGuid){ try{ OLog.info('Delete start for parent '+parentGuid); }catch(e){} const rows = getDirectRowsUnderParent(parentGuid).filter(function(r){ try{ if (r.classList.contains('child')) return true; const lvl = Number((r.querySelector('td.level')?.textContent||'').trim()); return lvl>=3; }catch(e){ return false; } }); let removed=0, failed=0; for (const tr of rows){ const ok = await contextDeleteRow(tr, 3200); if (ok){ const gone = await waitForRowRemoval(tr, 4000); if (gone) removed++; else failed++; } else { if (tryClickDeleteOnRow(tr)){ const gone = await waitForRowRemoval(tr, 4000); if (gone) removed++; else failed++; } else { failed++; } } } try{ OLog.info('Delete done for parent '+parentGuid+' removed='+removed+' failed='+failed+' total='+rows.length); }catch(e){} return { removed, failed, total: rows.length }; }
 try{ el.querySelector('#__cu_sel_toggle').onclick = function(){ if (!ROOT.__cu_sel_mode) enableSelectMode(); else { disableSelectMode(); clearSelectionHighlights(); ROOT.__cu_sel_set.clear(); el.querySelector('#__cu_sel_delete').disabled = true; } }; }catch(e){}
 try{ el.querySelector('#__cu_sel_all').onclick = function(){ if (!ROOT.__cu_sel_mode) enableSelectMode(); try{ OLog.info('Select: ALL Level 2 parents'); }catch(e){} const all = __getL2Parents(); for (var i=0;i<all.length;i++){ const tr=all[i]; const id=tr?.dataset?.cuguid; if (id && !ROOT.__cu_sel_set.has(id)){ ROOT.__cu_sel_set.add(id); tr.classList.add('__cu_parent_selected'); tr.style.position = tr.style.position || 'relative'; } } try{ el.querySelector('#__cu_sel_delete').disabled = (ROOT.__cu_sel_set.size===0); OLog.info('Select total = '+ROOT.__cu_sel_set.size); }catch(e){} }; }catch(e){}
 try{ el.querySelector('#__cu_sel_delete').onclick = async function(){ const ids = Array.from(ROOT.__cu_sel_set); if (!ids.length){ alert('Select one or more Level 2 location rows first.'); return; } let totalRemoved=0, totalFailed=0, total=0; for (const id of ids){ const res = await deleteChildrenUnder(id); totalRemoved+=res.removed; totalFailed+=res.failed; total+=res.total; } try{ OLog.phase('Delete summary: removed '+totalRemoved+' / '+total+' failed '+totalFailed); }catch(e){} alert('Deleted children: '+totalRemoved+' / '+total+(totalFailed?(' (failed: '+totalFailed+')'):'') ); disableSelectMode(); clearSelectionHighlights(); ROOT.__cu_sel_set.clear(); el.querySelector('#__cu_sel_delete').disabled = true; }; }catch(e){}
 renderSelBtn();

    // Preview heartbeat wrapper (cannot be shadowed)
    (function(){ try{ if (ROOT.__cu_preview_wrapped) return; ROOT.__cu_preview_wrapped = true; var beat=null,state={i:0,total:0}; function pump(){ try{ var i=state.i||0,t=state.total||0,p=t?Math.round((i/t)*100):0; var b=ROOT.document.querySelector('#__cu_preview'); var c=ROOT.document.getElementById('__cu_counts'); var f=ROOT.document.getElementById('__cu_progress_fill'); var l=ROOT.document.getElementById('__cu_progress_text'); if(b) b.innerHTML = '<span class="__cu_spin"></span>Previewing… ('+i+'/'+t+')'; if(c) c.innerHTML='<b>Preview:</b> Processing '+i+'/'+t; if(f) f.style.width=p+'%'; if(l) l.textContent=p+'% ('+i+'/'+t+')'; }catch(e){} } function start(){ try{ stop(); beat=setInterval(pump,70);}catch(e){} } function stop(){ try{ if(beat) clearInterval(beat);}catch(e){} beat=null; }
      var orig = previewCsvJobs; previewCsvJobs = async function(csvText, opts){ opts=opts||{}; try{ var parse=(typeof parseCsvAuto==='function')?parseCsvAuto:((typeof parseCsv==='function')?parseCsv:null); if(parse){ var parsed=parse(csvText); var rows=parsed.rows||[]; var jobs=[], seen=Object.create(null), uniq=[]; for (var i=0;i<rows.length;i++){ var r=rows[i]; jobs.push((typeof normalizeJobFromCsvRow2==='function')? normalizeJobFromCsvRow2(r) : normalizeJobFromCsvRow(r)); } for (var j=0;j<jobs.length;j++){ var jj=jobs[j]; if ((jj && jj.type==='cu') || (jj && jj.cu)){ var d=normalizeDigits(jj.cu||''); if(d && !seen[d]){ seen[d]=1; uniq.push(d);} } } state.total = uniq.length + jobs.length; } }catch(e){} start(); var user=opts.onPreviewProgress; opts.onPreviewProgress=function(i,total){ try{ state.i=i; if(total) state.total=total; }catch(e){} try{ if(user) user(i,total);}catch(e){} }; try { return await orig(csvText, opts);} finally { stop(); } };
    }catch(e){} })();

    // Fast bulk delete (includes assembly rows under parent)
    setTimeout(function(){ try{ var delBtn = el.querySelector('#__cu_sel_delete'); if(!delBtn) return; delBtn.onclick = async function(){ var ids = Array.from(ROOT.__cu_sel_set||[]); if(!ids.length){ alert('Select one or more Level 2 location rows first.'); return; } var pageDel = ROOT.document.querySelector('#DelCuBtn'); for (var x=0;x<ids.length;x++){ var id = ids[x]; var parentName = (ROOT.__parentNameFromGuid_alias||ROOT.__parentNameFromGuid||function(v){return v;})(id); try{ (ROOT.__cu_OLog||OLog).phase('Delete start for '+parentName); }catch(e){} if (pageDel){ var rows = Array.from(ROOT.document.querySelectorAll('tr[data-supid="'+id+'"]')); var targets = rows.filter(function(tr){ try{ if (tr.classList && tr.classList.contains('child')) return true; if (tr.classList && tr.classList.contains('cu_Parent')){ var t=(tr.querySelector('td.level')||{}).textContent||''; var n=parseInt(t,10); return (isFinite(n)&&n>=3);} }catch(e){} return false; }); for (var i=0;i<targets.length;i++){ var cb = targets[i].querySelector('input.SelectCUCB'); if (cb && !cb.checked){ cb.checked=true; try{ cb.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){} } } pageDel.click(); var deadline=Date.now()+15000; while(Date.now()<deadline){ if (ROOT.document.querySelectorAll('tr[data-supid="'+id+'"]').length===0) break; await sleep(60);} var ok = ROOT.document.querySelectorAll('tr[data-supid="'+id+'"]').length===0; try{ (ROOT.__cu_OLog||OLog).info('Fast delete '+(ok?'OK':'timeout')+' for '+parentName); }catch(e){} } else { var res = await deleteChildrenUnder(id); try{ (ROOT.__cu_OLog||OLog).info('Fallback delete for '+parentName+' — removed:'+res.removed+' failed:'+res.failed+' total:'+res.total);}catch(e){} } } alert('Delete complete.'); try{ disableSelectMode(); clearSelectionHighlights(); ROOT.__cu_sel_set && ROOT.__cu_sel_set.clear(); el.querySelector('#__cu_sel_delete').disabled=true; }catch(e){} }; }catch(e){} },0);
}

  function applyCollapsedState(el, collapsed){
    const body = el.querySelector('#__cu_body');
    const prog = el.querySelector('#__cu_progress_wrap');
    const minBtn = el.querySelector('#__cu_min');
    if (collapsed){
      body.style.display = 'none'; prog.style.display = 'block';
      el.style.width = '560px'; el.style.maxHeight = 'unset'; el.style.bottom = '20px';
      minBtn.textContent = '+'; minBtn.title = 'Expand';
    } else {
      body.style.display = 'block'; prog.style.display = 'block';
      el.style.width = '560px'; el.style.maxHeight = 'calc(100vh - 40px)';
      minBtn.textContent = '–'; minBtn.title = 'Minimize';
    }
  }

  // Boot

  try {
    installEverywhere();
    showCUOverlay(); // Use this command to bring it back if you close it out.
    let scans = 0; const timer = setInterval(() => {
      installEverywhere();
      const st = ROOT.__cu_altStats; st.frames = ROOT.__cu_frames.size;
      scans++; if (scans>5) clearInterval(timer);
    }, 800);
    log('CU Importer ' + IMPORTER_VERSION + ' ready');
  } catch (e) { warn('boot failed', e); }

  // Expose helpers
  ROOT.previewCsvJobs = previewCsvJobs;
  ROOT.runJobs        = runJobs;
  ROOT.preloadCUs     = preloadCUs;
  ROOT.addCU_byFetchAndDrag   = addCU_byFetchAndDrag;
  ROOT.addCUs_byFetchAndDrag  = addCUs_byFetchAndDrag;
  ROOT.addByMap_byFetchAndDrag= addByMap_byFetchAndDrag;
  ROOT.showCUOverlay  = showCUOverlay;

// This block overrides previewCsvJobs/runJobs and adds CMPLX support + badge without touching
// earlier code paths. It lives inside the same IIFE so it can reuse helpers already defined above.

// --- Helpers: delimiter auto-detect + simple split (Excel/Sheets exports)
function __cmplx_detectDelim(header){ return (header && header.indexOf('\t') !== -1) ? '\t' : ','; }
function __cmplx_split(line, delim){ return String(line).split(delim).map(function(s){ return s.trim(); }); }
function parseCsvAuto(text){
  var t = String(text||'').replace(/\r\n?/g,'\n');
  var lines = t.split('\n').filter(function(l){ return l.length>0; });
  if (!lines.length) return { headers: [], rows: [] };
  var delim = __cmplx_detectDelim(lines[0]);
  var headers = __cmplx_split(lines[0], delim);
  var rows = [];
  for (var i=1;i<lines.length;i++){
    var parts = __cmplx_split(lines[i], delim);
    var obj = {};
    for (var j=0;j<headers.length;j++) obj[headers[j]] = (parts[j] !== undefined ? parts[j] : '').trim();
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function normalizeJobFromCsvRow2(row){
  function get(k){ return row[k] || row[(k||'').toUpperCase()] || row[(k||'').toLowerCase()] || ''; }
  var loc = normalizeLocationName(get('Location'));
  var cuRaw = get('CU');
  var qtyRaw = get('Qty');
  var actionRaw = get('Action');
  var cmplxRaw = get('CMPLX');
  var cuDigits = String(cuRaw||'').trim();
  var cmplxVal = String(cmplxRaw||'').replace(/,/g,'').trim();
  var cmplxNum = cmplxVal !== '' ? Number(cmplxVal) : null;
  var isCmplxRow = (!cuDigits || cuDigits === '0') && (cmplxNum!=null && isFinite(cmplxNum));
  if (isCmplxRow){ return { type:'cmplx', location: loc, cmplx: cmplxNum }; }
  return { type:'cu', location: loc, cu: normalizeDigits(cuRaw), qty: (qtyRaw===''||qtyRaw==null)?null:Number(qtyRaw), action: actionRaw ? String(actionRaw).trim() : null };
}

function validateJobFormat2(job){
  var errors = [];
  if (!/^L\d{3}\sALT\d+$/.test(job.location)) errors.push('Location must be like "L001 ALT1"');
  if (job.type === 'cmplx'){
    if (!(typeof job.cmplx === 'number' && isFinite(job.cmplx))) errors.push('CMPLX must be a number');
    return errors;
  }
  if (!/^\d{3,}$/.test(job.cu)) errors.push('CU must be digits (e.g., 100417)');
  if (job.qty != null && (!isFinite(job.qty) || job.qty < 0)) errors.push('Qty must be a non-negative number');
  if (!job.action) errors.push('Action is required (INSTALL or RET REM)');
  return errors;
}

function findLocationRowLevel2Exact(locationName){
  var name = normalizeLocationName(locationName);
  var parents = Array.prototype.slice.call(document.querySelectorAll('tr.cu_Parent'));
  for (var i=0;i<parents.length;i++){
    var tr = parents[i];
    var lvl = Number(((tr.querySelector('td.level')||{}).textContent||'').trim());
    if (lvl !== 2) continue;
    var txt = ((tr.querySelector('td.tblCUITXTEditable')||{}).textContent||'').trim().toUpperCase();
    if (txt === name) return tr;
  }
  return null;
}

function __cmplx_tryInvoke(inputEl){
  var guid = inputEl && inputEl.getAttribute && inputEl.getAttribute('data-cuguid');
  try {
    if (typeof window !== 'undefined' && typeof window.ComplxFactorChange === 'function' && guid){
      window.ComplxFactorChange(guid);
      return;
    }
  } catch(e){}
  try { inputEl.dispatchEvent(new Event('change', { bubbles:true })); } catch(e){}
}

function showCmplxBadge(tr, factor){
  try{
    var badge = document.createElement('div');
    badge.textContent = 'CMPLX ' + factor + ' applied';
    badge.style.cssText = 'position:absolute;right:4px;top:4px;background:#6f42c1;color:#fff;padding:2px 6px;font-size:11px;border-radius:4px;opacity:0;transition:opacity .25s ease;pointer-events:none;z-index:9999;';
    tr.style.position = tr.style.position || 'relative';
    tr.appendChild(badge);
    requestAnimationFrame(function(){ badge.style.opacity = '1'; });
    setTimeout(function(){ badge.style.opacity = '0'; setTimeout(function(){ try{ badge.remove(); }catch(e){} }, 350); }, 2800);
  }catch(e){}
}

async function setComplexityOnParent(locationName, factor){
  try {
    var tr = findLocationRowLevel2Exact(locationName);
    if (!tr) { console.warn('CMPLX: Level 2 parent not found for', locationName); return false; }
    var input = tr.querySelector('input.Input_COMPLF');
    if (!input){ console.warn('CMPLX: Input_COMPLF not found for', locationName); return false; }
    input.focus();
    input.value = String(factor);
    try { input.dispatchEvent(new InputEvent('input', { bubbles:true })); } catch(e) {}
    __cmplx_tryInvoke(input);
    input.blur();
    tr.style.outline = '2px solid #6f42c1';
    tr.setAttribute('data-cmplx-applied','1');
    showCmplxBadge(tr, factor);
    return true;
  } catch(e){ console.warn('CMPLX set failed', e); return false; }
}


// === Preview-time Location Creation via Add Virtual CU ===
function previewEnsureLocation(locationName){
  var name = normalizeLocationName(locationName);
  if (findLocationRowLevel2Exact(name)) return Promise.resolve(true);

  var btn = document.getElementById('AddVirtual');
  if (!btn) return Promise.resolve(false);

  var origPrompt = window.prompt;
  window.prompt = function(){ return name; };
  try { btn.click(); } catch(e){ window.prompt = origPrompt; return Promise.resolve(false); }
  setTimeout(function(){ window.prompt = origPrompt; }, 50);

  return sleep(400).then(function(){ return !!findLocationRowLevel2Exact(name); });
}

async function previewEnsureAllLocations(jobs){
  var seen = {};
  for (var i=0;i<jobs.length;i++){
    var loc = jobs[i].location;
    if (!loc || seen[loc]) continue;
    seen[loc] = 1;
    var ok = await previewEnsureLocation(loc);
    if (!ok) return false;
  }
  return true;
}

// --- Override previewCsvJobs
previewCsvJobs = function(csvText, opts){
  opts = opts || {};
  var parsed = parseCsvAuto(csvText);
  var rows = parsed.rows || [];
  var preview = [];
  return (async function(){
    var jobs = [];
    for (var i=0;i<rows.length;i++){ jobs.push(normalizeJobFromCsvRow2(rows[i])); }
    if (!(await previewEnsureAllLocations(jobs))){ alert('Preview failed creating required locations.'); return { headers: parsed.headers, preview: [] }; }
    var unique = [], seen = Object.create(null);
    for (var j=0;j<jobs.length;j++){ var jj = jobs[j]; if (jj.type==='cu'){ var d = normalizeDigits(jj.cu); if (d && !seen[d]){ seen[d]=true; unique.push(d); } } }
    try { OLog.info('Preview: unique CU candidates = '+unique.length); } catch(e){}
    var okMap = Object.create(null), descMap = Object.create(null);
    if (unique.length){
      try { await preloadCUs(unique, 10); } catch(e){}
      for (var u=0; u<unique.length; u++){
        try{ var cu = unique[u]; var ok = await validateCUExists(cu); okMap[cu] = !!ok; descMap[cu] = ok ? (await getCUDescriptionIfValid(cu)) : ''; try { OLog.info('Validated CU '+cu+' => '+(ok?'OK':'MISS')); } catch(e){} }catch(e){ okMap[unique[u]] = false; descMap[unique[u]]=''; }
      }
      try { OLog.info('Preview: validated '+unique.length+' / '+unique.length+' unique CUs'); } catch(e){}
    } else { try { OLog.info('Preview: complexity-only import (0 CUs to validate)'); } catch(e){} }
    for (var k=0;k<jobs.length;k++){
      if (opts.onPreviewProgress) { try { opts.onPreviewProgress(k+1, jobs.length); } catch(e){} }
      var j = jobs[k]; var errs = validateJobFormat2(j); var desc = '';
      if (j.type==='cu'){
        var digits = normalizeDigits(j.cu);
        var ok = (unique.length ? !!okMap[digits] : true);
        if (!ok) errs.push('CU not found by strict CUCU search');
        if (ok && errs.length===0){ desc = descMap[digits] || ''; }
      }
      preview.push({ idx:k+1, description: desc, valid: errs.length===0, errors: errs, location: j.location, type: j.type, cu: j.cu, qty: j.qty, action: j.action, cmplx: j.cmplx });
    }
    var rb=document.getElementById('__cu_run'); if(rb){ rb.disabled=false; rb.textContent='Run Import'; rb.classList.remove('__cu_btn_disabled'); } return { headers: parsed.headers, preview: preview };
  })();
};
;

// --- Override runJobs
runJobs = async function(previewRows, opts){ if(!previewRows||!previewRows.length){ alert('Run Preview first.'); return {ok:0,fail:0,total:0,invalids:[],failedDetails:[]}; }
  opts = opts || {}; var timeoutMs = opts.timeoutMs || 9000;
  var rows = (previewRows||[]).filter(function(r){ return r && r.valid; });
  var ok=0, fail=0; var failedDetails=[];
  for (var i=0;i<rows.length;i++){
    var r = rows[i];
    try {
      if (r.type === 'cmplx'){
        var applied = await setComplexityOnParent(r.location, r.cmplx);
        if (applied) ok++; else { fail++; failedDetails.push(r); }
      } else {
        var added = await addCU_byFetchAndDrag(r.location, r.cu, { qty: r.qty, action: r.action, timeoutMs: timeoutMs });
        if (added) ok++; else { fail++; failedDetails.push(r); }
      }
      if (opts.onProgress) opts.onProgress({ row: r, ok: ok, fail: fail });
    } catch(e){
      fail++; failedDetails.push(r);
      if (opts.onProgress) opts.onProgress({ row: r, ok: ok, fail: fail, error: e });
    }
  }
  var invalids = (previewRows||[]).filter(function(r){ return !r.valid; });
  return { ok: ok, fail: fail, total: rows.length, invalids: invalids, failedDetails: failedDetails };
};

// Also expose the overrides to ROOT for external callers
try { ROOT.previewCsvJobs = previewCsvJobs; ROOT.runJobs = runJobs; } catch(e){}

(function(){
  var CMPLX_BADGES = new Set();
  function __cmplx_strongCommit(input){
    try{
      input.focus();
      input.dispatchEvent(new InputEvent('input', { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      ['keydown','keypress','keyup'].forEach(function(type){
        input.dispatchEvent(new KeyboardEvent(type, { bubbles:true, key:'Enter', code:'Enter'}));
      });
      input.blur();
    }catch(e){}
  }
  function syncHiddenCmplxNear(row, factor){
    var n=0;
    try{
      var inputs = row.querySelectorAll('input[type="hidden"], input:not([type])');
      for (var i=0;i<inputs.length;i++){
        var inp = inputs[i];
        var nm = (inp.name||'').toUpperCase();
        var id = (inp.id||'').toUpperCase();
        if (nm.indexOf('COMPLF')>-1 || nm.indexOf('CMPLX')>-1 || id.indexOf('COMPLF')>-1 || id.indexOf('CMPLX')>-1){
          inp.value = String(factor);
          try{ inp.dispatchEvent(new Event('change', { bubbles:true })); }catch(e){}
          n++;
        }
      }
    }catch(e){}
    return n;
  }
  function showCmplxBadgePersistent(tr, factor){
    var old = tr.querySelector('div.__cmplx_badge');
    if (old){ old.textContent = 'CMPLX ' + factor + ' (pending save)'; old.style.background = '#6f42c1'; return old; }
    var badge = document.createElement('div');
    badge.className = '__cmplx_badge';
    badge.textContent = 'CMPLX ' + factor + ' (pending save)';
    badge.style.cssText = 'position:absolute;right:4px;top:4px;background:#6f42c1;color:#fff;padding:2px 6px;font-size:11px;border-radius:4px;opacity:1;pointer-events:none;z-index:9999;';
    tr.style.position = tr.style.position || 'relative';
    tr.appendChild(badge);
    try { CMPLX_BADGES.add(badge); } catch(e){}
    return badge;
  }
  function __cmplx_markResult(ok){
    CMPLX_BADGES.forEach(function(badge){
      try {
        if (ok){ badge.remove(); CMPLX_BADGES.delete(badge); }
        else { badge.style.background = '#b00020'; badge.textContent = (badge.textContent||'').replace('(pending save)','(save failed)'); }
      } catch(e){}
    });
  }
  try{
    var _install = installShimInto;
    installShimInto = function(win){
      _install(win);
      try{
        var _fetch = win.fetch && win.fetch.bind(win);
        if (_fetch && !win.__cmplx_fetch_wrapped){
          win.__cmplx_fetch_wrapped = true;
          win.fetch = async function(input, init){
            var res = await _fetch(input, init);
            try{
              var url = typeof input==='string' ? input : (input && input.url);
              if (url && /\/CU\/ModifyDD(\?|$)/i.test(url)){
                __cmplx_markResult(res && res.ok && res.status>=200 && res.status<300);
              }
            }catch(e){}
            return res;
          };
        }
        if (win.XMLHttpRequest && !win.__cmplx_xhr_wrapped){
          win.__cmplx_xhr_wrapped = true;
          var XO = win.XMLHttpRequest.prototype.open;
          var XS = win.XMLHttpRequest.prototype.send;
          win.XMLHttpRequest.prototype.open = function(method, url){
            this.__cmplx_is_modify = url && /\/CU\/ModifyDD(\?|$)/i.test(url);
            return XO.apply(this, arguments);
          };
          win.XMLHttpRequest.prototype.send = function(body){
            var self = this;
            if (this.__cmplx_is_modify){
              this.addEventListener('loadend', function(){
                try { __cmplx_markResult(self && self.status>=200 && self.status<300); } catch(e){}
              });
            }
            return XS.apply(this, arguments);
          };
        }
      }catch(e){}
    };
  }catch(e){}

  var _setCmplx = setComplexityOnParent;
  setComplexityOnParent = async function(locationName, factor){
    var ok = await _setCmplx(locationName, factor);
    try{
      var tr = findLocationRowLevel2Exact(locationName);
      if (tr){
        showCmplxBadgePersistent(tr, factor);
        var updated = syncHiddenCmplxNear(tr, factor);
        var input = tr.querySelector('input.Input_COMPLF');
        if (input) __cmplx_strongCommit(input);
      }
    }catch(e){}
    return ok;
  };
})();

})();
