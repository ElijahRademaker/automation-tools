(async function AutoRID_v1_0() {
    "use strict";

    const WORKFLOW_VERSION = "AutoRID v1.0";
    const STORAGE_KEY = "RID_WORKFLOW_PAYLOAD_V1";

    function normalize(value) {
        return String(value || "").trim();
    }

    function isCombinedPayload(value) {
        const text = normalize(value);
        return /^Notification\s*(?:Number|#)?\s*:/im.test(text) && /(?:^|\n)(?:N\/A|[^,\n]+),[^,\n]+,/i.test(text);
    }

    function packageToCombinedPayload(workflowPackage) {
        const lines = [
            `Notification Number: ${workflowPackage.notificationNumber}`,
            ""
        ];

        for (const pole of workflowPackage.poles || []) {
            if (String(pole.oldCeid || "").toUpperCase() === "N/A") {
                lines.push([
                    "N/A",
                    pole.newCeid,
                    pole.latitude,
                    pole.longitude,
                    pole.scid
                ].join(","));
            } else {
                lines.push([
                    pole.oldCeid,
                    pole.newCeid,
                    pole.scid
                ].join(","));
            }
        }

        return lines.join("\n");
    }

    function validateWorkflowPackage(workflowPackage) {
        if (!workflowPackage || typeof workflowPackage !== "object") {
            throw new Error("The selected file does not contain a RID workflow package.");
        }
        if (Number(workflowPackage.schemaVersion) !== 1) {
            throw new Error(`Unsupported RID workflow package version: ${workflowPackage.schemaVersion}.`);
        }
        if (!/^\d{7,12}$/.test(String(workflowPackage.notificationNumber || ""))) {
            throw new Error("The RID workflow package has an invalid notification number.");
        }
        if (!Array.isArray(workflowPackage.poles) || !workflowPackage.poles.length) {
            throw new Error("The RID workflow package contains no poles.");
        }

        for (const [index, pole] of workflowPackage.poles.entries()) {
            if (!pole.newCeid || !pole.scid) {
                throw new Error(`Pole ${index + 1} is missing its New CEID or SCID.`);
            }
            if (String(pole.oldCeid || "").toUpperCase() === "N/A") {
                if (!Number.isFinite(Number(pole.latitude)) || !Number.isFinite(Number(pole.longitude))) {
                    throw new Error(`N/A pole ${index + 1} is missing valid coordinates.`);
                }
            } else if (!pole.oldCeid) {
                throw new Error(`Pole ${index + 1} is missing its Old CEID.`);
            }
        }
        return workflowPackage;
    }

    function requestWorkflowPackageFile(stageLabel) {
        return new Promise(resolve => {
            const existing = document.getElementById("rid-workflow-file-picker");
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = "rid-workflow-file-picker";
            overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-family:Segoe UI,Arial,sans-serif";

            const panel = document.createElement("div");
            panel.style.cssText = "width:620px;max-width:calc(100vw - 32px);background:#fff;border-radius:10px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4)";

            const title = document.createElement("h2");
            title.textContent = `RID Workflow - ${stageLabel}`;
            title.style.margin = "0 0 8px";

            const help = document.createElement("div");
            help.textContent = "Select the RID_Workflow JSON package downloaded from Katapult.";
            help.style.cssText = "font-size:14px;line-height:1.45;margin-bottom:14px;color:#333";

            const fileName = document.createElement("div");
            fileName.textContent = "No file selected.";
            fileName.style.cssText = "padding:10px;background:#f4f4f4;border-radius:6px;margin-bottom:10px;font:13px Consolas,monospace";

            const status = document.createElement("div");
            status.style.cssText = "min-height:20px;color:#b00020;font-size:13px;margin-bottom:8px";

            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json,application/json";
            input.style.display = "none";

            let selectedPackage = null;
            input.addEventListener("change", async () => {
                const file = input.files && input.files[0];
                if (!file) return;
                fileName.textContent = file.name;
                status.textContent = "Reading package...";
                try {
                    const text = await file.text();
                    selectedPackage = validateWorkflowPackage(JSON.parse(text));
                    status.style.color = "#107c10";
                    status.textContent = `Ready: ${selectedPackage.notificationNumber}, ${selectedPackage.poles.length} poles.`;
                    proceed.disabled = false;
                } catch (error) {
                    selectedPackage = null;
                    proceed.disabled = true;
                    status.style.color = "#b00020";
                    status.textContent = error.message;
                }
            });

            const buttons = document.createElement("div");
            buttons.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:10px";

            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.textContent = "Cancel";
            cancel.style.cssText = "padding:8px 14px";
            cancel.onclick = () => { overlay.remove(); resolve(null); };

            const select = document.createElement("button");
            select.type = "button";
            select.textContent = "Select RID Workflow File";
            select.style.cssText = "padding:8px 14px";
            select.onclick = () => input.click();

            const proceed = document.createElement("button");
            proceed.type = "button";
            proceed.textContent = "Continue";
            proceed.disabled = true;
            proceed.style.cssText = "padding:8px 14px;border:0;border-radius:4px;background:#0078d4;color:#fff;font-weight:600";
            proceed.onclick = () => {
                if (!selectedPackage) return;
                overlay.remove();
                resolve(selectedPackage);
            };

            buttons.appendChild(cancel);
            buttons.appendChild(select);
            buttons.appendChild(proceed);
            panel.appendChild(title);
            panel.appendChild(help);
            panel.appendChild(fileName);
            panel.appendChild(status);
            panel.appendChild(input);
            panel.appendChild(buttons);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
        });
    }

    async function prepareSharedPayload(stageLabel) {
        // Always require an explicit package selection for each phase. This prevents an
        // older sessionStorage package from being reused without the user noticing.
        const workflowPackage = await requestWorkflowPackageFile(stageLabel);
        if (!workflowPackage) throw new Error("RID workflow package selection was cancelled.");

        const payload = packageToCombinedPayload(workflowPackage);
        window.__RID_WORKFLOW_PACKAGE = workflowPackage;
        window.__RID_WORKFLOW_PAYLOAD = payload;
        return payload;
    }

    function pageMode() {
        const href = String(location.href || "");
        const title = String(document.title || "");

        // Detect the RID page from its stable SharePoint URL before waiting for the
        // embedded Power Apps controls to finish rendering.
        if (
            /sharepoint\.com/i.test(location.hostname) &&
            /\/sites\/RID\//i.test(href) &&
            /(?:NewForm\.aspx|Records(?:%20|\s)Improvement(?:%20|\s)Document)/i.test(href)
        ) return "rid-form";

        if (
            document.querySelector('[data-control-name="cmbCorrectionType"]') ||
            document.querySelector('[data-control-name="cmbErrorCategory"]')
        ) return "rid-form";

        if (
            window.katapultAuth?.__dataHost ||
            /katapult/i.test(location.hostname) ||
            /katapult pro maps/i.test(title)
        ) return "katapult";

        if (
            /gis\.consumersenergy\.com/i.test(location.hostname) ||
            /mapping\/rest|gis web viewer|consumers energy.*gis/i.test(href + " " + title)
        ) return "gis";

        return "unknown";
    }

    async function runKatapultStage() {

    "use strict";

    const VERSION = "AutoRID v1.0 / Katapult";
    const CONFIG = {
        oldAttributeNames: ["Pole Tag", "pole_tag", "pole tag"],
        newAttributeNames: ["Existing CE ID Tag", "existing_ce_id_tag", "existing ce id tag"],
        poleOwnerAttributeNames: ["Pole Owner", "pole_owner", "pole owner"],
        requiredPoleOwner: "Consumers Energy",
        nodeTypeNames: ["node_type", "Node Type", "node type"],
        scidAttributeNames: ["Scid", "SCID", "SCID #", "scid", "pole_number", "Pole Number", "pole number"],
        maximumObjectSearchDepth: 5,
        maximumObjectsSearched: 25000,
        maximumObjectKeys: 5000
    };

    function normalizeText(value) {
        return value === null || value === undefined ? "" : String(value).trim();
    }

    function normalizeName(value) {
        return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
    }

    function isNA(value) {
        const text = normalizeText(value)
            .toUpperCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return (
            text === "N/A" ||
            text === "NA" ||
            text === "NOTAG" ||
            text === "NO TAG" ||
            /^NO TAG\s*#?\s*\d+$/.test(text)
        );
    }
    function isValidCeid(value) {
        const text = normalizeText(value);
        return text !== "" && !isNA(text);
    }

    function unwrapAttributeValue(value) {
        if (value === null || value === undefined) return "";
        if (typeof value === "string" || typeof value === "number") return normalizeText(value);
        if (Array.isArray(value)) {
            for (let i = value.length - 1; i >= 0; i--) {
                const unwrapped = unwrapAttributeValue(value[i]);
                if (unwrapped !== "") return unwrapped;
            }
            return "";
        }
        if (typeof value === "object") {
            const preferredKeys = ["value", "text", "display_value", "displayValue", "name", "label"];
            for (const key of preferredKeys) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    const unwrapped = unwrapAttributeValue(value[key]);
                    if (unwrapped !== "") return unwrapped;
                }
            }
            const keys = Object.keys(value).filter(key => !["_timestamp", "timestamp", "user", "editor"].includes(key));
            for (let i = keys.length - 1; i >= 0; i--) {
                const unwrapped = unwrapAttributeValue(value[keys[i]]);
                if (unwrapped !== "") return unwrapped;
            }
        }
        return "";
    }

    function findAttribute(attributes, names) {
        if (!attributes || typeof attributes !== "object") return "";
        const wanted = new Set(names.map(normalizeName));

        for (const [key, value] of Object.entries(attributes)) {
            if (wanted.has(normalizeName(key))) return unwrapAttributeValue(value);
        }

        for (const value of Object.values(attributes)) {
            if (!value || typeof value !== "object") continue;
            const label = value.attribute_name || value.attributeName || value.name || value.label || value.title;
            if (label && wanted.has(normalizeName(label))) {
                return unwrapAttributeValue(value.value !== undefined ? value.value : value);
            }
        }

        return "";
    }

    function looksLikeNodesCollection(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const entries = Object.entries(value);
        if (!entries.length || entries.length > CONFIG.maximumObjectKeys) return false;
        let nodeLike = 0;
        const sample = entries.slice(0, 30);
        for (const [, item] of sample) {
            if (!item || typeof item !== "object") continue;
            const lat = Number(item.latitude ?? item.lat);
            const lon = Number(item.longitude ?? item.lng ?? item.lon);
            if (Number.isFinite(lat) && Number.isFinite(lon) && item.attributes && typeof item.attributes === "object") nodeLike++;
        }
        return nodeLike >= Math.min(2, sample.length) || (sample.length === 1 && nodeLike === 1);
    }

    function scoreJobCandidate(value) {
        if (!value || typeof value !== "object") return 0;
        let score = 0;
        if (looksLikeNodesCollection(value.nodes)) score += 100;
        if (value.connections && typeof value.connections === "object") score += 10;
        if (value.photos && typeof value.photos === "object") score += 5;
        if (value.name || value.job_name) score += 2;
        return score;
    }

    function findLoadedJobData() {
        try {
            const preferred = window.katapultAuth && window.katapultAuth.__dataHost;
            if (preferred && looksLikeNodesCollection(preferred.nodes)) {
                console.log(`[${VERSION}] Using current Katapult source: window.katapultAuth.__dataHost`);
                return {
                    path: "window.katapultAuth.__dataHost",
                    value: preferred,
                    score: 10000
                };
            }
        } catch (error) {
            console.warn(`[${VERSION}] Preferred Katapult source could not be read.`, error);
        }

        const directCandidates = [
            ["window.job", window.job],
            ["window.jobData", window.jobData],
            ["window.currentJob", window.currentJob],
            ["window.current_job", window.current_job],
            ["window.$job", window.$job],
            ["window.data", window.data]
        ];

        const found = [];
        for (const [path, value] of directCandidates) {
            const score = scoreJobCandidate(value);
            if (score) found.push({ path, value, score });
        }

        const queue = [];
        const visited = new WeakSet();
        const safeWindowKeys = Object.keys(window).filter(key =>
            /job|data|map|node|firebase|katapult|model|state|store/i.test(key)
        );

        for (const key of safeWindowKeys) {
            try {
                const value = window[key];
                if (value && typeof value === "object") queue.push({ path: `window.${key}`, value, depth: 0 });
            } catch (_) {}
        }

        let searched = 0;
        while (queue.length && searched < CONFIG.maximumObjectsSearched) {
            const current = queue.shift();
            const value = current.value;
            if (!value || typeof value !== "object" || visited.has(value)) continue;
            visited.add(value);
            searched++;

            const score = scoreJobCandidate(value);
            if (score) found.push({ path: current.path, value, score });
            if (looksLikeNodesCollection(value)) found.push({ path: current.path, value: { nodes: value }, score: 90 });
            if (current.depth >= CONFIG.maximumObjectSearchDepth) continue;

            let keys;
            try { keys = Object.keys(value).slice(0, 300); } catch (_) { continue; }
            for (const key of keys) {
                if (/^(parent|ownerDocument|documentElement|body|children|childNodes|previous|next|window|self|top|frames)$/i.test(key)) continue;
                let child;
                try { child = value[key]; } catch (_) { continue; }
                if (child && typeof child === "object" && !visited.has(child)) {
                    queue.push({ path: `${current.path}.${key}`, value: child, depth: current.depth + 1 });
                }
            }
        }

        found.sort((a, b) => b.score - a.score);
        console.table(found.slice(0, 20).map(item => ({ path: item.path, score: item.score, nodeCount: item.value.nodes ? Object.keys(item.value.nodes).length : 0 })));
        return found.length ? found[0] : null;
    }

    function findRawAttributeObject(attributes, names) {
        if (!attributes || typeof attributes !== "object") return null;
        const wanted = new Set(names.map(normalizeName));
        for (const [key, value] of Object.entries(attributes)) {
            if (wanted.has(normalizeName(key))) return value;
        }
        for (const value of Object.values(attributes)) {
            if (!value || typeof value !== "object") continue;
            const label = value.attribute_name || value.attributeName || value.name || value.label || value.title;
            if (label && wanted.has(normalizeName(label))) return value;
        }
        return null;
    }

    function collectLeafValues(value, path = [], output = [], depth = 0) {
        if (depth > 8 || value === null || value === undefined) return output;

        if (typeof value === "string" || typeof value === "number") {
            const text = normalizeText(value);
            if (text) output.push({ path: path.map(normalizeName), text });
            return output;
        }

        if (Array.isArray(value)) {
            value.forEach((item, index) => collectLeafValues(item, [...path, String(index)], output, depth + 1));
            return output;
        }

        if (typeof value === "object") {
            for (const [key, child] of Object.entries(value)) {
                if (["_timestamp", "timestamp", "user", "editor", "created", "modified"].includes(key)) continue;
                collectLeafValues(child, [...path, key], output, depth + 1);
            }
        }

        return output;
    }

    function getCompoundPoleTag(node) {
        const rawPoleTag = findRawAttributeObject(node.attributes, CONFIG.oldAttributeNames);
        if (rawPoleTag === null || rawPoleTag === undefined) return "";
        if (typeof rawPoleTag === "string" || typeof rawPoleTag === "number") {
            return normalizeText(rawPoleTag);
        }

        const leaves = collectLeafValues(rawPoleTag);

        // Missing-tag markers must win over owner/company text in compound Pole Tag data.
        const missingTag = leaves.find(item => isNA(item.text));
        if (missingTag) return "N/A";

        // Prefer values located under tag/number/value paths, excluding owner paths.
        const pathTag = leaves.find(item => {
            const pathText = item.path.join(" ");
            return !/owner|company|utility/.test(pathText) &&
                /tag|number|value|text|display/.test(pathText) &&
                /^\d{6,10}$/.test(item.text);
        });
        if (pathTag) return pathTag.text;

        // Final fallback: a CEID-shaped numeric leaf that is not metadata.
        const numericTag = leaves.find(item =>
            /^\d{6,10}$/.test(item.text) &&
            !/timestamp|date|time|id$/.test(item.path.join(" "))
        );
        return numericTag ? numericTag.text : "";
    }

    function getPoleOwner(node) {
        const rawPoleTag = findRawAttributeObject(node.attributes, CONFIG.oldAttributeNames);
        if (rawPoleTag && typeof rawPoleTag === "object") {
            const leaves = collectLeafValues(rawPoleTag);

            const exactConsumersEnergy = leaves.find(item =>
                normalizeName(item.text) === normalizeName(CONFIG.requiredPoleOwner)
            );
            if (exactConsumersEnergy) return CONFIG.requiredPoleOwner;

            const ownerLeaf = leaves.find(item =>
                /poleowner|owner|company|utility/.test(item.path.join("")) &&
                normalizeText(item.text)
            );
            if (ownerLeaf) return ownerLeaf.text;
        }

        // Only use explicit Pole Owner fields. Generic object "owner" metadata is excluded.
        return findAttribute(node.attributes, CONFIG.poleOwnerAttributeNames);
    }
    function isRequiredPoleOwner(value) {
        return normalizeName(value) === normalizeName(CONFIG.requiredPoleOwner);
    }

    function getNodeType(node) {
        return findAttribute(node.attributes, CONFIG.nodeTypeNames).toLowerCase();
    }

    function isOtherPole(node) {
        const nodeType = normalizeText(getNodeType(node)).toLowerCase();

        // Depending on the Katapult model, Other poles may be stored as "other",
        // "other pole", or another value containing both words.
        return (
            nodeType === "other" ||
            nodeType === "other pole" ||
            (nodeType.includes("other") && nodeType.includes("pole"))
        );
    }

    function isPoleNode(node) {
        const nodeType = getNodeType(node);
        if (nodeType) return nodeType.includes("pole") && !nodeType.includes("anchor");
        return Boolean(
            findAttribute(node.attributes, CONFIG.oldAttributeNames) ||
            findAttribute(node.attributes, CONFIG.newAttributeNames)
        );
    }

    function normalizeScid(value) {
        const text = normalizeText(value);
        if (!text) return "";

        // Katapult commonly displays values such as "Scid 023". Preserve nonnumeric
        // identifiers, but normalize purely numeric SCIDs by removing leading zeroes.
        const withoutLabel = text.replace(/^scid\s*#?\s*/i, "").trim();
        if (/^\d+$/.test(withoutLabel)) {
            return String(Number(withoutLabel));
        }

        return withoutLabel;
    }

    function analyzeNodes(nodes) {
        const ready = [];
        const matching = [];
        const review = [];
        const ignoredOther = [];
        const ignoredNonConsumersEnergy = [];
        const allPoles = [];
        const seenNew = new Map();
        const seenOld = new Map();

        for (const [nodeId, node] of Object.entries(nodes || {})) {
            if (!node || typeof node !== "object" || !isPoleNode(node)) continue;

            const latitude = Number(node.latitude ?? node.lat);
            const longitude = Number(node.longitude ?? node.lng ?? node.lon);
            const oldRaw = getCompoundPoleTag(node);
            const newRaw = findAttribute(node.attributes, CONFIG.newAttributeNames);
            const scidRaw = findAttribute(node.attributes, CONFIG.scidAttributeNames);
            const scid = normalizeScid(scidRaw);
            const oldCeidRaw = normalizeText(oldRaw);
            const oldCeid = isNA(oldCeidRaw) ? "N/A" : oldCeidRaw;
            const newCeid = normalizeText(newRaw);
            const poleOwner = normalizeText(getPoleOwner(node));

            const record = { nodeId, scid, scidRaw: normalizeText(scidRaw), oldCeid, oldCeidRaw, newCeid, poleOwner, latitude, longitude, node };
            allPoles.push(record);

            // Katapult's generic "Other Pole" node type can still represent a valid
            // Consumers Energy pole. Pole ownership, not node type, controls eligibility.

            if (!isRequiredPoleOwner(poleOwner)) {
                ignoredNonConsumersEnergy.push(record);
                continue;
            }

            if (!scid) {
                review.push({ ...record, reason: "Missing SCID / pole number." });
                continue;
            }

            if (!isValidCeid(newCeid)) {
                review.push({ ...record, reason: "Missing or invalid Existing CE ID Tag (New CEID)." });
                continue;
            }

            if (isValidCeid(oldCeid) && oldCeid === newCeid) {
                matching.push(record);
                continue;
            }

            if (!isValidCeid(oldCeid) && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
                review.push({ ...record, reason: "Pole Tag is N/A/blank and coordinates are missing." });
                continue;
            }

            const outputLine = isValidCeid(oldCeid)
                ? `${oldCeid},${newCeid},${scid}`
                : `N/A,${newCeid},${latitude.toFixed(7)},${longitude.toFixed(7)},${scid}`;

            ready.push({ ...record, outputLine });

            if (seenNew.has(newCeid)) {
                review.push({ ...record, reason: `Duplicate New CEID also used by node ${seenNew.get(newCeid)}.` });
            } else {
                seenNew.set(newCeid, nodeId);
            }

            if (isValidCeid(oldCeid)) {
                if (seenOld.has(oldCeid)) {
                    review.push({ ...record, reason: `Duplicate Old CEID also used by node ${seenOld.get(oldCeid)}.` });
                } else {
                    seenOld.set(oldCeid, nodeId);
                }
            }
        }

        return { ready, matching, review, ignoredOther, ignoredNonConsumersEnergy, allPoles };
    }

    function downloadText(text, fileName, type = "text/plain") {
        const blob = new Blob([text], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function csvEscape(value) {
        const text = normalizeText(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    function getJobName(jobData) {
        if (!jobData || typeof jobData !== "object") return "";
        return normalizeText(jobData.name || jobData.job_name || jobData.jobName || jobData.title || "");
    }

    function extractNotificationNumber(jobData) {
        const match = getJobName(jobData).match(/\b\d{7,12}\b/);
        return match ? match[0] : "";
    }

    function buildCombinedPayload(result, notificationNumber) {
        return [
            `Notification Number: ${notificationNumber}`,
            "",
            ...result.ready.map(item => item.outputLine)
        ].join("\n");
    }

    function createWorkflowPackage(result, notificationNumber, sourcePath) {
        return {
            schemaVersion: 1,
            workflow: "Consumers Energy RID",
            notificationNumber: String(notificationNumber),
            createdAt: new Date().toISOString(),
            source: {
                system: "Katapult Pro",
                path: sourcePath
            },
            poles: result.ready.map(item => ({
                scid: String(item.scid),
                oldCeid: item.oldCeid || "N/A",
                newCeid: item.newCeid,
                latitude: Number.isFinite(item.latitude) ? item.latitude : null,
                longitude: Number.isFinite(item.longitude) ? item.longitude : null
            }))
        };
    }

    function downloadWorkflowPackage(workflowPackage) {
        const text = JSON.stringify(workflowPackage, null, 2);
        downloadText(
            text,
            `RID_Workflow_${workflowPackage.notificationNumber}.json`,
            "application/json"
        );
    }

    function showResults(result, sourcePath, notificationNumber) {
        const old = document.getElementById("rid-katapult-scraper-panel");
        if (old) old.remove();

        const overlay = document.createElement("div");
        overlay.id = "rid-katapult-scraper-panel";
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,Arial,sans-serif";

        const panel = document.createElement("div");
        panel.style.cssText = "width:900px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;background:white;border-radius:10px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.4)";

        const title = document.createElement("h2");
        title.textContent = VERSION;
        title.style.margin = "0 0 8px";

        const summary = document.createElement("div");
        summary.style.cssText = "margin-bottom:12px;line-height:1.45";
        summary.textContent = `Source: ${sourcePath}\nNotification Number: ${notificationNumber}\nPole nodes found: ${result.allPoles.length}\nReady for RIDExporter: ${result.ready.length}\nSkipped because tags match: ${result.matching.length}\nIgnored Other poles: ${result.ignoredOther.length}\nIgnored non-Consumers Energy poles: ${result.ignoredNonConsumersEnergy.length}\nNeeds review: ${result.review.length}`;
        summary.style.whiteSpace = "pre-line";

        const textarea = document.createElement("textarea");
        textarea.value = buildCombinedPayload(result, notificationNumber);
        textarea.style.cssText = "width:100%;box-sizing:border-box;height:320px;padding:10px;font:13px Consolas,monospace;resize:vertical";
        textarea.spellcheck = false;

        const review = document.createElement("pre");
        review.style.cssText = "background:#f5f5f5;padding:10px;border-radius:6px;white-space:pre-wrap;max-height:180px;overflow:auto";
        review.textContent = result.review.length
            ? result.review.map(item => `${item.nodeId}: ${item.reason} | SCID=${item.scid || "(blank)"} | Owner=${item.poleOwner || "(blank)"} | Pole Tag=${item.oldCeidRaw || item.oldCeid || "(blank)"} | Existing CE ID Tag=${item.newCeid || "(blank)"}`).join("\n")
            : "No review issues.";

        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap";

        function button(text, handler, primary = false) {
            const b = document.createElement("button");
            b.textContent = text;
            b.style.cssText = `padding:8px 14px;border-radius:4px;border:1px solid #999;cursor:pointer;${primary ? "background:#0078d4;color:white;border-color:#0078d4" : "background:white"}`;
            b.onclick = handler;
            return b;
        }

        buttons.appendChild(button("Copy Combined RID Payload", async () => {
            await navigator.clipboard.writeText(textarea.value);
            alert(`Copied notification ${notificationNumber} and ${result.ready.length} RIDExporter rows.`);
        }, true));

        buttons.appendChild(button("Download TXT", () => {
            downloadText(textarea.value + (textarea.value ? "\n" : ""), `${VERSION}_Combined_RID_Payload.txt`);
        }));

        buttons.appendChild(button("Download RID Workflow JSON", () => {
            downloadWorkflowPackage(createWorkflowPackage(result, notificationNumber, sourcePath));
        }, true));
        buttons.appendChild(button("Download CSV Audit", () => {
            const rows = [["Node ID", "SCID", "Status", "Old CEID (Pole Tag)", "New CEID (Existing CE ID Tag)", "Latitude", "Longitude", "RIDExporter Line", "Reason"]];
            for (const item of result.ready) rows.push([item.nodeId, item.scid, "Ready", item.oldCeid || "N/A", item.newCeid, item.latitude, item.longitude, item.outputLine, ""]);
            for (const item of result.matching) rows.push([item.nodeId, item.scid, "Matched/Skipped", item.oldCeid, item.newCeid, item.latitude, item.longitude, "", "Old and new CEIDs match"]);
            for (const item of result.ignoredOther) rows.push([item.nodeId, item.scid, "Ignored", item.oldCeid, item.newCeid, item.latitude, item.longitude, "", "Other pole with no RID tag data"]);
            for (const item of result.ignoredNonConsumersEnergy) rows.push([item.nodeId, item.scid, "Ignored", item.oldCeidRaw || item.oldCeid, item.newCeid, item.latitude, item.longitude, "", `Pole owner is ${item.poleOwner || "unknown"}, not Consumers Energy`]);
            for (const item of result.review) rows.push([item.nodeId, item.scid, "Review", item.oldCeid, item.newCeid, item.latitude, item.longitude, "", item.reason]);
            downloadText(rows.map(row => row.map(csvEscape).join(",")).join("\n"), `${VERSION}_Audit.csv`, "text/csv");
        }));

        buttons.appendChild(button("Close", () => overlay.remove()));

        panel.appendChild(title);
        panel.appendChild(summary);
        panel.appendChild(document.createTextNode("Combined RID payload (notification + RIDExporter rows):"));
        panel.appendChild(textarea);
        panel.appendChild(document.createTextNode("Needs review:"));
        panel.appendChild(review);
        panel.appendChild(buttons);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    try {
        console.log(`[${VERSION}] Searching the loaded Katapult page for job data...`);
        const candidate = findLoadedJobData();

        if (!candidate || !candidate.value || !candidate.value.nodes) {
            throw new Error(
                "Could not find the loaded Katapult job nodes in page memory. Open the target job in Katapult Maps, wait for all poles to load, then run the script again. Candidate paths were printed to the console."
            );
        }

        const notificationNumber = extractNotificationNumber(candidate.value);
        if (!notificationNumber) {
            throw new Error(`Could not extract a notification number from Katapult job name: "${getJobName(candidate.value) || "(blank)"}".`);
        }

        const result = analyzeNodes(candidate.value.nodes);
        const workflowPackage = createWorkflowPackage(result, notificationNumber, candidate.path);
        window.__RID_WORKFLOW_PACKAGE = workflowPackage;

        try {
            downloadWorkflowPackage(workflowPackage);
        } catch (downloadError) {
            console.warn(`[${VERSION}] Automatic package download failed. Use the download button.`, downloadError);
        }

        console.log(`[${VERSION}] Analysis complete`, { notificationNumber, workflowPackage, ...result });
        showResults(result, candidate.path, notificationNumber);
        alert(
            `RID workflow package created.\n\n` +
            `Notification: ${notificationNumber}\n` +
            `RID poles: ${result.ready.length}\n\n` +
            `File: RID_Workflow_${notificationNumber}.json\n\n` +
            `Use this JSON file on GIS and the RID form.`
        );
    } catch (err) {
        console.error(`[${VERSION}] Failed`, err);
        alert(`${VERSION} failed:\n\n${err.message}\n\nCheck the console for details.`);
    }

    }

    async function runGisStage() {

    const CONFIG = {
        electricMapServer: "https://gis.consumersenergy.com/mapping/rest/services/Electric/Electric_PUB/MapServer",
        landbaseFolder: "https://gis.consumersenergy.com/mapping/rest/services/Landbase",
        landbaseMapServers: [
            "https://gis.consumersenergy.com/mapping/rest/services/Landbase/Landbase_Grids_Boundaries_PUB/MapServer"
        ],
        maxLandbaseServices: 20,
        supportStructureLayerId: 3,
        ceTagField: "CE_TAG",

        outputWidth: 1920,
        outputHeight: 1080,

        // Normal export radius. For N/A coordinate rows with a reference pole farther away,
        // the export radius becomes max(200, reference distance + 40).
        radiusFeet: 200,
        referencePoleBufferFeet: 40,
        extentExpandFactor: 1.18,

        coordinateSearchRadiusFeet: 75,
        referencePoleSearchRadiusFeet: 600,

        // V0.02 connected-chain grouping.
        maxTargetPolesPerImage: 5,
        groupingNeighborDistanceFeet: 300,
        groupEdgeBufferFeet: 40,

        // V0.11 measured floating-callout layout.
        calloutFontPx: 30,
        calloutLineHeightPx: 38,
        calloutPaddingPx: 10,
        calloutCollisionPaddingPx: 16,
        calloutEdgePaddingPx: 24,
        calloutLeaderWidthPx: 5,
        calloutPoleRadiusPx: 19,
        leaderOtherPoleClearancePx: 14,
        leaderPoleIntersectionPenalty: 2000000,
        calloutCandidateRadiiPx: [85, 125, 175, 240, 320, 410, 500, 600],
        calloutCandidateAnglesDeg: [0, 45, 90, 135, 180, 225, 270, 315],

        drawSettleMs: 3000,
        layerLoadTimeoutMs: 8000,
        delayMsBetweenPoles: 0,
        batchSize: 100,

        filePrefix: "AutoRID v1.0 / GIS Export",
        arcgisVersion: "4.29",
        showPreview: false,

        // Filled automatically from the host GIS Web Viewer page if ArcGIS IdentityManager has a credential.
        authToken: null
    };

    function log(...args) {
        console.log("[AutoRID v1.0 / GIS Export]", ...args);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function withTimeout(promise, timeoutMs, label) {
        return Promise.race([
            promise,
            new Promise(resolve => {
                setTimeout(() => {
                    console.warn(`[AutoRID v1.0 / GIS Export] Timeout waiting for ${label}. Continuing.`);
                    resolve({ timedOut: true, label });
                }, timeoutMs);
            })
        ]);
    }


    function getHostPageArcgisCredentials() {
        return new Promise(resolve => {
            try {
                if (!window.require || typeof window.require !== "function") {
                    resolve([]);
                    return;
                }

                window.require(["esri/IdentityManager"], function (esriId) {
                    try {
                        resolve((esriId && esriId.credentials) ? esriId.credentials.slice() : []);
                    } catch (err) {
                        console.warn("[AutoRID v1.0 / GIS Export] Could not read host IdentityManager credentials.", err);
                        resolve([]);
                    }
                }, function (err) {
                    console.warn("[AutoRID v1.0 / GIS Export] Host IdentityManager require failed.", err);
                    resolve([]);
                });
            } catch (err) {
                console.warn("[AutoRID v1.0 / GIS Export] Credential lookup failed.", err);
                resolve([]);
            }
        });
    }

    async function initializeAuthToken() {
        const credentials = await getHostPageArcgisCredentials();
        console.log("[AutoRID v1.0 / GIS Export] Host ArcGIS credentials found:", credentials.map(c => ({ server: c.server, userId: c.userId, expires: c.expires })));

        const match = credentials.find(c => {
            const server = String(c.server || "").toLowerCase();
            return c.token && server.includes("gis.consumersenergy.com");
        }) || credentials.find(c => c.token);

        if (match && match.token) {
            CONFIG.authToken = match.token;
            console.log("[AutoRID v1.0 / GIS Export] Using ArcGIS token from host page IdentityManager.");
            return true;
        }

        CONFIG.authToken = null;
        console.warn("[AutoRID v1.0 / GIS Export] No ArcGIS token found in host page IdentityManager. Protected Landbase services may fail with 499 Token Required.");
        return false;
    }

    function appendTokenToUrl(url) {
        if (!CONFIG.authToken) return url;
        const u = new URL(url, window.location.href);
        if (!u.searchParams.has("token")) {
            u.searchParams.set("token", CONFIG.authToken);
        }
        return u.toString();
    }

    function mapImageLayerOptions(MapImageLayer, options) {
        const layerOptions = Object.assign({}, options);
        if (CONFIG.authToken) {
            layerOptions.customParameters = Object.assign({}, layerOptions.customParameters || {}, {
                token: CONFIG.authToken
            });
        }
        return new MapImageLayer(layerOptions);
    }

    function sanitizeFileName(value) {
        return String(value)
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, " ")
            .trim();
    }

    function sqlString(value) {
        return String(value).replace(/'/g, "''");
    }

    function isNA(value) {
        const text = String(value || "").trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
        return text === "N/A" || text === "NA" || text === "NOTAG" || text === "NO TAG" || /^NO TAG\s*#?\s*\d+$/.test(text);
    }

    function hasValue(value) {
        return String(value || "").trim() !== "";
    }

    function isValidNewCeid(value) {
        return hasValue(value) && !isNA(value);
    }

    function isValidExistingCeid(value) {
        const text = String(value || "").trim();
        return text !== "" && text.toUpperCase() !== "N/A";
    }

    function chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
        return chunks;
    }

    function parseNumber(value) {
        const n = Number(String(value || "").trim());
        return Number.isFinite(n) ? n : null;
    }

    // Coordinate input format: N/A, New CEID, Latitude, Longitude
    function parseLatLon(latitudeValue, longitudeValue) {
        const latitude = parseNumber(latitudeValue);
        const longitude = parseNumber(longitudeValue);
        if (latitude === null || longitude === null) return null;
        if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
        return { longitude, latitude };
    }

    function splitInputLine(line) {
        if (line.includes("\t")) return line.split("\t").map(x => x.trim());
        if (line.includes(",")) return line.split(",").map(x => x.trim());
        if (line.includes(";")) return line.split(";").map(x => x.trim());
        return line.split(/\s+/).map(x => x.trim());
    }

    function normalizeScid(value) {
        const text = String(value || "").trim().replace(/^scid\s*#?\s*/i, "");
        if (/^\d+$/.test(text)) return String(Number(text));
        return text;
    }

    function findPackagePole(record) {
        const poles = window.__RID_WORKFLOW_PACKAGE?.poles || [];
        const recordScid = normalizeScid(record?.scid);
        const recordNewCeid = String(record?.newCeid || "").trim();

        return poles.find(pole =>
            normalizeScid(pole.scid) === recordScid &&
            String(pole.newCeid || "").trim() === recordNewCeid
        ) || poles.find(pole =>
            normalizeScid(pole.scid) === recordScid
        ) || poles.find(pole =>
            String(pole.newCeid || "").trim() === recordNewCeid
        ) || null;
    }

    function setPoleAdjacentCeid(record, adjacentCeid) {
        const packagePole = findPackagePole(record);
        if (!packagePole || !adjacentCeid) return false;
        packagePole.adjacentCeid = String(adjacentCeid).trim();
        return true;
    }

    function parseInputMappings(raw) {
        const records = [];
        const invalidRows = [];
        const seenKeys = new Set();
        const lines = String(raw).split(/\r?\n/).map(line => line.trim()).filter(Boolean);

        for (const line of lines) {
            const parts = splitInputLine(line);
            const oldCeid = parts[0] || "";
            const newCeid = parts[1] || "";
            const latValue = parts[2] || "";
            const lonValue = parts[3] || "";
            const scidValue = isNA(oldCeid) ? (parts[4] || "") : (parts[2] || "");

            if (!isValidNewCeid(newCeid)) {
                invalidRows.push({ line, reason: "New CEID is blank or N/A." });
                continue;
            }

            let record = null;

            if (!isNA(oldCeid) && parts.length >= 3) {
                const scid = normalizeScid(scidValue);
                if (!scid) {
                    invalidRows.push({ line, reason: "SCID / pole number is missing." });
                    continue;
                }
                record = {
                    mode: "oldCeid",
                    oldCeid,
                    newCeid,
                    scid,
                    longitude: null,
                    latitude: null,
                    sourceLine: line
                };
            }

            if (isNA(oldCeid) && parts.length >= 5) {
                const scid = normalizeScid(scidValue);
                if (!scid) {
                    invalidRows.push({ line, reason: "SCID / pole number is missing." });
                    continue;
                }
                const latLon = parseLatLon(latValue, lonValue);
                if (!latLon) {
                    invalidRows.push({ line, reason: "Coordinate row has invalid latitude/longitude." });
                    continue;
                }
                record = {
                    mode: "coordinate",
                    oldCeid: "N/A",
                    newCeid,
                    scid,
                    longitude: latLon.longitude,
                    latitude: latLon.latitude,
                    sourceLine: line
                };
            }

            if (!record) {
                invalidRows.push({ line, reason: "Unrecognized row format." });
                continue;
            }

            const key = record.mode === "oldCeid"
                ? `OLD:${record.oldCeid}`
                : `COORD:${record.newCeid}:${record.latitude}:${record.longitude}`;

            if (seenKeys.has(key)) {
                invalidRows.push({ line, reason: "Duplicate row skipped." });
                continue;
            }

            seenKeys.add(key);
            records.push(record);
        }

        return { records, invalidRows };
    }

    async function fetchJson(url) {
        const finalUrl = appendTokenToUrl(url);
        const response = await fetch(finalUrl, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${finalUrl}`);

        const json = await response.json();
        if (json && json.error) {
            const msg = json.error.message || "ArcGIS REST error";
            const code = json.error.code || "unknown";
            throw new Error(`ArcGIS REST error ${code}: ${msg} for ${finalUrl}`);
        }

        return json;
    }

    function xmlEscape(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function dataUrlToBytes(dataUrl) {
        const base64 = String(dataUrl).split(",")[1] || "";
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }

    function crc32(bytes) {
        let crc = 0xffffffff;
        for (const byte of bytes) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) {
                crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
            }
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    function uint16(value) {
        return new Uint8Array([value & 255, (value >>> 8) & 255]);
    }

    function uint32(value) {
        return new Uint8Array([
            value & 255,
            (value >>> 8) & 255,
            (value >>> 16) & 255,
            (value >>> 24) & 255
        ]);
    }

    function concatBytes(parts) {
        const total = parts.reduce((sum, part) => sum + part.length, 0);
        const output = new Uint8Array(total);
        let offset = 0;
        for (const part of parts) {
            output.set(part, offset);
            offset += part.length;
        }
        return output;
    }

    function createStoredZip(entries) {
        const encoder = new TextEncoder();
        const localParts = [];
        const centralParts = [];
        let localOffset = 0;

        for (const entry of entries) {
            const nameBytes = encoder.encode(entry.name);
            const dataBytes = entry.data instanceof Uint8Array
                ? entry.data
                : encoder.encode(String(entry.data));
            const checksum = crc32(dataBytes);

            const localHeader = concatBytes([
                uint32(0x04034b50),
                uint16(20),
                uint16(0),
                uint16(0),
                uint16(0),
                uint16(0),
                uint32(checksum),
                uint32(dataBytes.length),
                uint32(dataBytes.length),
                uint16(nameBytes.length),
                uint16(0),
                nameBytes
            ]);
            localParts.push(localHeader, dataBytes);

            const centralHeader = concatBytes([
                uint32(0x02014b50),
                uint16(20),
                uint16(20),
                uint16(0),
                uint16(0),
                uint16(0),
                uint16(0),
                uint32(checksum),
                uint32(dataBytes.length),
                uint32(dataBytes.length),
                uint16(nameBytes.length),
                uint16(0),
                uint16(0),
                uint16(0),
                uint16(0),
                uint32(0),
                uint32(localOffset),
                nameBytes
            ]);
            centralParts.push(centralHeader);
            localOffset += localHeader.length + dataBytes.length;
        }

        const localData = concatBytes(localParts);
        const centralData = concatBytes(centralParts);
        const endRecord = concatBytes([
            uint32(0x06054b50),
            uint16(0),
            uint16(0),
            uint16(entries.length),
            uint16(entries.length),
            uint32(centralData.length),
            uint32(localData.length),
            uint16(0)
        ]);
        return concatBytes([localData, centralData, endRecord]);
    }

    function createRidImagesDocx(images, notificationNumber) {
        const pageWidthEmu = 9144000;
        const pageHeightEmu = 5143500;
        const bodyParts = [];
        const relationshipParts = [];
        const imageEntries = [];

        images.forEach((image, index) => {
            const imageNumber = index + 1;
            const relationshipId = `rId${imageNumber + 1}`;
            const imagePath = `media/image${imageNumber}.png`;
            const title = image.fileName.replace(/\.png$/i, "");

            bodyParts.push(
                `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
                `<w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr>` +
                `<w:t>${xmlEscape(title)}</w:t></w:r></w:p>`,
                `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>` +
                `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
                `<wp:extent cx="${pageWidthEmu}" cy="${pageHeightEmu}"/>` +
                `<wp:docPr id="${imageNumber}" name="${xmlEscape(title)}"/>` +
                `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
                `<pic:pic><pic:nvPicPr><pic:cNvPr id="${imageNumber}" name="${xmlEscape(image.fileName)}"/>` +
                `<pic:cNvPicPr/></pic:nvPicPr><pic:blipFill>` +
                `<a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch>` +
                `</pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/>` +
                `<a:ext cx="${pageWidthEmu}" cy="${pageHeightEmu}"/></a:xfrm>` +
                `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
                `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>` +
                (imageNumber < images.length ? `<w:p><w:r><w:br w:type="page"/></w:r></w:p>` : "")
            );

            relationshipParts.push(
                `<Relationship Id="${relationshipId}" ` +
                `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
                `Target="${imagePath}"/>`
            );
            imageEntries.push({
                name: `word/${imagePath}`,
                data: dataUrlToBytes(image.dataUrl)
            });
        });

        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
            `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
            `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
            `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
            `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<w:body>` + bodyParts.join("") +
            `<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>` +
            `<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" ` +
            `w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;

        const documentRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
            relationshipParts.join("") + `</Relationships>`;

        const entries = [
            {
                name: "[Content_Types].xml",
                data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
                    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
                    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
                    `<Default Extension="xml" ContentType="application/xml"/>` +
                    `<Default Extension="png" ContentType="image/png"/>` +
                    `<Override PartName="/word/document.xml" ` +
                    `ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
                    `</Types>`
            },
            {
                name: "_rels/.rels",
                data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
                    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
                    `<Relationship Id="rId1" ` +
                    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ` +
                    `Target="word/document.xml"/></Relationships>`
            },
            { name: "word/document.xml", data: documentXml },
            { name: "word/_rels/document.xml.rels", data: documentRelationships },
            ...imageEntries
        ];

        const zipBytes = createStoredZip(entries);
        const blob = new Blob([zipBytes], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `RID_${notificationNumber}_Images.docx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return link.download;
    }

    function downloadDataUrl(dataUrl, fileName) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function createProgressUi() {
        const existing = document.getElementById("ceid-exporter-progress-ui");
        if (existing) existing.remove();

        const box = document.createElement("div");
        box.id = "ceid-exporter-progress-ui";
        box.style.position = "fixed";
        box.style.right = "16px";
        box.style.bottom = "16px";
        box.style.zIndex = "2147483647";
        box.style.width = "430px";
        box.style.maxWidth = "calc(100vw - 32px)";
        box.style.background = "#111";
        box.style.color = "#fff";
        box.style.padding = "14px";
        box.style.borderRadius = "8px";
        box.style.fontFamily = "Segoe UI, Arial, sans-serif";
        box.style.fontSize = "13px";
        box.style.boxShadow = "0 4px 14px rgba(0,0,0,.35)";

        const title = document.createElement("div");
        title.textContent = "AutoRID v1.0 / GIS Export";
        title.style.fontWeight = "700";
        title.style.marginBottom = "8px";

        const detail = document.createElement("div");
        detail.id = "ceid-exporter-progress-detail";
        detail.style.whiteSpace = "pre-line";
        detail.style.lineHeight = "1.35";
        detail.textContent = "Starting...";

        const track = document.createElement("div");
        track.style.marginTop = "10px";
        track.style.height = "10px";
        track.style.background = "#333";
        track.style.borderRadius = "999px";
        track.style.overflow = "hidden";

        const bar = document.createElement("div");
        bar.id = "ceid-exporter-progress-bar";
        bar.style.height = "100%";
        bar.style.width = "0%";
        bar.style.background = "#0078d4";
        bar.style.transition = "width .2s ease";

        const percent = document.createElement("div");
        percent.id = "ceid-exporter-progress-percent";
        percent.style.marginTop = "6px";
        percent.style.color = "#ddd";
        percent.textContent = "0%";

        track.appendChild(bar);
        box.appendChild(title);
        box.appendChild(detail);
        box.appendChild(track);
        box.appendChild(percent);
        document.body.appendChild(box);

        return { box, detail, bar, percent };
    }

    function updateProgress(ui, percentValue, text) {
        const pct = Math.max(0, Math.min(100, Number(percentValue) || 0));
        ui.detail.textContent = text;
        ui.bar.style.width = pct.toFixed(1) + "%";
        ui.percent.textContent = pct.toFixed(1) + "%";
        log(text);
    }

    async function promptForMappings() {
        const payload = String(window.__RID_WORKFLOW_PAYLOAD || "").trim();
        if (!payload) {
            throw new Error(
                "No shared RID workflow data was found. Return to Katapult and run the same bookmarklet first."
            );
        }

        return payload
            .split(/\r?\n/)
            .filter(line => !/^Notification\s*(?:Number|#)?\s*:/i.test(line.trim()))
            .join("\n")
            .trim();
    }

    function createArcgisIframe(width, height, version) {
        return new Promise((resolve, reject) => {
            const old = document.getElementById("ce-arcgis4-screenshot-frame");
            if (old) old.remove();

            const iframe = document.createElement("iframe");
            iframe.id = "ce-arcgis4-screenshot-frame";
            iframe.style.position = "fixed";
            iframe.style.left = "0";
            iframe.style.top = "0";
            iframe.style.width = width + "px";
            iframe.style.height = height + "px";
            iframe.style.border = "0";
            iframe.style.background = "#fff";

            if (CONFIG.showPreview) {
                iframe.style.opacity = "1";
                iframe.style.pointerEvents = "none";
                iframe.style.zIndex = "2147483000";
                iframe.style.transform = "scale(0.35)";
                iframe.style.transformOrigin = "top left";
                iframe.style.boxShadow = "0 0 0 3px #ffcc00";
            } else {
                iframe.style.opacity = "0.01";
                iframe.style.pointerEvents = "none";
                iframe.style.zIndex = "1";
            }

            document.body.appendChild(iframe);
            const frameWindow = iframe.contentWindow;
            const frameDoc = iframe.contentDocument || frameWindow.document;
            frameDoc.open();
            frameDoc.write("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>");
            frameDoc.close();

            const style = frameDoc.createElement("style");
            style.textContent = `html, body, #viewDiv { padding:0; margin:0; width:${width}px; height:${height}px; overflow:hidden; background:#fff; } .esri-ui { display:none !important; }`;
            frameDoc.head.appendChild(style);

            const css = frameDoc.createElement("link");
            css.rel = "stylesheet";
            css.href = `https://js.arcgis.com/${version}/esri/themes/light/main.css`;
            frameDoc.head.appendChild(css);

            const viewDiv = frameDoc.createElement("div");
            viewDiv.id = "viewDiv";
            frameDoc.body.appendChild(viewDiv);

            const script = frameDoc.createElement("script");
            script.src = `https://js.arcgis.com/${version}/`;
            script.onload = function () {
                const started = Date.now();
                const timer = setInterval(() => {
                    if (frameWindow.require && typeof frameWindow.require === "function") {
                        clearInterval(timer);
                        resolve(iframe);
                        return;
                    }
                    if (Date.now() - started > 15000) {
                        clearInterval(timer);
                        reject(new Error("ArcGIS script loaded, but iframe require did not appear."));
                    }
                }, 250);
            };
            script.onerror = function () { reject(new Error("Failed to load ArcGIS script inside iframe.")); };
            frameDoc.body.appendChild(script);
        });
    }

    function iframeRequire(iframe, modules) {
        return new Promise((resolve, reject) => {
            iframe.contentWindow.require(modules, (...loaded) => resolve(loaded), reject);
        });
    }

    async function discoverLandbaseMapServers(folderUrl) {
        const json = await fetchJson(folderUrl.replace(/\/$/, "") + "?f=pjson");
        if (!json.services || !Array.isArray(json.services)) throw new Error("Could not discover Landbase services from folder JSON.");
        return json.services
            .filter(s => String(s.type).toLowerCase() === "mapserver")
            .map(s => "https://gis.consumersenergy.com/mapping/rest/services/" + s.name + "/MapServer");
    }

    async function waitForOperationalLayers(layers, ui, basePercent) {
        const total = layers.length;
        const timeoutMs = CONFIG.layerLoadTimeoutMs;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const title = layer.title || `Layer ${i + 1}`;
            updateProgress(ui, basePercent + (i / Math.max(total, 1)) * 10, `Waiting for Electric and Landbase layers...\n${i + 1} of ${total}: ${title}\nTimeout per layer: ${Math.round(timeoutMs / 1000)} sec`);
            try {
                await withTimeout(layer.when(), timeoutMs, title);
            } catch (err) {
                console.warn(`[AutoRID v1.0 / GIS Export] Layer failed to load: ${title}`, err);
            }
        }
        updateProgress(ui, basePercent + 10, "Layer readiness complete. Continuing export...");
    }

    async function batchQueryPolesByOldCeid(layerUrl, records, ui) {
        const lookup = new Map();
        const oldCeids = records.filter(x => x.mode === "oldCeid").map(x => x.oldCeid);
        const chunks = chunkArray(oldCeids, CONFIG.batchSize);
        for (let i = 0; i < chunks.length; i++) {
            const batch = chunks[i];
            if (!batch.length) continue;
            updateProgress(ui, 5 + (i / Math.max(chunks.length, 1)) * 10, `Batch querying old CEID pole locations...\nBatch ${i + 1} of ${chunks.length}\nPoles in batch: ${batch.length}`);
            const quotedTags = batch.map(tag => `'${sqlString(String(tag).trim())}'`).join(",");
            const where = `${CONFIG.ceTagField} IN (${quotedTags})`;
            const params = new URLSearchParams({ f: "json", where, outFields: "*", returnGeometry: "true", outSR: "4326" });
            const json = await fetchJson(layerUrl + "/query?" + params.toString());
            if (!json.features || json.features.length === 0) continue;
            for (const feature of json.features) {
                const oldCeid = (feature.attributes || {})[CONFIG.ceTagField];
                if (oldCeid !== null && oldCeid !== undefined) lookup.set(String(oldCeid).trim(), feature);
            }
        }
        return lookup;
    }

    async function querySinglePoleByOldCeid(layerUrl, oldCeid) {
        const where = `${CONFIG.ceTagField}='${sqlString(String(oldCeid).trim())}'`;
        const params = new URLSearchParams({ f: "json", where, outFields: "*", returnGeometry: "true", outSR: "4326" });
        const json = await fetchJson(layerUrl + "/query?" + params.toString());
        return json.features && json.features.length ? json.features[0] : null;
    }

    function firstAttribute(attributes, names) {
        if (!attributes || typeof attributes !== "object") return "";
        const entries = Object.entries(attributes);

        for (const name of names) {
            const wanted = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
            for (const [key, value] of entries) {
                const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
                if (
                    normalizedKey === wanted &&
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== ""
                ) {
                    return String(value).trim();
                }
            }
        }
        return "";
    }

    function flattenServiceLayers(layers, output = []) {
        for (const layer of layers || []) {
            output.push(layer);
            if (Array.isArray(layer.subLayers)) flattenServiceLayers(layer.subLayers, output);
        }
        return output;
    }

    async function getElectricSublayers() {
        const allLayers = await fetchJson(CONFIG.electricMapServer + "/layers?f=pjson");
        return [...(allLayers.layers || []), ...(allLayers.tables || [])];
    }

    function normalizedFieldNames(layer) {
        const names = new Set();
        for (const field of layer.fields || []) {
            names.add(String(field.name || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
            names.add(String(field.alias || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
        }
        return names;
    }

    function hasAnyField(layer, names) {
        const fields = normalizedFieldNames(layer);
        return names.some(name => fields.has(String(name).toLowerCase().replace(/[^a-z0-9]/g, "")));
    }

    function scoreMetadataLayer(layer) {
        const name = String(layer.name || "").toLowerCase();
        let score = 0;

        if (hasAnyField(layer, ["WORKHEADQUARTERS", "WORK HEADQUARTERS", "WORK_HEADQUARTERS", "WORK HQ", "WORKHQ"])) score += 300;
        if (hasAnyField(layer, ["SUBSTATION", "SUBSTATIONNAME", "SUBSTATION NAME", "SUBSTATION_NAME"])) score += 220;
        if (hasAnyField(layer, ["CIRCUIT", "CIRCUITNAME", "CIRCUIT NAME", "CIRCUIT_NAME"])) score += 220;
        if (hasAnyField(layer, ["SUBSTATIONID", "SUBSTATION ID"])) score += 100;
        if (hasAnyField(layer, ["CIRCUITID", "CIRCUIT ID"])) score += 100;
        if (/circuit.*boundar/.test(name)) score += 80;
        if (/primary.*overhead.*conductor|overhead.*primary.*conductor/.test(name)) score += 60;
        return score;
    }

    function isQueryableFeatureLayer(definition) {
        if (!definition || definition.error) return false;
        const type = String(definition.type || "").toLowerCase();
        const capabilities = String(definition.capabilities || "").toLowerCase();
        const hasGeometry = Boolean(definition.geometryType);
        const isGroup = type.includes("group") || Array.isArray(definition.subLayers);
        return !isGroup && hasGeometry && (capabilities.includes("query") || type.includes("feature"));
    }

    async function queryLayerAtPoint(layerUrl, pointData, radiusFeet = 40) {
        const latitude = Number(pointData.latitude);
        const longitude = Number(pointData.longitude);
        const latDelta = radiusFeet / 364000;
        const lonScale = Math.max(0.2, Math.cos(latitude * Math.PI / 180));
        const lonDelta = radiusFeet / (364000 * lonScale);
        const envelope = {
            xmin: longitude - lonDelta,
            ymin: latitude - latDelta,
            xmax: longitude + lonDelta,
            ymax: latitude + latDelta,
            spatialReference: { wkid: 4326 }
        };
        const params = new URLSearchParams({
            f: "json",
            where: "1=1",
            outFields: "*",
            returnGeometry: "false",
            geometry: JSON.stringify(envelope),
            geometryType: "esriGeometryEnvelope",
            inSR: "4326",
            spatialRel: "esriSpatialRelIntersects",
            resultRecordCount: "5"
        });
        const result = await fetchJson(layerUrl + "/query?" + params.toString());
        return result.features || [];
    }

    async function getLayerFieldMap(layerUrl) {
        try {
            const definition = await fetchJson(layerUrl + "?f=pjson");
            const map = {};
            for (const field of definition.fields || []) {
                map[String(field.name || "").toLowerCase().replace(/[^a-z0-9]/g, "")] = field.name;
                map[String(field.alias || "").toLowerCase().replace(/[^a-z0-9]/g, "")] = field.name;
            }
            return { definition, map };
        } catch (error) {
            console.warn(`[${CONFIG.filePrefix}] Could not read layer field definitions for ${layerUrl}.`, error);
            return { definition: null, map: {} };
        }
    }

    function firstAttributeByFieldMap(attributes, fieldMap, names) {
        for (const name of names) {
            const normalized = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
            const actualName = fieldMap[normalized];
            if (actualName && attributes[actualName] !== null && attributes[actualName] !== undefined) {
                const value = String(attributes[actualName]).trim();
                if (value) return value;
            }
        }
        return firstAttribute(attributes, names);
    }

    function metadataFromAttributes(attributes, fieldMap = {}) {
        return {
            headquarters: firstAttributeByFieldMap(attributes, fieldMap, [
                "WORKHEADQUARTERS", "WORK HEADQUARTERS", "WORK_HEADQUARTERS", "WORKHQ", "HEADQUARTERSNAME", "HEADQUARTERS NAME", "HEADQUARTERS"
            ]),
            substationId: firstAttributeByFieldMap(attributes, fieldMap, [
                "SUBSTATIONID", "SUBSTATION ID", "SUBSTATION_ID", "SUBSTATIONID2"
            ]),
            circuitId: firstAttributeByFieldMap(attributes, fieldMap, [
                "CIRCUITID", "CIRCUIT ID", "CIRCUIT_ID"
            ]),
            feederId: firstAttributeByFieldMap(attributes, fieldMap, [
                "FEEDERID", "FEEDER ID", "FEEDER_ID"
            ]),
            substationName: firstAttributeByFieldMap(attributes, fieldMap, [
                "SUBSTATION", "SUBSTATIONNAME", "SUBSTATION NAME", "SUBSTATION_NAME", "SUBSTATIONDESC", "SUBSTATION DESCRIPTION"
            ]),
            circuitName: firstAttributeByFieldMap(attributes, fieldMap, [
                "CIRCUIT", "CIRCUITNAME", "CIRCUIT NAME", "CIRCUIT_NAME", "CIRCUITDESC", "CIRCUIT DESCRIPTION"
            ])
        };
    }

    function mergeMetadata(base, addition) {
        for (const key of Object.keys(base)) {
            if (!base[key] && addition[key]) base[key] = addition[key];
        }
        return base;
    }

    async function identifyElectricAtPoint(pointData) {
        const latitude = Number(pointData.latitude);
        const longitude = Number(pointData.longitude);
        const span = 0.0015;
        const mapExtent = {
            xmin: longitude - span,
            ymin: latitude - span,
            xmax: longitude + span,
            ymax: latitude + span,
            spatialReference: { wkid: 4326 }
        };
        const geometry = {
            x: longitude,
            y: latitude,
            spatialReference: { wkid: 4326 }
        };
        const params = new URLSearchParams({
            f: "json",
            geometry: JSON.stringify(geometry),
            geometryType: "esriGeometryPoint",
            sr: "4326",
            mapExtent: JSON.stringify(mapExtent),
            imageDisplay: "1200,800,96",
            tolerance: "12",
            returnGeometry: "false",
            layers: "all"
        });
        const response = await fetchJson(
            CONFIG.electricMapServer + "/identify?" + params.toString()
        );
        return response.results || [];
    }

    function metadataFromIdentifyResults(results) {
        const metadata = {
            headquarters: "",
            substationId: "",
            circuitId: "",
            feederId: "",
            substationName: "",
            circuitName: ""
        };

        const ranked = (results || []).map(result => {
            const layerName = String(result.layerName || "");
            let rank = 0;
            if (/primary.*overhead.*conductor/i.test(layerName)) rank += 300;
            if (/circuit.*boundar/i.test(layerName)) rank += 250;
            const attributes = result.attributes || {};
            const normalizedKeys = Object.keys(attributes).map(key =>
                String(key).toLowerCase().replace(/[^a-z0-9]/g, "")
            );
            if (normalizedKeys.includes("workheadquarters")) rank += 500;
            if (normalizedKeys.includes("substation")) rank += 400;
            if (normalizedKeys.includes("circuit")) rank += 400;
            return { result, rank };
        }).sort((a, b) => b.rank - a.rank);

        for (const { result } of ranked) {
            const attributes = result.attributes || {};
            const candidate = metadataFromAttributes(attributes, {});

            if (candidate.headquarters) {
                const candidateLooksFull = candidate.headquarters.length > 3;
                const currentLooksAbbreviated = metadata.headquarters && metadata.headquarters.length <= 3;
                if (!metadata.headquarters || (candidateLooksFull && currentLooksAbbreviated)) {
                    metadata.headquarters = candidate.headquarters;
                }
                candidate.headquarters = "";
            }
            mergeMetadata(metadata, candidate);

            console.log(`[${CONFIG.filePrefix}] Identify metadata candidate`, {
                layerId: result.layerId,
                layerName: result.layerName,
                displayFieldName: result.displayFieldName,
                attributes,
                accumulated: { ...metadata }
            });
        }
        return metadata;
    }

    async function fetchFirstPoleRidMetadata(pointData) {
        const metadata = {
            headquarters: "",
            substationId: "",
            circuitId: "",
            feederId: "",
            substationName: "",
            circuitName: ""
        };

        try {
            const identifyResults = await identifyElectricAtPoint(pointData);
            console.log(`[${CONFIG.filePrefix}] Electric identify returned ${identifyResults.length} results.`);
            mergeMetadata(metadata, metadataFromIdentifyResults(identifyResults));
        } catch (identifyError) {
            console.warn(`[${CONFIG.filePrefix}] Electric identify failed: ${identifyError.message || identifyError}`);
        }

        const candidateLayers = (await getElectricSublayers())
            .filter(layer => Number.isInteger(Number(layer.id)))
            .map(layer => ({ ...layer, id: Number(layer.id), metadataScore: scoreMetadataLayer(layer) }))
            .filter(layer => layer.metadataScore > 0)
            .filter(layer => isQueryableFeatureLayer(layer))
            .filter((layer, index, array) => array.findIndex(item => item.id === layer.id) === index)
            .sort((a, b) => b.metadataScore - a.metadataScore)
            .slice(0, 10);

        if (
            metadata.headquarters && metadata.headquarters.length > 3 &&
            metadata.substationId && metadata.circuitId &&
            metadata.substationName && metadata.circuitName
        ) {
            console.log(`[${CONFIG.filePrefix}] RID metadata completed from MapServer identify.`, metadata);
            return metadata;
        }

        const layers = candidateLayers.map(layer => {
            const fieldMap = {};
            for (const field of layer.fields || []) {
                fieldMap[String(field.name || "").toLowerCase().replace(/[^a-z0-9]/g, "")] = field.name;
                fieldMap[String(field.alias || "").toLowerCase().replace(/[^a-z0-9]/g, "")] = field.name;
            }
            return {
                ...layer,
                definition: layer,
                fieldMap
            };
        });

        console.table(layers.map(layer => ({
            id: layer.id,
            name: layer.name,
            score: layer.metadataScore,
            type: layer.definition?.type,
            geometryType: layer.definition?.geometryType
        })));

        for (const layer of layers) {
            const layerUrl = CONFIG.electricMapServer + "/" + layer.id;
            try {
                const definition = layer.definition;
                const fieldMap = layer.fieldMap;
                const effectiveLayerName = definition?.name || layer.name || `Layer ${layer.id}`;
                const features = await queryLayerAtPoint(
                    layerUrl,
                    pointData,
                    /circuit.*boundar/i.test(effectiveLayerName) ? 150 : 60
                );

                for (const feature of features) {
                    const candidate = metadataFromAttributes(feature.attributes || {}, fieldMap);

                    // WORKHEADQUARTERS is the full RID choice value. Do not let a short
                    // office abbreviation such as CLD overwrite a full headquarters name.
                    if (candidate.headquarters) {
                        const candidateLooksFull = candidate.headquarters.length > 3;
                        const currentLooksAbbreviated = metadata.headquarters && metadata.headquarters.length <= 3;
                        if (!metadata.headquarters || (candidateLooksFull && currentLooksAbbreviated)) {
                            metadata.headquarters = candidate.headquarters;
                        }
                        candidate.headquarters = "";
                    }
                    mergeMetadata(metadata, candidate);
                }

                console.log(`[${CONFIG.filePrefix}] Metadata layer result`, {
                    id: layer.id,
                    name: effectiveLayerName,
                    featureCount: features.length,
                    metadata: { ...metadata }
                });

                if (
                    metadata.headquarters && metadata.headquarters.length > 3 &&
                    metadata.substationId && metadata.circuitId &&
                    metadata.substationName && metadata.circuitName
                ) break;
            } catch (error) {
                console.warn(`[${CONFIG.filePrefix}] Metadata query skipped for layer ${layer.id} (${layer.name}): ${error.message || error}`);
            }
        }

        if (!layers.length) {
            console.warn(`[${CONFIG.filePrefix}] No queryable Electric layers containing the RID metadata fields were discovered.`);
        }
        const missing = [
            ["Headquarters", metadata.headquarters],
            ["Substation ID", metadata.substationId],
            ["Circuit ID", metadata.circuitId],
            ["Substation Name", metadata.substationName],
            ["Circuit Name", metadata.circuitName]
        ].filter(([, value]) => !value).map(([label]) => label);
        if (missing.length) {
            console.warn(`[${CONFIG.filePrefix}] GIS metadata is incomplete. Missing: ${missing.join(", ")}`);
        }
        console.log(`[${CONFIG.filePrefix}] First-pole RID metadata`, metadata);
        return metadata;
    }

    function downloadUpdatedWorkflowPackage(workflowPackage) {
        const updated = {
            ...workflowPackage,
            gis: {
                ...(workflowPackage.gis || {}),
                updatedAt: new Date().toISOString()
            }
        };
        const blob = new Blob([JSON.stringify(updated, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `RID_Workflow_${updated.notificationNumber}_GIS_Updated.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return updated;
    }

    function distanceFeet(lat1, lon1, lat2, lon2) {
        const rFeet = 20925524.9;
        const toRad = deg => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return rFeet * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    async function queryNearbyPolesByLonLat(layerUrl, longitude, latitude, radiusFeet) {
        const pointGeometry = { x: longitude, y: latitude, spatialReference: { wkid: 4326 } };
        const params = new URLSearchParams({
            f: "json",
            where: "1=1",
            outFields: "*",
            returnGeometry: "true",
            outSR: "4326",
            geometry: JSON.stringify(pointGeometry),
            geometryType: "esriGeometryPoint",
            inSR: "4326",
            spatialRel: "esriSpatialRelIntersects",
            distance: String(radiusFeet),
            units: "esriSRUnit_Foot"
        });
        const json = await fetchJson(layerUrl + "/query?" + params.toString());
        if (!json.features || json.features.length === 0) return [];
        return json.features
            .map(feature => {
                const geom = feature.geometry || {};
                const d = typeof geom.x === "number" && typeof geom.y === "number" ? distanceFeet(latitude, longitude, geom.y, geom.x) : Infinity;
                return { feature, distanceFeet: d };
            })
            .filter(x => Number.isFinite(x.distanceFeet))
            .sort((a, b) => a.distanceFeet - b.distanceFeet);
    }

    async function queryNearestPoleByLonLat(layerUrl, longitude, latitude) {
        const nearby = await queryNearbyPolesByLonLat(layerUrl, longitude, latitude, CONFIG.coordinateSearchRadiusFeet);
        return nearby.length ? nearby[0] : null;
    }

    async function queryNearestValidReferencePole(layerUrl, targetPoint, targetFeature) {
        const nearby = await queryNearbyPolesByLonLat(layerUrl, targetPoint.longitude, targetPoint.latitude, CONFIG.referencePoleSearchRadiusFeet);
        const targetGeom = targetFeature && targetFeature.geometry ? targetFeature.geometry : null;
        for (const item of nearby) {
            const feature = item.feature;
            const ceTag = (feature.attributes || {})[CONFIG.ceTagField];
            if (!isValidExistingCeid(ceTag)) continue;
            if (item.distanceFeet < 1) continue;
            if (targetGeom && feature.geometry && Math.abs(feature.geometry.x - targetGeom.x) < 0.0000001 && Math.abs(feature.geometry.y - targetGeom.y) < 0.0000001) continue;
            return { feature, ceTag: String(ceTag).trim(), distanceFeet: item.distanceFeet };
        }
        return null;
    }

    function getLonLatGeometry(feature) {
        if (!feature || !feature.geometry) return null;
        const geom = feature.geometry;
        if (typeof geom.x === "number" && typeof geom.y === "number") return { longitude: geom.x, latitude: geom.y, spatialReference: geom.spatialReference || { wkid: 4326 } };
        return null;
    }

    function isLikelyLonLat(point) {
        return point && typeof point.longitude === "number" && typeof point.latitude === "number" && point.longitude >= -180 && point.longitude <= 180 && point.latitude >= -90 && point.latitude <= 90;
    }

    async function waitForViewIdle(view, timeoutMs = 15000) {
        const started = Date.now();
        while (view.updating) {
            await sleep(150);
            if (Date.now() - started > timeoutMs) {
                console.warn("[AutoRID v1.0 / GIS Export] Timed out waiting for view.updating=false.");
                break;
            }
        }
        await sleep(CONFIG.drawSettleMs);
    }


    async function waitForLayerViewIdle(layerView, timeoutMs, label) {
        const started = Date.now();
        while (layerView && layerView.updating) {
            await sleep(150);
            if (Date.now() - started > timeoutMs) {
                console.warn(`[AutoRID v1.0 / GIS Export] Timed out waiting for layerView updating=false: ${label}`);
                break;
            }
        }
    }

    async function waitForMapAndOperationalLayers(view, layers, timeoutPerLayerMs = 5000) {
        await waitForViewIdle(view, 15000);

        for (const layer of layers) {
            const label = layer.title || layer.url || "Operational layer";
            try {
                const layerView = await withTimeout(view.whenLayerView(layer), timeoutPerLayerMs, `layerView ${label}`);
                if (layerView && !layerView.timedOut) {
                    await waitForLayerViewIdle(layerView, timeoutPerLayerMs, label);
                }
            } catch (err) {
                console.warn(`[AutoRID v1.0 / GIS Export] Could not wait for operational layer: ${label}`, err);
            }
        }

        await sleep(CONFIG.drawSettleMs);
    }

    function rectsIntersect(a, b) {
        return !(
            a.right < b.left ||
            a.left > b.right ||
            a.bottom < b.top ||
            a.top > b.bottom
        );
    }

    function rectIntersectionArea(a, b) {
        const left = Math.max(a.left, b.left);
        const right = Math.min(a.right, b.right);
        const top = Math.max(a.top, b.top);
        const bottom = Math.min(a.bottom, b.bottom);

        if (right <= left || bottom <= top) return 0;
        return (right - left) * (bottom - top);
    }

    function inflateRect(rect, padding) {
        return {
            left: rect.left - padding,
            right: rect.right + padding,
            top: rect.top - padding,
            bottom: rect.bottom + padding
        };
    }

    function labelRectFromPoint(screenPoint, offset, width, height) {
        const anchorX = screenPoint.x + offset.xoffset;
        const anchorY = screenPoint.y - offset.yoffset;

        if (offset.horizontalAlignment === "right") {
            return {
                left: anchorX - width,
                right: anchorX,
                top: anchorY - height / 2,
                bottom: anchorY + height / 2
            };
        }

        return {
            left: anchorX,
            right: anchorX + width,
            top: anchorY - height / 2,
            bottom: anchorY + height / 2
        };
    }

    function markerRectFromPoint(screenPoint, radiusPx) {
        return {
            left: screenPoint.x - radiusPx,
            right: screenPoint.x + radiusPx,
            top: screenPoint.y - radiusPx,
            bottom: screenPoint.y + radiusPx
        };
    }

    function outOfBoundsPenalty(rect, view) {
        let penalty = 0;
        const padding = 12;
        const width = view.width || CONFIG.outputWidth;
        const height = view.height || CONFIG.outputHeight;

        if (rect.left < padding) penalty += padding - rect.left;
        if (rect.top < padding) penalty += padding - rect.top;
        if (rect.right > width - padding) penalty += rect.right - (width - padding);
        if (rect.bottom > height - padding) penalty += rect.bottom - (height - padding);

        return Math.max(0, penalty);
    }

    function chooseReferenceLabelOffset(view, targetPoint, referencePoint) {
        const targetScreen = view.toScreen(targetPoint);
        const referenceScreen = view.toScreen(referencePoint);

        if (!targetScreen || !referenceScreen) {
            return { xoffset: 82, yoffset: 34, horizontalAlignment: "left" };
        }

        // These text boxes are intentionally oversized because ArcGIS wraps the large text
        // and the rendered label is taller/wider than the raw two-line string suggests.
        const targetLabelRect = inflateRect(labelRectFromPoint(
            targetScreen,
            { xoffset: 82, yoffset: 34, horizontalAlignment: "left" },
            430,
            145
        ), 18);

        const targetMarkerRect = inflateRect(markerRectFromPoint(targetScreen, 34), 14);
        const referenceMarkerRect = inflateRect(markerRectFromPoint(referenceScreen, 34), 14);

        const referenceLabelWidth = 500;
        const referenceLabelHeight = 135;

        const referenceIsLeftOfTarget = referenceScreen.x < targetScreen.x;
        const referenceIsAboveTarget = referenceScreen.y < targetScreen.y;

        const candidates = [];

        // Prefer top-right to match the target label style, but if the reference pole is
        // left/below the target, top-right often points directly into the target label.
        candidates.push({ name: "top-right", xoffset: 82, yoffset: 34, horizontalAlignment: "left", basePreference: 0 });

        if (referenceIsLeftOfTarget && !referenceIsAboveTarget) {
            candidates.push({ name: "bottom-left-away", xoffset: -82, yoffset: -58, horizontalAlignment: "right", basePreference: 1 });
            candidates.push({ name: "top-left", xoffset: -82, yoffset: 34, horizontalAlignment: "right", basePreference: 2 });
            candidates.push({ name: "bottom-right", xoffset: 82, yoffset: -58, horizontalAlignment: "left", basePreference: 3 });
        } else if (referenceIsLeftOfTarget && referenceIsAboveTarget) {
            candidates.push({ name: "top-left-away", xoffset: -82, yoffset: 34, horizontalAlignment: "right", basePreference: 1 });
            candidates.push({ name: "bottom-left", xoffset: -82, yoffset: -58, horizontalAlignment: "right", basePreference: 2 });
            candidates.push({ name: "bottom-right", xoffset: 82, yoffset: -58, horizontalAlignment: "left", basePreference: 3 });
        } else if (!referenceIsLeftOfTarget && !referenceIsAboveTarget) {
            candidates.push({ name: "bottom-right-away", xoffset: 82, yoffset: -58, horizontalAlignment: "left", basePreference: 1 });
            candidates.push({ name: "top-left", xoffset: -82, yoffset: 34, horizontalAlignment: "right", basePreference: 2 });
            candidates.push({ name: "bottom-left", xoffset: -82, yoffset: -58, horizontalAlignment: "right", basePreference: 3 });
        } else {
            candidates.push({ name: "top-right-away", xoffset: 82, yoffset: 34, horizontalAlignment: "left", basePreference: 1 });
            candidates.push({ name: "top-left", xoffset: -82, yoffset: 34, horizontalAlignment: "right", basePreference: 2 });
            candidates.push({ name: "bottom-right", xoffset: 82, yoffset: -58, horizontalAlignment: "left", basePreference: 3 });
            candidates.push({ name: "bottom-left", xoffset: -82, yoffset: -58, horizontalAlignment: "right", basePreference: 4 });
        }

        // Extra farther-away placements for tight cases.
        candidates.push({ name: "far-top-right", xoffset: 145, yoffset: 70, horizontalAlignment: "left", basePreference: 8 });
        candidates.push({ name: "far-bottom-right", xoffset: 145, yoffset: -92, horizontalAlignment: "left", basePreference: 9 });
        candidates.push({ name: "far-top-left", xoffset: -145, yoffset: 70, horizontalAlignment: "right", basePreference: 10 });
        candidates.push({ name: "far-bottom-left", xoffset: -145, yoffset: -92, horizontalAlignment: "right", basePreference: 11 });

        let best = null;

        for (const candidate of candidates) {
            const refRect = labelRectFromPoint(referenceScreen, candidate, referenceLabelWidth, referenceLabelHeight);
            const overlapArea =
                rectIntersectionArea(refRect, targetLabelRect) +
                rectIntersectionArea(refRect, targetMarkerRect) +
                rectIntersectionArea(refRect, referenceMarkerRect);

            const boundsPenalty = outOfBoundsPenalty(refRect, view);
            const score = overlapArea * 1000 + boundsPenalty * 100 + candidate.basePreference;

            const result = { candidate, refRect, overlapArea, boundsPenalty, score };

            if (!best || result.score < best.score) {
                best = result;
            }

            if (overlapArea === 0 && boundsPenalty === 0) {
                best = result;
                break;
            }
        }

        console.log("[AutoRID v1.0 / GIS Export] Reference label placement candidates:", candidates.map(candidate => {
            const refRect = labelRectFromPoint(referenceScreen, candidate, referenceLabelWidth, referenceLabelHeight);
            return {
                name: candidate.name,
                xoffset: candidate.xoffset,
                yoffset: candidate.yoffset,
                horizontalAlignment: candidate.horizontalAlignment,
                overlapArea:
                    rectIntersectionArea(refRect, targetLabelRect) +
                    rectIntersectionArea(refRect, targetMarkerRect) +
                    rectIntersectionArea(refRect, referenceMarkerRect),
                boundsPenalty: outOfBoundsPenalty(refRect, view)
            };
        }));

        return {
            xoffset: best.candidate.xoffset,
            yoffset: best.candidate.yoffset,
            horizontalAlignment: best.candidate.horizontalAlignment
        };
    }

    function createPolePoint(Point, point) {
        return new Point({ longitude: point.longitude, latitude: point.latitude, spatialReference: { wkid: 4326 } });
    }

    function createRadiusExtent(Extent, geometryEngine, polePoint, optionalReferencePoint, optionalReferenceDistanceFeet) {
        const effectiveRadiusFeet = optionalReferencePoint && Number.isFinite(optionalReferenceDistanceFeet)
            ? Math.max(CONFIG.radiusFeet, optionalReferenceDistanceFeet + CONFIG.referencePoleBufferFeet)
            : CONFIG.radiusFeet;

        const targetBuffer = geometryEngine.geodesicBuffer(polePoint, effectiveRadiusFeet, "feet");
        if (!targetBuffer || !targetBuffer.extent) throw new Error("Failed to create feet-based radius extent.");

        let xmin = targetBuffer.extent.xmin;
        let ymin = targetBuffer.extent.ymin;
        let xmax = targetBuffer.extent.xmax;
        let ymax = targetBuffer.extent.ymax;

        if (optionalReferencePoint) {
            const referenceBuffer = geometryEngine.geodesicBuffer(optionalReferencePoint, CONFIG.referencePoleBufferFeet, "feet");
            if (referenceBuffer && referenceBuffer.extent) {
                xmin = Math.min(xmin, referenceBuffer.extent.xmin);
                ymin = Math.min(ymin, referenceBuffer.extent.ymin);
                xmax = Math.max(xmax, referenceBuffer.extent.xmax);
                ymax = Math.max(ymax, referenceBuffer.extent.ymax);
            }
        }

        return new Extent({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }).expand(CONFIG.extentExpandFactor);
    }

    function addTargetPoleGraphics(Graphic, markerLayer, polePoint, oldCeid, newCeid) {
        markerLayer.add(new Graphic({
            geometry: polePoint,
            symbol: { type: "simple-marker", style: "circle", color: [0, 0, 0, 0], size: 30, outline: { color: [255, 0, 0, 1], width: 5 } }
        }));
        markerLayer.add(new Graphic({
            geometry: polePoint,
            symbol: {
                type: "text",
                text: `New CEID: ${newCeid}\nOld CEID: ${oldCeid || "N/A"}`,
                color: [180, 0, 0, 1],
                haloColor: [255, 255, 255, 1],
                haloSize: 3,
                font: { size: 28, family: "Arial", weight: "bold" },
                xoffset: 82,
                yoffset: 34,
                horizontalAlignment: "left",
                verticalAlignment: "middle"
            }
        }));
    }

    function addReferencePoleMarker(Graphic, markerLayer, referencePoint) {
        markerLayer.add(new Graphic({
            geometry: referencePoint,
            symbol: { type: "simple-marker", style: "circle", color: [0, 0, 0, 0], size: 28, outline: { color: [0, 90, 200, 1], width: 5 } }
        }));
    }

    function addReferencePoleLabel(Graphic, markerLayer, referencePoint, referenceCeid, distanceFeetValue, offset) {
        const labelOffset = offset || { xoffset: 82, yoffset: 34, horizontalAlignment: "left" };

        markerLayer.add(new Graphic({
            geometry: referencePoint,
            symbol: {
                type: "text",
                text: `Reference CEID: ${referenceCeid}\n${distanceFeetValue.toFixed(1)} ft away`,
                color: [0, 70, 160, 1],
                haloColor: [255, 255, 255, 1],
                haloSize: 3,
                font: { size: 26, family: "Arial", weight: "bold" },
                xoffset: labelOffset.xoffset,
                yoffset: labelOffset.yoffset,
                horizontalAlignment: labelOffset.horizontalAlignment,
                verticalAlignment: "middle"
            }
        }));
    }

    function connectedTargetClusters(items) {
        const unvisited = new Set(items.map((_, index) => index));
        const clusters = [];

        while (unvisited.size) {
            const seed = unvisited.values().next().value;
            const queue = [seed];
            const clusterIndexes = [];
            unvisited.delete(seed);

            while (queue.length) {
                const currentIndex = queue.shift();
                clusterIndexes.push(currentIndex);
                const current = items[currentIndex].pointData;

                for (const candidateIndex of Array.from(unvisited)) {
                    const candidate = items[candidateIndex].pointData;
                    const gap = distanceFeet(
                        current.latitude,
                        current.longitude,
                        candidate.latitude,
                        candidate.longitude
                    );

                    if (gap <= CONFIG.groupingNeighborDistanceFeet) {
                        unvisited.delete(candidateIndex);
                        queue.push(candidateIndex);
                    }
                }
            }

            clusters.push(clusterIndexes.map(index => items[index]));
        }

        return clusters;
    }

    function sortClusterByChain(cluster) {
        if (cluster.length <= 2) return cluster.slice();
        const remaining = cluster.slice();
        const ordered = [remaining.shift()];

        while (remaining.length) {
            const last = ordered[ordered.length - 1].pointData;
            let bestIndex = 0;
            let bestDistance = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const point = remaining[i].pointData;
                const gap = distanceFeet(last.latitude, last.longitude, point.latitude, point.longitude);
                if (gap < bestDistance) {
                    bestDistance = gap;
                    bestIndex = i;
                }
            }

            ordered.push(remaining.splice(bestIndex, 1)[0]);
        }

        return ordered;
    }

    function buildConnectedGroups(items) {
        const groups = [];
        const clusters = connectedTargetClusters(items);

        for (const rawCluster of clusters) {
            const cluster = sortClusterByChain(rawCluster);
            for (let i = 0; i < cluster.length; i += CONFIG.maxTargetPolesPerImage) {
                groups.push(cluster.slice(i, i + CONFIG.maxTargetPolesPerImage));
            }
        }

        return groups;
    }

    function unionExtent(base, addition) {
        base.xmin = Math.min(base.xmin, addition.xmin);
        base.ymin = Math.min(base.ymin, addition.ymin);
        base.xmax = Math.max(base.xmax, addition.xmax);
        base.ymax = Math.max(base.ymax, addition.ymax);
        return base;
    }

    function createConnectedGroupExtent(Extent, geometryEngine, targetPoints, referencePoint, referenceDistanceFeet) {
        let extent = createRadiusExtent(
            Extent,
            geometryEngine,
            targetPoints[0],
            referencePoint,
            referenceDistanceFeet
        );

        for (let i = 1; i < targetPoints.length; i++) {
            const buffer = geometryEngine.geodesicBuffer(
                targetPoints[i],
                CONFIG.groupEdgeBufferFeet,
                "feet"
            );
            if (!buffer || !buffer.extent) throw new Error(`Unable to buffer target pole ${i + 1}.`);
            extent = unionExtent(extent, buffer.extent);
        }

        return extent.expand(CONFIG.extentExpandFactor);
    }

    function rectOverlap(a, b) {
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }

    function markerRect(screen, radius = 36) {
        return { left: screen.x - radius, right: screen.x + radius, top: screen.y - radius, bottom: screen.y + radius };
    }

    function textRect(screen, option, width, height) {
        const x = screen.x + option.xoffset;
        const y = screen.y - option.yoffset;
        return option.horizontalAlignment === "right"
            ? { left: x - width, right: x, top: y - height / 2, bottom: y + height / 2 }
            : { left: x, right: x + width, top: y - height / 2, bottom: y + height / 2 };
    }

    function chooseMultiLabelPosition(view, point, occupied, width, height) {
        const screen = view.toScreen(point);
        const options = [
            { xoffset: 82, yoffset: 34, horizontalAlignment: "left" },
            { xoffset: -82, yoffset: 34, horizontalAlignment: "right" },
            { xoffset: 82, yoffset: -58, horizontalAlignment: "left" },
            { xoffset: -82, yoffset: -58, horizontalAlignment: "right" },
            { xoffset: 145, yoffset: 80, horizontalAlignment: "left" },
            { xoffset: -145, yoffset: 80, horizontalAlignment: "right" },
            { xoffset: 145, yoffset: -100, horizontalAlignment: "left" },
            { xoffset: -145, yoffset: -100, horizontalAlignment: "right" }
        ];
        if (!screen) return options[0];

        let best = options[0];
        let bestScore = Infinity;
        for (const option of options) {
            const rect = textRect(screen, option, width, height);
            const overlaps = occupied.filter(other => rectOverlap(rect, other)).length;
            const outside = rect.left < 0 || rect.top < 0 || rect.right > view.width || rect.bottom > view.height;
            const score = overlaps + (outside ? 100 : 0);
            if (score < bestScore) { best = option; bestScore = score; }
            if (score === 0) break;
        }
        occupied.push(textRect(screen, best, width, height));
        return best;
    }

    function addTargetMarker(Graphic, layer, point) {
        layer.add(new Graphic({
            geometry: point,
            symbol: { type: "simple-marker", style: "circle", color: [0, 0, 0, 0], size: 30,
                outline: { color: [255, 0, 0, 1], width: 5 } }
        }));
    }

    function addTargetLabel(Graphic, layer, point, record, position) {
        layer.add(new Graphic({
            geometry: point,
            symbol: {
                type: "text",
                text: `New CEID: ${record.newCeid}\nOld CEID: ${record.oldCeid || "N/A"}`,
                color: [180, 0, 0, 1], haloColor: [255, 255, 255, 1], haloSize: 3,
                font: { size: 28, family: "Arial", weight: "bold" },
                xoffset: position.xoffset, yoffset: position.yoffset,
                horizontalAlignment: position.horizontalAlignment, verticalAlignment: "middle"
            }
        }));
    }

    function loadCanvasImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("Unable to load the ArcGIS screenshot for callout annotation."));
            image.src = dataUrl;
        });
    }

    function rectanglesIntersect(a, b) {
        return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    }

    function inflateRect(rect, padding) {
        return {
            left: rect.left - padding,
            right: rect.right + padding,
            top: rect.top - padding,
            bottom: rect.bottom + padding
        };
    }

    function pointRect(point, radius) {
        return {
            left: point.x - radius,
            right: point.x + radius,
            top: point.y - radius,
            bottom: point.y + radius
        };
    }

    function intersectionArea(a, b) {
        const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return width * height;
    }

    function segmentIntersectsSegment(a1, a2, b1, b2) {
        function orientation(p, q, r) {
            const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
            if (Math.abs(value) < 0.00001) return 0;
            return value > 0 ? 1 : 2;
        }

        const o1 = orientation(a1, a2, b1);
        const o2 = orientation(a1, a2, b2);
        const o3 = orientation(b1, b2, a1);
        const o4 = orientation(b1, b2, a2);
        return o1 !== o2 && o3 !== o4;
    }

    function closestPointOnRect(rect, point) {
        const candidates = [
            { x: Math.max(rect.left, Math.min(point.x, rect.right)), y: rect.top },
            { x: rect.right, y: Math.max(rect.top, Math.min(point.y, rect.bottom)) },
            { x: Math.max(rect.left, Math.min(point.x, rect.right)), y: rect.bottom },
            { x: rect.left, y: Math.max(rect.top, Math.min(point.y, rect.bottom)) }
        ];
        candidates.sort((a, b) =>
            Math.hypot(a.x - point.x, a.y - point.y) -
            Math.hypot(b.x - point.x, b.y - point.y)
        );
        return candidates[0];
    }

    function measureCallout(ctx, lines) {
        ctx.save();
        ctx.font = `bold ${CONFIG.calloutFontPx}px Arial`;
        const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + CONFIG.calloutPaddingPx * 2;
        const height = lines.length * CONFIG.calloutLineHeightPx + CONFIG.calloutPaddingPx * 2;
        ctx.restore();
        return { width, height };
    }

    function candidateCalloutRects(pole, size, canvas) {
        const candidates = [];
        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        const awayAngle = Math.atan2(pole.y - center.y, pole.x - center.x) * 180 / Math.PI;
        const angles = [
            awayAngle,
            ...CONFIG.calloutCandidateAnglesDeg
        ];

        for (const radius of CONFIG.calloutCandidateRadiiPx) {
            for (const angleDeg of angles) {
                const angle = angleDeg * Math.PI / 180;
                const cx = pole.x + Math.cos(angle) * radius;
                const cy = pole.y + Math.sin(angle) * radius;
                candidates.push({
                    rect: {
                        left: cx - size.width / 2,
                        right: cx + size.width / 2,
                        top: cy - size.height / 2,
                        bottom: cy + size.height / 2
                    },
                    radius,
                    angleDeg
                });
            }
        }

        return candidates;
    }

    function edgePenalty(rect, canvas) {
        const p = CONFIG.calloutEdgePaddingPx;
        let penalty = 0;
        if (rect.left < p) penalty += p - rect.left;
        if (rect.top < p) penalty += p - rect.top;
        if (rect.right > canvas.width - p) penalty += rect.right - (canvas.width - p);
        if (rect.bottom > canvas.height - p) penalty += rect.bottom - (canvas.height - p);
        return penalty;
    }

    function distancePointToSegment(point, start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared <= 0.000001) {
            return Math.hypot(point.x - start.x, point.y - start.y);
        }

        const t = Math.max(0, Math.min(1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
        ));
        const projected = {
            x: start.x + t * dx,
            y: start.y + t * dy
        };

        return Math.hypot(point.x - projected.x, point.y - projected.y);
    }

    function leaderPoleIntersections(start, end, ownPole, allPoles) {
        const requiredClearance =
            CONFIG.calloutPoleRadiusPx + CONFIG.leaderOtherPoleClearancePx;
        let intersections = 0;

        for (const otherPole of allPoles) {
            if (
                Math.abs(otherPole.x - ownPole.x) < 0.01 &&
                Math.abs(otherPole.y - ownPole.y) < 0.01
            ) {
                continue;
            }

            if (distancePointToSegment(otherPole, start, end) < requiredClearance) {
                intersections++;
            }
        }

        return intersections;
    }

    function scoreCalloutCandidate(candidate, pole, allPoleRects, allPoles, placed, canvas) {
        const collisionRect = inflateRect(candidate.rect, CONFIG.calloutCollisionPaddingPx);
        let labelOverlap = 0;
        let poleOverlap = 0;
        let lineCrossings = 0;

        for (const placement of placed) {
            labelOverlap += intersectionArea(collisionRect, placement.collisionRect);
        }

        for (const poleRect of allPoleRects) {
            poleOverlap += intersectionArea(collisionRect, poleRect);
        }

        const labelEdge = closestPointOnRect(candidate.rect, pole);
        const poleIntersections = leaderPoleIntersections(
            pole,
            labelEdge,
            pole,
            allPoles
        );

        for (const placement of placed) {
            if (segmentIntersectsSegment(pole, labelEdge, placement.pole, placement.labelEdge)) {
                lineCrossings++;
            }
        }

        const boundary = edgePenalty(collisionRect, canvas);
        const score =
            labelOverlap * 100000 +
            poleOverlap * 20000 +
            boundary * 10000 +
            poleIntersections * CONFIG.leaderPoleIntersectionPenalty +
            lineCrossings * 500000 +
            candidate.radius;

        return {
            ...candidate,
            collisionRect,
            labelEdge,
            labelOverlap,
            poleOverlap,
            boundary,
            lineCrossings,
            poleIntersections,
            score
        };
    }

    function solveCalloutLayout(ctx, canvas, entries) {
        const allPoleRects = entries.map(entry =>
            inflateRect(pointRect(entry.pole, CONFIG.calloutPoleRadiusPx), 12)
        );

        const prepared = entries.map((entry, index) => ({
            ...entry,
            index,
            size: measureCallout(ctx, entry.lines)
        }));

        // Place the most crowded poles first.
        prepared.sort((a, b) => {
            const nearest = item => Math.min(...prepared
                .filter(other => other.index !== item.index)
                .map(other => Math.hypot(item.pole.x - other.pole.x, item.pole.y - other.pole.y))
                .concat([Infinity]));
            return nearest(a) - nearest(b);
        });

        const placed = [];
        for (const entry of prepared) {
            let best = null;
            for (const candidate of candidateCalloutRects(entry.pole, entry.size, canvas)) {
                const evaluated = scoreCalloutCandidate(candidate, entry.pole, allPoleRects, entries.map(item => item.pole), placed, canvas);
                if (!best || evaluated.score < best.score) best = evaluated;
                if (
                    evaluated.labelOverlap === 0 &&
                    evaluated.poleOverlap === 0 &&
                    evaluated.boundary === 0 &&
                    evaluated.lineCrossings === 0 &&
                    evaluated.poleIntersections === 0
                ) {
                    break;
                }
            }

            if (!best) return null;
            placed.push({ ...entry, ...best, pole: entry.pole });
        }

        placed.sort((a, b) => a.index - b.index);
        return placed;
    }

    function drawCallout(ctx, placement) {
        const color = placement.color;
        const pole = placement.pole;
        const labelEdge = placement.labelEdge;
        const dx = labelEdge.x - pole.x;
        const dy = labelEdge.y - pole.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / distance;
        const uy = dy / distance;

        ctx.save();
        ctx.lineCap = "round";
        ctx.strokeStyle = color;
        ctx.lineWidth = CONFIG.calloutLeaderWidthPx;
        ctx.beginPath();
        ctx.moveTo(
            pole.x + ux * CONFIG.calloutPoleRadiusPx,
            pole.y + uy * CONFIG.calloutPoleRadiusPx
        );
        ctx.lineTo(labelEdge.x, labelEdge.y);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fillRect(
            placement.rect.left - 4,
            placement.rect.top - 4,
            placement.rect.right - placement.rect.left + 8,
            placement.rect.bottom - placement.rect.top + 8
        );

        ctx.font = `bold ${CONFIG.calloutFontPx}px Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.lineJoin = "round";

        const textX = placement.rect.left + CONFIG.calloutPaddingPx;
        let textY = placement.rect.top + CONFIG.calloutPaddingPx;

        for (const line of placement.lines) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 8;
            ctx.strokeText(line, textX, textY);
            ctx.fillStyle = color;
            ctx.fillText(line, textX, textY);
            textY += CONFIG.calloutLineHeightPx;
        }

        ctx.beginPath();
        ctx.arc(pole.x, pole.y, CONFIG.calloutPoleRadiusPx, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.restore();
    }

    async function compositeFloatingCallouts(
        screenshot,
        view,
        group,
        targetPoints,
        referencePoint,
        referenceResult
    ) {
        const image = await loadCanvasImage(screenshot.dataUrl);
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const scaleX = canvas.width / view.width;
        const scaleY = canvas.height / view.height;
        const project = point => {
            const screen = view.toScreen(point);
            return screen ? { x: screen.x * scaleX, y: screen.y * scaleY } : null;
        };

        const entries = group.map((item, index) => ({
            pole: project(targetPoints[index]),
            color: "#ed1c24",
            lines: [
                `New CEID: ${item.record.newCeid}`,
                `Old CEID: ${item.record.oldCeid || "N/A"}`
            ]
        }));

        if (entries.some(entry => !entry.pole)) {
            throw new Error("Unable to project one or more target poles into the final screenshot.");
        }

        if (referencePoint && referenceResult) {
            const referencePole = project(referencePoint);
            if (referencePole) {
                entries.push({
                    pole: referencePole,
                    color: "#005ac8",
                    lines: [
                        `Reference CEID: ${referenceResult.ceTag}`,
                        `${referenceResult.distanceFeet.toFixed(1)} ft from target`
                    ]
                });
            }
        }

        const layout = solveCalloutLayout(ctx, canvas, entries);
        if (!layout) throw new Error("Unable to calculate floating callout positions.");

        for (const placement of layout) drawCallout(ctx, placement);

        console.log("[AutoRID v1.0 / GIS Export] Floating callout layout", layout.map(item => ({
            lines: item.lines,
            rect: item.rect,
            radius: item.radius,
            labelOverlap: item.labelOverlap,
            poleOverlap: item.poleOverlap,
            boundary: item.boundary,
            lineCrossings: item.lineCrossings,
            poleIntersections: item.poleIntersections
        })));

        return canvas.toDataURL("image/png");
    }

    function compareScids(a, b) {
        const aNum = /^\d+$/.test(a) ? Number(a) : null;
        const bNum = /^\d+$/.test(b) ? Number(b) : null;
        if (aNum !== null && bNum !== null) return aNum - bNum;
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    }

    function formatScidFileLabel(group) {
        const scids = Array.from(new Set(
            group.map(item => normalizeScid(item.record.scid)).filter(Boolean)
        )).sort(compareScids);

        if (!scids.length) return "RID Unknown SCID";

        const numeric = scids.every(value => /^\d+$/.test(value));
        if (numeric && scids.length > 1) {
            const numbers = scids.map(Number);
            const continuous = numbers.every((value, index) =>
                index === 0 || value === numbers[index - 1] + 1
            );

            if (continuous) {
                return `RID P${numbers[0]}-${numbers[numbers.length - 1]}`;
            }
        }

        if (scids.length === 1) {
            return `RID ${scids[0]}`;
        }

        return `RID ${scids.join(", ")}`;
    }

    function groupFileName(group) {
        return `${sanitizeFileName(formatScidFileLabel(group))}.png`;
    }

    try {
        const ui = createProgressUi();
        updateProgress(ui, 0, "Waiting for input...");

        const rawMappings = await promptForMappings();
        if (!rawMappings) {
            updateProgress(ui, 0, "Cancelled.");
            await sleep(1200);
            ui.box.remove();
            return;
        }

        const parsed = parseInputMappings(rawMappings);
        const records = parsed.records;
        const invalidRows = parsed.invalidRows;
        if (!records.length) {
            let msg = "No valid rows were entered.";
            if (invalidRows.length) msg += "\n\nInvalid rows:\n" + invalidRows.map(x => `${x.line} (${x.reason})`).join("\n");
            alert(msg);
            ui.box.remove();
            return;
        }

        const oldCeidRecords = records.filter(x => x.mode === "oldCeid");
        const coordinateRecords = records.filter(x => x.mode === "coordinate");
        const supportLayerUrl = CONFIG.electricMapServer + "/" + CONFIG.supportStructureLayerId;

        updateProgress(ui, 1, "Checking GIS authentication token from current GIS page...");
        const hasToken = await initializeAuthToken();

        updateProgress(ui, 2, `Preparing export...\nValid rows: ${records.length}\nInvalid rows skipped: ${invalidRows.length}\nOld CEID rows: ${oldCeidRecords.length}\nN/A coordinate rows: ${coordinateRecords.length}`);

        const poleLookup = await batchQueryPolesByOldCeid(supportLayerUrl, records, ui);

        updateProgress(ui, 16, `Creating isolated ArcGIS iframe...\nOld CEID locations found: ${poleLookup.size} of ${oldCeidRecords.length}`);
        const iframe = await createArcgisIframe(CONFIG.outputWidth, CONFIG.outputHeight, CONFIG.arcgisVersion);

        updateProgress(ui, 20, "Loading ArcGIS modules...");
        const [EsriMap, MapView, MapImageLayer, Graphic, GraphicsLayer, Point, Extent, geometryEngine, IframeIdentityManager] = await iframeRequire(iframe, [
            "esri/Map",
            "esri/views/MapView",
            "esri/layers/MapImageLayer",
            "esri/Graphic",
            "esri/layers/GraphicsLayer",
            "esri/geometry/Point",
            "esri/geometry/Extent",
            "esri/geometry/geometryEngine",
            "esri/identity/IdentityManager"
        ]);

        if (CONFIG.authToken && IframeIdentityManager && IframeIdentityManager.registerToken) {
            try {
                IframeIdentityManager.registerToken({
                    server: "https://gis.consumersenergy.com/mapping/rest/services",
                    token: CONFIG.authToken,
                    expires: Date.now() + 60 * 60 * 1000
                });
                IframeIdentityManager.registerToken({
                    server: "https://gis.consumersenergy.com/mapping/rest/services/Landbase",
                    token: CONFIG.authToken,
                    expires: Date.now() + 60 * 60 * 1000
                });
                IframeIdentityManager.registerToken({
                    server: "https://gis.consumersenergy.com/mapping/rest/services/Electric",
                    token: CONFIG.authToken,
                    expires: Date.now() + 60 * 60 * 1000
                });
                console.log("[AutoRID v1.0 / GIS Export] Registered host token with iframe IdentityManager.");
            } catch (err) {
                console.warn("[AutoRID v1.0 / GIS Export] Failed to register token with iframe IdentityManager.", err);
            }
        }

        updateProgress(ui, 25, "Preparing Landbase services...");
        let landbaseUrls = [];

        if (CONFIG.landbaseMapServers && CONFIG.landbaseMapServers.length) {
            landbaseUrls = CONFIG.landbaseMapServers.slice();
            console.log("[AutoRID v1.0 / GIS Export] Using hardcoded Landbase MapServers:", landbaseUrls);
        } else {
            try {
                landbaseUrls = await discoverLandbaseMapServers(CONFIG.landbaseFolder);
                console.log("[AutoRID v1.0 / GIS Export] Discovered Landbase MapServers:", landbaseUrls);
            } catch (err) {
                console.warn("[AutoRID v1.0 / GIS Export] Landbase discovery failed. Continuing with Electric + basemap only.", err);
                landbaseUrls = [];
            }
        }

        const landbaseLayers = landbaseUrls.slice(0, CONFIG.maxLandbaseServices).map((url, index) => mapImageLayerOptions(MapImageLayer, {
            url,
            title: "Landbase " + (index + 1),
            opacity: 1
        }));

        console.log("[AutoRID v1.0 / GIS Export] Final Landbase layers added:", landbaseLayers.map(layer => ({ title: layer.title, url: layer.url })));
        const electricLayer = mapImageLayerOptions(MapImageLayer, { url: CONFIG.electricMapServer, title: "Electric", opacity: 1 });
        const markerLayer = new GraphicsLayer({ title: "CEID Update Markers and Labels" });
        const map = new EsriMap({ basemap: "gray-vector", layers: [...landbaseLayers, electricLayer, markerLayer] });
        const view = new MapView({ container: iframe.contentDocument.getElementById("viewDiv"), map, center: [-84.555, 43.000], zoom: 18, constraints: { rotationEnabled: false }, ui: { components: [] } });

        updateProgress(ui, 30, `Initializing hidden map view...\nLandbase services added: ${landbaseLayers.length}`);
        await view.when();
        updateProgress(ui, 40, "Map initialized. Skipping pre-load layer wait so slow Landbase/Electric services cannot stall the exporter. Layers will load during each screenshot view.");
        await sleep(500);

        const results = {
            exported: [], notFound: [], coordinateNoTargetPole: [], noReferencePole: [],
            referenceFound: [], failed: [], badGeometry: [], invalidRows, groupsCreated: 0,
            documentImages: [], imagesDocument: ""
        };

        const resolved = [];
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            try {
                updateProgress(ui, 42 + ((i + 1) / records.length) * 12,
                    `Resolving target ${i + 1} of ${records.length}\nOld CEID: ${record.oldCeid}\nNew CEID: ${record.newCeid}`);

                let feature = null;
                if (record.mode === "oldCeid") {
                    feature = poleLookup.get(String(record.oldCeid).trim()) ||
                        await querySinglePoleByOldCeid(supportLayerUrl, record.oldCeid);
                    if (!feature) { results.notFound.push(record.oldCeid); continue; }
                } else {
                    const nearest = await queryNearestPoleByLonLat(supportLayerUrl, record.longitude, record.latitude);
                    if (!nearest || !nearest.feature) { results.coordinateNoTargetPole.push(record.sourceLine); continue; }
                    feature = nearest.feature;
                }

                const pointData = getLonLatGeometry(feature);
                if (!pointData || !isLikelyLonLat(pointData)) { results.badGeometry.push(record.sourceLine); continue; }
                resolved.push({ record, feature, pointData });
            } catch (err) {
                console.error("[AutoRID v1.0 / GIS Export] Resolve failed", record, err);
                results.failed.push(`${record.sourceLine} | ${err.message || err}`);
            }
        }

        // Each N/A pole can have a different adjacent/reference CEID. Resolve and
        // store it directly on that pole in the workflow package before grouping.
        const coordinateResolved = resolved.filter(item => item.record.mode === "coordinate");
        for (let index = 0; index < coordinateResolved.length; index++) {
            const item = coordinateResolved[index];
            try {
                updateProgress(
                    ui,
                    54 + ((index + 1) / Math.max(coordinateResolved.length, 1)),
                    `Finding adjacent CEID ${index + 1} of ${coordinateResolved.length}\n` +
                    `SCID: ${item.record.scid}\nNew CEID: ${item.record.newCeid}`
                );
                const adjacent = await queryNearestValidReferencePole(
                    supportLayerUrl,
                    item.pointData,
                    item.feature
                );
                if (adjacent?.ceTag) {
                    item.adjacentReference = adjacent;
                    setPoleAdjacentCeid(item.record, adjacent.ceTag);
                } else {
                    results.noReferencePole.push(`SCID ${item.record.scid}`);
                }
            } catch (adjacentError) {
                console.warn(
                    `[${CONFIG.filePrefix}] Adjacent CEID lookup failed for SCID ${item.record.scid}: ` +
                    `${adjacentError.message || adjacentError}`
                );
            }
        }

        const groups = buildConnectedGroups(resolved);
        results.groupsCreated = groups.length;
        const packageImagesIntoWord = groups.length > 5;

        let ridMetadata = null;
        if (resolved.length) {
            updateProgress(ui, 55, "Reading Headquarters, Substation ID, and Circuit ID from the first pole...");
            try {
                ridMetadata = await fetchFirstPoleRidMetadata(resolved[0].pointData);
                if (window.__RID_WORKFLOW_PACKAGE) {
                    window.__RID_WORKFLOW_PACKAGE = {
                        ...window.__RID_WORKFLOW_PACKAGE,
                        gis: {
                            ...(window.__RID_WORKFLOW_PACKAGE.gis || {}),
                            ...ridMetadata,
                            sourceScid: resolved[0].record.scid,
                            sourceOldCeid: resolved[0].record.oldCeid,
                            sourceNewCeid: resolved[0].record.newCeid
                        }
                    };
                }
            } catch (metadataError) {
                console.error(`[${CONFIG.filePrefix}] Unable to retrieve RID form GIS metadata.`, metadataError);
                ridMetadata = { error: metadataError.message || String(metadataError) };
            }
        }
        console.table(groups.map((group, index) => ({
            group: index + 1,
            count: group.length,
            oldCEIDs: group.map(x => x.record.oldCeid).join(", "),
            newCEIDs: group.map(x => x.record.newCeid).join(", ")
        })));

        const exportStartPct = 56;
        const exportSpan = 39;

        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const group = groups[groupIndex];
            try {
                updateProgress(ui, exportStartPct + (groupIndex / Math.max(groups.length, 1)) * exportSpan,
                    `Exporting group ${groupIndex + 1} of ${groups.length}\nTarget poles: ${group.length}\nNew CEIDs: ${group.map(x => x.record.newCeid).join(", ")}`);

                markerLayer.removeAll();
                const targetPoints = group.map(item => createPolePoint(Point, item.pointData));
                const hasOldCeid = group.some(item => isValidExistingCeid(item.record.oldCeid));
                let referenceResult = null;
                let referencePoint = null;

                if (!hasOldCeid) {
                    for (const item of group) {
                        const candidate = item.adjacentReference ||
                            await queryNearestValidReferencePole(supportLayerUrl, item.pointData, item.feature);
                        if (candidate?.ceTag) {
                            item.adjacentReference = candidate;
                            setPoleAdjacentCeid(item.record, candidate.ceTag);
                        }
                        if (candidate && (!referenceResult || candidate.distanceFeet < referenceResult.distanceFeet)) {
                            referenceResult = candidate;
                        }
                    }
                    if (referenceResult && referenceResult.feature) {
                        const data = getLonLatGeometry(referenceResult.feature);
                        if (data && isLikelyLonLat(data)) {
                            referencePoint = createPolePoint(Point, data);
                            results.referenceFound.push(`Group ${groupIndex + 1}: ${referenceResult.ceTag}`);
                        }
                    }
                    if (!referencePoint) results.noReferencePole.push(`Group ${groupIndex + 1}`);
                }

                // Keep ArcGIS responsible only for the GIS map. V0.11 composites all
                // floating callouts afterward on the final screenshot canvas.
                markerLayer.removeAll();

                const extent = createConnectedGroupExtent(
                    Extent,
                    geometryEngine,
                    targetPoints,
                    referencePoint,
                    referenceResult ? referenceResult.distanceFeet : null
                );

                await view.goTo(extent, { animate: false });
                await waitForMapAndOperationalLayers(view, [electricLayer, ...landbaseLayers], 5000);
                markerLayer.removeAll();
                const screenshot = await view.takeScreenshot({
                    width: CONFIG.outputWidth,
                    height: CONFIG.outputHeight,
                    format: "png"
                });

                const annotatedDataUrl = await compositeFloatingCallouts(
                    screenshot,
                    view,
                    group,
                    targetPoints,
                    referencePoint,
                    referenceResult
                );

                const fileName = groupFileName(group);
                if (packageImagesIntoWord) {
                    results.documentImages.push({
                        fileName,
                        dataUrl: annotatedDataUrl
                    });
                } else {
                    downloadDataUrl(annotatedDataUrl, fileName);
                }
                results.exported.push(fileName);
            } catch (err) {
                console.error("[AutoRID v1.0 / GIS Export] Group failed", groupIndex + 1, err);
                results.failed.push(`Group ${groupIndex + 1}: ${group.map(x => x.record.newCeid).join(", ")} | ${err.message || err}`);
            }
        }

        if (packageImagesIntoWord && results.documentImages.length) {
            try {
                results.imagesDocument = createRidImagesDocx(
                    results.documentImages,
                    window.__RID_WORKFLOW_PACKAGE?.notificationNumber || "Unknown"
                );
            } catch (documentError) {
                console.error(`[${CONFIG.filePrefix}] Word image document creation failed.`, documentError);
                results.failed.push(`Word image document: ${documentError.message || documentError}`);
            }
        }

        if (window.__RID_WORKFLOW_PACKAGE && window.__RID_WORKFLOW_PACKAGE.gis) {
            try {
                window.__RID_WORKFLOW_PACKAGE = downloadUpdatedWorkflowPackage(window.__RID_WORKFLOW_PACKAGE);
                results.updatedPackage = `RID_Workflow_${window.__RID_WORKFLOW_PACKAGE.notificationNumber}_GIS_Updated.json`;
            } catch (packageError) {
                console.error(`[${CONFIG.filePrefix}] Updated JSON download failed.`, packageError);
            }
        }

        updateProgress(ui, 98, "Cleaning up...");
        view.destroy();
        iframe.remove();

        let message =
            `Done.\n\n` +
            `Images created: ${results.exported.length}\n` +
            (results.imagesDocument
                ? `Word image document: ${results.imagesDocument}\nIndividual PNG downloads: 0\n`
                : `Individual PNG downloads: ${results.exported.length}\n`) +
            `Target poles resolved: ${resolved.length}\n` +
            `Groups created: ${results.groupsCreated}\n` +
            `Old CEID not found: ${results.notFound.length}\n` +
            `N/A coordinate target pole not found: ${results.coordinateNoTargetPole.length}\n` +
            `Reference pole found: ${results.referenceFound.length}\n` +
            `No reference pole found: ${results.noReferencePole.length}\n` +
            `Bad geometry/input: ${results.badGeometry.length}\n` +
            `Invalid rows skipped: ${results.invalidRows.length}\n` +
            `Failed: ${results.failed.length}` +
            (results.updatedPackage ? `\nGIS-updated JSON: ${results.updatedPackage}` : "");

        if (results.notFound.length) message += `\n\nOld CEID not found:\n${results.notFound.join(", ")}`;
        if (results.coordinateNoTargetPole.length) message += `\n\nN/A target pole not found:\n${results.coordinateNoTargetPole.join("\n")}`;
        if (results.noReferencePole.length) message += `\n\nNo reference pole found:\n${results.noReferencePole.join("\n")}`;
        if (results.invalidRows.length) message += `\n\nInvalid rows skipped:\n` + results.invalidRows.map(x => `${x.line} (${x.reason})`).join("\n");
        if (results.failed.length) message += `\n\nFailed rows:\n${results.failed.join("\n")}`;

        updateProgress(ui, 100, message);
        alert(message);
        await sleep(6000);
        ui.box.remove();
    } catch (err) {
        console.error("[AutoRID v1.0 / GIS Export] Fatal error:", err);
        alert("AutoRID v1.0 / GIS Export failed. Check console for details:\n\n" + err.message);
    }

    }

    async function runRidFormStage() {

    "use strict";

    const VERSION = "AutoRID v1.0 / RID Form";
    const CONFIG = {
        correctionType: "Electric CAD URD",
        errorCategory: "Pole Errors",
        dropdownOpenTimeoutMs: 8000,
        optionSelectTimeoutMs: 8000,
        fieldUpdateDelayMs: 150
    };

    function getRidDocuments() {
        const documents = [];
        const visited = new Set();

        function visit(doc) {
            if (!doc || visited.has(doc)) return;
            visited.add(doc);
            documents.push(doc);

            for (const frame of doc.querySelectorAll("iframe")) {
                try {
                    if (frame.contentDocument) visit(frame.contentDocument);
                } catch (_) {
                    // Cross-origin frames cannot be inspected and are not the Power Apps form host.
                }
            }
        }

        visit(document);
        return documents;
    }

    function queryRid(selector) {
        for (const doc of getRidDocuments()) {
            try {
                const match = doc.querySelector(selector);
                if (match) return match;
            } catch (_) {}
        }
        return null;
    }

    function queryRidAll(selector) {
        const matches = [];
        for (const doc of getRidDocuments()) {
            try { matches.push(...doc.querySelectorAll(selector)); } catch (_) {}
        }
        return matches;
    }

    function findRidCombobox(controlName, title) {
        return (
            queryRid(`[data-control-name="${controlName}"] [role="button"][aria-haspopup="dialog"]`) ||
            queryRid(`[role="button"][aria-haspopup="dialog"][title="${title}"]`) ||
            queryRid(`[role="button"][title="${title}"]`) ||
            queryRid(`[aria-haspopup="dialog"][title="${title}"]`)
        );
    }

    function findRidTextField(title, tagName) {
        const tag = tagName || "input";
        return (
            queryRid(`${tag}[title="${title}"]`) ||
            queryRidAll(tag).find(element =>
                String(element.title || "").trim().toLowerCase() === title.toLowerCase()
            ) ||
            null
        );
    }

    async function waitForRidFormControls(timeoutMs = 30000) {
        const started = Date.now();
        let lastState = null;

        while (Date.now() - started < timeoutMs) {
            const correction = findRidCombobox("cmbCorrectionType", "Correction Type");
            const category = findRidCombobox("cmbErrorCategory", "Error Category");
            const description =
                queryRid('textarea[title^="Description"]') ||
                queryRidAll("textarea").find(element =>
                    String(element.title || "").trim().toLowerCase() === "description"
                );
            const notification = findRidTextField("Work Order or Notification Number", "input");

            lastState = {
                correction: Boolean(correction),
                category: Boolean(category),
                description: Boolean(description),
                notification: Boolean(notification)
            };

            if (correction && category && description && notification) return true;
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        console.error(`[${VERSION}] RID control detection failed`, {
            ...lastState,
            documentsInspected: getRidDocuments().length,
            iframeCount: queryRidAll("iframe").length
        });
        throw new Error(
            "The RID form is visible, but one or more controls could not be identified. " +
            `Detected: Correction Type=${lastState?.correction}, Error Category=${lastState?.category}, ` +
            `Description=${lastState?.description}, Notification=${lastState?.notification}.`
        );
    }

    function normalize(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function isNA(value) {
        const text = normalize(value).toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
        return text === "N/A" || text === "NA" || text === "NOTAG" || text === "NO TAG" || /^NO TAG\s*#?\s*\d+$/.test(text);
    }

    function splitLine(line) {
        if (line.includes("\t")) return line.split("\t").map(normalize);
        if (line.includes(",")) return line.split(",").map(normalize);
        if (line.includes(";")) return line.split(";").map(normalize);
        return line.split(/\s+/).map(normalize);
    }

    function parseCombinedPayload(raw) {
        const lines = String(raw || "").split(/\r?\n/);
        let notificationNumber = "";
        const ridLines = [];

        for (const originalLine of lines) {
            const line = originalLine.trim();
            if (!line) continue;

            const notificationMatch = line.match(
                /^Notification\s*(?:Number|#)?\s*:\s*(.+)$/i
            );

            if (notificationMatch) {
                notificationNumber = extractNotificationNumber(notificationMatch[1]);
                continue;
            }

            ridLines.push(line);
        }

        return {
            notificationNumber,
            ridText: ridLines.join("\n")
        };
    }

    function parseRidRows(raw) {
        const rows = [];
        const invalid = [];

        for (const sourceLine of String(raw || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
            const parts = splitLine(sourceLine);
            const oldCeid = parts[0] || "";
            const newCeid = parts[1] || "";

            if (!newCeid) {
                invalid.push({ sourceLine, reason: "New CEID is missing." });
                continue;
            }

            if (isNA(oldCeid)) {
                const latitude = parts[2] || "";
                const longitude = parts[3] || "";
                const scid = parts[4] || "";

                if (!latitude || !longitude || !scid) {
                    invalid.push({
                        sourceLine,
                        reason: "N/A rows require New CEID, Latitude, Longitude, and SCID."
                    });
                    continue;
                }

                const packagePole = (window.__RID_WORKFLOW_PACKAGE?.poles || []).find(pole =>
                    String(pole.scid || "").replace(/^0+/, "") === String(scid).replace(/^0+/, "") &&
                    String(pole.newCeid || "").trim() === String(newCeid).trim()
                ) || (window.__RID_WORKFLOW_PACKAGE?.poles || []).find(pole =>
                    String(pole.newCeid || "").trim() === String(newCeid).trim()
                );

                rows.push({
                    oldCeid: "N/A",
                    newCeid,
                    latitude,
                    longitude,
                    scid,
                    adjacentCeid: String(packagePole?.adjacentCeid || "").trim(),
                    mode: "newTag",
                    sourceLine
                });
            } else {
                const scid = parts[2] || "";
                if (!oldCeid || !scid) {
                    invalid.push({
                        sourceLine,
                        reason: "Existing-tag rows require Old CEID, New CEID, and SCID."
                    });
                    continue;
                }

                rows.push({
                    oldCeid,
                    newCeid,
                    scid,
                    latitude: "",
                    longitude: "",
                    mode: "replacement",
                    sourceLine
                });
            }
        }

        return { rows, invalid };
    }

    function buildDescription(rows) {
        const lines = ["Please update the following CE IDs:", ""];

        for (const row of rows) {
            if (row.mode === "replacement") {
                lines.push(`Old CE ID ${row.oldCeid} to New CE ID ${row.newCeid}`);
            } else {
                const latitude = Number(row.latitude);
                const longitude = Number(row.longitude);
                const latitudeText = Number.isFinite(latitude) ? latitude.toFixed(4) : row.latitude;
                const longitudeText = Number.isFinite(longitude) ? longitude.toFixed(4) : row.longitude;
                const adjacentCeid = row.adjacentCeid || "ADJACENT CE ID NOT FOUND";

                lines.push(
                    `Assign New CE ID ${row.newCeid} to Pole Located at ` +
                    `${latitudeText}/${longitudeText} Adjacent to CE ID ${adjacentCeid}`
                );
            }
        }

        return lines.join("\n");
    }

    function nativeValueSetter(element, value) {
        const view = element.ownerDocument?.defaultView || window;
        const prototype = element.tagName === "TEXTAREA"
            ? view.HTMLTextAreaElement.prototype
            : view.HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

        if (descriptor && descriptor.set) descriptor.set.call(element, value);
        else element.value = value;

        element.dispatchEvent(new view.Event("input", { bubbles: true }));
        element.dispatchEvent(new view.Event("change", { bubbles: true }));
        element.dispatchEvent(new view.Event("blur", { bubbles: true }));
    }

    async function setTextField(selector, value, fieldName) {
        let element = queryRid(selector);
        if (!element && fieldName === "Work Order or Notification Number") {
            element = findRidTextField(fieldName, "input");
        }
        if (!element && fieldName === "Description") {
            element = queryRidAll("textarea").find(candidate =>
                String(candidate.title || "").trim().toLowerCase() === "description"
            ) || null;
        }
        if (!element) throw new Error(`${fieldName} field was not found.`);

        element.focus();
        nativeValueSetter(element, value);
        await sleep(CONFIG.fieldUpdateDelayMs);

        if (normalize(element.value) !== normalize(value)) {
            throw new Error(`${fieldName} did not retain the entered value.`);
        }

        return element;
    }

    function visibleElements(selector) {
        return queryRidAll(selector).filter(element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                Number(style.opacity || 1) !== 0 &&
                rect.width > 0 &&
                rect.height > 0
            );
        });
    }

    function candidateOptionText(element) {
        return normalize(
            element.innerText ||
            element.textContent ||
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            ""
        );
    }

    function findExactVisibleOption(desiredValue) {
        const wanted = normalize(desiredValue).toLowerCase();
        const selectors = [
            '[role="option"]',
            '[role="listbox"] [role="button"]',
            '[role="dialog"] [role="button"]',
            '[role="dialog"] li',
            '[role="dialog"] div',
            '.react-combobox-view-list-item',
            '[data-is-focusable="true"]'
        ];

        const seen = new Set();
        const candidates = [];

        for (const selector of selectors) {
            for (const element of visibleElements(selector)) {
                if (seen.has(element)) continue;
                seen.add(element);

                const text = candidateOptionText(element);
                if (text.toLowerCase() === wanted) candidates.push(element);
            }
        }

        return candidates.find(element => !element.closest('[data-control-name="cmbCorrectionType"], [data-control-name="cmbErrorCategory"]'))
            || candidates[0]
            || null;
    }

    function findPopupSearchInput() {
        const selectors = [
            '[role="dialog"] input[type="text"]',
            '[role="dialog"] input',
            '[role="listbox"] input[type="text"]',
            'input[placeholder*="Find items" i]',
            'input[aria-label*="search" i]',
            'input[aria-label*="find" i]',
            '.react-combobox-view input',
            '[data-control-part="search"] input',
            'input[type="text"]'
        ];

        for (const selector of selectors) {
            const input = visibleElements(selector)[0];
            if (input) return input;
        }

        return null;
    }

    async function waitUntil(test, timeoutMs, description) {
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            const result = test();
            if (result) return result;
            await sleep(100);
        }

        throw new Error(`Timed out waiting for ${description}.`);
    }

    function dispatchKeyboard(element, key) {
        const options = {
            key,
            code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
            bubbles: true,
            cancelable: true
        };
        const KeyboardEventCtor = element.ownerDocument?.defaultView?.KeyboardEvent || KeyboardEvent;
        element.dispatchEvent(new KeyboardEventCtor("keydown", options));
        element.dispatchEvent(new KeyboardEventCtor("keyup", options));
    }

    async function openPowerAppsCombobox(control, fieldName) {
        control.scrollIntoView({ behavior: "auto", block: "center" });
        control.focus();
        control.click();
        await sleep(600);

        // The Power Apps React combobox does not consistently update aria-expanded and
        // its popup is not always assigned role=dialog. Treat any newly visible search
        // input or selectable item as proof that the popup opened.
        const opened = (
            control.getAttribute("aria-expanded") === "true" ||
            Boolean(findPopupSearchInput()) ||
            visibleElements('[role="option"], [role="listbox"], [data-is-focusable="true"]').some(
                element => element !== control && !element.closest(`#${CSS.escape(control.id || "__none__")}`)
            )
        );

        if (opened) return;

        // Keyboard fallback for Power Apps controls that ignore the first synthetic click.
        dispatchKeyboard(control, "Enter");
        await sleep(500);
        dispatchKeyboard(control, "ArrowDown");
        await sleep(500);

        console.log(`[${VERSION}] ${fieldName} open state`, {
            ariaExpanded: control.getAttribute("aria-expanded"),
            searchInputFound: Boolean(findPopupSearchInput()),
            visibleOptions: visibleElements('[role="option"], [role="listbox"] [role="button"]').length
        });
    }

    async function selectPowerAppsCombobox(controlName, desiredValue, fieldName) {
        const control = findRidCombobox(controlName, fieldName);
        if (!control) throw new Error(`${fieldName} combobox was not found.`);

        const wanted = desiredValue.toLowerCase();
        if (
            candidateOptionText(control).toLowerCase().includes(wanted) ||
            normalize(control.getAttribute("aria-label")).toLowerCase().includes(wanted)
        ) {
            return control;
        }

        await openPowerAppsCombobox(control, fieldName);

        let searchInput = findPopupSearchInput();
        if (searchInput && searchInput !== queryRid('input[title="Work Order or Notification Number"]')) {
            searchInput.focus();
            nativeValueSetter(searchInput, desiredValue);
            await sleep(650);
        }

        let option = findExactVisibleOption(desiredValue);

        // Some Power Apps comboboxes render the result only after keyboard navigation.
        if (!option && searchInput) {
            dispatchKeyboard(searchInput, "ArrowDown");
            await sleep(150);
            dispatchKeyboard(searchInput, "Enter");
            await sleep(500);
        }

        option = option || findExactVisibleOption(desiredValue);
        if (option) {
            option.scrollIntoView({ behavior: "auto", block: "nearest" });
            option.click();
            await sleep(500);
        }

        // If exact option discovery failed, try direct combobox keyboard filtering.
        if (!option) {
            control.focus();
            for (const character of desiredValue) dispatchKeyboard(control, character);
            await sleep(400);
            dispatchKeyboard(control, "ArrowDown");
            dispatchKeyboard(control, "Enter");
            await sleep(500);
        }

        const selected = await waitUntil(
            () => {
                const text = candidateOptionText(control).toLowerCase();
                const aria = normalize(control.getAttribute("aria-label")).toLowerCase();
                return text.includes(wanted) || aria.includes(wanted);
            },
            CONFIG.optionSelectTimeoutMs,
            `${fieldName} selection to update to "${desiredValue}"`
        ).catch(() => false);

        if (!selected) {
            throw new Error(
                `${fieldName} dropdown opened, but option "${desiredValue}" could not be selected. ` +
                `Current control text: "${candidateOptionText(control)}".`
            );
        }

        return control;
    }

    function extractNotificationNumber(value) {
        const text = normalize(value);
        const match = text.match(/\b\d{7,12}\b/);
        return match ? match[0] : text;
    }

    async function createInputDialog() {
        const payload = String(window.__RID_WORKFLOW_PAYLOAD || "").trim();
        if (!payload) {
            throw new Error(
                "No shared RID workflow data was found. Return to Katapult and run the same bookmarklet first."
            );
        }
        return { payload };
    }

    async function setOptionalRidField(title, value) {
        if (!value) return false;
        const element = findRidTextField(title, "input");
        if (!element) {
            console.warn(`[${VERSION}] Optional RID field not found: ${title}`);
            return false;
        }
        element.focus();
        nativeValueSetter(element, String(value));
        await sleep(CONFIG.fieldUpdateDelayMs);
        return true;
    }

    function showCompletion(notificationNumber, rows, description) {
        const old = document.getElementById("rid-form-filler-complete");
        if (old) old.remove();

        const box = document.createElement("div");
        box.id = "rid-form-filler-complete";
        box.style.cssText = [
            "position:fixed",
            "right:16px",
            "bottom:16px",
            "z-index:2147483647",
            "width:420px",
            "max-width:calc(100vw - 32px)",
            "background:#111",
            "color:white",
            "padding:14px",
            "border-radius:8px",
            "font:13px Segoe UI,Arial",
            "box-shadow:0 4px 18px rgba(0,0,0,.4)"
        ].join(";");

        const message = document.createElement("div");
        message.style.whiteSpace = "pre-line";
        message.textContent = [
            `${VERSION} completed.`,
            "",
            `Correction Type: ${CONFIG.correctionType}`,
            `Error Category: ${CONFIG.errorCategory}`,
            `Notification Number: ${notificationNumber}`,
            `CEID rows: ${rows.length}`,
            `Headquarters: ${window.__RID_WORKFLOW_PACKAGE?.gis?.headquarters || "Not provided"}`,
            `Substation ID: ${[
                window.__RID_WORKFLOW_PACKAGE?.gis?.substationName,
                window.__RID_WORKFLOW_PACKAGE?.gis?.substationId
            ].filter(Boolean).join(" ") || "Not provided"}`,
            `Circuit ID: ${[
                window.__RID_WORKFLOW_PACKAGE?.gis?.circuitName,
                window.__RID_WORKFLOW_PACKAGE?.gis?.circuitId
            ].filter(Boolean).join(" ") || "Not provided"}`,
            "",
            "Review the form and attach the RID PNG files. Save and Save and Send were not clicked."
        ].join("\n");

        const close = document.createElement("button");
        close.textContent = "Close";
        close.style.cssText = "margin-top:10px;padding:6px 12px";
        close.onclick = () => box.remove();

        box.appendChild(message);
        box.appendChild(close);
        document.body.appendChild(box);

        console.log(`[${VERSION}] Description populated:\n${description}`);
    }

    async function copyRidValue(value) {
        const text = String(value ?? "");
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (_) {}
        const area = document.createElement("textarea");
        area.value = text;
        area.readOnly = true;
        area.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (!ok) throw new Error("Clipboard access was blocked by the browser.");
    }

    function showRidCopyAssistant(fields, notificationNumber, rowCount) {
        document.getElementById("autorid-copy-assistant-v1-0")?.remove();
        document.getElementById("rid-workflow-card")?.remove();
        const panel = document.createElement("section");
        panel.id = "autorid-copy-assistant-v1-0";
        panel.style.cssText = "position:fixed;top:72px;right:18px;z-index:2147483647;width:390px;height:620px;min-width:300px;min-height:180px;max-width:calc(100vw - 20px);max-height:calc(100vh - 20px);overflow:auto;resize:both;background:#fff;color:#242424;border:1px solid #c8c8c8;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.28);font-family:Segoe UI,Arial,sans-serif;font-size:14px;";
        const header = document.createElement("div");
        header.style.cssText = "position:sticky;top:0;background:#742774;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:1;border-radius:11px 11px 0 0;cursor:move;user-select:none;";
        const heading = document.createElement("div");
        heading.innerHTML = `<div style="font-size:17px;font-weight:700">AutoRID v1.0</div><div style="font-size:12px;opacity:.9;margin-top:2px">${notificationNumber} | ${rowCount} pole${rowCount === 1 ? "" : "s"}</div>`;
        const controls = document.createElement("div");
        const minimize = document.createElement("button");
        const close = document.createElement("button");
        for (const button of [minimize, close]) button.style.cssText = "border:0;border-radius:6px;background:rgba(255,255,255,.18);color:#fff;width:32px;height:32px;font-size:20px;cursor:pointer;margin-left:6px;";
        minimize.type = close.type = "button"; minimize.textContent = "−"; close.textContent = "×";
        controls.append(minimize, close); header.append(heading, controls);
        const body = document.createElement("div"); body.style.cssText = "padding:12px;";
        const intro = document.createElement("div"); intro.textContent = "Copy each value, then paste or select it in the matching RID field."; intro.style.cssText = "font-size:12px;color:#555;background:#f5f5f5;border-radius:8px;padding:9px 10px;margin-bottom:10px;"; body.appendChild(intro);
        const list = document.createElement("div"); list.style.cssText = "display:grid;gap:8px;";
        for (const field of fields) {
            const row = document.createElement("div"); row.style.cssText = "border:1px solid #ddd;border-radius:9px;padding:9px;background:#fff;";
            const label = document.createElement("div"); label.textContent = field.label; label.style.cssText = "font-weight:700;font-size:12px;color:#444;margin-bottom:6px;";
            const content = document.createElement("div"); content.style.cssText = "display:flex;gap:8px;align-items:flex-start;";
            const preview = document.createElement(field.multiline ? "textarea" : "input"); preview.value = field.value; preview.readOnly = true; preview.style.cssText = field.multiline ? "flex:1;min-width:0;height:112px;resize:vertical;border:1px solid #c8c8c8;border-radius:6px;padding:7px;font:12px/1.35 Consolas,monospace;background:#fafafa;color:#222;" : "flex:1;min-width:0;border:1px solid #c8c8c8;border-radius:6px;padding:7px;font:13px Segoe UI,Arial;background:#fafafa;color:#222;";
            const copy = document.createElement("button"); copy.type = "button"; copy.textContent = "Copy"; copy.style.cssText = "border:0;border-radius:7px;background:#0078d4;color:#fff;font-weight:700;padding:8px 12px;cursor:pointer;min-width:76px;";
            copy.addEventListener("click", async () => { try { await copyRidValue(field.value); copy.textContent = "Copied ✓"; copy.style.background = "#107c10"; row.style.borderColor = "#107c10"; row.style.background = "#f1faf1"; } catch (e) { copy.textContent = "Failed"; copy.style.background = "#a4262c"; } });
            content.append(preview, copy); row.append(label, content); list.appendChild(row);
        }
        body.appendChild(list); panel.append(header, body); document.body.appendChild(panel);
        let drag = null;
        header.addEventListener("mousedown", e => { if (e.button !== 0 || e.target.closest("button")) return; const r=panel.getBoundingClientRect(); panel.style.left=`${r.left}px`; panel.style.top=`${r.top}px`; panel.style.right="auto"; drag={x:e.clientX-r.left,y:e.clientY-r.top}; e.preventDefault(); });
        document.addEventListener("mousemove", e => { if (!drag || !document.body.contains(panel)) return; panel.style.left=`${Math.max(0,Math.min(window.innerWidth-panel.offsetWidth,e.clientX-drag.x))}px`; panel.style.top=`${Math.max(0,Math.min(window.innerHeight-48,e.clientY-drag.y))}px`; });
        document.addEventListener("mouseup", () => drag=null);
        let collapsed=false; minimize.addEventListener("click",()=>{collapsed=!collapsed;body.style.display=collapsed?"none":"block";minimize.textContent=collapsed?"+":"−";panel.style.height=collapsed?"auto":panel.style.height;}); close.addEventListener("click",()=>panel.remove());
    }

    try {
        const input = await createInputDialog();
        if (!input) return;
        const combined = parseCombinedPayload(input.payload);
        const notificationNumber = combined.notificationNumber;
        if (!notificationNumber) throw new Error("The combined payload is missing a valid 'Notification Number:' header.");
        const parsed = parseRidRows(combined.ridText);
        if (!parsed.rows.length || parsed.invalid.length) throw new Error("The selected package contains invalid RID rows.");
        const missing = parsed.rows.filter(row => row.mode === "newTag" && !row.adjacentCeid);
        if (missing.length) throw new Error("The selected GIS-updated JSON is missing adjacent CE IDs. Run GIS phase again with AutoRID v1.0.");
        const description = buildDescription(parsed.rows);
        const gis = window.__RID_WORKFLOW_PACKAGE?.gis || {};
        const substationValue = [gis.substationName, gis.substationId].map(v=>String(v||"").trim()).filter(Boolean).join(" ");
        const circuitValue = [gis.circuitName, gis.circuitId].map(v=>String(v||"").trim()).filter(Boolean).join(" ");
        const fields = [
            { label: "Headquarters", value: String(gis.headquarters || "").trim() },
            { label: "Correction Type", value: CONFIG.correctionType },
            { label: "Description", value: description, multiline: true },
            { label: "Work Order or Notification Number", value: notificationNumber },
            { label: "Error Category", value: CONFIG.errorCategory },
            { label: "Substation ID", value: substationValue },
            { label: "Circuit ID", value: circuitValue }
        ];
        showRidCopyAssistant(fields, notificationNumber, parsed.rows.length);
    } catch (error) {
        console.error(`[${VERSION}] Failed`, error);
        alert(`${VERSION} failed:\n\n${error.message}\n\nCheck the console for details.`);
    }
    }

    try {
        const mode = pageMode();
        console.log(`[${WORKFLOW_VERSION}] Detected stage:`, mode);

        if (mode === "katapult") {
            await runKatapultStage();
            return;
        }

        if (mode === "gis") {
            await prepareSharedPayload("GIS Export");
            await runGisStage();
            return;
        }

        if (mode === "rid-form") {
            await prepareSharedPayload("AutoRID v1.0");
            await runRidFormStage();
            return;
        }

        throw new Error(
            "This page was not recognized. Open the Katapult job, Consumers Energy GIS viewer, or RID new-item form and try again."
        );
    } catch (error) {
        console.error(`[${WORKFLOW_VERSION}] Fatal error`, error);
        alert(`${WORKFLOW_VERSION} failed:\n\n${error.message}\n\nCheck the console for details.`);
    }
})();
