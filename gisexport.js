(() => {
  if (window.__CE_POLE_SELECTOR__) return;
  window.__CE_POLE_SELECTOR__ = true;

  /* ================= CONFIG ================= */
  const POLE_LAYER_URL =
    "https://gis.consumersenergy.com/mapping/rest/services/Electric/Electric_PUB/MapServer/3";

  /* ================= STATE ================= */
  let drawing = false;
  let editing = false;
  let points = [];
  let dragIndex = null;
  let MAP_BBOX = null;
  let MAP_TOKEN = null;

  /* ================= INTERCEPT EXPORT ================= */
  (function interceptExport() {
    const oOpen = XMLHttpRequest.prototype.open;
    const oSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (m, u) {
      this.__url = u;
      return oOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (b) {
      try {
        if (typeof b === "string" && this.__url?.includes("MapServer/export")) {
          const p = new URLSearchParams(b);
          if (p.get("bbox")) MAP_BBOX = p.get("bbox");
          if (p.get("token")) MAP_TOKEN = p.get("token");
        }
      } catch {}
      return oSend.apply(this, arguments);
    };
  })();

  /* ================= UI ================= */
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;top:15px;left:15px;z-index:10000;background:#1f2937;color:#fff;padding:8px;border-radius:6px;font-family:sans-serif";
  panel.innerHTML = `
    <b>Pole Selector</b><br/>
    <button id="psDraw">Draw</button>
    <button id="psClear">Clear</button>
    <button id="psExport">Export</button>
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

  /* ================= DRAW ================= */
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length) {
      ctx.fillStyle = "rgba(255,0,0,0.18)";
      ctx.beginPath();
      points.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])
      );
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "red";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    });
  }

  /* ================= INTERACTION ================= */
  canvas.addEventListener("mousedown", e => {
    points.forEach((p, i) => {
      if (Math.hypot(p[0] - e.clientX, p[1] - e.clientY) < 8) {
        dragIndex = i;
        editing = true;
      }
    });
  });

  canvas.addEventListener("mousemove", e => {
    if (editing && dragIndex !== null) {
      points[dragIndex] = [e.clientX, e.clientY];
      redraw();
    }
  });

  canvas.addEventListener("mouseup", () => {
    editing = false;
    dragIndex = null;
  });

  canvas.addEventListener("click", e => {
    if (!drawing) return;
    points.push([e.clientX, e.clientY]);
    redraw();
  });

  canvas.addEventListener("dblclick", () => {
    drawing = false;
    canvas.style.pointerEvents = "auto";
    redraw();
  });

  /* ================= CONTROLS ================= */
  document.getElementById("psDraw").onclick = () => {
    points = [];
    drawing = true;
    canvas.style.pointerEvents = "auto";
  };

  document.getElementById("psClear").onclick = () => {
    points = [];
    drawing = false;
    canvas.style.pointerEvents = "none";
    redraw();
  };

  document.getElementById("psExport").onclick = async () => {
    if (points.length < 3 || !MAP_BBOX || !MAP_TOKEN) {
      alert("Map not ready or polygon incomplete.");
      return;
    }

    const mapCanvas = [...document.querySelectorAll("canvas")]
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const rect = mapCanvas.getBoundingClientRect();
    const [xmin, ymin, xmax, ymax] = MAP_BBOX.split(",").map(Number);

    const scaleX = (xmax - xmin) / rect.width;
    const scaleY = (ymax - ymin) / rect.height;

    const ring = points.map(([sx, sy]) => [
      xmin + (sx - rect.left) * scaleX,
      ymin + (rect.height - (sy - rect.top)) * scaleY
    ]);
    ring.push(ring[0]);

    const polygon = {
      rings: [ring],
      spatialReference: { wkid: 102100 },
      bufferDistance: 0.75,
      bufferUnit: "esriMeters"
    };

    const url =
      `${POLE_LAYER_URL}/query` +
      `?where=1=1&outFields=*` +
      `&returnGeometry=true` +
      `&geometry=${encodeURIComponent(JSON.stringify(polygon))}` +
      `&geometryType=esriGeometryPolygon` +
      `&inSR=102100&spatialRel=esriSpatialRelIntersects` +
      `&outSR=4326&f=json&token=${MAP_TOKEN}`;

    const res = await fetch(url);
    const data = await res.json();

    const rows = [["node_type", "pole_tag", "latitude", "longitude", "scid"]];
const totalPoles = data.features.length;
const scidWidth = String(totalPoles).length;

let scid = 1;

data.features.forEach(f => {
  const ceTag = f.attributes.CE_TAG || "UNKNOWN";

  const paddedScid = String(scid).padStart(scidWidth, "0");

  rows.push([
    "pole",
    `${f.attributes.OWNER}::${ceTag}::True`,
    f.geometry.y,
    f.geometry.x,
    paddedScid
  ]);

  scid++;
});

    const csv = rows.map(r => r.join(",")).join("\n");

// number of exported poles (excluding header)
const poleCount = rows.length - 1;

// CE_TAG from first pole (scid = 1)
const firstCeTagRaw = rows[1]?.[1]?.split("::")[1] || "N/A";
const firstCeTag = firstCeTagRaw || "N/A";

const filename = `${poleCount}_exported_poles_${firstCeTag}.csv`;

const a = document.createElement("a");
a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
a.download = filename;
a.click();
  };

  console.log("✅ CE Pole Selector fully loaded");
})();
