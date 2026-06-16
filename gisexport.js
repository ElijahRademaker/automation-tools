(() => {
  if (window.__CE_SCID_TOOL__) {
    alert("SCID tool already running");
    return;
  }
  window.__CE_SCID_TOOL__ = true;

  /* ================= CONFIG ================= */
  const BASE_URL = "https://gis.consumersenergy.com/mapping/rest/services/Electric/Electric_PUB/MapServer";
  const POLE_LAYER = 3;
  const CONDUCTOR_LAYERS = [32, 92];
  const PICK_RADIUS = 20;
  const SNAP = 25;
  const PAD = 3;
  const R = 6378137;

  const MODE = { IDLE:0, DRAW:1, PICK:2 };
  let mode = MODE.IDLE;

  let MAP_BBOX = null;
  let MAP_TOKEN = null;

  let poles = new Map();
  let conductorFeatures = [];
  let polygon = [];

  let hoveredPole=null, hoverXY=null;
  let scidRootId=null, scidRootScreen=null;

  function updateCanvas(){ canvas.style.pointerEvents = mode===MODE.IDLE?"none":"auto"; }

  /* ================= ENSURE MAP ================= */
  async function ensureContext(){
    if(MAP_BBOX && MAP_TOKEN) return true;

    try{
      await fetch(`${BASE_URL}/export`,{
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body:"f=json"
      });
      await new Promise(r=>setTimeout(r,200));
    }catch{}

    return !!MAP_BBOX;
  }

  /* ================= INTERCEPT ================= */
  (function(){
    const oOpen=XMLHttpRequest.prototype.open;
    const oSend=XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open=function(m,u){ this.__url=u; return oOpen.apply(this,arguments); };
    XMLHttpRequest.prototype.send=function(b){

      if(this.__url?.includes("export")){
        if(typeof b==="string"){
          const p=new URLSearchParams(b);
          if(p.get("bbox")) MAP_BBOX=p.get("bbox");
          if(p.get("token")) MAP_TOKEN=p.get("token");
        }
        try{
          const u=new URL(this.__url);
          if(u.searchParams.get("bbox")) MAP_BBOX=u.searchParams.get("bbox");
          if(u.searchParams.get("token")) MAP_TOKEN=u.searchParams.get("token");
        }catch{}
      }

      return oSend.apply(this,arguments);
    };
  })();

  /* ================= UI ================= */
  const panel=document.createElement("div");
  panel.style.cssText="position:fixed;top:20px;left:20px;z-index:10000;background:#111827;color:#fff;padding:10px;border-radius:8px;width:220px;font-family:sans-serif;";
  panel.innerHTML=`
    <div id="dragHeader" style="cursor:move;font-weight:bold;margin-bottom:6px;">⚡ CE SCID Tool</div>
    <button id="drawBtn" style="width:100%;margin-bottom:6px;">Draw Area</button>
    <button id="clearBtn" style="width:100%;margin-bottom:6px;">Clear</button>
    <button id="runBtn" style="width:100%;background:#16a34a;color:white;font-weight:bold;">
      Run SCIDs + Export
    </button>
  `;
  document.body.appendChild(panel);

  /* DRAG */
  (() => {
    const h=panel.querySelector("#dragHeader");
    let dx=0,dy=0,drag=false;
    h.onmousedown=e=>{drag=true;dx=e.clientX-panel.offsetLeft;dy=e.clientY-panel.offsetTop;};
    document.onmousemove=e=>{if(!drag)return;panel.style.left=(e.clientX-dx)+"px";panel.style.top=(e.clientY-dy)+"px";};
    document.onmouseup=()=>drag=false;
  })();

  /* ================= CANVAS ================= */
  const canvas=document.createElement("canvas");
  canvas.style.cssText="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none";
  document.body.appendChild(canvas);

  const ctx=canvas.getContext("2d");
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;

  function redraw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    if(mode===MODE.DRAW && polygon.length){
      ctx.fillStyle="rgba(0,0,0,0.35)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    if(polygon.length>=3){
      ctx.beginPath();
      polygon.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
      ctx.closePath();
      ctx.fillStyle="rgba(255,0,0,0.25)";
      ctx.fill();
      ctx.strokeStyle="red";
      ctx.stroke();
    }

    polygon.forEach(p=>{
      ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);
      ctx.fillStyle="white";ctx.fill();
    });

    if(mode===MODE.PICK && hoverXY){
      ctx.beginPath();ctx.arc(hoverXY.x,hoverXY.y,14,0,Math.PI*2);
      ctx.strokeStyle=hoveredPole?"yellow":"orange";
      ctx.stroke();
    }

    if(scidRootScreen){
      ctx.beginPath();ctx.arc(scidRootScreen.x,scidRootScreen.y,18,0,Math.PI*2);
      ctx.strokeStyle="lime";ctx.stroke();
    }
  }

  /* ================= INPUT ================= */
  canvas.onclick=e=>{
    if(mode===MODE.DRAW){
      polygon.push([e.clientX,e.clientY]);
      redraw();
      return;
    }

    if(mode===MODE.PICK && hoveredPole){
      scidRootId=hoveredPole.id;
      scidRootScreen={x:e.clientX,y:e.clientY};

      assignSCIDs();
      exportAll();

      mode=MODE.IDLE; updateCanvas(); redraw();
    }
  };

  canvas.ondblclick=()=>{
    if(mode===MODE.DRAW && polygon.length>=3){
      mode=MODE.IDLE; updateCanvas(); redraw();
    }
  };

  document.onkeydown=e=>{
    if(e.key==="Escape" && mode===MODE.DRAW){
      polygon=[]; mode=MODE.IDLE; updateCanvas(); redraw();
    }
  };

  canvas.onmousemove=e=>{
    if(mode!==MODE.PICK) return;

    hoverXY={x:e.clientX,y:e.clientY};

    const [xmin,ymin,xmax,ymax]=MAP_BBOX.split(",").map(Number);
    const cursor={
      x:xmin+(e.clientX/canvas.width)*(xmax-xmin),
      y:ymin+((canvas.height-e.clientY)/canvas.height)*(ymax-ymin)
    };

    hoveredPole=null; let best=Infinity;
    for(const p of poles.values()){
      const d=Math.hypot(p.x-cursor.x,p.y-cursor.y);
      if(d<PICK_RADIUS && d<best){best=d; hoveredPole=p;}
    }

    redraw();
  };

  function latlon(p){return{
    lat:(2*Math.atan(Math.exp(p.y/R))-Math.PI/2)*180/Math.PI,
    lon:(p.x/R)*180/Math.PI
  };}

  /* ================= LOAD ================= */
  async function loadData(){
    const [xmin,ymin,xmax,ymax]=MAP_BBOX.split(",").map(Number);

    const rings=[polygon.map(([x,y])=>[
      xmin+(x/canvas.width)*(xmax-xmin),
      ymin+((canvas.height-y)/canvas.height)*(ymax-ymin)
    ])];

    const geom=encodeURIComponent(JSON.stringify({rings,spatialReference:{wkid:102100}}));

    poles.clear(); conductorFeatures=[];

    // ✅ FIXED POLE URL
    const poleUrl =
      `${BASE_URL}/${POLE_LAYER}/query` +
      `?where=1=1&outFields=*&returnGeometry=true&geometryType=esriGeometryPolygon` +
      `&geometry=${geom}&spatialRel=esriSpatialRelIntersects&inSR=102100&outSR=102100` +
      `&f=json&token=${MAP_TOKEN}`;

    const poleJson=await (await fetch(poleUrl)).json();

    poleJson.features.forEach(f=>{
      const id=f.attributes.CE_TAG||f.attributes.OBJECTID;
      const owner=f.attributes.OWNER ?? f.attributes.owner ?? f.attributes.POLE_OWNER ?? "UNKNOWN";
      poles.set(id,{id,owner,x:f.geometry.x,y:f.geometry.y,scid:null});
    });

    // ✅ FIXED CONDUCTOR URL
    for(const layer of CONDUCTOR_LAYERS){
      const url =
        `${BASE_URL}/${layer}/query` +
        `?where=1=1&outFields=*&returnGeometry=true&geometryType=esriGeometryPolygon` +
        `&geometry=${geom}&spatialRel=esriSpatialRelIntersects&inSR=102100&outSR=102100` +
        `&f=json&token=${MAP_TOKEN}`;

      const json=await (await fetch(url)).json();
      conductorFeatures.push(...json.features);
    }
  }

  /* ================= SCID ================= */
function buildAdjacency() {
  const adj = new Map();

  function add(a, b) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }

  buildRefs().forEach(r => add(r.from, r.to));
  return adj;
}
  
function assignSCIDs() {
  const adjacency = buildAdjacency();
  const visited = new Set();
  const order = [];

  function branchLength(start, parent) {
    const seen = new Set([parent]);
    let stack = [start];
    let count = 0;

    while (stack.length) {
      const node = stack.pop();
      if (seen.has(node)) continue;
      seen.add(node);
      count++;

      const nexts = (adjacency.get(node) || []);
      for (const n of nexts) {
        if (!seen.has(n)) {
          stack.push(n);
        }
      }
    }

    return count;
  }

  function angleBetween(a, b, c) {
    if (!a) return 0;

    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);

    if (mag1 === 0 || mag2 === 0) return Math.PI;

    return Math.acos(dot / (mag1 * mag2));
  }

  function traverse(currentId, parentId = null, prevId = null) {
    visited.add(currentId);
    order.push(currentId);

    const neighbors = [...(adjacency.get(currentId) || [])]
      .filter(n => n !== parentId);

    const current = poles.get(currentId);
    const prev = prevId ? poles.get(prevId) : null;

    const scored = neighbors.map(n => {
      const next = poles.get(n);

      const angle = angleBetween(prev, current, next);
      const dist = Math.hypot(next.x - current.x, next.y - current.y);

      const size = branchLength(n, currentId);

      return {
        id: n,
        angle,
        dist,
        size
      };
    });

// ✅ FINAL Katapult-like sort
scored.sort((a, b) => {

  // 1️⃣ smallest branch first
  if (a.size !== b.size) {
    return a.size - b.size;
  }

  // ✅ 2️⃣ shortest span FIRST (fixes skip-span poles)
  if (Math.abs(a.dist - b.dist) > 0.01) {
    return a.dist - b.dist;
  }

  // 3️⃣ straightest continuation
  return a.angle - b.angle;
});


    for (const s of scored) {
      if (!visited.has(s.id)) {
        traverse(s.id, currentId, currentId);
      }
    }
  }

  traverse(scidRootId);

  // fallback (rare)
  poles.forEach((_, id) => {
    if (!visited.has(id)) order.push(id);
  });

  order.forEach((id, i) => {
    poles.get(id).scid = String(i + 1).padStart(PAD, "0");
  });
}

  /* ================= EXPORT ================= */
  function buildRefs(){
    const refs=[],seen=new Set();

    conductorFeatures.forEach(f=>{
      f.geometry.paths.forEach(path=>{
        const touched=[];
        path.forEach(pt=>{
          let best=null, bestD=Infinity;
          for(const p of poles.values()){
            const d=Math.hypot(p.x-pt[0],p.y-pt[1]);
            if(d<bestD){bestD=d;best=p;}
          }
          if(bestD<SNAP && touched[touched.length-1]!==best.id)
            touched.push(best.id);
        });

        for(let i=0;i<touched.length-1;i++){
          const a=touched[i], b=touched[i+1];
          const key=a<b?`${a}|${b}`:`${b}|${a}`;
          if(seen.has(key)) continue;
          seen.add(key);
          refs.push({from:a,to:b});
        }
      });
    });

    return refs;
  }

  function exportAll(){
    let pCsv="node_type,pole_tag,latitude,longitude,scid\n";
    poles.forEach(p=>{
      const ll=latlon(p);
      pCsv+=`pole,${p.owner}::${p.id}::True,${ll.lat},${ll.lon},${p.scid}\n`;
    });

    let cCsv="connection_type,reference_type,latitude1,longitude1,latitude2,longitude2\n";

    buildRefs().forEach(r=>{
      const a=latlon(poles.get(r.from));
      const b=latlon(poles.get(r.to));
      cCsv+=`reference,power reference,${a.lat},${a.lon},${b.lat},${b.lon}\n`;
    });

    download("scid_poles.csv",pCsv);
    download("scid_conductor_references.csv",cCsv);
  }

  function download(name,data){
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([data]));
    a.download=name;
    a.click();
  }

  /* ================= BUTTONS ================= */
  document.getElementById("drawBtn").onclick=()=>{
    polygon=[]; mode=MODE.DRAW; updateCanvas(); redraw();
  };

  document.getElementById("clearBtn").onclick=()=>{
    polygon=[]; mode=MODE.IDLE; updateCanvas(); redraw();
  };

  document.getElementById("runBtn").onclick=async()=>{
    if(polygon.length<3){alert("Draw area first");return;}

    const ready=await ensureContext();
    if(!ready){alert("Move map slightly then retry.");return;}

    await loadData();

    mode=MODE.PICK;
    updateCanvas();
    alert("Click SCID 1 pole");
  };

})();
