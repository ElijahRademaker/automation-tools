(() => {
  if (window.__CE_SCID_TOOL__) {
    alert("SCID tool already running");
    return;
  }
  window.__CE_SCID_TOOL__ = true;

  /* ================= CONFIG ================= */
  const POLE_LAYER = 3;
  const CONDUCTOR_LAYERS = [32, 92]; // 32=secondary, 92=primary
  const PICK_RADIUS_METERS = 20;
  const SNAP_RADIUS_METERS = 25;
  const SCID_PAD = 3;
  const R = 6378137;

  /* ================= MODES ================= */
  const MODE = { IDLE:0, DRAW:1, EDIT:2, PICK:3 };
  let mode = MODE.IDLE;

  /* ================= STATE ================= */
  let MAP_BBOX = null;
  let MAP_TOKEN = null;

  let polygon = [];
  let draggingIndex = null;

  // poleId -> { id, owner, x, y, scid }
  let poles = new Map();

  // graph nodes: P:{id} and C:{layer}:{fid}:{pi}:{vi}
  let graph = new Map();

  // raw conductor features preserved for export
  let conductorFeatures = [];

  let hoveredPole = null;
  let hoverXY = null;
  let scidRootId = null;
  let scidRootScreen = null;

  /* ================= BBOX + TOKEN CAPTURE (PROVEN) ================= */
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
  panel.style.cssText =
    "position:fixed;top:15px;left:15px;z-index:10000;background:#1f2937;color:#fff;padding:8px;border-radius:6px;font-family:sans-serif";
  panel.innerHTML = `
    <b>CE SCID Tool</b><br/>
    <button id="drawBtn">Draw Polygon</button>
    <button id="editBtn">Edit Polygon</button>
    <button id="clearBtn">Clear</button>
    <button id="loadBtn">Load Data</button>
    <button id="pickBtn">Pick SCID 1</button>
    <button id="exportBtn">Export</button>
  `;
  document.body.appendChild(panel);

  /* ================= CANVAS ================= */
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  function setMode(m) {
    mode = m;
    canvas.style.pointerEvents = m === MODE.IDLE ? "none" : "auto";
    redraw();
  }

  function screenToMapMeters(x, y) {
    const [xmin, ymin, xmax, ymax] = MAP_BBOX.split(",").map(Number);
    return {
      x: xmin + (x / canvas.width) * (xmax - xmin),
      y: ymin + ((canvas.height - y) / canvas.height) * (ymax - ymin)
    };
  }

  function mercatorToLatLon(x, y) {
    return {
      lon: (x / R) * 180 / Math.PI,
      lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI
    };
  }

  /* ================= GRAPH HELPERS ================= */
  function addNode(id) {
    if (!graph.has(id)) graph.set(id, new Set());
  }

  function addEdge(a, b) {
    addNode(a);
    addNode(b);
    graph.get(a).add(b);
    graph.get(b).add(a);
  }

  function nearestPole(pt) {
    let best = null, bestD = Infinity;
    for (const p of poles.values()) {
      const d = Math.hypot(p.x - pt[0], p.y - pt[1]);
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return bestD < SNAP_RADIUS_METERS ? best : null;
  }

  /* ================= DRAW ================= */
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mode === MODE.DRAW && polygon.length) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (polygon.length >= 3) {
      ctx.beginPath();
      polygon.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
      ctx.closePath();
      ctx.fillStyle="rgba(255,0,0,0.25)";
      ctx.fill();
      ctx.strokeStyle="red";
      ctx.lineWidth=3;
      ctx.stroke();
    }

    polygon.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p[0],p[1],5,0,Math.PI*2);
      ctx.fillStyle="white";
      ctx.strokeStyle="red";
      ctx.fill(); ctx.stroke();
    });

    if (mode === MODE.PICK && hoverXY) {
      ctx.beginPath();
      ctx.arc(hoverXY.x, hoverXY.y, 14, 0, Math.PI*2);
      ctx.strokeStyle = hoveredPole ? "yellow" : "orange";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (scidRootScreen) {
      ctx.beginPath();
      ctx.arc(scidRootScreen.x, scidRootScreen.y, 18, 0, Math.PI*2);
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  /* ================= CANVAS INPUT ================= */
  canvas.addEventListener("click", e => {
    if (mode === MODE.DRAW) {
      polygon.push([e.clientX, e.clientY]);
      redraw();
    }

    if (mode === MODE.PICK && hoveredPole) {
      scidRootId = hoveredPole.id;
      scidRootScreen = { x: e.clientX, y: e.clientY };
      assignSCIDs(scidRootId);
      setMode(MODE.IDLE);
      redraw();
    }
  });

  canvas.addEventListener("dblclick", () => {
    if (mode === MODE.DRAW && polygon.length >= 3) setMode(MODE.IDLE);
  });

  canvas.addEventListener("mousedown", e => {
    if (mode !== MODE.EDIT) return;
    draggingIndex = null;
    polygon.forEach((p,i)=>{
      if (Math.hypot(p[0]-e.clientX,p[1]-e.clientY)<8) draggingIndex=i;
    });
  });

  canvas.addEventListener("mousemove", e => {
    if (mode === MODE.EDIT && draggingIndex !== null) {
      polygon[draggingIndex] = [e.clientX,e.clientY];
      redraw();
      return;
    }

    if (mode === MODE.PICK) {
      hoverXY = { x:e.clientX, y:e.clientY };
      const cursor = screenToMapMeters(e.clientX, e.clientY);
      hoveredPole = null;
      let best = Infinity;
      for (const p of poles.values()) {
        const d = Math.hypot(p.x - cursor.x, p.y - cursor.y);
        if (d < PICK_RADIUS_METERS && d < best) {
          best = d;
          hoveredPole = p;
        }
      }
      redraw();
    }
  });

  canvas.addEventListener("mouseup",()=>draggingIndex=null);

  /* ================= LOAD DATA ================= */
  document.getElementById("loadBtn").onclick = async () => {
    const [xmin, ymin, xmax, ymax] = MAP_BBOX.split(",").map(Number);
    const rings = [polygon.map(([x,y]) => [
      xmin + (x / canvas.width) * (xmax - xmin),
      ymin + ((canvas.height - y) / canvas.height) * (ymax - ymin)
    ])];

    const geom = encodeURIComponent(JSON.stringify({
      rings,
      spatialReference:{wkid:102100}
    }));

    poles.clear();
    graph.clear();
    conductorFeatures = [];

    /* ---- POLES ---- */
    const poleUrl =
      `https://gis.consumersenergy.com/mapping/rest/services/Electric/Electric_PUB/MapServer/${POLE_LAYER}/query` +
      `?where=1=1&outFields=*&returnGeometry=true&geometryType=esriGeometryPolygon` +
      `&geometry=${geom}&spatialRel=esriSpatialRelIntersects&inSR=102100&outSR=102100` +
      `&f=json&token=${MAP_TOKEN}`;

    const poleJson = await (await fetch(poleUrl)).json();

    poleJson.features.forEach(f => {
      const id = f.attributes.CE_TAG || f.attributes.OBJECTID;
      const owner =
        f.attributes.OWNER ??
        f.attributes.owner ??
        f.attributes.POLE_OWNER ??
        "UNKNOWN";

      poles.set(id, {
        id,
        owner,
        x: f.geometry.x,
        y: f.geometry.y,
        scid: null
      });

      addNode(`P:${id}`);
    });

    /* ---- CONDUCTORS ---- */
    for (const layer of CONDUCTOR_LAYERS) {
      const url =
        `https://gis.consumersenergy.com/mapping/rest/services/Electric/Electric_PUB/MapServer/${layer}/query` +
        `?where=1=1&outFields=*&returnGeometry=true&geometryType=esriGeometryPolygon` +
        `&geometry=${geom}&spatialRel=esriSpatialRelIntersects&inSR=102100&outSR=102100` +
        `&f=json&token=${MAP_TOKEN}`;

      const json = await (await fetch(url)).json();
      conductorFeatures.push(...json.features);

      json.features.forEach((f, fi) => {
        f.geometry.paths.forEach((path, pi) => {
          path.forEach((pt, i) => {
            const cid = `C:${layer}:${fi}:${pi}:${i}`;
            addNode(cid);
            if (i > 0) addEdge(cid, `C:${layer}:${fi}:${pi}:${i-1}`);

            const poleId = nearestPole(pt);
            if (poleId) addEdge(cid, `P:${poleId}`);
          });
        });
      });
    }

    alert(`Loaded ${poles.size} poles`);
  };

  /* ================= SCID ASSIGNMENT ================= */
  function assignSCIDs(rootPoleId) {
    const rootNode = `P:${rootPoleId}`;
    const visited = new Set([rootNode]);
    const queue = [rootNode];
    const poleOrder = [];

    while (queue.length) {
      const node = queue.shift();
      if (node.startsWith("P:")) poleOrder.push(node.slice(2));
      for (const n of graph.get(node) || []) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }

    for (const id of poles.keys()) {
      if (!poleOrder.includes(id)) poleOrder.push(id);
    }

    poleOrder.forEach((id, i) => {
      poles.get(id).scid = String(i + 1).padStart(SCID_PAD, "0");
    });
  }

  /* ================= CONDUCTOR EXPORT (FIXED) ================= */
  function buildConductorReferencesByPath(features) {
    const refs = [];
    const seen = new Set();

    features.forEach(f => {
      f.geometry.paths.forEach(path => {
        const touched = [];

        path.forEach(pt => {
          const pid = nearestPole(pt);
          if (pid && touched[touched.length - 1] !== pid) {
            touched.push(pid);
          }
        });

        for (let i = 0; i < touched.length - 1; i++) {
          const a = touched[i];
          const b = touched[i + 1];
          const key = a < b ? `${a}|${b}` : `${b}|${a}`;
          if (seen.has(key)) continue;
          seen.add(key);
          refs.push({ from: a, to: b });
        }
      });
    });

    return refs;
  }

  /* ================= EXPORT ================= */
  document.getElementById("exportBtn").onclick = () => {
    /* ---- POLES ---- */
    let poleCsv = "node_type,pole_tag,latitude,longitude,scid\n";
    poles.forEach(p => {
      const ll = mercatorToLatLon(p.x, p.y);
      const tag = `${p.owner}::${p.id}::True`;
      poleCsv += `pole,${tag},${ll.lat},${ll.lon},${p.scid}\n`;
    });

    const poleBlob = new Blob([poleCsv], { type: "text/csv" });
    const poleUrl = URL.createObjectURL(poleBlob);
    const pa = document.createElement("a");
    pa.href = poleUrl;
    pa.download = "scid_poles.csv";
    pa.click();
    URL.revokeObjectURL(poleUrl);

    /* ---- CONDUCTOR REFERENCES (KATAPULT) ---- */
    const refs = buildConductorReferencesByPath(conductorFeatures);
    let refCsv =
      "connection_type,reference_type,latitude1,longitude1,latitude2,longitude2\n";

    refs.forEach(r => {
      const a = mercatorToLatLon(poles.get(r.from).x, poles.get(r.from).y);
      const b = mercatorToLatLon(poles.get(r.to).x, poles.get(r.to).y);
      refCsv +=
        `reference,power reference,` +
        `${a.lat},${a.lon},${b.lat},${b.lon}\n`;
    });

    const refBlob = new Blob([refCsv], { type: "text/csv" });
    const refUrl = URL.createObjectURL(refBlob);
    const ra = document.createElement("a");
    ra.href = refUrl;
    ra.download = "scid_conductor_references.csv";
    ra.click();
    URL.revokeObjectURL(refUrl);
  };

  /* ================= BUTTON WIRING ================= */
  document.getElementById("drawBtn").onclick=()=>{polygon=[];setMode(MODE.DRAW);};
  document.getElementById("editBtn").onclick=()=>polygon.length>=3&&setMode(MODE.EDIT);
  document.getElementById("clearBtn").onclick=()=>{
    polygon=[];hoverXY=null;scidRootId=null;scidRootScreen=null;
    setMode(MODE.IDLE);
  };
  document.getElementById("pickBtn").onclick=()=>{
    hoveredPole=null;hoverXY=null;setMode(MODE.PICK);
  };

})();
