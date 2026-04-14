## 🚀 CU Import Tool (Bookmarklet)

### One‑time setup

1. Show the bookmarks bar (**Ctrl + Shift + B**)
2. Create a new bookmark (any page)
3. Edit the bookmark and paste **this entire line** into the URL field:

```text
javascript:(async function(){  const r = await fetch(    'https://raw.githubusercontent.com/ElijahRademaker/automation-tools/refs/heads/main/cuimport.js?%27+Date.now()  );  eval(await r.text());})();
