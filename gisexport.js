(() => {
  if (window.__CE_SCID_TOOL__) {
    alert("SCID tool already running");
    return;
  }
  window.__CE_SCID_TOOL__ = true;

  /* ================= CONFIG ================= */
  const POLE_LAYER = 3;
  const CONDUCTOR_LAYERS = [32, 92];
  const PICK_RADIUS_METERS = 20;
  const SNAP_RADIUS_METERS = 25;
  const SCID_PAD = 3;
  const R = 6378137;

  /* ================= MODES ================= */
  const MODE = { IDLE:0, DRAW:1, PICK:2 };
  let mode = MODE.IDLE;

  function updateCanvasState() {
    canvas.style.pointerEvents = (mode === MODE.IDLE) ? "none" : "auto";
  }

  /* ================= STATE ================= */
  let MAP_BBOX = null;
  let MAP_TOKEN = null;
  let poles = new Map();
  let graph = new Map();
  let conductorFeatures = [];
  let polygon = [];
  let hoveredPole = null;
  let hoverXY = null;
  let scidRootId = null;
  let scidRootScreen = null;

  /* ================= BBOX CAPTURE ================= */
  (function interceptExport() {
    const oOpen = XMLHttpRequest.prototype.open;
    const oSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) {
      this.__url = u;
      return oOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (b) {
      if (typeof b === "string" && this.__url?.includes("MapServer/export")) {
        const p = new URLSearchParams(b);
        if (p.get("bbox")) MAP_BBOX = p.get("bbox");
        if (p.get("token")) MAP_TOKEN = p.get("token");
      }
      return oSend.apply(this, arguments);
    };
  })();

  /* ================= UI ================= */
  const panel = document.createElement("div");
  panel.style.cssText = `
    position:fixed;
    top:20px;
    left:20px;
    z-index:10000;
    background:#111827;
    color:#fff;
    padding:10px;
    border-radius:8px;
    font-family:sans-serif;
    width:220px;
    box-shadow:0 4px 12px rgba(0,0,0,0.4)
  `;

  panel.innerHTML = `
    <div id="dragHeader" style="cursor:move;font-weight:bold;margin-bottom:8px;">
      GiS -> Katapult Tool
    </div>
    <button id="drawBtn" style="width:100%;margin-bottom:6px;">Draw Area</button>
    <button id="clearBtn" style="width:100%;margin-bottom:6px;">Clear</button>
    <button id="runBtn" style="width:100%;background:#16a34a;color:white;font-weight:bold;">
      Run SCIDs + Export
    </button>
  `;

  document.body.appendChild(panel);

  /* ================= DRAG ================= */
  (() => {
    const header = panel.querySelector("#dragHeader");
    let offsetX = 0, offsetY = 0, dragging = false;

    header.addEventListener("mousedown", e => {
      dragging = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;
    });

    document.addEventListener("mousemove", e => {
      if (!dragging) return;
      panel.style.left = (e.clientX - offsetX) + "px";
      panel.style.top = (e.clientY - offsetY) + "px";
    });

    document.addEventListener("mouseup", () => dragging = false);
  })();

  /* ================= CANVAS ================= */
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  /* ================= DRAW ================= */
  function redraw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    if (mode === MODE.DRAW && polygon.length) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    if (polygon.length >= 3) {
      ctx.beginPath();
      polygon.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
      ctx.closePath();
      ctx.fillStyle="rgba(255,0,0,0.25)";
      ctx.fill();
      ctx.strokeStyle="red";
      ctx.lineWidth=2;
      ctx.stroke();
    }

    if (mode === MODE.DRAW) {
      polygon.forEach(p=>{
        ctx.beginPath();
        ctx.arc(p[0],p[1],4,0,Math.PI*2);
        ctx.fillStyle="white";
        ctx.fill();
      });
    }

    if (mode === MODE.PICK && hoverXY) {
      ctx.beginPath();
      ctx.arc(hoverXY.x,hoverXY.y,14,0,Math.PI*2);
      ctx.strokeStyle = hoveredPole ? "yellow" : "orange";
      ctx.stroke();
    }

    if (scidRootScreen) {
      ctx.beginPath();
      ctx.arc(scidRootScreen.x,scidRootScreen.y,18,0,Math.PI*2);
      ctx.strokeStyle="lime";
      ctx.stroke();
    }
  }

  /* ================= INPUT ================= */
  canvas.addEventListener("click", e => {
    if (mode === MODE.DRAW) {
      polygon.push([e.clientX,e.clientY]);
      redraw();
      return;
    }

    if (mode === MODE.PICK && hoveredPole) {
      scidRootId = hoveredPole.id;
      scidRootScreen = { x:e.clientX, y:e.clientY };

      assignSCIDs();
      exportAll();

      mode = MODE.IDLE;
      updateCanvasState();
      redraw();
    }
  });

  canvas.addEventListener("dblclick", () => {
    if (mode === MODE.DRAW && polygon.length >= 3) {
      mode = MODE.IDLE;
      updateCanvasState();
      redraw();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && mode === MODE.DRAW) {
      polygon = [];
      mode = MODE.IDLE;
      updateCanvasState();
      redraw();
    }
  });

  canvas.addEventListener("mousemove", e => {
    if (mode !== MODE.PICK) return;

    hoverXY = { x:e.clientX, y:e.clientY };

    const cursor = screenToMapMeters(e.clientX,e.clientY);
    hoveredPole = null;
    let best = Infinity;

    for (const p of poles.values()) {
      const d = Math.hypot(p.x-cursor.x,p.y-cursor.y);
      if (d < PICK_RADIUS_METERS && d < best) {
        best = d;
        hoveredPole = p;
      }
    }

    redraw();
  });

  function screenToMapMeters(x,y){
    const [xmin,ymin,xmax,ymax]=MAP_BBOX.split(",").map(Number);
    return {
      x:xmin+(x/canvas.width)*(xmax-xmin),
      y:ymin+((canvas.height-y)/canvas.height)*(ymax-ymin)
    };
  }

  function mercatorToLatLon(x,y){
    return {
      lon:(x/R)*180/Math.PI,
      lat:(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI
    };
  }

  /* ================= GRAPH ================= */
  function addNode(id){ if(!graph.has(id)) graph.set(id,new Set()); }
  function addEdge(a,b){ addNode(a); addNode(b); graph.get(a).add(b); graph.get(b).add(a); }

  function nearestPole(pt){
    let best=null, bestD=Infinity;
    for(const p of poles.values()){
      const d=Math.hypot(p.x-pt[0],p.y-pt[1]);
      if(d<bestD){bestD=d;best=p.id;}
    }
    return bestD<SNAP_RADIUS_METERS?best:null;
  }

  /* ================= LOAD ================= */
  async function loadData(){
if (!MAP_BBOX || !MAP_TOKEN) {
  throw new Error("MAP_BBOX or MAP_TOKEN missing");
}
    const [xmin,ymin,xmax,ymax]=MAP_BBOX.split(",").map(Number);

    const rings=[polygon.map(([x,y])=>[
      xmin+(x/canvas.width)*(xmax-xmin),
      ymin+((canvas.height-y)/canvas.height)*(ymax-ymin)
    ])];

    const geom=encodeURIComponent(JSON.stringify({rings,spatialReference:{wkid:102100}}));

    poles.clear(); graph.clear(); conductorFeatures=[];

    const poleUrl=`https://gis.consumersenergy.com/.../${POLE_LAYER}/query?...&geometry=${geom}&token=${MAP_TOKEN}`;
    const poleJson=await (await fetch(poleUrl)).json();

    poleJson.features.forEach(f=>{
      const id=f.attributes.CE_TAG||f.attributes.OBJECTID;
      const owner=f.attributes.OWNER??f.attributes.owner??f.attributes.POLE_OWNER??"UNKNOWN";

      poles.set(id,{id,owner,x:f.geometry.x,y:f.geometry.y,scid:null});
      addNode(`P:${id}`);
    });

    // conductor loading unchanged (same as previous working version)
  }

  /* ================= SCID ================= */
  function assignSCIDs(){
    const root=`P:${scidRootId}`;
    const visited=new Set([root]);
    const queue=[root];
    const order=[];

    while(queue.length){
      const node=queue.shift();
      if(node.startsWith("P:")) order.push(node.slice(2));

      for(const n of graph.get(node)||[]){
        if(!visited.has(n)){
          visited.add(n);
          queue.push(n);
        }
      }
    }

    for(const id of poles.keys()){
      if(!order.includes(id)) order.push(id);
    }

    order.forEach((id,i)=>{
      poles.get(id).scid=String(i+1).padStart(SCID_PAD,"0");
    });
  }

  /* ================= EXPORT ================= */
  function buildRefs(){
    const refs=[];
    const seen=new Set();

    conductorFeatures.forEach(f=>{
      f.geometry.paths.forEach(path=>{
        const touched=[];
        path.forEach(pt=>{
          const pid=nearestPole(pt);
          if(pid && touched[touched.length-1]!==pid){
            touched.push(pid);
          }
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
      const ll=mercatorToLatLon(p.x,p.y);
      pCsv+=`pole,${p.owner}::${p.id}::True,${ll.lat},${ll.lon},${p.scid}\n`;
    });

    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([pCsv]));
    a.download="scid_poles.csv";
    a.click();

    const refs=buildRefs();
    let cCsv="connection_type,reference_type,latitude1,longitude1,latitude2,longitude2\n";

    refs.forEach(r=>{
      const a=mercatorToLatLon(poles.get(r.from).x,poles.get(r.from).y);
      const b=mercatorToLatLon(poles.get(r.to).x, poles.get(r.to).y);
      cCsv+=`reference,power reference,${a.lat},${a.lon},${b.lat},${b.lon}\n`;
    });

    const bLink=document.createElement("a");
    bLink.href=URL.createObjectURL(new Blob([cCsv]));
    bLink.download="scid_conductor_references.csv";
    bLink.click();
  }

  /* ================= BUTTONS ================= */
  document.getElementById("drawBtn").onclick=()=>{
    polygon=[];
    mode=MODE.DRAW;
    updateCanvasState();
    redraw();
  };

  document.getElementById("clearBtn").onclick=()=>{
    polygon=[];
    hoverXY=null;
    scidRootScreen=null;
    mode=MODE.IDLE;
    updateCanvasState();
    redraw();
  };

document.getElementById("runBtn").onclick = async () => {

  // ✅ ensure bbox/token exists
  if (!MAP_BBOX || !MAP_TOKEN) {
    alert(
      "Map extent not detected yet.\n\n" +
      "Pan or zoom the map slightly, then click Run again."
    );
    return;
  }

  if (polygon.length < 3) {
    alert("Draw an area first.");
    return;
  }

  await loadData();

  mode = MODE.PICK;
  updateCanvasState();

  alert("Click SCID 1 pole");
};

})();
