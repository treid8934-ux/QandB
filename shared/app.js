// TAB LOADER — builds the tab bar from TABS (in index.html), loads every tab's
// tab.html + tab.js, runs each tab's init(), then opens the first tab.
//
// A tab's tab.js registers itself at the bottom of the file:
//   registerTab('my-tab', {
//       init()    { ... },   // runs once, after every tab has loaded (optional)
//       onShow()  { ... },   // runs each time the tab is opened (optional)
//       onReset() { ... }    // shows a "Reset Form" button in the header (optional)
//   });

const tabHooks = {};
let activeTabId = null;

function registerTab(id, hooks) {
    tabHooks[id] = hooks || {};
}

const TAB_BTN_ON  = 'px-5 py-3 font-bold text-sm rounded-t-xl transition-all duration-200 flex items-center gap-2 bg-white text-qbNavy-600 shadow';
const TAB_BTN_OFF = 'px-5 py-3 font-semibold text-sm rounded-t-xl transition-all duration-200 flex items-center gap-2 text-blue-200 hover:text-white hover:bg-white/10';

function switchTab(id) {
    if (!TABS.some(t => t.id === id)) return;
    activeTabId = id;
    TABS.forEach(t => {
        const btn = document.getElementById('tab-' + t.id);
        const pane = document.getElementById('pane-' + t.id);
        const on = t.id === id;
        if (btn) { btn.className = on ? TAB_BTN_ON : TAB_BTN_OFF; btn.setAttribute('aria-selected', on); }
        if (pane) pane.classList.toggle('hidden', !on);
    });
    const hooks = tabHooks[id] || {};
    document.getElementById('header-reset-btn').classList.toggle('hidden', typeof hooks.onReset !== 'function');
    if (typeof hooks.onShow === 'function') hooks.onShow();
    renderIcons();
}

function resetActiveTab() {
    const hooks = tabHooks[activeTabId] || {};
    if (typeof hooks.onReset === 'function') hooks.onReset();
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load ' + src));
        document.body.appendChild(s);
    });
}

async function startSuite() {
    // 1. Tab buttons
    document.getElementById('tab-bar').innerHTML = TABS.map(t =>
        `<button id="tab-${t.id}" type="button" role="tab" onclick="switchTab('${t.id}')" class="${TAB_BTN_OFF}">` +
        `<i data-lucide="${t.icon || 'layers'}" class="w-4 h-4"></i> ${t.label}</button>`).join('');

    const main = document.getElementById('tab-container');
    const problems = [];

    // 2. Every tab's HTML (fetched together, inserted in TABS order)
    const htmls = await Promise.all(TABS.map(t =>
        fetch(`tabs/${t.id}/tab.html`)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .catch(err => { problems.push(`tabs/${t.id}/tab.html (${err.message})`); return ''; })));
    main.innerHTML = TABS.map((t, i) =>
        `<section id="pane-${t.id}" class="hidden" role="tabpanel">${htmls[i]}</section>`).join('');

    // 3. Every tab's JS, one at a time in TABS order
    for (const t of TABS) {
        if (!htmls[TABS.indexOf(t)]) continue;
        try { await loadScript(`tabs/${t.id}/tab.js`); }
        catch (err) { problems.push(err.message.replace('Could not load ', '')); }
    }

    // 4. init() for each tab — one broken tab won't stop the others
    TABS.forEach(t => {
        const hooks = tabHooks[t.id];
        if (hooks && typeof hooks.init === 'function') {
            try { hooks.init(); } catch (err) { console.error(`[${t.id}] init failed`, err); problems.push(`${t.id} (init error — see console)`); }
        }
    });

    if (problems.length) {
        const local = location.protocol === 'file:';
        main.insertAdjacentHTML('afterbegin', `<div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
            <strong>Some tabs didn't load:</strong> ${problems.join(', ')}.
            ${local ? '<br>This page was opened straight from your computer, which blocks loading the tab files. Use a local web server (e.g. VS Code Live Server) or your Vercel site.' : ''}</div>`);
    }

    switchTab(TABS[0].id);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSuite);
else startSuite();
