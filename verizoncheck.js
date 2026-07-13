(async () => {
  /*
   * Verizon Catalog Updater v6.5 - Fixed Workbook Build
   *
   * Fixes:
   * - Uses a new localStorage key so stale v6.4 progress cannot export only old rows.
   * - If saved progress exists, asks whether to RESUME or CLEAR.
   * - Exports a safer Excel SpreadsheetML workbook with XML sanitizing/truncation.
   * - Filename format: Verizon_Catalog_MM-DD-YY.xls
   * - Keeps DEFAULTS / MANUAL startup choice.
   * - Keeps one sheet per device, sorted storage rows, and editable Color Sort # row.
   * - Removes the sort button / macro approach.

   Bookmarklet:
   javascript:(async function(){try{const u='https://raw.githubusercontent.com/ElijahRademaker/automation-tools/main/verizoncheck.js?t=%27+Date.now();const r=await fetch(u,{cache:%27no-store%27});if(!r.ok)throw new Error(%27HTTP %27+r.status+%27 %27+r.statusText);const code=await r.text();console.log(%27Loaded Verizon Catalog Updater:%27,u);console.log(code.slice(0,300));(0,eval)(code);}catch(e){alert(%27Verizon Catalog Updater failed to load/run: %27+(e.message||e));console.error(e);}})();
   */

  const CONFIG = {
    timeoutMs: 45000,
    readyMs: 14000,
    settleMs: 650,
    afterClickMs: 750,
    maxUrls: 150,
    saveKey: 'vz_catalog_updater_v65_state',
    debug: true
  };

  const DEFAULT_URLS = [
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

  const COLOR_WORDS = [
    'natural titanium', 'black titanium', 'white titanium', 'blue titanium', 'desert titanium',
    'space black', 'space gray', 'space grey', 'rose gold', 'ultramarine', 'wintergreen',
    'lemongrass', 'moonstone', 'porcelain', 'obsidian', 'starlight', 'midnight', 'graphite',
    'lavender', 'charcoal', 'cobalt', 'denim', 'frost', 'violet', 'purple', 'yellow',
    'silver', 'orange', 'cosmic', 'hazel', 'jade', 'iris', 'peony', 'rose', 'pink',
    'blue', 'sky', 'bay', 'aqua', 'teal', 'mint', 'green', 'sage', 'red', 'coral',
    'gold', 'gray', 'grey', 'black', 'white', 'cream', 'snow', 'onyx', 'space',
    'sand', 'aloe', 'linen', 'mist', 'plum', 'navy'
  ];

  const OUT_OF_STOCK_RE = /out\s*of\s*stock|sold\s*out|currently\s*unavailable|temporarily\s*unavailable|this selection is out of stock/i;
  const SHIPPING_RE = /free shipping|ship by|shipping by|delivery/i;
  const EXPRESS_PICKUP_ONLY_RE = /only available for express pickup|express pickup/i;
  const PICKUP_RE = /pick up in as little as|select store|pickup/i;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const lower = value => normalize(value).toLowerCase();
  const timestamp = () => new Date().toISOString();
  const log = (...args) => {
    if (CONFIG.debug) console.log('[Verizon Catalog v6.5]', ...args);
  };

  function titleCase(value) {
    return normalize(value).toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
  }

  function knownColorName(text) {
    const t = lower(text);
    const sortedColors = [...COLOR_WORDS].sort((a, b) => b.length - a.length);

    for (const color of sortedColors) {
      const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const colorRegex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (colorRegex.test(t)) return titleCase(color);
    }

    return '';
  }

  function catalogFilename(suffix = '') {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `Verizon_Catalog_${mm}-${dd}-${yy}${suffix}.xls`;
  }

  function createProgressUi() {
    const existing = document.getElementById('vz-catalog-progress-v65');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'vz-catalog-progress-v65';
    box.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:18px',
      'z-index:2147483647',
      'background:#111',
      'color:#fff',
      'width:540px',
      'max-width:calc(100vw - 36px)',
      'padding:14px',
      'border-radius:12px',
      'font-family:Arial,sans-serif',
      'font-size:13px',
      'box-shadow:0 8px 28px #0008',
      'border:1px solid #444'
    ].join(';');

    box.innerHTML = `
      <div style="font-weight:700;font-size:15px">Verizon Catalog Updater v6.5</div>
      <div id="vz-status" style="margin:8px 0;color:#eee">Starting...</div>
      <div style="height:10px;background:#333;border-radius:99px;overflow:hidden">
        <div id="vz-bar" style="height:100%;width:0;background:#0af"></div>
      </div>
      <pre id="vz-details" style="white-space:pre-wrap;color:#bbb;font:12px Arial;margin:8px 0 0;max-height:155px;overflow:auto"></pre>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">
        <button id="vz-hide">Hide</button>
        <button id="vz-export">Export Partial Workbook</button>
        <button id="vz-clear">Clear Saved Progress</button>
        <button id="vz-pause">Pause</button>
      </div>`;

    document.body.appendChild(box);

    for (const button of box.querySelectorAll('button')) {
      button.style.cssText = 'background:#333;color:#fff;border:1px solid #555;border-radius:6px;padding:4px 8px;cursor:pointer';
    }

    const api = {
      paused: false,
      rowsProvider: null,
      set({ percent, status, details } = {}) {
        if (Number.isFinite(percent)) {
          box.querySelector('#vz-bar').style.width = `${Math.max(0, Math.min(100, percent))}%`;
        }
        if (status !== undefined) box.querySelector('#vz-status').textContent = status;
        if (details !== undefined) box.querySelector('#vz-details').textContent = details;
      },
      done(status, details) {
        this.set({ percent: 100, status, details });
      }
    };

    box.querySelector('#vz-hide').onclick = () => {
      box.style.display = 'none';
    };

    box.querySelector('#vz-export').onclick = () => {
      const rows = api.rowsProvider ? api.rowsProvider() : [];
      if (!rows.length) {
        alert('No rows collected yet.');
        return;
      }
      downloadWorkbook(rows, catalogFilename('_partial'));
    };

    box.querySelector('#vz-clear').onclick = () => {
      localStorage.removeItem(CONFIG.saveKey);
      alert('Saved v6.5 progress cleared.');
    };

    box.querySelector('#vz-pause').onclick = () => {
      api.paused = !api.paused;
      box.querySelector('#vz-pause').textContent = api.paused ? 'Resume' : 'Pause';
    };

    return api;
  }

  const progressUi = createProgressUi();

  function askForUrls() {
    const mode = prompt(
      'Choose product list mode:\n\nType DEFAULTS to run the built-in Verizon product list.\nType MANUAL to paste your own product URLs.',
      'DEFAULTS'
    );

    if (!mode) return [];

    if (/^d|default/i.test(mode.trim())) {
      return DEFAULT_URLS.slice(0, CONFIG.maxUrls);
    }

    const defaultValue = /(\.|^)verizon\.com$/i.test(location.hostname) ? location.href : '';
    const input = prompt('Paste Verizon product URLs. Separate multiple URLs with commas or new lines.', defaultValue);

    if (!input) return [];

    return input
      .split(/[\n,]+/)
      .map(url => url.trim())
      .filter(Boolean)
      .filter((url, index, array) => array.indexOf(url) === index)
      .slice(0, CONFIG.maxUrls);
  }

  function normalizeVerizonUrl(url) {
    const parsed = new URL(url, location.href);
    if (!/(\.|^)verizon\.com$/i.test(parsed.hostname)) {
      throw new Error(`Not a Verizon URL: ${url}`);
    }
    return parsed.href;
  }

  function loadSavedState(urls) {
    const urlKey = urls.join('|');

    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.saveKey) || '{}');
      if (saved.urlKey === urlKey && Array.isArray(saved.rows) && saved.doneKeys) {
        const choice = prompt(
          `Saved v6.5 progress found with ${saved.rows.length} rows.\n\nType RESUME to continue it.\nType CLEAR to start fresh.`,
          'CLEAR'
        );

        if (/^r|resume/i.test((choice || '').trim())) return saved;
        localStorage.removeItem(CONFIG.saveKey);
      }
    } catch (error) {
      console.warn('Unable to read saved state. Starting fresh.', error);
    }

    return {
      version: 'v6.5',
      urlKey,
      startedAt: timestamp(),
      rows: [],
      doneKeys: {}
    };
  }

  function saveState(state) {
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not save progress to localStorage.', error);
    }
  }

  async function createIframe(url) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = [
        'position:fixed',
        'left:-99999px',
        'top:0',
        'width:1500px',
        'height:1700px',
        'opacity:0',
        'pointer-events:none'
      ].join(';');
      iframe.setAttribute('aria-hidden', 'true');

      const timeout = setTimeout(() => {
        iframe.remove();
        reject(new Error(`Timeout loading ${url}`));
      }, CONFIG.timeoutMs);

      iframe.onload = async () => {
        clearTimeout(timeout);
        try {
          await waitForProductReady(iframe);
          resolve(iframe);
        } catch (error) {
          iframe.remove();
          reject(error);
        }
      };

      iframe.src = url;
      document.body.appendChild(iframe);
    });
  }

  function iframeDocument(iframe) {
    return iframe.contentDocument || iframe.contentWindow.document;
  }

  async function waitForProductReady(iframe) {
    const start = Date.now();

    while (Date.now() - start < CONFIG.readyMs) {
      const text = iframeDocument(iframe)?.body?.innerText || '';
      if (/Customize your device|Storage|Color\s*:/i.test(text)) {
        await sleep(CONFIG.settleMs);
        return;
      }
      await sleep(350);
    }

    await sleep(CONFIG.settleMs);
  }

  function isVisible(element) {
    if (!element || !element.ownerDocument?.defaultView) return false;

    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    const r = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) !== 0 &&
      r.width > 0 &&
      r.height > 0
    );
  }

  function getRect(element) {
    const r = element.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      top: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
      centerX: Math.round(r.left + r.width / 2),
      centerY: Math.round(r.top + r.height / 2)
    };
  }

  function ownText(element) {
    if (!element) return '';

    return normalize(
      Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent)
        .join(' ')
    );
  }

  function directText(element) {
    if (!element) return '';

    const pieces = [
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('title'),
      element.getAttribute?.('alt'),
      element.getAttribute?.('data-color'),
      element.getAttribute?.('data-value'),
      element.value,
      ownText(element)
    ];

    if (element.id) {
      const label = element.ownerDocument.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) {
        pieces.push(label.getAttribute('aria-label'), label.getAttribute('title'), ownText(label), normalize(label.innerText || label.textContent || ''));
      }
    }

    return normalize(pieces.filter(Boolean).join(' '));
  }

  function deepText(element) {
    if (!element) return '';

    const pieces = [];
    const pushNode = node => {
      if (!node) return;
      pieces.push(
        node.getAttribute?.('aria-label'),
        node.getAttribute?.('title'),
        node.getAttribute?.('alt'),
        node.getAttribute?.('data-color'),
        node.getAttribute?.('data-value'),
        node.value,
        node.innerText,
        node.textContent
      );
    };

    pushNode(element);
    Array.from(element.querySelectorAll?.('*') || []).slice(0, 16).forEach(pushNode);

    if (element.id) {
      const label = element.ownerDocument.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      pushNode(label);
      Array.from(label?.querySelectorAll?.('*') || []).slice(0, 16).forEach(pushNode);
    }

    return normalize(pieces.filter(Boolean).join(' '));
  }

  function isSpecificOutOfStock(element) {
    return Boolean(element && OUT_OF_STOCK_RE.test(directText(element)));
  }

  function isSpecificDisabled(element) {
    return Boolean(
      element &&
        (element.disabled === true ||
          element.getAttribute('aria-disabled') === 'true' ||
          element.getAttribute('disabled') !== null ||
          /\bdisabled\b/i.test(directText(element)) ||
          isSpecificOutOfStock(element))
    );
  }

  function getDeviceName(documentRef) {
    const selectors = [
      'h1',
      '[data-testid*="product-title" i]',
      '[class*="product-title" i]',
      'meta[property="og:title"]'
    ];

    for (const selector of selectors) {
      const element = documentRef.querySelector(selector);
      if (!element) continue;

      if (element.tagName === 'META') {
        const content = normalize(element.content);
        if (content) return content.replace(/\|.*$/, '').trim();
      }

      const text = normalize(element.textContent);
      if (text) return text;
    }

    return normalize(documentRef.title).replace(/\|.*$/, '').trim() || 'Unknown device';
  }

  function configuratorText(documentRef) {
    const body = documentRef.body?.innerText || '';
    const match = body.match(/Customize your device([\s\S]*?)(?:Tell us about yourself|New customer|Existing customer)/i);
    return normalize(match ? match[1] : body.slice(0, 2200));
  }

  function selectedColor(documentRef) {
    const match = configuratorText(documentRef).match(/Color\s*:\s*([A-Za-z][A-Za-z\s-]{1,45}?)(?=\s+Color\s*:|\s+Storage\b|$)/i);
    if (!match) return '';

    const color = normalize(match[1]).replace(/Out of stock|Selected/gi, '').trim();
    return color ? knownColorName(color) || titleCase(color) : '';
  }

  function storagesFromText(documentRef) {
    let text = configuratorText(documentRef);
    const storageIndex = text.search(/\bStorage\b/i);
    if (storageIndex < 0) return [];

    text = text
      .slice(storageIndex)
      .split(/Free shipping|Tell us about yourself|New customer|Existing customer|This item is only available for Express Pickup/i)[0];

    const matches = [...text.matchAll(/\b(\d+\s*(?:GB|TB))\b/gi)];
    const output = [];

    for (let i = 0; i < matches.length; i++) {
      const label = matches[i][1].replace(/\s+/g, ' ').toUpperCase();
      if (output.some(item => item.label === label)) continue;

      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const segment = text.slice(start, end);
      const outOfStock = OUT_OF_STOCK_RE.test(segment);

      output.push({
        index: output.length,
        label,
        outOfStock,
        disabled: outOfStock,
        rawText: normalize(matches[i][0] + segment)
      });
    }

    return output;
  }

  function labelY(documentRef, regex, min = 0, max = Infinity) {
    const nodes = Array.from(documentRef.body.querySelectorAll('*'))
      .filter(isVisible)
      .map(element => ({ element, text: normalize(element.textContent || ''), rect: getRect(element) }))
      .filter(item => item.text && item.text.length < 180 && item.rect.top >= min && item.rect.top <= max && regex.test(item.text))
      .sort((a, b) => a.rect.top - b.rect.top);

    return nodes[0]?.rect.top ?? null;
  }

  function getBounds(documentRef) {
    const customizeTop = labelY(documentRef, /Customize your device/i) ?? 0;
    const tellUsTop = labelY(documentRef, /Tell us about yourself|New customer|Existing customer/i, customizeTop) ?? 1000;
    const colorTop = labelY(documentRef, /^\s*Color\s*:?.*$/i, customizeTop, tellUsTop) ?? labelY(documentRef, /Color\s*:/i, customizeTop, tellUsTop);
    const storageTop = labelY(documentRef, /^\s*Storage\s*:?.*$/i, customizeTop, tellUsTop) ?? labelY(documentRef, /^Storage$/i, customizeTop, tellUsTop);

    return { colorTop, colorBottom: storageTop, storageTop, storageBottom: tellUsTop };
  }

  function isInVerticalRange(element, top, bottom) {
    const y = getRect(element).centerY;
    return (top == null || y >= top + 3) && (bottom == null || y <= bottom - 3);
  }

  function clickableControl(element) {
    if (element.tagName.toLowerCase() === 'input' && element.type === 'radio') {
      if (element.id) {
        const label = element.ownerDocument.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label && isVisible(label)) return label;
      }
      const parentLabel = element.closest('label');
      if (parentLabel && isVisible(parentLabel)) return parentLabel;
    }

    return element;
  }

  function optionControls(documentRef) {
    return Array.from(
      documentRef.querySelectorAll('button,input[type="radio"],label,[role="radio"],[role="button"],select,option,[aria-label]')
    )
      .filter(isVisible)
      .map(clickableControl);
  }

  function badNonOptionText(text) {
    const t = lower(text);
    return (
      /network-outage|payment|phoenix|flex|upgrade|monthly|pricing|customer|simplicity|checkout|cart|activation|device unlocking|terms|pagination|next page|previous page|compare devices|currently viewing|select store|open-ispu-modal|fulfillment-section/i.test(t) ||
      t.length > 260
    );
  }

  function storageControls(documentRef) {
    const bounds = getBounds(documentRef);
    const candidates = optionControls(documentRef)
      .filter(element => isInVerticalRange(element, bounds.storageTop, bounds.storageBottom))
      .filter(element => {
        const r = getRect(element);
        const text = directText(element) || deepText(element);
        return r.width <= 720 && r.height <= 280 && /\b\d+\s*(gb|tb)\b/i.test(text) && !badNonOptionText(text.replace(OUT_OF_STOCK_RE, ''));
      });

    const output = [];
    const seen = new Set();

    for (const element of candidates) {
      const text = directText(element) || deepText(element);
      const match = text.match(/\b\d+\s*(gb|tb)\b/i);
      const key = match ? match[0].toLowerCase().replace(/\s+/g, '') : lower(text);

      if (!seen.has(key)) {
        seen.add(key);
        output.push(element);
      }
    }

    return output;
  }

  function storagePlan(documentRef) {
    const parsed = storagesFromText(documentRef);
    const controls = storageControls(documentRef);

    if (parsed.length) {
      return parsed.map((item, index) => {
        const control =
          controls.find(element => new RegExp(item.label.replace(' ', '\\s*'), 'i').test(directText(element) || deepText(element))) ||
          controls[index] ||
          null;
        const specificText = control ? directText(control) : '';
        const outOfStock = item.outOfStock || isSpecificOutOfStock(control);

        return {
          ...item,
          index,
          outOfStock,
          disabled: outOfStock || isSpecificDisabled(control),
          controlIndex: index,
          rawText: specificText || item.rawText
        };
      });
    }

    return controls.map((control, index) => {
      const text = directText(control) || deepText(control);
      const match = text.match(/\b\d+\s*(gb|tb)\b/i);
      const outOfStock = isSpecificOutOfStock(control);

      return {
        index,
        label: match ? match[0].replace(/\s+/g, ' ').toUpperCase() : `Storage ${index + 1}`,
        outOfStock,
        disabled: outOfStock || isSpecificDisabled(control),
        controlIndex: index,
        rawText: text
      };
    });
  }

  function isSwatchLike(element) {
    const r = getRect(element);
    return r.width >= 5 && r.height >= 5 && r.width <= 240 && r.height <= 210;
  }

  function colorSignal(element) {
    const text = directText(element) || deepText(element);
    if (/\b\d+\s*(gb|tb)\b/i.test(text)) return false;
    if (badNonOptionText(text.replace(OUT_OF_STOCK_RE, ''))) return false;

    return (
      Boolean(knownColorName(text)) ||
      /color|swatch|out\s*of\s*stock/i.test(text) ||
      ['button', 'label', 'input'].includes(element.tagName.toLowerCase()) ||
      lower(element.getAttribute?.('role') || '') === 'radio'
    );
  }

  function colorControls(documentRef) {
    const bounds = getBounds(documentRef);
    if (bounds.colorTop == null || bounds.colorBottom == null) return [];

    const rawControls = optionControls(documentRef)
      .filter(element => isInVerticalRange(element, bounds.colorTop, bounds.colorBottom))
      .filter(isSwatchLike)
      .filter(colorSignal);

    const output = [];
    const seen = new Set();

    for (const element of rawControls) {
      const r = getRect(element);
      const key = `${Math.round(r.centerX / 7) * 7}:${Math.round(r.centerY / 7) * 7}`;
      if (!seen.has(key)) {
        seen.add(key);
        output.push(element);
      }
    }

    return output.sort((a, b) => {
      const ar = getRect(a);
      const br = getRect(b);
      return Math.abs(ar.centerY - br.centerY) > 12 ? ar.centerY - br.centerY : ar.centerX - br.centerX;
    });
  }

  async function clickOption(element) {
    if (!element || !isVisible(element) || isSpecificOutOfStock(element) || isSpecificDisabled(element)) return false;

    const r = getRect(element);
    if (r.width > 760 || r.height > 320) return false;

    element.scrollIntoView({ block: 'center', inline: 'center' });
    await sleep(100);

    if (element.tagName.toLowerCase() === 'option') {
      const select = element.closest('select');
      if (!select) return false;
      select.value = element.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      try {
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      } catch {}
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      element.click();
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      try {
        element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      } catch {}
    }

    await sleep(CONFIG.afterClickMs);
    return true;
  }

  async function discoverColors(documentRef) {
    let controls = colorControls(documentRef);

    if (!controls.length) {
      return [{ index: 0, label: selectedColor(documentRef) || 'N/A', outOfStock: false, disabled: false, rawText: '' }];
    }

    const colors = [];

    for (let index = 0; index < controls.length; index++) {
      controls = colorControls(documentRef);
      const control = controls[index];
      if (!control) continue;

      const rawText = directText(control) || deepText(control);
      let label = knownColorName(rawText) || `Color ${index + 1}`;
      const outOfStock = isSpecificOutOfStock(control);

      if (!outOfStock) {
        await clickOption(control);
        await sleep(250);
        label = selectedColor(documentRef) || knownColorName(rawText) || label;
      }

      colors.push({
        index,
        label,
        outOfStock,
        disabled: outOfStock || isSpecificDisabled(control),
        rawText
      });
    }

    const deduped = [];
    const seen = new Set();

    for (const color of colors) {
      const key = color.label.toLowerCase();
      if (!seen.has(key) || /^color \d+$/i.test(color.label)) {
        seen.add(key);
        deduped.push(color);
      }
    }

    return deduped.length ? deduped : [{ index: 0, label: selectedColor(documentRef) || 'N/A', outOfStock: false, disabled: false, rawText: '' }];
  }

  function availabilityForSelection(documentRef, storage, color, storageElement, colorElement) {
    if (color?.outOfStock || isSpecificOutOfStock(colorElement)) {
      return {
        availability: 'Out of stock',
        evidence: `Specific color option unavailable: ${color?.rawText || directText(colorElement)}`
      };
    }

    if (storage?.outOfStock || isSpecificOutOfStock(storageElement)) {
      return {
        availability: 'Out of stock',
        evidence: `Specific storage option unavailable: ${storage?.rawText || directText(storageElement)}`
      };
    }

    const bodyText = normalize(documentRef.body?.innerText || '');

    if (EXPRESS_PICKUP_ONLY_RE.test(bodyText)) {
      return {
        availability: 'Out of stock',
        evidence: 'Express Pickup-only messaging visible; no normal shipping availability for this selected configuration'
      };
    }

    if (SHIPPING_RE.test(bodyText)) {
      return {
        availability: 'In stock',
        evidence: 'Shipping/delivery text visible after this selection'
      };
    }

    if (PICKUP_RE.test(bodyText) && !SHIPPING_RE.test(bodyText)) {
      return {
        availability: 'Out of stock',
        evidence: 'Pickup/store-only option visible without normal shipping text for this selected configuration'
      };
    }

    return {
      availability: 'Unknown',
      evidence: 'No direct stock signal found for this specific option'
    };
  }

  async function waitIfPaused() {
    while (progressUi.paused) {
      progressUi.set({ status: 'Paused', details: 'Click Resume to continue.' });
      await sleep(500);
    }
  }

  function comboKey(url, storage, color) {
    return `${url}|||${storage.label}|||${color.label}|||${storage.index}|||${color.index}`;
  }

  async function scanProduct(url, productIndex, totalProducts, state) {
    progressUi.set({
      percent: Math.round((productIndex / Math.max(1, totalProducts)) * 100),
      status: `Loading ${productIndex + 1}/${totalProducts}`,
      details: url
    });

    const iframe = await createIframe(url);
    const documentRef = iframeDocument(iframe);

    try {
      const device = getDeviceName(documentRef);
      let storages = storagePlan(documentRef);
      if (!storages.length) storages = [{ index: 0, label: 'N/A', outOfStock: false, disabled: false, rawText: '' }];

      const colors = await discoverColors(documentRef);
      const comboCount = storages.length * colors.length;
      let localComboIndex = 0;

      log('Detected plan', device, { storages, colors });

      for (const baseColor of colors) {
        await waitIfPaused();

        let currentColorControls = colorControls(documentRef);
        let colorElement = currentColorControls[baseColor.index] || null;
        let finalColorLabel = baseColor.label;
        const rawColorText = colorElement ? directText(colorElement) || deepText(colorElement) || baseColor.rawText : baseColor.rawText;

        if (colorElement && !isSpecificOutOfStock(colorElement)) {
          await clickOption(colorElement);
          await sleep(250);
          finalColorLabel = selectedColor(documentRef) || knownColorName(rawColorText) || finalColorLabel;
        }

        for (const baseStorage of storages) {
          await waitIfPaused();

          const rowColor = {
            ...baseColor,
            label: finalColorLabel,
            rawText: rawColorText,
            outOfStock: baseColor.outOfStock || isSpecificOutOfStock(colorElement),
            disabled: baseColor.disabled || isSpecificDisabled(colorElement)
          };

          const key = comboKey(url, baseStorage, rowColor);
          if (state.doneKeys[key]) {
            localComboIndex++;
            continue;
          }

          progressUi.set({
            percent: Math.round(((productIndex + localComboIndex / Math.max(1, comboCount)) / Math.max(1, totalProducts)) * 100),
            status: `${device} (${productIndex + 1}/${totalProducts})`,
            details: [
              `Overall: ${productIndex + 1}/${totalProducts} devices`,
              `Device combo: ${localComboIndex + 1}/${comboCount}`,
              `Storage: ${baseStorage.label}`,
              `Color: ${rowColor.label}`,
              `Rows collected: ${state.rows.length}`,
              `URL: ${url}`
            ].join('\n')
          });

          const currentStorages = storagePlan(documentRef);
          const storage = currentStorages.find(item => item.label === baseStorage.label) || currentStorages[baseStorage.index] || baseStorage;
          const currentStorageControls = storageControls(documentRef);
          const storageElement =
            currentStorageControls.find(element => new RegExp((storage.label || baseStorage.label).replace(' ', '\\s*'), 'i').test(directText(element) || deepText(element))) ||
            currentStorageControls[storage.controlIndex] ||
            currentStorageControls[baseStorage.index] ||
            null;

          let row;

          if (rowColor.outOfStock || isSpecificOutOfStock(colorElement)) {
            row = {
              'Scanned At': timestamp(),
              'Product URL': url,
              Device: device,
              Storage: storage.label || baseStorage.label,
              Color: rowColor.label,
              Availability: 'Out of stock',
              Evidence: `Specific color option unavailable: ${rowColor.rawText || directText(colorElement)}`
            };
          } else if (storage.outOfStock || isSpecificOutOfStock(storageElement)) {
            row = {
              'Scanned At': timestamp(),
              'Product URL': url,
              Device: device,
              Storage: storage.label || baseStorage.label,
              Color: rowColor.label,
              Availability: 'Out of stock',
              Evidence: `Specific storage option unavailable: ${storage.rawText || directText(storageElement)}`
            };
          } else {
            if (storageElement) await clickOption(storageElement);
            await sleep(250);

            finalColorLabel = selectedColor(documentRef) || finalColorLabel;
            rowColor.label = finalColorLabel;

            const availability = availabilityForSelection(documentRef, storage, rowColor, storageElement, colorElement);

            row = {
              'Scanned At': timestamp(),
              'Product URL': url,
              Device: device,
              Storage: storage.label || baseStorage.label,
              Color: rowColor.label,
              Availability: availability.availability,
              Evidence: availability.evidence
            };
          }

          state.rows.push(row);
          state.doneKeys[key] = true;
          saveState(state);
          console.log(row);
          localComboIndex++;
        }
      }
    } finally {
      iframe.src = 'about:blank';
      iframe.remove();
      await sleep(250);
    }
  }

  function storageSortValue(storage) {
    const s = lower(storage).replace(/\s+/g, '');
    const match = s.match(/([0-9.]+)(tb|gb|mb)/i);
    if (!match) return 999999;

    let value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 'tb') value *= 1024;
    if (unit === 'mb') value /= 1024;

    return value;
  }

  function xmlSafe(value, maxLength = 32000) {
    return String(value ?? '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .slice(0, maxLength)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function worksheetName(base, used) {
    let name = normalize(base || 'Sheet')
      .replace(/[\\/?*\[\]:]/g, ' ')
      .slice(0, 31)
      .trim() || 'Sheet';

    const original = name;
    let counter = 2;

    while (used.has(name.toLowerCase())) {
      const suffix = ` (${counter++})`;
      name = original.slice(0, 31 - suffix.length) + suffix;
    }

    used.add(name.toLowerCase());
    return name;
  }

  function excelCell(value, styleId = '') {
    const isNumber = typeof value === 'number' && Number.isFinite(value);
    const style = styleId ? ` ss:StyleID="${styleId}"` : '';
    return `<Cell${style}><Data ss:Type="${isNumber ? 'Number' : 'String'}">${xmlSafe(value)}</Data></Cell>`;
  }

  function excelRow(values, defaultStyle = '') {
    return `<Row>${values.map(value => (Array.isArray(value) ? excelCell(value[0], value[1]) : excelCell(value, defaultStyle))).join('')}</Row>`;
  }

  function availabilityStyle(value) {
    const text = lower(value);
    if (text.includes('in stock')) return 'sIn';
    if (text.includes('out of stock')) return 'sOut';
    if (text.includes('error')) return 'sErr';
    return 'sWarn';
  }

  function downloadWorkbook(rows, filename = catalogFilename()) {
    const usedSheetNames = new Set();
    const groups = new Map();

    for (const row of rows) {
      const key = `${row.Device || 'Unknown'}|||${row['Product URL'] || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    const styles = `
      <Styles>
        <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
        <Style ss:ID="sTitle"><Font ss:Bold="1" ss:Size="14"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style>
        <Style ss:ID="sHead"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#305496" ss:Pattern="Solid"/></Style>
        <Style ss:ID="sSub"><Font ss:Bold="1"/><Interior ss:Color="#E2F0D9" ss:Pattern="Solid"/></Style>
        <Style ss:ID="sIn"><Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/><Font ss:Color="#006100"/></Style>
        <Style ss:ID="sOut"><Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/><Font ss:Color="#9C0006"/></Style>
        <Style ss:ID="sWarn"><Interior ss:Color="#FFEB9C" ss:Pattern="Solid"/></Style>
        <Style ss:ID="sErr"><Interior ss:Color="#F4B084" ss:Pattern="Solid"/><Font ss:Bold="1"/></Style>
        <Style ss:ID="sNote"><Font ss:Color="#666666" ss:Italic="1"/></Style>
      </Styles>`;

    const worksheets = [];

    worksheets.push(`
      <Worksheet ss:Name="Instructions">
        <Table>
          <Column ss:Width="220"/>
          <Column ss:Width="820"/>
          ${excelRow([['Purpose', 'sHead'], ['How to use this workbook', 'sHead']])}
          ${excelRow(['Sheets', 'One sheet per device/product URL, plus Raw Data.'])}
          ${excelRow(['Storage sort', 'Storage rows are sorted numerically: 128 GB, 256 GB, 512 GB, 1 TB.'])}
          ${excelRow(['Color sort', 'Edit the Color Sort # row per device. Lower numbers sort farther left. To reorder colors, select the color/status columns and use Excel Data > Sort > Options > Sort left to right by the Color Sort # row.'])}
          ${excelRow(['URL mode', 'At startup choose DEFAULTS for the built-in 12-product list or MANUAL to paste URLs.'])}
          ${excelRow(['File name', 'Workbook file name uses Verizon_Catalog_MM-DD-YY.xls.'])}
        </Table>
      </Worksheet>`);

    for (const [, items] of groups) {
      const device = items[0].Device || 'Unknown Device';
      const url = items[0]['Product URL'] || '';
      const sheetName = worksheetName(device, usedSheetNames);

      const storages = [...new Set(items.map(row => row.Storage || 'N/A'))].sort(
        (a, b) => storageSortValue(a) - storageSortValue(b) || String(a).localeCompare(String(b))
      );
      const colors = [...new Set(items.map(row => row.Color || 'N/A'))];
      const rowMap = new Map(items.map(row => [`${row.Storage || 'N/A'}|||${row.Color || 'N/A'}`, row]));

      let tableXml = '<Table>';
      tableXml += '<Column ss:Width="135"/>';
      tableXml += colors.map(() => '<Column ss:Width="125"/>').join('');
      tableXml += '<Column ss:Width="420"/>';
      tableXml += excelRow([[device, 'sTitle'], ['', 'sTitle']]);
      tableXml += excelRow(['Product URL', url]);
      tableXml += excelRow(['Generated', timestamp()]);
      tableXml += excelRow([['Color Sort #', 'sSub'], ...colors.map((color, index) => [index + 1, 'sSub']), ['Notes', 'sSub']]);
      tableXml += excelRow([['Storage \\ Color', 'sHead'], ...colors.map(color => [color, 'sHead']), ['Evidence / Notes', 'sHead']]);

      for (const storage of storages) {
        const notes = [];
        const values = [[storage, 'sHead']];

        for (const color of colors) {
          const result = rowMap.get(`${storage}|||${color}`);
          values.push([result ? result.Availability : '', result ? availabilityStyle(result.Availability) : '']);
          if (result?.Evidence) notes.push(`${color}: ${result.Evidence}`);
        }

        values.push([notes.join(' | '), 'sNote']);
        tableXml += excelRow(values);
      }

      tableXml += '</Table>';
      worksheets.push(`<Worksheet ss:Name="${xmlSafe(sheetName, 31)}">${tableXml}</Worksheet>`);
    }

    const rawSheetName = worksheetName('Raw Data', usedSheetNames);
    const rawHeaders = ['Scanned At', 'Product URL', 'Device', 'Storage', 'Color', 'Availability', 'Evidence'];

    let rawXml = '<Table>';
    rawXml += rawHeaders.map(() => '<Column ss:Width="150"/>').join('');
    rawXml += excelRow(rawHeaders.map(header => [header, 'sHead']));

    for (const row of rows) {
      rawXml += excelRow(rawHeaders.map(header => [row[header] ?? '', header === 'Availability' ? availabilityStyle(row[header]) : '']));
    }

    rawXml += '</Table>';
    worksheets.push(`<Worksheet ss:Name="${xmlSafe(rawSheetName, 31)}">${rawXml}</Worksheet>`);

    const workbookXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Created>${xmlSafe(timestamp())}</Created>
  </DocumentProperties>
  ${styles}
  ${worksheets.join('\n')}
</Workbook>`;

    const blob = new Blob([workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 500);
  }

  async function main() {
    if (!/(\.|^)verizon\.com$/i.test(location.hostname)) {
      alert('Open a Verizon.com page first.');
      return;
    }

    const urls = askForUrls().map(normalizeVerizonUrl);
    if (!urls.length) {
      alert('No URLs provided.');
      return;
    }

    const state = loadSavedState(urls);
    progressUi.rowsProvider = () => state.rows;
    console.clear();

    for (let index = 0; index < urls.length; index++) {
      try {
        await scanProduct(urls[index], index, urls.length, state);
        progressUi.set({
          percent: Math.round(((index + 1) / urls.length) * 100),
          status: `Completed ${index + 1}/${urls.length} devices`,
          details: `Rows collected: ${state.rows.length}`
        });
      } catch (error) {
        const row = {
          'Scanned At': timestamp(),
          'Product URL': urls[index],
          Device: 'Unknown',
          Storage: 'N/A',
          Color: 'N/A',
          Availability: 'Error',
          Evidence: error.message || String(error)
        };

        state.rows.push(row);
        saveState(state);
        console.error('Product failed', urls[index], error);
      }
    }

    downloadWorkbook(state.rows);
    console.table(state.rows);
    progressUi.done(
      `Complete. Exported ${state.rows.length} row(s).`,
      `Workbook downloaded as ${catalogFilename()}. Saved progress remains until cleared.`
    );
    alert(`Scan complete. Rows exported: ${state.rows.length}. Excel workbook downloaded.`);
  }

  main();
})();
