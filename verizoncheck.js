(async()=>{

/* Verizon Availability Scanner v6.4
   - DEFAULTS or MANUAL URL selection
   - Optimized one-frame-per-product scan
   - Excel-compatible workbook export with one sheet per device
   - Numeric storage sorting: 128 GB, 256 GB, 512 GB, 1 TB
   - Per-device Color Sort # row
   - Workbook filename: Verizon_Catalog_MM-DD-YY.xls

   Bookmarklet:
   javascript:(async function(){try{const u='https://raw.githubusercontent.com/ElijahRademaker/automation-tools/main/verizoncheck.js?t=%27+Date.now();const r=await fetch(u,{cache:%27no-store%27});if(!r.ok)throw new Error(%27HTTP %27+r.status+%27 %27+r.statusText);const code=await r.text();console.log(%27Loaded Verizon Catalog Updater:%27,u);console.log(code.slice(0,300));(0,eval)(code);}catch(e){alert(%27Verizon Catalog Updater failed to load/run: %27+(e.message||e));console.error(e);}})();
*/
const CFG={
    timeoutMs:45000, readyMs:14000, settleMs:650, afterClickMs:750, maxUrls:150, saveKey:'vz_availability_v64_state', debug:true
  }
  ;

const DEFAULT_URLS=[
'https://www.verizon.com/tablets/apple-ipad-air-11-inch-m4/?sku=sku6045109',
'https://www.verizon.com/tablets/apple-ipad-air-13-inch-m4/?sku=sku6045050',
'https://www.verizon.com/tablets/apple-ipad-pro-13-inch-m5/?sku=sku6040602',
'https://www.verizon.com/tablets/apple-ipad-pro-11-inch-m5/?sku=sku6040623',
'https://www.verizon.com/smartphones/apple-iphone-air/?sku=sku6037390',
'https://www.verizon.com/smartphones/apple-iphone-17/?sku=sku6037251',
'https://www.verizon.com/smartphones/apple-iphone-17-pro/?sku=sku6037286',
'https://www.verizon.com/smartphones/apple-iphone-17-pro-max/?sku=sku6037281',
'https://www.verizon.com/smartphones/google-pixel-10/?sku=sku6035292',
'https://www.verizon.com/smartphones/google-pixel-10-pro/?sku=sku6035254',
'https://www.verizon.com/smartphones/google-pixel-10-pro-fold/?sku=sku6035280',
'https://www.verizon.com/smartphones/google-pixel-10-pro-xl/?sku=sku6035309'
];

const COLORS=['natural titanium', 'black titanium', 'white titanium', 'blue titanium', 'desert titanium', 'space black', 'space gray', 'space grey', 'rose gold', 'ultramarine', 'wintergreen', 'lemongrass', 'moonstone', 'porcelain', 'obsidian', 'starlight', 'midnight', 'graphite', 'lavender', 'charcoal', 'cobalt', 'denim', 'frost', 'violet', 'purple', 'yellow', 'silver', 'orange', 'cosmic', 'hazel', 'jade', 'iris', 'peony', 'rose', 'pink', 'blue', 'sky', 'bay', 'aqua', 'teal', 'mint', 'green', 'sage', 'red', 'coral', 'gold', 'gray', 'grey', 'black', 'white', 'cream', 'snow', 'onyx', 'space', 'sand', 'aloe', 'linen', 'mist', 'plum', 'navy'];

const OOS=/out\s*of\s*stock|sold\s*out|currently\s*unavailable|temporarily\s*unavailable|this selection is out of stock/i;

const SHIP=/free shipping|ship by|shipping by|delivery/i;

const PICKUP_ONLY=/only available for express pickup|express pickup/i;

const PICKUP=/pick up in as little as|select store|pickup/i;

const $sleep=ms=>new Promise(r=>setTimeout(r, ms));

const norm=v=>String(v||'').replace(/\s+/g, ' ').trim();

const low=v=>norm(v).toLowerCase();

const now=()=>new Date().toISOString();

const log=(...a)=>{
    if(CFG.debug)console.log('[VZ v6.4]', ...a)
  }
  ;

function title(s){
    return norm(s).toLowerCase().replace(/\b\w/g, c=>c.toUpperCase())
  }

  function knownColor(t){
    t=low(t);
    for(const c of [...COLORS].sort((a, b)=>b.length-a.length)){
      const e=c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if(new RegExp(`\\b${e
    }
    \\b`, 'i').test(t))return title(c)
  }
  return''
}

function makeUi(){
  const old=document.getElementById('vz-v64');
  if(old)old.remove();
  const d=document.createElement('div');
  d.id='vz-v64';
  d.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483647;background:#111;color:#fff;width:530px;max-width:calc(100vw - 36px);padding:14px;border-radius:12px;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 8px 28px #0008;border:1px solid #444';
  d.innerHTML=`<b>Verizon Availability Scanner v6.4</b><div id=s style="margin:8px 0;color:#eee">Starting...</div><div style="height:10px;background:#333;border-radius:99px;overflow:hidden"><div id=b style="height:100%;width:0;background:#0af"></div></div><pre id=p style="white-space:pre-wrap;color:#bbb;font:12px Arial;margin:8px 0 0;max-height:150px;overflow:auto"></pre><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px"><button id=h>Hide</button><button id=e>Export Partial</button><button id=c>Clear Saved Progress</button><button id=pa>Pause</button></div>`;
  document.body.appendChild(d);
  for(const b of d.querySelectorAll('button'))b.style.cssText='background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:4px 8px';
  const api={
    paused:false, rowsProvider:null, set(o={

    }
    ){
      if(Number.isFinite(o.percent))d.querySelector('#b').style.width=Math.max(0, Math.min(100, o.percent))+'%';
      if(o.status!=null)d.querySelector('#s').textContent=o.status;
      if(o.details!=null)d.querySelector('#p').textContent=o.details
    }
    , done(m, x){
      this.set({
        percent:100, status:m, details:x
      }
      )
    }

  }
  ;
  d.querySelector('#h').onclick=()=>d.style.display='none';
  d.querySelector('#e').onclick=()=>{
    const rows=api.rowsProvider?api.rowsProvider():[];
    if(rows.length)downloadWorkbook(rows, catalogFilename('_partial'));
    else alert('No rows collected yet.')
  }
  ;
  d.querySelector('#c').onclick=()=>{
    localStorage.removeItem(CFG.saveKey);
    alert('Saved progress cleared.')
  }
  ;
  d.querySelector('#pa').onclick=()=>{
    api.paused=!api.paused;
    d.querySelector('#pa').textContent=api.paused?'Resume':'Pause'
  }
  ;
  return api
}

const ui=makeUi();

function askUrls(){
  const mode=prompt('Choose product list mode:\n\nType DEFAULTS to run the built-in Verizon product list.\nType MANUAL to paste your own product URLs.', 'DEFAULTS');
  if(!mode)return[];
  if(/^d|default/i.test(mode.trim()))return DEFAULT_URLS.slice();
  const def=/(\.|^)verizon\.com$/i.test(location.hostname)?location.href:'';
  const x=prompt('Paste Verizon product URLs. Separate multiple URLs with commas or new lines.', def);
  return x?x.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).filter((u, i, a)=>a.indexOf(u)===i).slice(0, CFG.maxUrls):[]
}

function vzUrl(u){
  const x=new URL(u, location.href);
  if(!/(\.|^)verizon\.com$/i.test(x.hostname))throw Error('Not a Verizon URL: '+u);
  return x.href
}

function catalogFilename(suffix=''){
  const d=new Date(), mm=String(d.getMonth()+1).padStart(2, '0'), dd=String(d.getDate()).padStart(2, '0'), yy=String(d.getFullYear()).slice(-2);
  return `Verizon_Catalog_${mm
}
-${dd
}
-${yy
}
${suffix
}
.xls`
}

function getState(urls){
  const key=urls.join('|');
  try{
    const s=JSON.parse(localStorage.getItem(CFG.saveKey)||'{}');
    if(s.urlKey===key&&Array.isArray(s.rows)&&s.done)return s
  }
  catch{

  }
  return{
    urlKey:key, rows:[], done:{

    }
    , startedAt:now(), version:'v6.4'
  }

}

function saveState(s){
  try{
    localStorage.setItem(CFG.saveKey, JSON.stringify(s))
  }
  catch(e){
    console.warn('Could not save progress', e)
  }

}

async function frame(url){
  return new Promise((res, rej)=>{
    const f=document.createElement('iframe');
    f.style.cssText='position:fixed;left:-99999px;top:0;width:1500px;height:1700px;opacity:0;pointer-events:none';
    f.setAttribute('aria-hidden', 'true');
    const t=setTimeout(()=>{
      f.remove();
      rej(Error('Timeout loading '+url))
    }
    , CFG.timeoutMs);
    f.onload=
    async()=>{
      clearTimeout(t);
      await ready(f);
      res(f)
    }
    ;
    f.src=url;
    document.body.appendChild(f)
  }
  )
}

const doc=f=>f.contentDocument||f.contentWindow.document;

async function ready(f){
  const start=Date.now();
  while(Date.now()-start<CFG.readyMs){
    const body=doc(f)?.body?.innerText||'';
    if(/Customize your device|Storage|Color\s*:/i.test(body)){
      await $sleep(CFG.settleMs);
      return
    }
    await $sleep(350)
  }
  await $sleep(CFG.settleMs)
}

function visible(el){
  if(!el||!el.ownerDocument?.defaultView)return false;
  const s=el.ownerDocument.defaultView.getComputedStyle(el), r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity!==0&&r.width>0&&r.height>0
}

function rect(el){
  const r=el.getBoundingClientRect();
  return{
    l:Math.round(r.left), t:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height), cx:Math.round(r.left+r.width/2), cy:Math.round(r.top+r.height/2)
  }

}

function own(el){
  return el?norm(Array.from(el.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ')):''
}

function direct(el){
  if(!el)return'';
  const p=[el.getAttribute?.('aria-label'), el.getAttribute?.('title'), el.getAttribute?.('alt'), el.getAttribute?.('data-color'), el.getAttribute?.('data-value'), el.value, own(el)];
  if(el.id){
    const lab=el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)
  }
  "]`);
  if(lab)p.push(lab.getAttribute('aria-label'), lab.getAttribute('title'), own(lab), norm(lab.innerText||lab.textContent||''))
}
return norm(p.filter(Boolean).join(' '))
}

function deep(el){
  if(!el)return'';
  const p=[], push=n=>{
    if(!n)return;
    p.push(n.getAttribute?.('aria-label'), n.getAttribute?.('title'), n.getAttribute?.('alt'), n.getAttribute?.('data-color'), n.getAttribute?.('data-value'), n.value, n.innerText, n.textContent)
  }
  ;
  push(el);
  Array.from(el.querySelectorAll?.('*')||[]).slice(0, 16).forEach(push);
  if(el.id){
    const lab=el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)
  }
  "]`);
  push(lab);
  Array.from(lab?.querySelectorAll?.('*')||[]).slice(0, 16).forEach(push)
}
return norm(p.filter(Boolean).join(' '))
}

function oos(el){
  return !!el&&OOS.test(direct(el))
}

function disabled(el){
  return !!el&&(el.disabled===true||el.getAttribute('aria-disabled')==='true'||el.getAttribute('disabled')!==null||/\bdisabled\b/i.test(direct(el))||oos(el))
}

function deviceName(d){
  for(const q of ['h1', '[data-testid*="product-title" i]', '[class*="product-title" i]', 'meta[property="og:title"]']){
    const el=d.querySelector(q);
    if(!el)continue;
    if(el.tagName==='META'){
      const c=norm(el.content);
      if(c)return c.replace(/\|.*$/, '').trim()
    }

    const t=norm(el.textContent);
    if(t)return t
  }
  return norm(d.title).replace(/\|.*$/, '').trim()||'Unknown device'
}

function conf(d){
  const body=d.body?.innerText||'';
  const m=body.match(/Customize your device([\s\S]*?)(?:Tell us about yourself|New customer|Existing customer)/i);
  return norm(m?m[1]:body.slice(0, 2200))
}

function selectedColor(d){
  const m=conf(d).match(/Color\s*:\s*([A-Za-z][A-Za-z\s-]{1,45}?)(?=\s+Color\s*:|\s+Storage\b|$)/i);
  if(!m)return'';
  const c=norm(m[1]).replace(/Out of stock|Selected/ig, '').trim();
  return c?(knownColor(c)||title(c)):''
}

function storagesFromText(d){
  let s=conf(d), ix=s.search(/\bStorage\b/i);
  if(ix<0)return[];
  s=s.slice(ix).split(/Free shipping|Tell us about yourself|New customer|Existing customer|This item is only available for Express Pickup/i)[0];
  const ms=[...s.matchAll(/\b(\d+\s*(?:GB|TB))\b/gi)], out=[];
  for(let i=0;
  i<ms.length;
  i++){
    const label=ms[i][1].replace(/\s+/g, ' ').toUpperCase();
    if(out.some(x=>x.label===label))continue;
    const start=ms[i].index+ms[i][0].length, end=i+1<ms.length?ms[i+1].index:s.length, seg=s.slice(start, end), is=OOS.test(seg);
    out.push({
      index:out.length, label, outOfStock:is, disabled:is, rawText:norm(ms[i][0]+seg)
    }
    )
  }
  return out
}

function labelY(d, re, min=0, max=Infinity){
  const n=Array.from(d.body.querySelectorAll('*')).filter(visible).map(el=>({
    el, t:norm(el.textContent||''), r:rect(el)
  }
  )).filter(x=>x.t&&x.t.length<180&&x.r.t>=min&&x.r.t<=max&&re.test(x.t)).sort((a, b)=>a.r.t-b.r.t);
  return n[0]?.r.t??null
}

function bounds(d){
  const c=labelY(d, /Customize your device/i)??0, t=labelY(d, /Tell us about yourself|New customer|Existing customer/i, c)??1000, col=labelY(d, /^\s*Color\s*:?.*$/i, c, t)??labelY(d, /Color\s*:/i, c, t), sto=labelY(d, /^\s*Storage\s*:?.*$/i, c, t)??labelY(d, /^Storage$/i, c, t);
  return{
    colorTop:col, colorBottom:sto, storageTop:sto, storageBottom:t
  }

}

function inY(el, top, bot){
  const y=rect(el).cy;
  return(top==null||y>=top+3)&&(bot==null||y<=bot-3)
}

function clickable(el){
  if(el.tagName.toLowerCase()==='input'&&el.type==='radio'){
    if(el.id){
      const lab=el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)
    }
    "]`);
    if(lab&&visible(lab))return lab
  }

  const lab=el.closest('label');
  if(lab&&visible(lab))return lab
}
return el
}

function controls(d){
  return Array.from(d.querySelectorAll('button,input[type="radio"],label,[role="radio"],[role="button"],select,option,[aria-label]')).filter(visible).map(clickable)
}

function bad(s){
  s=low(s);
  return/network-outage|payment|phoenix|flex|upgrade|monthly|pricing|customer|simplicity|checkout|cart|activation|device unlocking|terms|pagination|next page|previous page|compare devices|currently viewing|select store|open-ispu-modal|fulfillment-section/i.test(s)||s.length>260
}

function storageControls(d){
  const b=bounds(d), arr=controls(d).filter(el=>inY(el, b.storageTop, b.storageBottom)).filter(el=>{
    const r=rect(el), s=direct(el)||deep(el);
    return r.w<=720&&r.h<=280&&/\b\d+\s*(gb|tb)\b/i.test(s)&&!bad(s.replace(OOS, ''))
  }
  );
  const out=[], seen=new Set();
  for(const el of arr){
    const s=direct(el)||deep(el), m=s.match(/\b\d+\s*(gb|tb)\b/i), key=m?m[0].toLowerCase().replace(/\s+/g, ''):low(s);
    if(!seen.has(key)){
      seen.add(key);
      out.push(el)
    }

  }
  return out
}

function storagePlan(d){
  const parsed=storagesFromText(d), els=storageControls(d);
  if(parsed.length)return parsed.map((p, i)=>{
    const el=els.find(e=>new RegExp(p.label.replace(' ', '\\s*'), 'i').test(direct(e)||deep(e)))||els[i]||null;
    const spec=el?direct(el):'', is=p.outOfStock||oos(el);
    return{
      ...p, index:i, outOfStock:is, disabled:is||disabled(el), controlIndex:i, rawText:spec||p.rawText
    }

  }
  );
  return els.map((el, i)=>{
    const s=direct(el)||deep(el), m=s.match(/\b\d+\s*(gb|tb)\b/i), is=oos(el);
    return{
      index:i, label:m?m[0].replace(/\s+/g, ' ').toUpperCase():`Storage ${i+1
    }
    `, outOfStock:is, disabled:is||disabled(el), controlIndex:i, rawText:s
  }

}
)
}

function swatch(el){
  const r=rect(el);
  return r.w>=5&&r.h>=5&&r.w<=240&&r.h<=210
}

function colorSignal(el){
  const s=direct(el)||deep(el);
  if(/\b\d+\s*(gb|tb)\b/i.test(s))return false;
  if(bad(s.replace(OOS, '')))return false;
  return knownColor(s)||/color|swatch|out\s*of\s*stock/i.test(s)||['button', 'label', 'input'].includes(el.tagName.toLowerCase())||low(el.getAttribute?.('role')||'')==='radio'
}

function colorControls(d){
  const b=bounds(d);
  if(b.colorTop==null||b.colorBottom==null)return[];
  const raw=controls(d).filter(el=>inY(el, b.colorTop, b.colorBottom)).filter(swatch).filter(colorSignal), out=[], seen=new Set();
  for(const el of raw){
    const r=rect(el), key=`${Math.round(r.cx/7)*7
  }
  :${Math.round(r.cy/7)*7
}
`;
if(!seen.has(key)){
  seen.add(key);
  out.push(el)
}

}
return out.sort((a, b)=>Math.abs(rect(a).cy-rect(b).cy)>12?rect(a).cy-rect(b).cy:rect(a).cx-rect(b).cx)
}

async function click(el){
  if(!el||!visible(el)||oos(el)||disabled(el))return false;
  const r=rect(el);
  if(r.w>760||r.h>320)return false;
  el.scrollIntoView({
    block:'center', inline:'center'
  }
  );
  await $sleep(100);
  if(el.tagName.toLowerCase()==='option'){
    const s=el.closest('select');
    if(!s)return false;
    s.value=el.value;
    s.dispatchEvent(new Event('input', {
      bubbles:true
    }
    ));
    s.dispatchEvent(new Event('change', {
      bubbles:true
    }
    ))
  }
  else{
    try{
      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles:true
      }
      ))
    }
    catch{

    }
    el.dispatchEvent(new MouseEvent('mousedown', {
      bubbles:true
    }
    ));
    el.click();
    el.dispatchEvent(new MouseEvent('mouseup', {
      bubbles:true
    }
    ));
    try{
      el.dispatchEvent(new PointerEvent('pointerup', {
        bubbles:true
      }
      ))
    }
    catch{

    }

  }
  await $sleep(CFG.afterClickMs);
  return true
}

async function discoverColors(d){
  let sw=colorControls(d);
  if(!sw.length)return[{
    index:0, label:selectedColor(d)||'N/A', outOfStock:false, disabled:false, rawText:''
  }
  ];
  const colors=[];
  for(let i=0;
  i<sw.length;
  i++){
    sw=colorControls(d);
    const el=sw[i];
    if(!el)continue;
    const raw=direct(el)||deep(el);
    let name=knownColor(raw)||`Color ${i+1
  }
  `;
  const is=oos(el);
  if(!is){
    await click(el);
    await $sleep(250);
    name=selectedColor(d)||knownColor(raw)||name
  }
  colors.push({
    index:i, label:name, outOfStock:is, disabled:is||disabled(el), rawText:raw
  }
  )
}

const out=[], seen=new Set();
for(const c of colors){
  const key=c.label.toLowerCase();
  if(!seen.has(key)||/^color \d+$/i.test(c.label)){
    seen.add(key);
    out.push(c)
  }

}
return out.length?out:[{
  index:0, label:selectedColor(d)||'N/A', outOfStock:false, disabled:false, rawText:''
}
]
}

function availability(d, storage, color, storageEl, colorEl){
  if(color?.outOfStock||oos(colorEl))return{
    a:'Out of stock', e:`Specific color option unavailable: ${color?.rawText||direct(colorEl)
  }
  `
}
;
if(storage?.outOfStock||oos(storageEl))return{
  a:'Out of stock', e:`Specific storage option unavailable: ${storage?.rawText||direct(storageEl)
}
`
}
;
const body=norm(d.body?.innerText||'');
if(PICKUP_ONLY.test(body))return{
  a:'Out of stock', e:'Express Pickup-only messaging visible; no normal shipping availability for this selected configuration'
}
;
if(SHIP.test(body))return{
  a:'In stock', e:'Shipping/delivery text visible after this selection'
}
;
if(PICKUP.test(body)&&!SHIP.test(body))return{
  a:'Out of stock', e:'Pickup/store-only option visible without normal shipping text for this selected configuration'
}
;
return{
  a:'Unknown', e:'No direct stock signal found for this specific option'
}

}

async function pauseCheck(){
  while(ui.paused){
    ui.set({
      status:'Paused', details:'Click Resume to continue.'
    }
    );
    await $sleep(500)
  }

}

function comboKey(url, s, c){
  return`${url
}
|||${s.label
}
|||${c.label
}
|||${s.index
}
|||${c.index
}
`
}

async function scanProduct(url, idx, total, state){
  ui.set({
    percent:Math.round(idx/Math.max(1, total)*100), status:`Loading ${idx+1
  }
  /${total
}
`, details:url
}
);
const f=await frame(url), d=doc(f);
try{
  const device=deviceName(d);
  let stores=storagePlan(d);
  if(!stores.length)stores=[{
    index:0, label:'N/A', outOfStock:false, disabled:false, rawText:''
  }
  ];
  const colors=await discoverColors(d);
  log('Detected', device, {
    stores, colors
  }
  );
  const combos=stores.length*colors.length;
  let local=0;
  for(const c0 of colors){
    await pauseCheck();
    let cc=colorControls(d), colorEl=cc[c0.index]||null, finalColor=c0.label, rawColor=colorEl?(direct(colorEl)||deep(colorEl)||c0.rawText):c0.rawText;
    if(colorEl&&!oos(colorEl)){
      await click(colorEl);
      await $sleep(250);
      finalColor=selectedColor(d)||knownColor(rawColor)||finalColor
    }
    for(const s0 of stores){
      await pauseCheck();
      const rowColor={
        ...c0, label:finalColor, rawText:rawColor, outOfStock:c0.outOfStock||oos(colorEl), disabled:c0.disabled||disabled(colorEl)
      }
      , key=comboKey(url, s0, rowColor);
      if(state.done[key]){
        local++;
        continue
      }

      const pct=Math.round(((idx+(local/Math.max(1, combos)))/Math.max(1, total))*100);
      ui.set({
        percent:pct, status:`${device
      }
       (${idx+1
    }
    /${total
  }
  )`, details:`Overall: ${idx+1
}
/${total
}
 devices\nDevice combo: ${local+1
}
/${combos
}
\nStorage: ${s0.label
}
\nColor: ${rowColor.label
}
\nRows collected: ${state.rows.length
}
\nURL: ${url
}
`
}
);
let current=storagePlan(d).find(s=>s.label===s0.label)||storagePlan(d)[s0.index]||s0, sc=storageControls(d), storageEl=sc.find(e=>new RegExp((current.label||s0.label).replace(' ', '\\s*'), 'i').test(direct(e)||deep(e)))||sc[current.controlIndex]||sc[s0.index]||null, row;
if(rowColor.outOfStock||oos(colorEl))row={
  'Scanned At':now(), 'Product URL':url, 'Device':device, 'Storage':current.label||s0.label, 'Color':rowColor.label, 'Availability':'Out of stock', 'Evidence':`Specific color option unavailable: ${rowColor.rawText||direct(colorEl)
}
`
}
;
else if(current.outOfStock||oos(storageEl))row={
  'Scanned At':now(), 'Product URL':url, 'Device':device, 'Storage':current.label||s0.label, 'Color':rowColor.label, 'Availability':'Out of stock', 'Evidence':`Specific storage option unavailable: ${current.rawText||direct(storageEl)
}
`
}
;
else{
  if(storageEl)await click(storageEl);
  await $sleep(250);
  finalColor=selectedColor(d)||finalColor;
  rowColor.label=finalColor;
  const av=availability(d, current, rowColor, storageEl, colorEl);
  row={
    'Scanned At':now(), 'Product URL':url, 'Device':device, 'Storage':current.label||s0.label, 'Color':rowColor.label, 'Availability':av.a, 'Evidence':av.e
  }

}
state.rows.push(row);
state.done[key]=true;
saveState(state);
console.log(row);
local++
}

}

}
finally{
  f.src='about:blank';
  f.remove();
  await $sleep(250)
}

}

function storageVal(s){
  s=low(s).replace(/\s+/g, '');
  const m=s.match(/([0-9.]+)(tb|gb|mb)/i);
  if(!m)return 999999;
  let n=parseFloat(m[1]);
  if(m[2].toLowerCase()==='tb')n*=1024;
  if(m[2].toLowerCase()==='mb')n/=1024;
  return n
}

function xml(s){
  return String(s??'').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function cell(v, st){
  const n=typeof v==='number'&&Number.isFinite(v);
  return`<Cell${st?` ss:StyleID="${st
}
"`:''
}
><Data ss:Type="${n?'Number':'String'
}
">${xml(v)
}
</Data></Cell>`
}

function row(vals, st){
  return`<Row>${vals.map(v=>Array.isArray(v)?cell(v[0], v[1]):cell(v, st)).join('')
}
</Row>`
}

function ssName(base, used){
  let n=norm(base||'Sheet').replace(/[\\/\?\*\[\]:]/g, ' ').slice(0, 31).trim()||'Sheet', o=n, i=2;
  while(used.has(n.toLowerCase())){
    const s=` (${i++
  }
  )`;
  n=o.slice(0, 31-s.length)+s
}
used.add(n.toLowerCase());
return n
}

function statStyle(s){
  s=low(s);
  if(s.includes('in stock'))return'sIn';
  if(s.includes('out of stock'))return'sOut';
  if(s.includes('error'))return'sErr';
  return'sWarn'
}

function downloadWorkbook(rows, filename=catalogFilename()){
  const used=new Set(), groups=new Map();
  for(const r of rows){
    const k=(r.Device||'Unknown')+'|||'+(r['Product URL']||'');
    if(!groups.has(k))groups.set(k, []);
    groups.get(k).push(r)
  }

  const styles=`<Styles><Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style><Style ss:ID="sTitle"><Font ss:Bold="1" ss:Size="14"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style><Style ss:ID="sHead"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#305496" ss:Pattern="Solid"/></Style><Style ss:ID="sSub"><Font ss:Bold="1"/><Interior ss:Color="#E2F0D9" ss:Pattern="Solid"/></Style><Style ss:ID="sIn"><Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/><Font ss:Color="#006100"/></Style><Style ss:ID="sOut"><Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/><Font ss:Color="#9C0006"/></Style><Style ss:ID="sWarn"><Interior ss:Color="#FFEB9C" ss:Pattern="Solid"/></Style><Style ss:ID="sErr"><Interior ss:Color="#F4B084" ss:Pattern="Solid"/><Font ss:Bold="1"/></Style><Style ss:ID="sNote"><Font ss:Color="#666666" ss:Italic="1"/></Style></Styles>`;
  const sheets=[];
  sheets.push(`<Worksheet ss:Name="Instructions"><Table><Column ss:Width="220"/><Column ss:Width="820"/>${row([['Purpose', 'sHead'], ['How to use this workbook', 'sHead']])
}
${row(['Sheets', 'One sheet per device/product URL, plus Raw Data.'])
}
${row(['Storage sort', 'Storage rows are sorted numerically: 128 GB, 256 GB, 512 GB, 1 TB.'])
}
${row(['Color sort', 'Edit the Color Sort # row per device. Lower numbers sort farther left. To reorder colors, select the color/status columns and use Excel Data > Sort > Options > Sort left to right by the Color Sort # row.'])
}
${row(['URL mode', 'At startup choose DEFAULTS for the built-in 12-product list or MANUAL to paste URLs.'])
}
</Table></Worksheet>`);
for(const [k, items] of groups){
  const device=items[0].Device||'Unknown Device', url=items[0]['Product URL']||'', name=ssName(device, used), storages=[...new Set(items.map(r=>r.Storage||'N/A'))].sort((a, b)=>storageVal(a)-storageVal(b)||String(a).localeCompare(String(b))), colors=[...new Set(items.map(r=>r.Color||'N/A'))], map=new Map(items.map(r=>[(r.Storage||'N/A')+'|||'+(r.Color||'N/A'), r]));
  let t='<Table><Column ss:Width="135"/>'+colors.map(()=>'<Column ss:Width="125"/>').join('')+'<Column ss:Width="420"/>';
  t+=row([[device, 'sTitle'], ['', 'sTitle']]);
  t+=row(['Product URL', url]);
  t+=row(['Generated', now()]);
  t+=row([['Color Sort #', 'sSub'], ...colors.map((c, i)=>[i+1, 'sSub']), ['Notes', 'sSub']]);
  t+=row([['Storage \\ Color', 'sHead'], ...colors.map(c=>[c, 'sHead']), ['Evidence / Notes', 'sHead']]);
  for(const s of storages){
    const notes=[], vals=[[s, 'sHead']];
    for(const c of colors){
      const r=map.get(s+'|||'+c);
      vals.push([r?r.Availability:'', r?statStyle(r.Availability):'']);
      if(r?.Evidence)notes.push(`${c
    }
    : ${r.Evidence
  }
  `)
}
vals.push([notes.join(' | '), 'sNote']);
t+=row(vals)
}
t+='</Table>';
sheets.push(`<Worksheet ss:Name="${xml(name)
}
">${t
}
</Worksheet>`)
}

const rawName=ssName('Raw Data', used), heads=['Scanned At', 'Product URL', 'Device', 'Storage', 'Color', 'Availability', 'Evidence'];
let raw='<Table>'+heads.map(()=>'<Column ss:Width="150"/>').join('')+row(heads.map(h=>[h, 'sHead']));
for(const r of rows)raw+=row(heads.map(h=>[r[h]??'', h==='Availability'?statStyle(r[h]):'']));
raw+='</Table>';
sheets.push(`<Worksheet ss:Name="${rawName
}
">${raw
}
</Worksheet>`);
const wb=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${styles
}
${sheets.join('')
}
</Workbook>`;
const blob=new Blob([wb], {
  type:'application/vnd.ms-excel'
}
), u=URL.createObjectURL(blob), a=document.createElement('a');
a.href=u;
a.download=filename;
document.body.appendChild(a);
a.click();
setTimeout(()=>{
  URL.revokeObjectURL(u);
  a.remove()
}
, 500)
}

async function main(){
  if(!/(\.|^)verizon\.com$/i.test(location.hostname)){
    alert('Open a Verizon.com page first.');
    return
  }

  const urls=askUrls().map(vzUrl);
  if(!urls.length){
    alert('No URLs provided.');
    return
  }

  const state=getState(urls);
  ui.rowsProvider=()=>state.rows;
  console.clear();
  for(let i=0;
  i<urls.length;
  i++){
    try{
      await scanProduct(urls[i], i, urls.length, state);
      ui.set({
        percent:Math.round(((i+1)/urls.length)*100), status:`Completed ${i+1
      }
      /${urls.length
    }
     devices`, details:`Rows collected: ${state.rows.length
  }
  `
}
)
}
catch(e){
  const r={
    'Scanned At':now(), 'Product URL':urls[i], 'Device':'Unknown', 'Storage':'N/A', 'Color':'N/A', 'Availability':'Error', 'Evidence':e.message||String(e)
  }
  ;
  state.rows.push(r);
  saveState(state);
  console.error('Product failed', urls[i], e)
}

}
downloadWorkbook(state.rows);
console.table(state.rows);
ui.done(`Complete. Exported ${state.rows.length
}
 row(s).`, `Workbook downloaded. Saved progress remains until cleared.`);
alert(`Scan complete. Rows exported: ${state.rows.length
}
. Excel workbook downloaded.`)
}

main();

}
)();
