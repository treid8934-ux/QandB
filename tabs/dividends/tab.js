// DIVIDEND LOOKUP TAB — data loads from data/dividends.json the first time the tab is opened

// Bump this whenever dividends.json is replaced, so browsers fetch the new file
const DL_DATA_VERSION = '2026-09';
function dlInit(DATA) {
const S = DATA.s, R = DATA.r;
const $ = id => document.getElementById(id);
const TYPE_NAME = {E:'Share / ETF / trust', D:'Delisted'};
const EV_NAME = {'NON-RENOUNCEABLE':'Non-renounceable issue','RENOUNCEABLE':'Renounceable issue','RECONSTRUCTION':'Split / consolidation','CAPITAL/PREMIUM RETURN':'Return of capital','EQUAL ACCESS BUY BACK':'Buy-back','SHARE PURCHASE PLAN':'Share purchase plan','BONUS':'Bonus issue'};
const EV_KEY = {'RECONSTRUCTION':1,'CAPITAL/PREMIUM RETURN':1,'EQUAL ACCESS BUY BACK':1,'BONUS':1};
const TAGS = [
  ['Demerger', /demerg/i], ['Return of capital', /return of capital|reduction (of|in) (share )?capital|capital reduction|capital return|\bROC\b/i],
  ['Split / consolidation', /split|consolidat|reconstruct|subdivi/i], ['Buy-back', /buy-?back/i],
  ['Scheme / takeover', /scheme of arrangement|takeover|scrip for scrip|scrip-for-scrip/i], ['Special dividend', /special divid/i],
  ['In specie', /in specie/i], ['Stapling / restructure', /stapl|restructur|interpos|top hat/i]];
const RUL_DOC = {CR:'CLR', PR:'PRR', TR:'TXR', TD:'TXD'};
const rulUrl = id => { const m = /^(CR|PR|TR|TD) (\d{4})\/(\d+)$/.exec(id); return m ? `https://www.ato.gov.au/law/view/document?docid=${RUL_DOC[m[1]]}/${m[1]}${m[2]}${m[3]}/NAT/ATO/00001` : null; };
const PAY_TYPE = {I:'Interim', F:'Final', S:'Special', N:'Interest'};
const fyOf = d => { const y = +d.slice(0,4), m = +d.slice(4,6); return m >= 7 ? y + 1 : y; };
const fmtD = d => d ? d.slice(6,8) + '/' + d.slice(4,6) + '/' + d.slice(0,4) : '—';
const c4 = n => n.toLocaleString('en-AU',{minimumFractionDigits:4,maximumFractionDigits:4});
const aud = n => n.toLocaleString('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2,maximumFractionDigits:2});
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Shared Tailwind class strings (match the rest of the suite)
const CODE = 'inline-block bg-qbNavy-600 text-white font-extrabold text-xs tracking-wide rounded-lg px-1.5 py-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis';
const TH = 'py-2.5 px-3 font-semibold whitespace-nowrap';
const TD = 'py-2.5 px-3 whitespace-nowrap align-top';
const BLOCK = 'px-6 py-5 border-b border-gray-100 last:border-b-0';
const EMPTY = 'px-4 py-8 text-center text-sm text-gray-500';

// group rows by security, precompute tax figures
const bySec = new Map();
const fyCount = {};
for (const r of R) {
  const [si, t, amt, rec, pay, frank, drp, notes, ctr0] = r;
  const fy = fyOf(pay);
  const ctr = (ctr0 == null ? 30 : ctr0) / 100;
  const franked = amt * frank / 100;
  const row = {t, amt, rec, pay, frank, drp, notes: notes || '', fy, franked, unfranked: amt - franked,
    credit: frank > 0 ? franked * ctr / (1 - ctr) : 0, ctr: frank > 0 ? ctr * 100 : null};
  if (!bySec.has(si)) bySec.set(si, []);
  bySec.get(si).push(row);
  fyCount[fy] = (fyCount[fy] || 0) + 1;
}
const index = S.map((s, i) => ({i, code: s[0], name: s[1], isin: s[2], type: s[3], desc: s[4], price: s[5], last: s[6],
  lc: s[0].toLowerCase(), ln: s[1].toLowerCase(), rows: bySec.get(i) || [], ruls: [], evts: []}));
for (const [si, id, text] of DATA.u) index[si].ruls.push({id, text, tags: TAGS.filter(t => t[1].test(text)).map(t => t[0])});
for (const [si, ev, rec, iss, desc] of DATA.e) index[si].evts.push({ev, rec, iss, desc, fy: fyOf(rec)});
for (const s of index) s.ruls.sort((a, b) => b.id.slice(3).localeCompare(a.id.slice(3), undefined, {numeric: true}));

const chip = t => `<span class="bg-qbTeal-500/10 text-qbTeal-600 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-teal-200 whitespace-nowrap">${t}</span>`;
$('dl-srcCount').innerHTML = chip(R.length.toLocaleString('en-AU') + ' payments') + chip(DATA.u.length.toLocaleString('en-AU') + ' ATO rulings') + chip(S.length.toLocaleString('en-AU') + ' shares, ETFs &amp; trusts');

// FY selector
const fySel = $('dl-fy');
const FY_LABEL = {2024:'FY2024', 2025:'FY2025', 2026:'FY2026', 2027:'FY2027 · announced so far'};
const years = Object.keys(fyCount).map(Number).sort((a,b) => b - a);
fySel.innerHTML = '<option value="all">All years</option>' + years.map(y => `<option value="${y}">${FY_LABEL[y] || 'FY' + y}</option>`).join('');
const fyRange = y => `1 Jul ${y-1} – 30 Jun ${y}`;

const q = $('dl-q');
const list = $('dl-results'), detail = $('dl-detail');
let selected = null, matches = [], units = 0;

try { const saved = JSON.parse(localStorage.getItem('qb-div-lookup') || '{}');
  if (saved.fy && [...fySel.options].some(o => o.value === saved.fy)) fySel.value = saved.fy;
} catch (e) {}
function save(){ try { localStorage.setItem('qb-div-lookup', JSON.stringify({fy: fySel.value})); } catch (e) {} }

const inFy = (row) => fySel.value === 'all' || row.fy === +fySel.value;

function search(){
  const term = q.value.trim().toLowerCase();
  const out = [];
  for (const s of index) {
    let rank;
    if (!term) { rank = 5; }
    else if (s.lc === term) rank = 0;
    else if (s.lc.startsWith(term)) rank = 1;
    else if (s.ln.startsWith(term)) rank = 2;
    else if ((' ' + s.ln).includes(' ' + term)) rank = 3;
    else if (s.ln.includes(term) || s.isin.toLowerCase() === term) rank = 4;
    else continue;
    const n = s.rows.filter(inFy).length;
    if (!term && n === 0) continue;
    out.push({s, rank, n});
  }
  out.sort((a,b) => a.rank - b.rank || (b.n > 0) - (a.n > 0) || a.s.code.length - b.s.code.length || a.s.code.localeCompare(b.s.code));
  matches = out;
  renderList(term);
}

const ITEM = 'grid grid-cols-[64px_minmax(0,1fr)_auto] gap-2.5 items-center w-full text-left px-2.5 py-2 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-qbTeal-500';
const itemCls = on => ITEM + (on ? ' bg-qbNavy-50 ring-1 ring-qbNavy-100' : ' hover:bg-gray-50');

function renderList(term){
  const shown = matches.slice(0, 150);
  $('dl-listInfo').innerHTML = term ? `<b class="text-qbNavy-700">${matches.length.toLocaleString('en-AU')}</b> match${matches.length === 1 ? '' : 'es'}` : `<b class="text-qbNavy-700">${matches.length.toLocaleString('en-AU')}</b> with payments`;
  $('dl-listFy').textContent = fySel.value === 'all' ? 'payments, all years' : 'payments in FY' + fySel.value;
  if (!shown.length) { list.innerHTML = `<li class="${EMPTY}">No securities match “${esc(q.value.trim())}”. Try the ASX code instead.</li>`; return; }
  list.innerHTML = shown.map(m => `<li><button type="button" role="option" data-i="${m.s.i}" aria-selected="${selected === m.s.i}" class="${itemCls(selected === m.s.i)}">
      <span class="${CODE}">${esc(m.s.code)}</span>
      <span class="min-w-0"><span class="block text-[13px] font-semibold text-gray-800 truncate">${esc(m.s.name)}</span><span class="block text-[11px] text-gray-500 truncate">${m.s.type === 'D' ? 'Delisted' : (m.s.last !== '2026' ? 'Not in 2026 edition' : (!m.s.desc || m.s.desc === 'ORDINARY FULLY PAID' ? 'Ordinary shares' : esc(m.s.desc.charAt(0) + m.s.desc.slice(1).toLowerCase())))}${m.s.ruls.length ? ` · <span class="text-qbTeal-600 font-semibold">${m.s.ruls.length} ATO ruling${m.s.ruls.length === 1 ? '' : 's'}</span>` : ''}</span></span>
      <span class="text-[11px] whitespace-nowrap ${m.n ? 'font-bold text-qbTeal-600' : 'text-gray-400'}">${m.n || 'none'}</span></button></li>`).join('')
    + (matches.length > shown.length ? `<li class="${EMPTY}">Showing the first 150. Keep typing to narrow the list.</li>` : '');
}

list.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) select(+b.dataset.i); });
list.addEventListener('keydown', e => {
  const btns = [...list.querySelectorAll('button[data-i]')]; const i = btns.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' && i < btns.length - 1) { e.preventDefault(); btns[i+1].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); i > 0 ? btns[i-1].focus() : q.focus(); }
});
q.addEventListener('keydown', e => {
  if (e.key === 'Enter' && matches[0]) { select(matches[0].s.i); }
  if (e.key === 'ArrowDown') { const b = list.querySelector('button[data-i]'); if (b) { e.preventDefault(); b.focus(); } }
});
let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { search(); if (q.value.trim() && matches[0] && matches[0].rank <= 1) select(matches[0].s.i, true); }, 90); });
fySel.addEventListener('change', () => { save(); search(); renderDetail(); });

function select(i){
  selected = i;
  list.querySelectorAll('button[data-i]').forEach(b => { const on = +b.dataset.i === i; b.setAttribute('aria-selected', on); b.className = itemCls(on); });
  renderDetail();
}

const PILL = 'inline-block text-[10px] font-bold px-2 py-px rounded-full ml-1 align-[1px]';
function pills(r){
  let p = '';
  if (r.amt === 0) p += `<span class="${PILL} bg-gray-100 text-gray-600">TBA</span>`;
  if (r.amt > 0 && /\bEST\b/.test(r.notes)) p += `<span class="${PILL} bg-amber-100 text-amber-800" title="The registry marked the tax components of this distribution as estimated">Est. split</span>`;
  if (/\bSPEC\b/.test(r.notes)) p += `<span class="${PILL} bg-indigo-100 text-indigo-700">Special</span>`;
  return p;
}

const tile = (label, value, sub) => `<div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
    <span class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">${label}</span>
    <strong class="block text-xl font-extrabold text-qbNavy-700 mt-1 tabular-nums">${value}</strong>
    <span class="block text-[11px] text-gray-500 mt-0.5">${sub}</span></div>`;
const blockHead = (title, small, right) => `<div class="flex flex-wrap justify-between items-baseline gap-2 mb-3">
    <h3 class="text-base font-bold text-qbNavy-600">${title}<small class="text-xs font-semibold text-gray-500 ml-2">${small}</small></h3>
    <span class="text-xs text-gray-500">${right}</span></div>`;

let curRows = [];
function renderDetail(bodyOnly){
  const s = index[selected];
  if (!s) { detail.innerHTML = `<div class="${EMPTY}">Pick a security from the list.</div>`; return; }
  const rows = s.rows.filter(inFy).sort((a,b) => a.pay.localeCompare(b.pay));
  const groups = new Map();
  for (const r of rows) { if (!groups.has(r.fy)) groups.set(r.fy, []); groups.get(r.fy).push(r); }
  const sum = (rs, k) => rs.reduce((a, r) => a + r[k], 0);
  const tot = {amt: sum(rows,'amt'), franked: sum(rows,'franked'), unfranked: sum(rows,'unfranked'), credit: sum(rows,'credit')};
  const fyLbl = fySel.value === 'all' ? 'All years shown' : 'FY' + fySel.value + ' · ' + fyRange(+fySel.value);
  const u = units || 0;
  const money = c => u ? aud(c * u / 100) : c4(c) + 'c';
  const sfx = u ? `for ${u.toLocaleString('en-AU')} units` : 'per share / unit';

  const head = `<div class="px-6 py-5 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-start">
    <div class="min-w-0">
      <h2 class="text-xl font-extrabold text-qbNavy-700 flex flex-wrap items-center gap-2"><span class="${CODE} text-sm px-2.5 py-1">${esc(s.code)}</span>${esc(s.name)}</h2>
      <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
        ${s.isin ? `<span>ISIN <b class="text-gray-700 font-semibold">${esc(s.isin)}</b></span>` : ''}
        <span>${TYPE_NAME[s.type]}${s.desc ? ' · <b class="text-gray-700 font-semibold">' + esc(s.desc) + '</b>' : ''}</span>
        ${s.price ? `<span>Price at 30/6/${s.last.slice(2)} <b class="text-gray-700 font-semibold tabular-nums">$${esc(s.price)}</b></span>` : ''}
      </div>
    </div>
    <div class="flex gap-2 items-end w-full sm:w-auto no-print">
      <div class="flex-1 sm:w-40 sm:flex-none"><label for="dl-units" class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Units Held</label>
      <input id="dl-units" type="text" inputmode="numeric" autocomplete="off" placeholder="Optional" value="${u ? u.toLocaleString('en-AU') : ''}" class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-qbNavy-500 focus:outline-none p-3 font-semibold"></div>
      <button id="dl-copyBtn" type="button" title="Copy rows to paste into Excel" class="bg-qbNavy-600 hover:bg-qbNavy-700 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl flex items-center gap-2 transition shadow-sm whitespace-nowrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>Copy</button>
    </div>
  </div>`;
  let html = `<div class="grid grid-cols-2 xl:grid-cols-4 gap-3 px-6 py-5 border-b border-gray-100">
    <div class="bg-gradient-to-br from-qbNavy-600 via-qbNavy-700 to-qbNavy-800 rounded-xl p-4 text-white shadow relative overflow-hidden">
      <span class="block text-[10px] font-bold text-qbTeal-400 uppercase tracking-wider">Total paid</span>
      <strong class="block text-xl font-extrabold mt-1 tabular-nums">${money(tot.amt)}</strong>
      <span class="block text-[11px] text-blue-200 mt-0.5">${fyLbl}</span></div>
    ${tile('Franked', money(tot.franked), sfx)}
    ${tile('Unfranked', money(tot.unfranked), sfx)}
    ${tile('Franking credits', money(tot.credit), 'Grossed-up ' + money(tot.amt + tot.credit))}
  </div>`;

  if (!rows.length) {
    const other = s.rows.length ? `This security has ${s.rows.length} payment${s.rows.length === 1 ? '' : 's'} in other years. Switch the year to All years to see them.` : 'No edition records a dividend, distribution or interest payment for this security.';
    html += `<div class="${EMPTY}">No dividends or distributions ${fySel.value === 'all' ? '' : 'with a pay date in FY' + fySel.value}. ${other}</div>`;
  }
  const yrs = [...groups.keys()].sort((a,b) => b - a);
  for (const fy of yrs) {
    const g = groups.get(fy);
    const gt = {amt: sum(g,'amt'), franked: sum(g,'franked'), unfranked: sum(g,'unfranked'), credit: sum(g,'credit')};
    html += `<div class="${BLOCK}">
      ${blockHead('FY' + fy, fyRange(fy), `${g.length} payment${g.length === 1 ? '' : 's'} · total <b class="text-gray-800 tabular-nums">${money(gt.amt)}</b> · credits <b class="text-gray-800 tabular-nums">${money(gt.credit)}</b>`)}
      ${fy === 2027 ? '<div class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">FY2027 holds payments announced before the 2026 edition was published. Many were still TBA, so check the registry for final amounts.</div>' : ''}
      <div class="overflow-x-auto rounded-xl border border-gray-200"><table class="w-full text-left text-xs min-w-[760px]">
        <thead><tr class="bg-qbNavy-600 text-white uppercase tracking-wider text-[10px]"><th class="${TH}">Type</th><th class="${TH} text-right">Amount</th><th class="${TH}">Record</th><th class="${TH}">Paid</th><th class="${TH} text-right">Frank %</th><th class="${TH} text-right">Franked</th><th class="${TH} text-right">Unfranked</th><th class="${TH} text-right">Credit</th><th class="${TH} text-right">DRP Price</th><th class="${TH}">Notes</th></tr></thead>
        <tbody class="divide-y divide-gray-100">${g.map(r => `<tr class="hover:bg-gray-50">
          <td class="${TD}"><span class="font-bold text-gray-800">${PAY_TYPE[r.t]}</span>${pills(r)}</td>
          <td class="${TD} text-right tabular-nums font-bold text-gray-800">${money(r.amt)}</td>
          <td class="${TD} tabular-nums text-gray-500">${fmtD(r.rec)}</td>
          <td class="${TD} tabular-nums font-bold text-gray-800">${fmtD(r.pay)}</td>
          <td class="${TD} text-right tabular-nums">${r.t === 'N' ? '—' : r.frank.toFixed(2) + '%'}</td>
          <td class="${TD} text-right tabular-nums">${money(r.franked)}</td>
          <td class="${TD} text-right tabular-nums">${money(r.unfranked)}</td>
          <td class="${TD} text-right tabular-nums">${r.credit ? money(r.credit) : '<span class="text-gray-400">—</span>'}${r.credit && r.ctr !== 30 ? `<div class="text-[10px] text-gray-500">${+r.ctr.toFixed(4)}% CTR</div>` : ''}</td>
          <td class="${TD} text-right tabular-nums text-gray-500">${r.drp ? '$' + r.drp.toFixed(4) : '—'}</td>
          <td class="py-2.5 px-3 align-top whitespace-normal text-gray-500 text-[11px] min-w-[170px] max-w-[300px]">${esc(r.notes)}</td></tr>`).join('')}</tbody>
        ${g.length > 1 ? `<tfoot><tr class="bg-qbNavy-50 font-bold text-qbNavy-700 border-t border-gray-200"><td class="${TD}">FY${fy} total</td><td class="${TD} text-right tabular-nums">${money(gt.amt)}</td><td></td><td></td><td></td><td class="${TD} text-right tabular-nums">${money(gt.franked)}</td><td class="${TD} text-right tabular-nums">${money(gt.unfranked)}</td><td class="${TD} text-right tabular-nums">${money(gt.credit)}</td><td></td><td></td></tr></tfoot>` : ''}
      </table></div></div>`;
  }
  // capital events
  const evts = s.evts.filter(e => fySel.value === 'all' || e.fy === +fySel.value).sort((a, b) => b.rec.localeCompare(a.rec));
  html += `<div class="${BLOCK}">${blockHead('Capital Events', fySel.value === 'all' ? 'FY2024 onward' : 'FY' + fySel.value + ', by record date', 'Splits, returns of capital, buy-backs and issues that can change your cost base')}`;
  if (evts.length) {
    html += `<div class="overflow-x-auto rounded-xl border border-gray-200"><table class="w-full text-left text-xs min-w-[560px]"><thead><tr class="bg-qbNavy-600 text-white uppercase tracking-wider text-[10px]"><th class="${TH}">Event</th><th class="${TH}">Record</th><th class="${TH}">Issue / Paid</th><th class="${TH}">Details</th></tr></thead><tbody class="divide-y divide-gray-100">${evts.map(e => `<tr class="hover:bg-gray-50">
      <td class="${TD}"><span class="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${EV_KEY[e.ev] ? 'bg-teal-50 text-qbTeal-600 border border-teal-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}">${EV_NAME[e.ev] || esc(e.ev)}</span></td>
      <td class="${TD} tabular-nums font-bold text-gray-800">${fmtD(e.rec)}</td><td class="${TD} tabular-nums text-gray-500">${e.iss ? fmtD(e.iss) : '—'}</td><td class="py-2.5 px-3 align-top whitespace-normal text-gray-500 text-[11px] min-w-[240px]">${esc(e.desc)}</td></tr>`).join('')}</tbody></table></div>`;
  } else html += `<p class="text-sm text-gray-500">No capital events recorded${fySel.value === 'all' ? '' : ' in FY' + fySel.value}.</p>`;
  html += '</div>';
  // ATO rulings
  html += `<div class="${BLOCK}">${blockHead('ATO Rulings', s.ruls.length + ' listed · all years', 'Class and product rulings the booklets list for this security')}`;
  if (s.ruls.length) {
    html += '<div class="grid gap-3">' + s.ruls.map(r => { const link = rulUrl(r.id); return `<article class="border border-gray-200 rounded-xl p-4 bg-gray-50">
      <div class="flex flex-wrap items-center gap-1.5 mb-2"><span class="font-extrabold text-qbNavy-600 text-sm mr-1">${esc(r.id || 'Ruling')}</span>${r.tags.map(tg => `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">${tg}</span>`).join('')}
      ${link ? `<a class="ml-auto text-xs font-bold text-qbTeal-600 hover:underline no-print" href="${link}" target="_blank" rel="noopener">Open on ATO legal database ↗</a>` : ''}</div>
      <p class="text-[13px] text-gray-700 leading-relaxed max-w-[110ch]">${esc(r.text)}</p></article>`; }).join('') + '</div>';
  } else html += '<p class="text-sm text-gray-500">No ATO rulings listed for this security.</p>';
  html += '</div>';
  curRows = rows;
  if (bodyOnly) { $('dl-dbody').innerHTML = html; return; }
  detail.innerHTML = head + '<div id="dl-dbody">' + html + '</div>';

  const ui = $('dl-units');
  ui.addEventListener('input', () => { units = Math.max(0, parseFloat(ui.value.replace(/[^\d.]/g, '')) || 0); renderDetail(true); });
  ui.addEventListener('blur', () => { ui.value = units ? units.toLocaleString('en-AU') : ''; });
  $('dl-copyBtn').addEventListener('click', () => copyRows(s, curRows));
}

function notify(msg){ if (typeof showToast === 'function') showToast(msg); }
function copyRows(s, rows){
  const head = ['Code','Company','FY','Type','Amount (c)','Record date','Pay date','Frank %','Franked (c)','Unfranked (c)','Franking credit (c)','DRP price','Notes'];
  if (units) head.push('Units','Cash ($)','Franking credit ($)');
  const lines = [head.join('\t')].concat(rows.map(r => {
    const a = [s.code, s.name, 'FY' + r.fy, PAY_TYPE[r.t], r.amt.toFixed(4), fmtD(r.rec), fmtD(r.pay), r.frank.toFixed(2), r.franked.toFixed(4), r.unfranked.toFixed(4), r.credit.toFixed(4), r.drp ? r.drp.toFixed(4) : '', r.notes];
    if (units) a.push(units, (r.amt * units / 100).toFixed(2), (r.credit * units / 100).toFixed(2));
    return a.join('\t');
  }));
  const text = lines.join('\n');
  const done = () => notify(`Copied ${rows.length} row${rows.length === 1 ? '' : 's'}. Paste into Excel.`);
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy') ? done() : notify('Copy was blocked. Select the table and copy it manually.'); } catch (e) { notify('Copy was blocked. Select the table and copy it manually.'); } ta.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
}

// start with an empty search
q.value = '';
search();
select(null);
q.focus();
}

// --- Lazy loader: fetch dividends.json the first time the tab is opened ---
let dlLoadState = null; // null | 'loading' | 'ready'
function dlSetInputs(on){ ['dl-q','dl-fy'].forEach(id => { document.getElementById(id).disabled = !on; }); }
function loadDividends(){
  if (dlLoadState) return;
  dlLoadState = 'loading';
  dlSetInputs(false);
  const detail = document.getElementById('dl-detail'), list = document.getElementById('dl-results');
  list.innerHTML = '<li class="px-4 py-8 text-center text-sm text-gray-500">Loading…</li>';
  detail.innerHTML = '<div class="px-4 py-16 text-center text-sm text-gray-500 flex flex-col items-center gap-3"><span class="w-8 h-8 border-4 border-qbNavy-100 border-t-qbTeal-500 rounded-full animate-spin"></span>Loading dividend data…</div>';
  fetch('data/dividends.json?v=' + DL_DATA_VERSION)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => { dlLoadState = 'ready'; dlSetInputs(true); dlInit(data); })
    .catch(err => {
      dlLoadState = null; dlSetInputs(true);
      const local = location.protocol === 'file:';
      list.innerHTML = '';
      detail.innerHTML = `<div class="p-6"><div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm space-y-3">
        <p><strong>Couldn't load the dividend data</strong> (${String(err.message || err).replace(/[<>&]/g, '')}).</p>
        <p>${local ? 'This page was opened directly from your computer, and browsers block it from reading <code>data/dividends.json</code> that way. Open it from your Vercel site instead, or run a local web server in the folder.' : 'Check that <code>dividends.json</code> has been uploaded to the <code>data</code> folder.'}</p>
        <button type="button" onclick="loadDividends()" class="bg-qbNavy-600 hover:bg-qbNavy-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition">Try again</button></div></div>`;
    });
}

registerTab('dividends', {
    onShow() { loadDividends(); }
});
