// SMALL BUSINESS CGT CONCESSIONS TAB (Division 152 ITAA 1997)
// Guided flow: capital gain -> losses -> discount -> basic conditions (entities, active asset test,
// $6m net asset test, $2m turnover test, stakeholders / 90% test) -> 15 year exemption ->
// 50% active asset reduction -> retirement exemption -> roll-over -> net capital gain + printable report.
// Thresholds come from shared/sbc-data.js (SBC_DATA / SBC_RULES), kept separate from TAX_DATA.
// Everything is wrapped in one function so no names leak into the shared page.
(function () {
'use strict';

const STORE_KEY = 'qb-sbc-draft-v1';
const ROOT = () => document.getElementById('sbc-tool');
const $ = sel => ROOT().querySelector(sel);

/* ======================= helpers ======================= */
const num = v => { if (v === '' || v == null) return 0; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const has = v => v !== '' && v != null && String(v).trim() !== '';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => (n < -0.5 ? '-' : '') + '$' + Math.round(Math.abs(n || 0)).toLocaleString('en-AU');
const pct = (n, d = 2) => has(n) && isFinite(n) ? (Math.round(n * 100 * Math.pow(10, d)) / Math.pow(10, d)) + '%' : '—';
const fmtNum = v => has(v) ? num(v).toLocaleString('en-AU', { maximumFractionDigits: 2 }) : '';
const DAY = 864e5;
const D = s => { if (!s) return null; const p = String(s).split('-').map(Number); if (p.length !== 3 || !p[0] || p[0] < 1900 || p[0] > 2200) return null; return Date.UTC(p[0], p[1] - 1, p[2]); };
// Australian dd/mm/yyyy <-> ISO yyyy-mm-dd
const isoToAu = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const auToIso = v => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || ''); if (!m) return null; const d = +m[1], mo = +m[2], y = +m[3]; if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return null; if (d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null; return `${m[3]}-${m[2]}-${m[1]}`; };
// Tidy typed text into dd/mm/yyyy as the user types (slashes added automatically)
function maskDate(raw, deleting) {
    const parts = String(raw).split(/[^0-9]+/);
    let digits = '';
    if (parts.length > 1) { parts.forEach((pt, i) => { if (i < parts.length - 1 && i < 2 && pt.length === 1) pt = '0' + pt; digits += pt; }); }
    else digits = parts[0];
    digits = digits.slice(0, 8);
    let out = digits.slice(0, 2);
    if (digits.length > 2) out += '/' + digits.slice(2, 4); else if (digits.length === 2 && !deleting) out += '/';
    if (digits.length > 4) out += '/' + digits.slice(4, 8); else if (digits.length === 4 && !deleting) out += '/';
    return out;
}
const iso = t => t == null ? '' : new Date(t).toISOString().slice(0, 10);
const fdate = t => t == null ? '—' : new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const daysIncl = (a, b) => (a == null || b == null || b < a) ? 0 : Math.round((b - a) / DAY) + 1;
const addYears = (t, n) => { if (t == null) return null; const d = new Date(t); let y = d.getUTCFullYear() + n, m = d.getUTCMonth(), dd = d.getUTCDate(); const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return Date.UTC(y, m, Math.min(dd, last)); };
const addDays = (t, n) => t == null ? null : t + n * DAY;
const later = (...ts) => { const v = ts.filter(t => t != null); return v.length ? Math.max(...v) : null; };
const ageAt = (dob, t) => { if (dob == null || t == null) return null; const a = new Date(dob), b = new Date(t); let y = b.getUTCFullYear() - a.getUTCFullYear(); if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) y--; return y; };
const fyOf = t => { const d = new Date(t); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear(); };
const todayIso = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10); };
const yes = v => v === 'yes', no = v => v === 'no';
let uidN = 1; const uid = () => uidN++;

// Merge date ranges and count the days that fall inside [lo, hi]
function overlapDays(ranges, lo, hi) {
    if (lo == null || hi == null || hi < lo) return 0;
    const iv = ranges.map(r => [Math.max(D(r.from) ?? lo, lo), Math.min(D(r.to) ?? hi, hi)]).filter(r => r[1] >= r[0]).sort((a, b) => a[0] - b[0]);
    let tot = 0, cs = null, ce = null;
    iv.forEach(([s, e]) => { if (cs == null) { cs = s; ce = e; } else if (s <= ce + DAY) { ce = Math.max(ce, e); } else { tot += daysIncl(cs, ce); cs = s; ce = e; } });
    if (cs != null) tot += daysIncl(cs, ce);
    return tot;
}

/* ======================= reference lists ======================= */
const TP_TYPES = [['individual', 'Individual'], ['company', 'Company'], ['dtrust', 'Discretionary trust'], ['utrust', 'Unit / fixed trust'], ['super', 'Complying super fund']];
const TYPE_NAME = Object.fromEntries(TP_TYPES);
const ASSET_KINDS = [['land', 'Land / buildings'], ['goodwill', 'Goodwill / other intangible'], ['shares', 'Shares in a company'], ['units', 'Units / interest in a trust'], ['partnership', 'Right to partnership income or capital'], ['other', 'Other CGT asset'], ['depreciating', 'Depreciating asset (Div 40)'], ['stock', 'Trading stock / revenue asset']];
const KIND_NAME = Object.fromEntries(ASSET_KINDS);
const EVENTS = [['A1', 'A1 – Disposal of a CGT asset'], ['B1', 'B1 – Use and enjoyment before title passes'], ['C1', 'C1 – Loss or destruction'], ['C2', 'C2 – Cancellation, surrender etc.'], ['C3', 'C3 – End of option to acquire shares'], ['D1', 'D1 – Creating contractual or other rights'], ['D2', 'D2 – Granting an option'], ['D3', 'D3 – Granting a right to mining income'], ['E1', 'E1 – Creating a trust over an asset'], ['E2', 'E2 – Transferring an asset to a trust'], ['E4', 'E4 – Capital payment for trust interest'], ['E9', 'E9 – Creating a trust over future property'], ['F1', 'F1 – Granting a lease'], ['F2', 'F2 – Granting a long-term lease'], ['F5', 'F5 – Lessor receives payment for changing a lease'], ['H2', 'H2 – Receipt for event relating to a CGT asset'], ['J2', 'J2 – Change in status of replacement asset'], ['J5', 'J5 – Failure to acquire replacement asset'], ['J6', 'J6 – Replacement asset cost less than rolled-over gain'], ['K6', 'K6 – Pre-CGT shares or trust interest'], ['K7', 'K7 – Depreciating asset, non-taxable use'], ['K10', 'K10 – Short-term forex gain'], ['other', 'Other CGT event']];
const DISC_EXCL = new Set(['D1', 'D2', 'D3', 'E9', 'F1', 'F2', 'F5', 'H2', 'J2', 'J5', 'J6', 'K10']);
const ENT_TYPES = [['individual', 'Individual'], ['company', 'Company'], ['dtrust', 'Discretionary trust'], ['utrust', 'Unit / fixed trust'], ['partnership', 'Partnership']];
const REL = [['connected', 'Connected entity'], ['affiliate', 'Affiliate'], ['spouse', 'Spouse / child under 18 (s152-47 affiliate)'], ['affconn', 'Entity connected with an affiliate'], ['other', 'Related, but not connected or an affiliate']];
const REL_NAME = Object.fromEntries(REL);
const ASSET_TREAT = [['inc', 'Include'], ['home', 'Main residence (income-use % only)'], ['personal', 'Exclude – personal use asset'], ['super', 'Exclude – super / life insurance'], ['connint', 'Exclude – interest in a connected entity'], ['notbiz', 'Exclude – not used in business of taxpayer / connected entity'], ['affonly', 'Exclude – business of entity connected only via an affiliate']];
const TREAT_NAME = Object.fromEntries(ASSET_TREAT);
const BS_CATS = [['active', 'Active asset'], ['cashConn', 'Cash / financial instrument inherently connected with business'], ['cashNot', 'Cash / financial instrument – not connected'], ['nonactive', 'Non-active asset (passive investment, rental, etc.)'], ['sub', 'Interest in a subsidiary company / trust (look-through)']];
const BS_NAME = Object.fromEntries(BS_CATS);
const DEEMED_WHY = [['', 'Select…'], ['compulsory', 'Roll-over: compulsory acquisition, loss or destruction (Subdiv 124-B)'], ['marriage', 'Marriage / relationship breakdown roll-over'], ['restructure', 'Small business restructure roll-over (Subdiv 328-G)'], ['fsr', 'FSR transition replacement'], ['inherited', 'Inherited asset (deceased estate)'], ['other', 'Other']];
const CB = {
    e2: [['adv', 'Remuneration for surveyor, valuer, auctioneer, accountant, broker, agent, consultant or legal adviser'], ['transfer', 'Costs of transfer'], ['duty', 'Stamp duty or similar duties'], ['market', 'Advertising or marketing'], ['valuation', 'Valuation or apportionment for CGT purposes'], ['search', 'Search fees relating to the asset'], ['convey', 'Conveyancing kit'], ['borrow', 'Borrowing expenses (loan application, mortgage discharge)'], ['other', 'Other incidental costs']],
    e3: [['interest', 'Interest on money borrowed to acquire the asset'], ['maint', 'Maintaining, repairing or insuring the asset'], ['rates', 'Rates or land tax'], ['refi', 'Interest on refinancing the acquisition borrowing'], ['capint', 'Interest on money borrowed for capital expenditure'], ['other', 'Other ownership costs']],
    e4: [['improve', 'Capital expenditure to increase or preserve value'], ['install', 'Capital expenditure to install or move the asset']],
    red: [['itc', 'Input tax credits claimed (if not already excluded)'], ['deduct', 'Deductions claimed for amounts included above'], ['capworks', 'Capital works deductions (acquired after 13 May 1997)'], ['recoup', 'Capital expenditure recouped']]
};

/* ======================= state ======================= */
function blankState() {
    const obj = keys => Object.fromEntries(keys.map(k => [k[0], '']));
    return {
        v: 1,
        client: { name: '', code: '', preparer: '', prepDate: todayIso(), reviewer: '', revDate: '' },
        tp: { type: 'individual', name: '', resident: 'yes', business: '', partner: 'no', dob: '', incap: '', retireConn: '', priorUsed: '', choiceDate: '', proceedsDate: '' },
        asset: { desc: '', kind: 'land', event: 'A1', occurred: '', owner: '', eventDate: '', acqDate: '', deemed: 'no', deemedDate: '', deemedWhy: '', d1conn: '' },
        gain: { proceeds: '', e1: '', e2: obj(CB.e2), e3: obj(CB.e3), e4: obj(CB.e4), e5: '', red: obj(CB.red), rcbE3: '', lossCur: '', lossCf: '' },
        disc: { indexation: '', i300: '', i10: '', i50cb: '', i50gain: '', trustAssess: '', foreign: 'no', fperiods: [], mvChoice: 'no', mv2012: '', override: '' },
        noEnts: false,
        entities: [],
        tpm: { assets: [], liabs: [], to: { prior: '', dPrior: '', cur: '', dCur: '' } },
        sbe: { y2: '', likely: '' },
        aat: { periods: [], ceased: 'no', ceasedDate: '', fin: '', passive: '', passiveExc: '', resident: '', bs: [] },
        objType: '',
        people: [],
        shr: { bizBefore: '', objEnt: '', objNet: '', objTurn: '', membership: '' },
        alt: { partnerAsset: '', passive: '', partnerPassive: '' },
        dec: { deceased: '', could: '', within2: '' },
        f15: { siYears: '', dtLoss: '' },
        conc: { apply50: 'yes', retAmt: '', rollAmt: '', repl: [] },
        notes: {}
    };
}
let S = blankState();
let R = {};
let step = 'setup';

const TPL = {
    entity: () => ({ id: uid(), name: '', type: 'company', rel: 'other', relAuto: true, connFrom: '', connTo: '', objGroup: false, ctl: { pct: '', affPct: '', via: '', viaPct: '', comm: '', wish: '', dist: '', aff: '' }, assets: [], liabs: [], to: { prior: '', dPrior: '', cur: '', dCur: '' } }),
    asset: path => ({ desc: '', mv: '', treat: /entities\.\d+/.test(path) && ['affiliate', 'spouse', 'affconn'].includes(getP(path.replace(/\.assets$/, '.rel'))) ? 'notbiz' : 'inc', use: '' }),
    liab: () => ({ desc: '', amt: '', treat: 'inc' }),
    period: () => ({ from: '', to: '', user: 'tp', note: '' }),
    fperiod: () => ({ from: '', to: '' }),
    bs: () => ({ desc: '', cat: 'active', mv: '', purpose: false, subPct: '', subActive: '', subTotal: '' }),
    person: () => ({ id: uid(), name: '', dob: '', spouseOf: '', tpV: '', tpD: '', tpC: '', tpI: '', tpInd: [], obV: '', obD: '', obC: '', obI: '', obInd: [], incap: '', retire: '', priorUsed: '', retPct: '' }),
    ind: () => ({ via: '', a: '', b: '' }),
    repl: () => ({ desc: '', kind: 'asset', acq: '', active: '', cost: '' })
};

function getP(path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S); }
function setP(path, val) { const ks = path.split('.'); let o = S; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = val; }

/* ======================= calculation engine ======================= */
function compute() {
    const r = { flags: [] };
    const tp = S.tp, a = S.asset, RU = SBC_RULES;
    r.type = tp.type;
    r.isInd = tp.type === 'individual'; r.isCo = tp.type === 'company'; r.isDT = tp.type === 'dtrust';
    r.isTrust = tp.type === 'dtrust' || tp.type === 'utrust'; r.isSuper = tp.type === 'super';
    r.isEntity = !r.isInd; // company, trust or fund
    r.equity = a.kind === 'shares' || a.kind === 'units';
    r.ev = D(a.eventDate); r.acq = D(a.acqDate);
    r.start = (yes(a.deemed) && D(a.deemedDate)) || r.acq;
    r.fy = r.ev ? fyOf(r.ev) : fyOf(Date.now());
    const years = Object.keys(SBC_DATA).map(Number).sort((x, y) => x - y);
    const near = SBC_DATA[r.fy] ? r.fy : (r.fy < years[0] ? years[0] : years[years.length - 1]);
    r.rt = SBC_DATA[near];
    r.fyName = `${r.fy - 1} - ${r.fy} (FY${String(r.fy).slice(2)})` + (r.ev ? '' : ' – enter event date');
    r.rtWarn = r.ev && !SBC_DATA[r.fy] ? `No thresholds stored for ${r.fyName}; using the ${r.rt.name} figures. Add the year to shared/sbc-data.js.` : '';
    r.reform = r.ev != null && r.ev >= D(RU.dates.cgtReform);
    r.post2018 = r.ev != null && r.ev >= D(RU.dates.sharesRules);
    r.ownDays = daysIncl(r.start, r.ev);
    r.ownYears = r.ownDays / 365.25;
    r.ownTxt = r.ownDays ? r.ownDays.toLocaleString() + ' days (' + r.ownYears.toFixed(2) + ' yrs)' : '—';
    r.preCGT = r.acq != null && r.acq < D(RU.dates.preCGT);
    r.T = { mnav: r.rt.mnav, sbe: r.rt.sbeTurnover, red: r.rt.reductionTurnover, ret: r.rt.retirementLimit };

    /* ---- 1. CGT event & asset gate ---- */
    const gi = [];
    gi.push({ t: 'A CGT event happened to the asset in the income year', s: yes(a.occurred) ? 'pass' : no(a.occurred) ? 'fail' : 'inc', ref: '104-5' });
    gi.push({ t: 'Concessions are being applied by the entity that had the CGT event', s: yes(a.owner) ? 'pass' : no(a.owner) ? 'fail' : 'inc', ref: '152-10' });
    gi.push({ t: 'Asset is taxed under the CGT rules (not a depreciating asset or trading stock)', s: (a.kind === 'depreciating' || a.kind === 'stock') ? 'fail' : 'pass', ref: '118-24' });
    gi.push({ t: 'Gain did not arise from CGT event K7', s: a.event === 'K7' ? 'fail' : 'pass', ref: '104-235' });
    gi.push({ t: 'Acquisition and CGT event dates entered', s: (r.ev && r.acq && r.ev >= r.acq) ? 'pass' : 'inc' });
    r.gate = { items: gi, s: worst(gi) };
    if (r.preCGT && a.event !== 'K6') r.flags.push('The asset was acquired before 20 September 1985. A capital gain is generally disregarded unless it is deemed acquired later, or CGT event K6 applies.');

    /* ---- 2. capital gain ---- */
    const g = S.gain, sum = o => Object.values(o).reduce((t, v) => t + num(v), 0);
    r.cb1 = num(g.e1); r.cb2 = sum(g.e2); r.cb3 = sum(g.e3); r.cb4 = sum(g.e4); r.cb5 = num(g.e5); r.cbRed = sum(g.red);
    r.cb = r.cb1 + r.cb2 + r.cb3 + r.cb4 + r.cb5 - r.cbRed;
    r.rcb = r.cb1 + r.cb2 + num(g.rcbE3) + r.cb4 + r.cb5 - r.cbRed;
    r.rcbv = { e1: r.cb1, e5: r.cb5 };
    ['e2', 'e4', 'red'].forEach(grp => CB[grp].forEach(([k]) => { r.rcbv[grp + '_' + k] = (grp === 'red' ? -1 : 1) * num(g[grp][k]); }));
    r.proceeds = num(g.proceeds);
    r.diff = r.proceeds - r.cb;
    r.gross = Math.max(r.diff, 0);
    r.loss = r.diff < 0 ? Math.max(r.rcb - r.proceeds, 0) : 0;
    r.lossAvail = num(g.lossCur) + num(g.lossCf);
    r.gainEntered = has(g.proceeds);
    r.gainS = !r.gainEntered ? 'inc' : r.gross > 0 ? 'pass' : 'fail';

    /* ---- 3. discount ---- */
    const dz = S.disc, di = [];
    let dpct = RU.discount[tp.type] || 0;
    const eligEnt = !r.isCo;
    di.push({ t: 'Taxpayer is an individual, trust or complying super fund', s: eligEnt ? 'pass' : 'fail', ref: '115-10' });
    const held12 = r.ev != null && r.start != null ? r.ev > addYears(r.start, 1) : null;
    di.push({ t: 'Asset held for at least 12 months (excluding acquisition and event days)', s: held12 == null ? 'inc' : held12 ? 'pass' : 'fail', ref: '115-25' });
    di.push({ t: 'CGT event is not one excluded from the discount (D1, D2, D3, E9, F1, F2, F5, H2, J2, J5, J6, K10)', s: DISC_EXCL.has(a.event) ? 'fail' : 'pass', ref: '115-25(3)' });
    di.push({ t: 'CGT event after 11:45am (ACT) 21 Sep 1999', s: r.ev == null ? 'inc' : r.ev >= D('1999-09-21') ? 'pass' : 'fail', ref: '115-15' });
    di.push({ t: 'Indexation method not used to calculate the gain', s: yes(dz.indexation) ? 'fail' : no(dz.indexation) ? 'pass' : (r.acq != null && r.acq >= D('1999-09-21')) ? 'pass' : 'inc', ref: '115-20' });
    if (r.equity && eligEnt) {
        let s = 'inc';
        if (yes(dz.i300)) s = 'pass';
        else if (no(dz.i300)) {
            if (no(dz.i10)) s = 'pass';
            else if (yes(dz.i10)) { if (yes(dz.i50cb)) s = 'fail'; else if (no(dz.i50cb)) s = yes(dz.i50gain) ? 'fail' : no(dz.i50gain) ? 'pass' : 'inc'; }
        }
        di.push({ t: 'Share / trust interest integrity rule satisfied', s, ref: '115-45' });
    }
    if (r.isTrust || r.isSuper) di.push({ t: 'Gain is not assessed to the trustee under s99A, 98(3) or 98(4)', s: yes(dz.trustAssess) ? 'fail' : no(dz.trustAssess) ? 'pass' : 'inc', ref: '115-220' });
    r.discFactor = null;
    if (r.isInd && yes(dz.foreign) && r.ev != null && r.start != null) {
        const cut = D('2012-05-09');
        const testStart = Math.max(r.start, cut);
        const inel = overlapDays(dz.fperiods, testStart, r.ev);
        if (yes(dz.mvChoice) && r.start < cut && r.gross > 0) {
            const preGain = Math.min(Math.max(num(dz.mv2012) - r.cb, 0), r.gross);
            const preFrac = preGain / r.gross;
            const postDays = daysIncl(cut, r.ev);
            r.discFactor = { method: 'mv', inel, postDays, preFrac, f: preFrac + (1 - preFrac) * (postDays ? 1 - inel / postDays : 1) };
        } else {
            r.discFactor = { method: 'days', inel, total: r.ownDays, f: r.ownDays ? 1 - inel / r.ownDays : 1 };
        }
        dpct = dpct * r.discFactor.f;
    }
    r.discItems = di;
    r.discOk = !di.some(x => x.s === 'fail');
    r.discInc = di.some(x => x.s === 'inc');
    r.discOverride = has(dz.override);
    r.discPct = r.discOverride ? num(dz.override) / 100 : (r.discOk ? dpct : 0);
    r.discS = r.isCo ? 'na' : r.discOverride ? 'warn' : !r.discOk ? 'fail' : r.discInc ? 'inc' : 'pass';

    /* ---- entities, $6m test, turnover ---- */
    const ents = [{ id: 'tp', name: tp.name || 'Taxpayer', type: tp.type, rel: 'tp', data: S.tpm }].concat(S.entities.map(e => ({ id: e.id, name: e.name || 'Unnamed entity', type: e.type, rel: e.rel, data: e, ctl: e.ctl })));
    r.ents = {};
    let mTot = 0, anyM = false, toP = 0, toC = 0, anyT = false;
    const fyWin = fy => [D(`${fy - 1}-07-01`), D(`${fy}-06-30`)];
    const connIn = (e, lo, hi) => { if (e.id === 'tp' || lo == null) return true; const f = D(e.data.connFrom), t = D(e.data.connTo); return (f == null || f <= hi) && (t == null || t >= lo); };
    const connAll = (e, lo, hi) => { if (e.id === 'tp' || lo == null) return true; const f = D(e.data.connFrom), t = D(e.data.connTo); return (f == null || f <= lo) && (t == null || t >= hi); };
    const [cLo, cHi] = fyWin(r.fy), [pLo, pHi] = fyWin(r.fy - 1);
    ents.forEach(e => {
        const before = r.ev != null ? r.ev - DAY : null;
        const connAtEvent = connIn(e, before, before);
        const counts = e.rel !== 'other' && connAtEvent;
        let incl = 0, excl = 0, liab = 0;
        (e.data.assets || []).forEach(x => {
            const mv = num(x.mv); if (has(x.mv)) anyM = true;
            let val = 0;
            if (x.treat === 'inc') val = mv;
            else if (x.treat === 'home') val = mv * Math.min(Math.max(num(x.use), 0), 100) / 100;
            incl += val; excl += mv - val;
        });
        (e.data.liabs || []).forEach(x => { if (x.treat !== 'exc') liab += num(x.amt); });
        const net = incl - liab;
        const relT = ['tp', 'connected', 'affiliate', 'spouse'].includes(e.rel);
        const inP = relT && connIn(e, pLo, pHi), inC = relT && connIn(e, cLo, cHi);
        const partP = inP && !connAll(e, pLo, pHi), partC = inC && !connAll(e, cLo, cHi);
        const tcounts = inP || inC;
        const t = e.data.to || {};
        const pNet = num(t.prior) - num(t.dPrior), cNet = num(t.cur) - num(t.dCur);
        if (has(t.prior) || has(t.cur)) anyT = true;
        r.ents[e.id] = { name: e.name, rel: e.rel, type: e.type, incl, excl, liab, net, counts, connAtEvent, tcounts, inP, inC, partP, partC, pNet, cNet, sugg: e.ctl ? ctlSuggest(e.data) : null };
        if (counts) mTot += net;
        if (inP) toP += pNet;
        if (inC) toC += cNet;
    });
    r.entList = ents;
    r.entS = (S.entities.length || S.noEnts) ? 'pass' : 'inc';
    r.mnavTotal = mTot;
    r.mnavPass = anyM ? mTot <= r.T.mnav : null;
    r.toPrior = toP; r.toCur = toC;
    const sbe = T => {
        const steps = [];
        const biz = tp.business;
        if (!yes(biz)) return { s: no(biz) ? 'fail' : 'inc', steps: [{ t: 'Carrying on a business', s: no(biz) ? 'fail' : 'inc' }], why: no(biz) ? 'Not carrying on a business' : 'Business question not answered' };
        steps.push({ t: 'Carrying on a business', s: 'pass' });
        const hasP = anyT && ents.some(e => has((e.data.to || {}).prior));
        const hasC = anyT && ents.some(e => has((e.data.to || {}).cur));
        const p1 = hasP ? toP < T : null;
        steps.push({ t: `Prior year aggregated turnover ${hasP ? money(toP) : '—'} < ${money(T)}`, s: p1 == null ? 'inc' : p1 ? 'pass' : 'fail' });
        if (p1) return { s: 'pass', steps, why: 'Prior year aggregated turnover under threshold' };
        const y2 = has(S.sbe.y2) ? num(S.sbe.y2) : null, lk = has(S.sbe.likely) ? num(S.sbe.likely) : null;
        const bothPrevOver = hasP && y2 != null ? (toP >= T && y2 >= T) : null;
        let p2 = null;
        if (lk != null) p2 = lk < T && bothPrevOver === false;
        steps.push({ t: `Current year likely turnover ${lk != null ? money(lk) : '—'} < ${money(T)} and not ≥ threshold in both prior 2 years`, s: p2 == null ? (lk != null && bothPrevOver == null ? 'inc' : 'inc') : p2 ? 'pass' : 'fail' });
        if (p2) return { s: 'pass', steps, why: 'Likely current-year turnover under threshold' };
        const p3 = hasC ? toC < T : null;
        steps.push({ t: `Current year actual aggregated turnover ${hasC ? money(toC) : '—'} < ${money(T)}`, s: p3 == null ? 'inc' : p3 ? 'pass' : 'fail' });
        if (p3) return { s: 'pass', steps, why: 'Actual current-year turnover under threshold' };
        return { s: steps.some(x => x.s === 'inc') ? 'inc' : 'fail', steps, why: 'Turnover thresholds not met' };
    };
    r.sbe = sbe(r.T.sbe);
    r.sbe10 = r.T.red !== r.T.sbe ? sbe(r.T.red) : r.sbe;
    r.sbePass = r.sbe.s === 'pass';
    r.mnavS = r.mnavPass == null ? 'inc' : r.mnavPass ? 'pass' : (r.sbePass ? 'warn' : 'fail');
    r.sbeS = r.sbe.s === 'fail' && r.mnavPass ? 'warn' : r.sbe.s;

    /* ---- active asset test ---- */
    const at = S.aat;
    r.relEnd = yes(at.ceased) && D(at.ceasedDate) ? D(at.ceasedDate) : r.ev;
    r.relDays = daysIncl(r.start, r.relEnd);
    r.activeDays = overlapDays(at.periods.map(x => {
        const en = S.entities.find(e => String(e.id) === String(x.user));
        if (!en) return x;
        const f = D(en.connFrom), t = D(en.connTo), a = D(x.from), b = D(x.to);
        return { from: iso(f != null && (a == null || f > a) ? f : a), to: iso(t != null && (b == null || t < b) ? t : b) };
    }), r.start, r.relEnd);
    r.periodsClipped = at.periods.some(x => { const en = S.entities.find(e => String(e.id) === String(x.user)); return en && (has(en.connFrom) || has(en.connTo)); });
    r.longHold = r.ownYears > RU.longHoldYears;
    r.needDays = r.longHold ? Math.ceil(RU.longHoldActiveYears * 365.25) : Math.ceil(r.relDays / 2);
    const ai = [];
    if (a.event === 'D1') {
        ai.push({ t: 'Right created (event D1) is inherently connected with an asset that passes the active asset test', s: yes(a.d1conn) ? 'pass' : no(a.d1conn) ? 'fail' : 'inc', ref: '152-12' });
    } else {
        const timeOk = r.relDays > 0 && at.periods.length ? r.activeDays >= r.needDays : null;
        ai.push({ t: `Active for ${r.longHold ? 'at least 7½ years (held over 15 years)' : 'at least half of the relevant period'}: ${r.activeDays.toLocaleString()} of ${r.needDays.toLocaleString()} days needed`, s: timeOk == null ? 'inc' : timeOk ? 'pass' : 'fail', ref: '152-35' });
        ai.push({ t: 'Asset is not a financial instrument', s: yes(at.fin) ? 'fail' : no(at.fin) ? 'pass' : (r.equity ? 'pass' : 'inc'), ref: '152-40(4)' });
        ai.push({ t: 'Main use is not to derive interest, annuity, rent, royalties or forex gains (or an exception applies)', s: yes(at.passive) ? (yes(at.passiveExc) ? 'pass' : no(at.passiveExc) ? 'fail' : 'inc') : no(at.passive) ? 'pass' : 'inc', ref: '152-40(4)(e)' });
        if (r.equity) {
            let nmr = 0, den = 0;
            at.bs.forEach(b => {
                const mv = num(b.mv);
                if (b.cat === 'sub') {
                    const p = num(b.subPct) / 100;
                    if (has(b.subTotal)) { den += p * num(b.subTotal); nmr += p * num(b.subActive); }
                    else { den += mv; }
                } else {
                    den += mv;
                    if (b.cat === 'active') nmr += mv;
                    if (b.cat === 'cashConn' && !(r.post2018 && b.purpose)) nmr += mv;
                }
            });
            r.e80 = { nmr, den, pct: den ? nmr / den : null };
            ai.push({ t: 'Company / trust is an Australian resident', s: yes(at.resident) ? 'pass' : no(at.resident) ? 'fail' : 'inc', ref: '152-40(3)' });
            ai.push({ t: `80% test: active assets ${den ? pct(nmr / den, 1) : '—'} of total market value`, s: !den ? 'inc' : nmr / den >= RU.activeAssetPct ? 'pass' : 'fail', ref: '152-40(3)' });
        }
    }
    r.aatItems = ai; r.aatS = worst(ai);

    /* ---- people: significant individuals & stakeholders ---- */
    r.objType = S.objType || (a.kind === 'shares' ? 'company' : 'fixed');
    r.needPeople = r.isEntity || r.equity;
    // Small business participation % = direct (smallest of voting / dividend or income / capital) + indirect
    // Indirect = sum over interposed entities of (individual's % in that entity × that entity's % in this one) — s152-70
    const indOf = (rows, legacy) => (rows || []).reduce((t, x) => t + num(x.a) * num(x.b) / 100, 0) + num(legacy);
    const partOf = (p, pre, isCo) => {
        const vals = (isCo ? [p[pre + 'V'], p[pre + 'D'], p[pre + 'C']] : [p[pre + 'D'], p[pre + 'C']]).filter(has).map(num);
        const rows = (p[pre + 'Ind'] || []).filter(x => has(x.a) && has(x.b));
        if (!vals.length && !rows.length && !has(p[pre + 'I'])) return { part: null, direct: null, ind: 0, err: '' };
        const direct = vals.length ? Math.min(...vals) : 0, ind = indOf(rows, p[pre + 'I']);
        const all = (isCo ? [p[pre + 'V'], p[pre + 'D'], p[pre + 'C']] : [p[pre + 'D'], p[pre + 'C']]).filter(has).map(num).concat((p[pre + 'Ind'] || []).flatMap(x => [x.a, x.b]).filter(has).map(num));
        let err = '';
        if (all.some(v => v < 0 || v > 100)) err = 'A percentage is below 0% or above 100%.';
        else if (direct + ind > 100 + 1e-9) err = `Direct ${pct(direct / 100, 2)} + indirect ${pct(ind / 100, 2)} is more than 100%.`;
        return { part: Math.min(direct + ind, 100) / 100, direct: direct / 100, ind: ind / 100, err };
    };
    r.people = {};
    S.people.forEach(p => {
        const tp_ = partOf(p, 'tp', r.isCo), ob_ = partOf(p, 'ob', r.objType === 'company');
        const tpPart = tp_.part, obPart = ob_.part;
        r.people[p.id] = { name: p.name || 'Unnamed', tpPart, obPart, tpD: tp_, obD: ob_, siTp: tpPart != null && tpPart >= RU.significantPct, siOb: obPart != null && obPart >= RU.significantPct, age: ageAt(D(p.dob), r.ev) };
    });
    // Totals across individuals: dividend / income and capital can't exceed 100%; voting can (joint holdings count 100% each)
    const totals = pre => { const t = { V: 0, D: 0, C: 0 }; S.people.forEach(p => ['V', 'D', 'C'].forEach(k => { t[k] += num(p[pre + k]); })); return t; };
    r.pTot = { tp: totals('tp'), ob: totals('ob') };
    r.pErr = S.people.some(p => r.people[p.id].tpD.err || r.people[p.id].obD.err);
    S.people.forEach(p => {
        const me = r.people[p.id], sp = p.spouseOf ? r.people[p.spouseOf] : null;
        me.stTp = me.siTp || (!!sp && sp.siTp && (me.tpPart || 0) > 0);
        me.stOb = me.siOb || (!!sp && sp.siOb && (me.obPart || 0) > 0);
    });
    const tpRow = S.people.find(p => p.isTp);
    if (r.equity) {
        if (r.isInd) {
            const me = tpRow ? r.people[tpRow.id] : null;
            r.stakeS = !me || me.obPart == null ? 'inc' : me.stOb ? 'pass' : 'fail';
            r.stakeWhy = me ? (me.siOb ? 'Taxpayer is a significant individual of the entity sold' : me.stOb ? 'Taxpayer is the spouse of a significant individual with a participation interest' : 'Taxpayer is not a CGT concession stakeholder') : '';
        } else {
            const tot = S.people.filter(p => r.people[p.id].stOb).reduce((t, p) => t + (r.people[p.id].tpPart || 0), 0);
            r.ninety = tot;
            r.stakeS = !S.people.length ? 'inc' : tot >= RU.ninetyPct - 1e-9 ? 'pass' : 'fail';
            r.stakeWhy = `Stakeholders of the entity sold hold ${pct(tot, 2)} of the taxpayer (90% needed)`;
        }
    }
    r.siTpAny = S.people.some(p => r.people[p.id].siTp);
    r.peopleS = !r.needPeople ? 'na' : r.pErr ? 'fail' : r.equity ? r.stakeS : !S.people.length ? 'inc' : r.siTpAny ? 'pass' : 'warn';

    /* ---- basic conditions ---- */
    const bi = [];
    bi.push({ k: 'B1', t: 'A CGT event happened in relation to a CGT asset of the taxpayer', s: worst(r.gate.items.slice(0, 2).concat(r.gate.items.slice(4))), ref: '152-10(1)(a)' });
    bi.push({ k: 'B2', t: 'The event resulted in a capital gain', s: r.gainS, ref: '152-10(1)(a)' });
    bi.push({ k: 'B3', t: 'Not CGT event K7, and not a depreciating asset / trading stock', s: worst(r.gate.items.slice(2, 4)), ref: '104-235' });
    bi.push({ k: 'B4', t: 'The CGT asset satisfies the active asset test', s: r.aatS, ref: '152-35' });
    const routes = [
        { t: `Maximum net asset value test (≤ ${money(r.T.mnav)})`, s: r.mnavPass == null ? 'inc' : r.mnavPass ? 'pass' : 'fail', ref: '152-15' },
        { t: `CGT small business entity (turnover < ${money(r.T.sbe)})`, s: r.sbe.s, ref: '152-10(1AA)' },
        { t: 'Partner in a CGT SBE partnership, asset is an interest in a partnership asset', s: yes(S.alt.partnerAsset) ? 'pass' : no(S.alt.partnerAsset) ? 'fail' : 'na', ref: '152-10(1)(c)(iii)' },
        { t: 'Passively held asset used in the business of a connected entity / affiliate that is a CGT SBE', s: yes(S.alt.passive) ? 'pass' : no(S.alt.passive) ? 'fail' : 'na', ref: '152-10(1A)' },
        { t: 'Partner\'s asset (not a partnership asset) used in the business of a CGT SBE partnership', s: yes(S.alt.partnerPassive) ? 'pass' : no(S.alt.partnerPassive) ? 'fail' : 'na', ref: '152-10(1B)' }
    ];
    r.routes = routes;
    const routeS = routes.some(x => x.s === 'pass') ? 'pass' : routes.some(x => x.s === 'inc') ? 'inc' : 'fail';
    bi.push({ k: 'B5', t: 'Taxpayer satisfies at least one of the size / entity tests', s: routeS, ref: '152-10(1)(c)' });
    if (r.equity) {
        bi.push({ k: 'C1', t: r.isInd ? 'Taxpayer is a CGT concession stakeholder of the company / trust' : '90% test is satisfied', s: r.stakeS || 'inc', ref: r.isInd ? '152-10(2)(a)' : '152-10(2)(b)' });
        if (r.post2018) {
            const relyTurn = r.mnavPass !== true;
            const c2a = relyTurn ? (yes(S.shr.bizBefore) ? 'pass' : no(S.shr.bizBefore) ? 'fail' : 'inc') : 'pass';
            // Object company / trust tested on its own group: itself + its affiliates + entities it controls at 20%
            const grp = S.entities.filter(e => String(S.shr.objEnt) === String(e.id) || e.objGroup);
            const fromReg = has(S.shr.objEnt);
            const regNet = grp.reduce((t, e) => t + (r.ents[e.id] ? r.ents[e.id].net : 0), 0);
            const regHasNet = grp.some(e => (e.assets || []).some(x => has(x.mv)));
            const tP = grp.reduce((t, e) => t + (r.ents[e.id] ? r.ents[e.id].pNet : 0), 0), tC = grp.reduce((t, e) => t + (r.ents[e.id] ? r.ents[e.id].cNet : 0), 0);
            const regHasTo = grp.some(e => has((e.to || {}).prior) || has((e.to || {}).cur));
            const netV = has(S.shr.objNet) ? num(S.shr.objNet) : (fromReg && regHasNet ? regNet : null);
            const turnV = has(S.shr.objTurn) ? num(S.shr.objTurn) : (fromReg && regHasTo ? Math.min(...[grp.some(e => has((e.to || {}).prior)) ? tP : null, grp.some(e => has((e.to || {}).cur)) ? tC : null].filter(v => v != null)) : null);
            const on = netV != null ? netV <= r.T.mnav : null, ot = turnV != null ? turnV < r.T.sbe : null;
            const c2b = (on || ot) ? 'pass' : (on === false && ot === false) ? 'fail' : 'inc';
            r.objTest = { on, ot, s: c2b, netV, turnV, netSrc: has(S.shr.objNet) ? 'entered' : 'register', turnSrc: has(S.shr.objTurn) ? 'entered' : 'register', grp: grp.map(e => e.name || 'Unnamed entity') };
            bi.push({ k: 'C2.1', t: relyTurn ? 'Relying on turnover (not the $6m test): taxpayer carried on a business just before the event' : 'Taxpayer passes the $6m test, so it need not carry on a business', s: c2a, ref: '152-10(2)(c)' });
            bi.push({ k: 'C2.2', t: 'Object company / trust passes the $6m test or is a CGT SBE (20% control threshold)', s: c2b, ref: '152-10(2)(c)' });
        }
    }
    if (a.kind === 'partnership' && r.ev != null && r.ev >= D(RU.dates.partnershipRules)) {
        bi.push({ k: 'P1', t: 'Right / interest in partnership income or capital is a membership interest', s: yes(S.shr.membership) ? 'pass' : no(S.shr.membership) ? 'fail' : 'inc', ref: '152-10(2C)' });
    }
    r.basicItems = bi;
    let bs = worst(bi);
    r.viaEstate = false;
    if (bs === 'fail' && yes(S.dec.deceased) && yes(S.dec.could) && yes(S.dec.within2)) { bs = 'pass'; r.viaEstate = true; }
    r.basicS = bs;
    r.basicOk = bs === 'pass';
    // 50% reduction may use a different turnover threshold (FY2028+)
    const routes10 = routes.slice(); routes10[1] = Object.assign({}, routes[1], { s: r.sbe10.s });
    r.basic10Ok = r.basicOk || (r.T.red !== r.T.sbe && bi.every(x => x.k === 'B5' ? routes10.some(y => y.s === 'pass') : (x.s === 'pass' || x.s === 'na')));

    /* ---- 15 year exemption ---- */
    const f = S.f15, fi = [];
    r.own15 = r.ev != null && r.start != null ? r.ev >= addYears(r.start, RU.fifteenYears) : null;
    fi.push({ t: 'Basic conditions satisfied', s: r.basicOk ? 'pass' : r.basicS === 'inc' ? 'inc' : 'fail', ref: '152-105' });
    fi.push({ t: `Asset continuously owned for at least 15 years (${r.ownYears ? r.ownYears.toFixed(1) : '—'} years)`, s: r.own15 == null ? 'inc' : r.own15 ? 'pass' : 'fail', ref: '152-105(b)' });
    const siYrs = has(f.siYears) ? num(f.siYears) : null;
    if (r.isInd) {
        if (r.equity) fi.push({ t: `Company / trust had a significant individual for at least 15 years of ownership (${siYrs ?? '—'} years)`, s: siYrs == null ? 'inc' : siYrs >= 15 ? 'pass' : 'fail', ref: '152-105(c)' });
        const age = ageAt(D(tp.dob), r.ev);
        r.tpAge = age;
        const retOk = age != null && age >= RU.retirementAge && yes(tp.retireConn), incOk = yes(tp.incap);
        fi.push({ t: `Taxpayer 55 or over (${age ?? '—'}) and event in connection with retirement, or permanently incapacitated`, s: retOk || incOk ? 'pass' : (age == null || (!has(tp.retireConn) && !has(tp.incap))) ? 'inc' : 'fail', ref: '152-105(d)' });
    } else {
        const dtl = r.isDT && yes(f.dtLoss);
        fi.push({ t: `Entity had a significant individual for at least 15 years of ownership (${siYrs ?? '—'} years)`, s: (siYrs != null && siYrs >= 15) || dtl ? 'pass' : siYrs == null ? 'inc' : 'fail', ref: '152-110(1)(c)' });
        const q = S.people.filter(p => r.people[p.id] && r.people[p.id].siTp);
        const ok = q.filter(p => (r.people[p.id].age != null && r.people[p.id].age >= RU.retirementAge && yes(p.retire)) || yes(p.incap));
        r.f15Qual = ok.map(p => p.name || 'Unnamed');
        fi.push({ t: 'A significant individual just before the event was 55+ and retiring, or permanently incapacitated', s: ok.length ? 'pass' : q.length ? (q.some(p => !has(p.retire) && !has(p.incap)) ? 'inc' : 'fail') : 'inc', ref: '152-110(1)(d)' });
    }
    r.f15Items = fi;
    r.f15S = worst(fi);
    r.f15 = r.f15S === 'pass';

    /* ---- stakeholder participation (15 year payments & retirement) ---- */
    const stk = S.people.filter(p => r.people[p.id] && r.people[p.id].stTp);
    r.stakeholders = stk.map(p => ({ id: p.id, name: p.name || 'Unnamed', part: r.isDT ? (stk.length ? 1 / stk.length : 0) : (r.people[p.id].tpPart || 0), age: r.people[p.id].age, p }));

    /* ---- waterfall ---- */
    const W = {};
    W.gross = r.gross;
    r.redAvail = (r.basic10Ok || r.basicOk) && !r.f15;
    if (r.f15 && r.gross > 0) {
        W.f15 = r.gross; W.lossUsed = 0; W.afterLoss = r.gross; W.disc = 0; W.red = 0; W.ret = 0; W.roll = 0; W.net = 0;
        r.f15Pay = r.stakeholders.map(s => ({ name: s.name, part: s.part, amt: s.part * r.gross }));
        r.f15Due = addYears(r.ev, RU.fifteenPayYears);
    } else {
        W.f15 = 0;
        W.lossUsed = Math.min(r.lossAvail, r.gross);
        W.afterLoss = r.gross - W.lossUsed;
        W.disc = W.afterLoss * r.discPct;
        const g2 = W.afterLoss - W.disc;
        W.red = r.redAvail && yes(S.conc.apply50) ? g2 * 0.5 : 0;
        const g3 = g2 - W.red;
        W.g3 = g3;
        // retirement exemption
        const retAvail = r.basicOk && !r.f15 && (r.isInd || r.siTpAny);
        r.retAvail = retAvail;
        if (r.isInd) {
            r.retRemaining = Math.max(r.T.ret - num(tp.priorUsed), 0);
            r.retMax = Math.min(r.retRemaining, g3);
            const cd = D(tp.choiceDate) || r.ev;
            r.retAge = ageAt(D(tp.dob), cd);
            r.retSuper = r.retAge != null && r.retAge < RU.retirementAge;
            r.retDue = later(D(tp.choiceDate), D(tp.proceedsDate));
        } else {
            const rows = r.stakeholders.map(s => { const share = num(s.p.retPct) / 100; const rem = Math.max(r.T.ret - num(s.p.priorUsed), 0); return { id: s.id, name: s.name, age: s.age, share, rem, p: s.p }; });
            r.retRows = rows;
            r.retPctTot = rows.reduce((t, x) => t + x.share, 0);
            const lim = rows.filter(x => x.share > 0).map(x => x.rem / x.share);
            r.retMax = Math.min(g3, lim.length ? Math.min(...lim) : 0);
            r.retDue = later(addDays(D(tp.choiceDate), 7), addDays(D(tp.proceedsDate), 7));
        }
        r.retMax = Math.max(r.retMax || 0, 0);
        const want = num(S.conc.retAmt);
        W.ret = retAvail ? Math.min(want, r.retMax) : 0;
        r.retCapped = retAvail && want > r.retMax + 0.5;
        if (!r.isInd && r.retRows) r.retRows.forEach(x => { x.amt = W.ret * x.share; x.over = x.amt > x.rem + 0.5; });
        const g4 = g3 - W.ret;
        W.g4 = g4;
        r.rollAvail = r.basicOk && !r.f15;
        const wantR = num(S.conc.rollAmt);
        W.roll = r.rollAvail ? Math.min(wantR, g4) : 0;
        r.rollCapped = r.rollAvail && wantR > g4 + 0.5;
        W.net = g4 - W.roll;
    }
    r.W = W;

    /* ---- roll-over replacement assets ---- */
    r.winStart = r.ev != null ? addYears(r.ev, -RU.replacementBefore) : null;
    r.winEnd = r.ev != null ? addYears(r.ev, RU.replacementAfter) : null;
    r.repl = S.conc.repl.map(x => { const t = D(x.acq); const inWin = t != null && r.winStart != null && t >= r.winStart && t <= r.winEnd; return { inWin, cost: num(x.cost) }; });
    r.replCost = r.repl.reduce((t, x) => t + (x.inWin ? x.cost : 0), 0);
    r.j6 = W.roll > 0 ? Math.max(W.roll - r.replCost, 0) : 0;

    /* ---- statuses for the step list ---- */
    r.st = {
        setup: has(S.client.name) && has(tp.type) ? 'pass' : 'inc',
        asset: r.gate.s,
        gain: r.gainS,
        discount: r.discS,
        entities: r.entS,
        aat: r.aatS,
        mnav: r.mnavS,
        sbe: r.sbeS,
        people: r.peopleS,
        basic: r.basicS,
        fifteen: r.f15 ? 'pass' : r.basicOk ? (r.f15S === 'inc' ? 'inc' : 'na') : 'na',
        reduction: !r.redAvail ? 'na' : W.red > 0 ? 'pass' : 'na',
        retire: !r.retAvail ? 'na' : W.ret > 0 ? (r.retCapped || (r.retRows && r.retRows.some(x => x.over)) ? 'warn' : 'pass') : 'na',
        rollover: !r.rollAvail ? 'na' : W.roll > 0 ? (r.rollCapped ? 'warn' : 'pass') : 'na',
        result: ''
    };
    if (r.reform && (r.isInd || r.isTrust)) r.flags.push('CGT event on or after 1 July 2027: for individuals, trusts and partnerships the 50% discount only applies to the gain accrued to 30 June 2027 (indexation applies after that) under the Tax Reform No. 1 Act 2026. Enter the blended rate as a discount override until this tab handles the split.');
    if (r.rtWarn) r.flags.push(r.rtWarn);
    return r;
}

function worst(items) {
    const ss = items.map(x => x.s).filter(s => s !== 'na');
    if (ss.includes('fail')) return 'fail';
    if (ss.includes('inc')) return 'inc';
    if (ss.includes('warn')) return 'warn';
    return ss.length ? 'pass' : 'na';
}

function ctlSuggest(e) {
    const c = e.ctl || {};
    const RU = SBC_RULES;
    let warn = '';
    // Holding through another entity: only counts if the taxpayer controls that entity (s328-125(7) chain of control)
    let viaCtl = false;
    if (has(c.via) && has(c.viaPct)) {
        const ve = S.entities.find(x => String(x.id) === String(c.via));
        const vp = num(c.viaPct) / 100;
        if (ve && ve.rel === 'connected' && vp >= RU.controlPct) viaCtl = true;
        else if (ve && vp > 0) warn = ve.rel === 'connected'
            ? `${esc(ve.name || 'That entity')} holds ${pct(vp, 1)}, under 40%, so it doesn't give indirect control. Its holding is not added to the direct percentage.`
            : `${esc(ve.name || 'That entity')} isn't controlled by the taxpayer, so its ${pct(vp, 1)} holding doesn't count toward control at all (it is not added to the direct percentage).`;
    }
    if (e.type === 'dtrust') {
        if (yes(c.wish)) return { rel: 'connected', t: 'Trustee acts in accordance with the taxpayer\'s wishes: taxpayer controls the trust, so they are connected.', warn };
        if (viaCtl) return { rel: 'connected', t: 'Indirect control through an entity the taxpayer controls: connected.', warn };
        if (has(c.dist)) {
            const d = num(c.dist) / 100;
            if (d >= RU.controlPct) {
                if (d < RU.commissionerBand && yes(c.comm)) return { rel: 'other', t: 'Distributions are 40–50%, but the Commissioner has determined another entity controls the trust: not connected.', warn };
                return { rel: 'connected', t: `Received ${pct(d, 1)} of income or capital distributions in one of the 4 prior years: deemed control, so connected.`, warn };
            }
            return { rel: 'other', t: 'Under 40% of distributions and trustee not accustomed to act on the taxpayer\'s wishes: no control.', warn };
        }
        return warn ? { rel: null, t: '', warn } : null;
    }
    if (has(c.pct) || has(c.affPct)) {
        const p = (num(c.pct) + num(c.affPct)) / 100;
        const parts = has(c.affPct) && num(c.affPct) ? ` (${num(c.pct)}% direct + ${num(c.affPct)}% held by affiliates)` : '';
        if (p >= RU.controlPct) {
            if (p < RU.commissionerBand && yes(c.comm)) return { rel: 'other', t: `${pct(p, 1)}${parts}, but the Commissioner has determined another entity controls it: not connected.`, warn };
            return { rel: 'connected', t: `${pct(p, 1)}${parts} is at least 40%: the taxpayer controls it, so it is connected.`, warn };
        }
        if (viaCtl) return { rel: 'connected', t: 'Indirect control: the taxpayer controls an entity that holds at least 40% of this entity.', warn };
        if ((e.type === 'individual' || e.type === 'company') && yes(c.aff)) return { rel: 'affiliate', t: `Under 40% (${pct(p, 1)}), but it acts in accordance with the taxpayer\'s wishes in its business affairs: affiliate.`, warn };
        return { rel: 'other', t: `${pct(p, 1)}${parts} is under 40%: no control. Not connected unless another route applies (e.g. both controlled by the same third party).`, warn };
    }
    if (viaCtl) return { rel: 'connected', t: 'Indirect control: the taxpayer controls an entity that holds at least 40% of this entity.', warn };
    if ((e.type === 'individual' || e.type === 'company') && yes(c.aff)) return { rel: 'affiliate', t: 'Acts in accordance with the taxpayer\'s wishes in its business affairs: affiliate.', warn };
    return warn ? { rel: null, t: '', warn } : null;
}

// Relationship follows the control check unless it has been set by hand
function applyAutoRel() {
    for (let pass = 0; pass < 3; pass++) { // repeat so chains (A controls B controls C) settle
        S.entities.forEach(e => { if (e.relAuto) { const sg = ctlSuggest(e); if (sg && sg.rel) e.rel = sg.rel; } });
    }
}

/* ======================= UI builders ======================= */
const val = p => { const x = getP(p); return x == null ? '' : x; };
const tin = (p, cls = '', ph = '') => { const x = val(p); return `<input type="text" data-k="${p}" class="${cls}" value="${esc(cls.includes('money') ? fmtNum(x) : x)}" placeholder="${esc(ph)}">`; };
const tmon = (p, ph = '0') => tin(p, 'money', ph);
const tpct = (p, ph = '0') => tin(p, 'pct', ph);
const tdate = p => `<span class="dt"><input type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="dd/mm/yyyy" data-date="${p}" value="${esc(isoToAu(val(p)))}"><button type="button" class="dtb" data-act="pick" data-path="${p}" tabindex="-1" title="Pick a date"><i data-lucide="calendar"></i></button><input type="date" class="dtn" data-k="${p}" value="${esc(val(p))}" tabindex="-1" aria-hidden="true"></span>`;
const tsel = (p, opts) => `<select data-k="${p}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(val(p)) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
const F = (label, ctrl, small = '') => `<label class="f">${label}${small ? ` <small>${small}</small>` : ''}${ctrl}</label>`;
const icon = n => `<i data-lucide="${n}"></i>`;
function yn(p, q, o = {}) {
    const cur = val(p);
    const b = (v, t) => `<button type="button" data-yn="${p}" data-v="${v}" class="${cur === v ? 'on' : ''}">${t}</button>`;
    return `<div class="q${o.dim ? ' dim' : ''}"><div>${o.ref ? `<div class="ref">s${o.ref}</div>` : ''}<div class="qt">${q}</div>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div><div class="yn">${b('yes', 'Yes')}${b('no', 'No')}${o.na ? b('na', 'N/A') : ''}</div></div>`;
}
const LBL = { pass: 'Pass', fail: 'Fail', warn: 'Check', inc: 'Incomplete', na: 'N/A' };
const badge = (s, t) => `<span class="badge ${s || 'inc'}">${t || LBL[s] || ''}</span>`;
const res = (s, title, body = '') => `<div class="res ${s === 'inc' ? 'na' : s}"><b>${title}</b>${body}</div>`;
function checks(items) {
    return `<table class="t"><tbody>${items.map(x => `<tr><td>${x.t}${x.ref ? ` <span class="muted" style="font-size:11px">s${x.ref}</span>` : ''}</td><td class="num">${badge(x.s)}</td></tr>`).join('')}</tbody></table>`;
}
const addBtn = (path, tpl, text) => `<button type="button" class="btn add" data-act="add" data-path="${path}" data-tpl="${tpl}">${icon('plus')} ${text}</button>`;
const delBtn = (path, i) => `<button type="button" class="btn small danger" data-act="del" data-path="${path}" data-i="${i}" title="Remove">${icon('trash-2')}</button>`;
const notes = id => `<h4>File notes</h4><textarea data-k="notes.${id}" placeholder="Evidence sighted, judgements made, workpaper references…">${esc(S.notes[id] || '')}</textarea>`;
const o = (key, f = 'money') => `<span data-o="${key}" data-f="${f}"></span>`;

/* ======================= steps ======================= */
const STEPS = [
    { id: 'setup', t: 'Client & taxpayer', g: 'Set up' },
    { id: 'asset', t: 'CGT event & asset' },
    { id: 'gain', t: 'Capital gain', g: 'Capital gain' },
    { id: 'discount', t: 'CGT discount' },
    { id: 'entities', t: 'Connected entities & affiliates', g: 'Basic conditions' },
    { id: 'aat', t: 'Active asset test' },
    { id: 'mnav', t: '$6m net asset test' },
    { id: 'sbe', t: '$2m turnover test' },
    { id: 'people', t: 'Significant individuals' },
    { id: 'basic', t: 'Basic conditions summary' },
    { id: 'fifteen', t: '15 year exemption', g: 'Concessions' },
    { id: 'reduction', t: '50% active asset reduction' },
    { id: 'retire', t: 'Retirement exemption' },
    { id: 'rollover', t: 'Roll-over relief' },
    { id: 'result', t: 'Net capital gain & report', g: 'Result' }
];

const P = {};
const inObjGroup = e => e.id !== 'tp' && R.equity && R.post2018 && (String(S.shr.objEnt) === String(e.id) || !!e.data.objGroup);
const entTag = e => {
    const rr = R.ents[e.id] || {};
    const bits = [];
    if (e.id !== 'tp' && !rr.connAtEvent && e.rel !== 'other') bits.push(badge('warn', 'not connected just before event – excluded'));
    if (e.rel === 'other' && inObjGroup(e)) bits.push(badge('na', 'C2.2 group only – not in taxpayer total'));
    return bits.join(' ');
};

P.setup = () => {
    const t = S.tp.type;
    const changes = {
        individual: ['CGT discount of 50% (apportioned if a foreign or temporary resident after 8 May 2012).', 'Selling shares or trust interests: the taxpayer must be a CGT concession stakeholder.', '15 year exemption: the taxpayer must be 55+ and retiring, or permanently incapacitated.', 'Retirement exemption: own $500,000 lifetime limit; if under 55, the exempt amount must go to super.'],
        company: ['No CGT discount.', 'Selling shares or trust interests: the 90% test applies.', '15 year exemption and retirement exemption depend on significant individuals and CGT concession stakeholders, with payments to them.', 'Consider not applying the 50% active asset reduction so more can pass tax-free under the retirement exemption.'],
        dtrust: ['CGT discount of 50% (beneficiaries gross up; ×4 if the 50% reduction also applies).', 'Selling shares or trust interests: the 90% test applies.', 'Significant individual test uses distributions for the year; special loss-year rule for the 15 year exemption.', 'Stakeholder participation for the 15 year exemption = 100% ÷ number of stakeholders.'],
        utrust: ['CGT discount of 50% (beneficiaries gross up).', 'Selling shares or trust interests: the 90% test applies.', '15 year and retirement exemptions depend on significant individuals and stakeholders.', 'Consider not applying the 50% active asset reduction to maximise retirement exemption payments.'],
        super: ['CGT discount of 33⅓%.', 'A complying super fund rarely satisfies the basic conditions; document why the concessions apply.', 'Stakeholder-based rules work as for a trust.', '']
    }[t];
    return `<div class="card"><h3>Client &amp; taxpayer</h3><p class="lead">Report header details, and the type of entity that made the gain. The steps that follow change to suit the entity type.</p>
    <div class="grid">${F('Client name', tin('client.name'))}${F('Client code', tin('client.code'))}${F('Prepared by', tin('client.preparer'))}${F('Preparation date', tdate('client.prepDate'))}${F('Reviewed by', tin('client.reviewer'))}${F('Review date', tdate('client.revDate'))}</div>
    <h4>Taxpayer</h4>
    <div class="grid">${F('Entity that made the gain', tsel('tp.type', TP_TYPES))}${F('Taxpayer name', tin('tp.name', '', 'e.g. Smith Family Trust'))}${F('Australian resident for tax', tsel('tp.resident', [['yes', 'Yes'], ['no', 'No']]))}</div>
    ${yn('tp.business', 'Is the taxpayer carrying on a business (under general principles)?', { ref: '328-110', hint: 'Needed for the CGT small business entity test. If the asset is held passively, the concessions may still apply through a connected entity or affiliate (Basic conditions step).' })}
    ${t === 'individual' || t === 'company' ? yn('tp.partner', 'Is the taxpayer a partner in a partnership that carries on the business?', { ref: '152-10(1)(c)' }) : ''}
    <h4>What changes for ${t === 'individual' ? 'an individual' : 'a ' + TYPE_NAME[t].toLowerCase()}</h4><ul style="margin:0 0 0 18px;padding:0;color:var(--muted);font-size:13px">${changes.filter(Boolean).map(x => `<li>${x}</li>`).join('')}</ul>
    ${notes('setup')}</div>`;
};

P.asset = () => {
    const a = S.asset;
    return `<div class="card"><h3>CGT event &amp; asset</h3><p class="lead">Confirm a CGT event happened to an asset taxed under the CGT rules. The concessions can't apply to depreciating assets, trading stock or event K7.</p>
    <div class="grid g2">${F('Asset description', tin('asset.desc', '', 'e.g. Goodwill of plumbing business'))}${F('Asset type', tsel('asset.kind', ASSET_KINDS))}${F('CGT event', tsel('asset.event', EVENTS))}</div>
    <div class="grid" style="margin-top:10px">${F('Date of CGT event', tdate('asset.eventDate'), 'usually contract date')}${F('Date asset acquired', tdate('asset.acqDate'))}${F('Income year', `<input type="text" disabled data-o="fyName" data-f="text-in">`, 'from event date')}${F('Ownership period', `<input type="text" disabled data-o="ownTxt" data-f="text-in">`)}</div>
    ${yn('asset.deemed', 'Is the asset treated as acquired earlier than its actual acquisition date?', { ref: '152-45', hint: 'e.g. replacement asset under a compulsory acquisition / loss roll-over, marriage breakdown roll-over, small business restructure roll-over, or an inherited asset. The earlier date is used for the ownership, discount and active asset periods.' })}
    ${yes(a.deemed) ? `<div class="grid g2">${F('Deemed acquisition date', tdate('asset.deemedDate'))}${F('Reason', tsel('asset.deemedWhy', DEEMED_WHY))}</div>` : ''}
    <h4>Checks</h4>
    ${yn('asset.occurred', 'Has a CGT event happened in relation to the asset in this income year?', { ref: '104-5', hint: 'For a disposal (A1) the event happens when the contract is entered into, even if settlement is in a later year.' })}
    ${yn('asset.owner', 'Is the entity that had the CGT event the one applying the concessions?', { ref: '152-10', hint: 'If a company or trust sells an asset, the company or trust applies the concessions, not its shareholders or beneficiaries.' })}
    ${a.event === 'D1' ? `<div class="res info"><b>Event D1</b>The asset does not have to pass the active asset test; the right created must be inherently connected with an asset that does (answered in the Active asset test step).</div>` : ''}
    ${checks(R.gate.items)}
    ${res(R.gate.s, R.gate.s === 'pass' ? 'Eligible CGT event and asset' : R.gate.s === 'fail' ? 'Concessions not available for this event or asset' : 'Complete the questions above')}
    ${notes('asset')}</div>`;
};

P.gain = () => {
    // Two columns: cost base (entered) and reduced cost base (filled in automatically; shown when there is a loss)
    const rc = key => `<td class="num rcbcol">${o('rcbv.' + key)}</td>`;
    const row = (grp, k, t) => `<tr><td>${t}</td><td style="width:170px">${tmon(`gain.${grp}.${k}`)}</td>${grp === 'e3' ? '<td class="num rcbcol muted">excluded</td>' : rc(grp + '_' + k)}</tr>`;
    const head = (t, extra = '') => `<tr class="sub"><td>${t}</td><td></td><td class="rcbcol muted" style="font-size:11px">${extra}</td></tr>`;
    return `<div class="card"><h3>Capital gain</h3><p class="lead">Capital proceeds less cost base. Small business concessions only apply to gains, not losses. The indexation method is not used here.</p>
    <div class="grid">${F('Capital proceeds', tmon('gain.proceeds'))}</div>
    <h4>Cost base</h4>
    <div class="banner rcbcol"><b>Capital proceeds are less than the cost base.</b> The reduced cost base is shown alongside. It is filled in from the cost base automatically, except the 3rd element costs of ownership, which the law leaves out (s110-55(2)).</div>
    <div class="tw" id="sbc-cbt"><table class="t"><thead><tr><th></th><th class="num">Cost base</th><th class="num rcbcol">Reduced cost base</th></tr></thead><tbody>
    <tr><td><b>1st element</b> – money paid / market value given to acquire the asset <div class="muted" style="font-size:12px">Use market value if nothing was paid or the dealing was not at arm's length.</div></td><td style="width:170px">${tmon('gain.e1')}</td>${rc('e1')}</tr>
    ${head('<b>2nd element</b> – incidental costs of acquisition and disposal')}${CB.e2.map(([k, t]) => row('e2', k, t)).join('')}
    ${head('<b>3rd element</b> – costs of owning the asset <div class="muted" style="font-size:12px">Only costs that were <b>not</b> deductible (and not for collectables / personal use assets, or assets acquired before 21 Aug 1991). They increase the cost base but are excluded from the reduced cost base.</div>', 'not in reduced cost base')}${CB.e3.map(([k, t]) => row('e3', k, t)).join('')}
    <tr class="rcbcol"><td><b>Reduced cost base 3rd element</b> – assessable balancing adjustments <div class="muted" style="font-size:12px">Only where a balancing adjustment for the asset (or part of it, e.g. a depreciating component) was included in assessable income. Usually nil.</div></td><td></td><td style="width:170px">${tmon('gain.rcbE3')}</td></tr>
    ${head('<b>4th element</b> – capital expenditure')}${CB.e4.map(([k, t]) => row('e4', k, t)).join('')}
    <tr><td><b>5th element</b> – capital expenditure to establish, preserve or defend title</td><td>${tmon('gain.e5')}</td>${rc('e5')}</tr>
    ${head('<b>Less reductions</b>')}${CB.red.map(([k, t]) => row('red', k, t)).join('')}
    <tr class="tot"><td>Total</td><td class="num">${o('cb')}</td><td class="num rcbcol">${o('rcb')}</td></tr>
    </tbody></table></div>
    <table class="calc" style="margin-top:12px"><tr><td>Capital proceeds</td><td>${o('proceeds')}</td></tr><tr><td>Less cost base</td><td>${o('cb')}</td></tr><tr class="tot"><td>Gross capital gain</td><td>${o('gross')}</td></tr></table>
    <table class="calc rcbcol" style="margin-top:6px"><tr><td>Ownership costs excluded from the reduced cost base</td><td>${o('cb3')}</td></tr><tr><td>Reduced cost base</td><td>${o('rcb')}</td></tr><tr class="tot"><td>Capital loss (reduced cost base less proceeds)</td><td>${o('loss')}</td></tr></table>
    <p class="muted rcbcol" style="font-size:12px">If proceeds fall between the reduced cost base and the cost base there is neither a gain nor a loss. Capital losses can't use the small business concessions.</p>
    <h4>Capital losses</h4>
    <div class="grid">${F('Current year capital losses', tmon('gain.lossCur'))}${F('Carried-forward net capital losses', tmon('gain.lossCf'))}</div>
    <p class="muted" style="font-size:12px">Losses are applied before the discount and the 50% reduction. If the 15 year exemption applies, the whole gain is disregarded and the losses are kept for later.</p>
    <div data-o="gainRes" data-f="html"></div>
    ${notes('gain')}</div>`;
};

P.discount = () => {
    const d = S.disc;
    if (R.isCo) return `<div class="card"><h3>CGT discount</h3>${res('na', 'Not available to companies', 'A company cannot apply the general CGT discount (s115-10). Go to the basic conditions.')}${notes('discount')}</div>`;
    const integ = R.equity ? `<h4>Shares or trust interests (s115-45)</h4>
      ${yn('disc.i300', 'Does the company / trust have 300 or more members and is not subject to concentrated ownership?', { hint: 'Concentrated ownership: 20 or fewer individuals control 75% or more of capital, income or voting rights.' })}
      ${no(d.i300) ? yn('disc.i10', 'Do the taxpayer and associates own 10% or more of the company / trust?') : ''}
      ${no(d.i300) && yes(d.i10) ? yn('disc.i50cb', 'Have more than 50% of the entity\'s CGT assets (by cost base) been held for less than 12 months?') : ''}
      ${no(d.i300) && yes(d.i10) && no(d.i50cb) ? yn('disc.i50gain', 'If the entity sold all its CGT assets at market value, would more than 50% of the net capital gain come from assets held less than 12 months?') : ''}` : '';
    const trustQ = R.isTrust || R.isSuper ? `<h4>Trust</h4>${yn('disc.trustAssess', 'Is the gain assessed to the trustee under s99A, 98(3) or 98(4)?', { ref: '115-222', hint: 'e.g. no beneficiary presently entitled, or the gain goes to a non-resident company or foreign trustee. If so, the trustee cannot apply the discount.' })}
      <p class="muted" style="font-size:12px">Beneficiaries gross up their share of a discounted gain (×2, or ×4 if the 50% active asset reduction also applies), apply their own losses, then reapply the discount. Company beneficiaries get no discount.</p>` : '';
    const foreign = R.isInd ? `<h4>Residency</h4>${yn('disc.foreign', 'Was the taxpayer a foreign or temporary resident at any time after 8 May 2012 while holding the asset?', { ref: '115-115' })}
      ${yes(d.foreign) ? `<div class="tw"><table class="t"><thead><tr><th>Foreign / temporary resident from</th><th>To</th><th></th></tr></thead><tbody>${d.fperiods.map((p, i) => `<tr><td>${tdate(`disc.fperiods.${i}.from`)}</td><td>${tdate(`disc.fperiods.${i}.to`)}</td><td>${delBtn('disc.fperiods', i)}</td></tr>`).join('')}</tbody></table></div>${addBtn('disc.fperiods', 'fperiod', 'Add a foreign / temporary residency period')}
        ${R.start != null && R.start < D('2012-05-09') ? yn('disc.mvChoice', 'Asset acquired before 9 May 2012: choose the market value method (market value on 8 May 2012 exceeded cost base)?', { hint: 'The gain to 8 May 2012 keeps the full discount; only the later gain is apportioned. Generally better when the asset grew in value before 8 May 2012.' }) : ''}
        ${yes(d.mvChoice) && R.start != null && R.start < D('2012-05-09') ? `<div class="grid">${F('Market value at 8 May 2012', tmon('disc.mv2012'))}</div>` : ''}
        ${R.discFactor ? `<p class="muted" style="font-size:12.5px">Days as a foreign / temporary resident after 8 May 2012: <b>${R.discFactor.inel.toLocaleString()}</b> of ${(R.discFactor.method === 'mv' ? R.discFactor.postDays : R.discFactor.total).toLocaleString()} days. Discount percentage: <b>${pct(0.5 * R.discFactor.f, 2)}</b>${R.discFactor.method === 'mv' ? ` (${pct(R.discFactor.preFrac, 1)} of the gain accrued to 8 May 2012)` : ''}.</p>` : ''}` : ''}` : '';
    return `<div class="card"><h3>CGT discount</h3><p class="lead">The discount is applied after capital losses and before the 50% active asset reduction.</p>
    ${R.reform && (R.isInd || R.isTrust) ? `<div class="banner"><b>CGT event on or after 1 July 2027.</b> For individuals, trusts and partnerships the 50% discount is replaced by cost base indexation for gain accruing from 1 July 2027 (Tax Reform No. 1 Act 2026). Only the gain to 30 June 2027 keeps the discount. Work out the blended rate and enter it as an override below.</div>` : ''}
    ${checks(R.discItems)}
    ${yn('disc.indexation', 'Has the gain been calculated using the indexation method (pre-21 September 1999 assets only)?', { ref: '115-20', dim: R.acq != null && R.acq >= D('1999-09-21') })}
    ${integ}${trustQ}${foreign}
    <h4>Discount percentage</h4>
    <div class="grid">${F('Calculated percentage', `<input type="text" disabled value="${R.discOverride ? '(overridden)' : pct(R.discOk ? (R.discFactor ? (SBC_RULES.discount[S.tp.type] * R.discFactor.f) : SBC_RULES.discount[S.tp.type]) : 0, 2)}">`)}${F('Override %', tpct('disc.override', 'leave blank'), 'e.g. 1 July 2027 split')}</div>
    ${res(R.discS, R.discS === 'pass' ? `Discount available: ${pct(R.discPct, 2)}` : R.discS === 'warn' ? `Override applied: ${pct(R.discPct, 2)}` : R.discS === 'fail' ? 'Discount not available' : 'Answer the questions above', R.discS === 'pass' || R.discS === 'warn' ? `Gain after losses ${money(R.W.afterLoss)} × ${pct(R.discPct, 2)} = <b>${money(R.W.disc)}</b> discount.` : '')}
    ${notes('discount')}</div>`;
};

P.entities = () => {
    const e = S.entities;
    const showObj = R.equity && R.post2018;
    const card = (x, i) => {
        const isDT = x.type === 'dtrust';
        const others = [['', '—']].concat(S.entities.filter(y => y.id !== x.id).map(y => [String(y.id), y.name || 'Unnamed entity']));
        return `<div class="ent"><div class="eh"><b><span data-o="entName.${x.id}" data-f="text">${esc(x.name || 'Entity ' + (i + 1))}</span></b>${delBtn('entities', i)}</div>
        <div class="grid">${F('Name', tin(`entities.${i}.name`))}${F('Type', tsel(`entities.${i}.type`, ENT_TYPES))}
          ${F('Relationship to taxpayer', tsel(`entities.${i}.rel`, REL), x.relAuto ? 'set by the control check' : `set by hand · <a href="#" data-act="relauto" data-i="${i}">use control check</a>`)}</div>
        <div class="grid" style="margin-top:8px">${F('Connected / affiliate from', tdate(`entities.${i}.connFrom`), 'blank = throughout')}${F('Connected / affiliate until', tdate(`entities.${i}.connTo`), 'e.g. date sold out')}</div>
        ${showObj ? `<label class="chk" style="margin-top:8px"><input type="checkbox" data-k="entities.${i}.objGroup" ${x.objGroup ? 'checked' : ''}> In the group of the company / trust being sold (its affiliate, or an entity it controls at 20%+) – used for C2.2</label>` : ''}
        <h4>Control / affiliate check</h4>
          ${isDT ? `${yn(`entities.${i}.ctl.wish`, 'Is the trustee accustomed or obliged to act (or reasonably expected to act) in accordance with the wishes of the taxpayer and / or its affiliates?', { ref: '328-125(3)' })}
            <div class="grid">${F('Highest % of income or capital distributions to taxpayer + affiliates in any of the 4 prior years', tpct(`entities.${i}.ctl.dist`), 'income and capital tested separately')}</div>`
            : `<div class="grid">${F('% held directly by the taxpayer', tpct(`entities.${i}.ctl.pct`), 'highest of income, capital or voting')}${F('% held by the taxpayer\'s affiliates', tpct(`entities.${i}.ctl.affPct`), 'incl. spouse / children under 18 (s152-47)')}</div>`}
          <div class="grid" style="margin-top:8px">${F('Also held through another entity', tsel(`entities.${i}.ctl.via`, others), 'from this register')}${F('That entity\'s % in this entity', tpct(`entities.${i}.ctl.viaPct`))}</div>
          ${yn(`entities.${i}.ctl.comm`, 'If between 40% and 50%: has the Commissioner determined that another entity controls it?', { ref: '328-125(6)' })}
          ${x.type === 'individual' || x.type === 'company' ? yn(`entities.${i}.ctl.aff`, 'Does it act, or could it reasonably be expected to act, in accordance with the taxpayer\'s directions or wishes (or in concert) in its business affairs?', { ref: '328-130', hint: 'Only individuals and companies can be affiliates. Being a spouse, partner or co-director is not enough by itself.' }) : ''}
          <div data-o="entSugg.${x.id}" data-f="html"></div>
        </div>`;
    };
    return `<div class="card"><h3>Connected entities &amp; affiliates</h3><p class="lead">List every entity connected with, or an affiliate of, the taxpayer. Fill in the control check and the relationship is set automatically (you can still override it). This register feeds the active asset test, the $6m net asset test and the turnover test, so it only needs to be entered once. Enter each entity's <b>full</b> assets and turnover in those steps, not the taxpayer's share.</p>
    <label class="chk"><input type="checkbox" data-k="noEnts" ${S.noEnts ? 'checked' : ''}> The taxpayer has no connected entities or affiliates</label>
    <div style="margin-top:10px">${e.map(card).join('')}</div>
    ${addBtn('entities', 'entity', 'Add related entity')}
    <details class="more"><summary>Control rules (s328-125)</summary><ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px;color:var(--muted)">
      <li>Connected: one entity controls the other, or both are controlled by the same third entity.</li>
      <li>Control: the right to at least 40% of income or capital distributions, or (companies) 40% of voting power, held by the taxpayer, its affiliates, or both together.</li>
      <li>Holdings through another entity only count through a chain of control: if the taxpayer controls B and B controls A, the taxpayer controls A. A non-controlling stake in B adds nothing.</li>
      <li>Discretionary trust: controlled if the trustee acts on the entity's wishes, or the entity (with affiliates) received at least 40% of income or capital distributions in any of the 4 prior years.</li>
      <li>Connection dates: the $6m test only counts entities connected just before the CGT event; turnover only counts the part of the year an entity was connected; active use only counts while the user was connected.</li></ul></details>
    ${notes('entities')}</div>`;
};

P.aat = () => {
    const at = S.aat;
    const users = [['tp', 'Taxpayer']].concat(S.entities.map(e => [String(e.id), e.name || 'Unnamed entity']));
    const bsRows = at.bs.map((b, i) => `<tr><td>${tin(`aat.bs.${i}.desc`)}</td><td>${tsel(`aat.bs.${i}.cat`, BS_CATS)}</td><td style="width:140px">${tmon(`aat.bs.${i}.mv`)}</td>
        <td>${b.cat === 'cashConn' ? `<label class="chk"><input type="checkbox" data-k="aat.bs.${i}.purpose" ${b.purpose ? 'checked' : ''}> Acquired to help pass the 80% test</label>` : b.cat === 'sub' ? `<div class="grid" style="grid-template-columns:repeat(3,minmax(90px,1fr));gap:6px">${F('Participation %', tpct(`aat.bs.${i}.subPct`))}${F('Sub active assets', tmon(`aat.bs.${i}.subActive`))}${F('Sub total assets', tmon(`aat.bs.${i}.subTotal`))}</div>` : ''}</td><td>${delBtn('aat.bs', i)}</td></tr>`).join('');
    return `<div class="card"><h3>Active asset test</h3><p class="lead">The asset must be active (used or held ready for use in a business of the taxpayer, a connected entity or an affiliate, or an inherently connected intangible) for at least half of the relevant period, or 7½ years if held for more than 15 years. The periods don't have to be continuous.</p>
    ${S.asset.event === 'D1' ? yn('asset.d1conn', 'Is the right created inherently connected with a CGT asset of the taxpayer that satisfies the active asset test?', { ref: '152-12' }) : `
    <h4>Relevant period</h4>
    ${yn('aat.ceased', 'Did the business stop being carried on within 12 months before the CGT event (or a longer period allowed by the Commissioner)?', { ref: '152-35(2)', hint: 'If so, the relevant period ends when the business ceased.' })}
    <div class="grid">${F('Period starts', `<input type="text" disabled value="${fdate(R.start)}">`)}${yes(at.ceased) ? F('Business ceased', tdate('aat.ceasedDate')) : ''}${F('Period ends', `<input type="text" disabled value="${fdate(R.relEnd)}">`)}${F('Relevant period', `<input type="text" disabled value="${R.relDays.toLocaleString()} days">`)}</div>
    <h4>Periods the asset was active${R.equity ? ' (periods the 80% test was met)' : ''}</h4>
    <div class="tw"><table class="t"><thead><tr><th>From</th><th>To</th><th>Used in business of</th><th>Notes</th><th></th></tr></thead><tbody>
    ${at.periods.map((p, i) => `<tr><td>${tdate(`aat.periods.${i}.from`)}</td><td>${tdate(`aat.periods.${i}.to`)}</td><td>${tsel(`aat.periods.${i}.user`, users)}</td><td>${tin(`aat.periods.${i}.note`)}</td><td>${delBtn('aat.periods', i)}</td></tr>`).join('')}
    </tbody></table></div>
    ${addBtn('aat.periods', 'period', 'Add active period')}
    <table class="calc" style="margin-top:10px"><tr><td>Days active within the relevant period</td><td>${R.activeDays.toLocaleString()}</td></tr><tr><td>Days required (${R.longHold ? '7½ years – held over 15 years' : 'half the relevant period'})</td><td>${R.needDays.toLocaleString()}</td></tr></table>
    <h4>Exclusions (s152-40(4))</h4>
    ${R.equity ? '' : yn('aat.fin', 'Is the asset a financial instrument (loan, bond, debenture, option, future, etc.)?')}
    ${yn('aat.passive', 'Is the asset\'s main use (over 50%) to derive interest, an annuity, rent, royalties or foreign exchange gains?', { hint: 'Ignore personal use by the taxpayer, a connected entity or an affiliate.' })}
    ${yes(at.passive) ? yn('aat.passiveExc', 'Does an exception apply?', { hint: 'Rent from a connected entity / affiliate that uses the asset in its business; main use for rent was only temporary; or an intangible substantially enhanced by the taxpayer\'s development.' }) : ''}
    ${R.equity ? `<h4>80% test – balance sheet of the company / trust (s152-40(3))</h4>
      ${yn('aat.resident', 'Is the company / trust an Australian resident?')}
      <p class="muted" style="font-size:12.5px">Enter each asset at market value. Cash and financial instruments count as active only if inherently connected with the business${R.post2018 ? ', and not if acquired to help pass this test (events from 8 Feb 2018)' : ''}. For holdings in another company or trust, enter the participation % and that entity's active and total asset values: the tool looks through to its share of the underlying assets.</p>
      <div class="tw"><table class="t"><thead><tr><th>Balance sheet item</th><th>Category</th><th class="num">Market value</th><th></th><th></th></tr></thead><tbody>${bsRows}
      <tr class="tot"><td colspan="2">Active assets / total</td><td class="num">${R.e80 ? money(R.e80.nmr) + ' / ' + money(R.e80.den) : '—'}</td><td colspan="2"><b>${R.e80 && R.e80.pct != null ? pct(R.e80.pct, 1) : '—'}</b> (80% needed)</td></tr></tbody></table></div>
      ${addBtn('aat.bs', 'bs', 'Add balance sheet item')}` : ''}`}
    ${checks(R.aatItems)}
    ${res(R.aatS, R.aatS === 'pass' ? 'Active asset test passed' : R.aatS === 'fail' ? 'Active asset test failed: the concessions are not available' : 'Complete the active asset test')}
    ${notes('aat')}</div>`;
};

P.mnav = () => {
    const list = R.entList.filter(e => e.rel !== 'other' || inObjGroup(e));
    const card = e => {
        const base = e.id === 'tp' ? 'tpm' : `entities.${S.entities.findIndex(x => x.id === e.id)}`;
        const d = e.data, rr = R.ents[e.id];
        const isIndLike = e.type === 'individual';
        const treats = ASSET_TREAT.filter(([k]) => (isIndLike || !['home', 'personal', 'super'].includes(k)) && (e.rel === 'tp' || e.rel === 'connected' ? !['notbiz', 'affonly'].includes(k) : true));
        return `<div class="ent${e.id === 'tp' ? ' tp' : ''}"><div class="eh"><b>${esc(e.name)}</b><span class="muted" style="font-size:12px">${e.rel === 'tp' ? 'Taxpayer' : REL_NAME[e.rel]} · ${TYPE_NAME[e.type] || e.type} ${entTag(e)}</span></div>
        <div class="tw"><table class="t"><thead><tr><th>CGT asset</th><th class="num">Market value</th><th>Treatment</th><th class="num">Counted</th><th></th></tr></thead><tbody>
        ${(d.assets || []).map((x, i) => `<tr><td>${tin(`${base}.assets.${i}.desc`)}</td><td style="width:140px">${tmon(`${base}.assets.${i}.mv`)}</td><td>${tsel(`${base}.assets.${i}.treat`, treats)}${x.treat === 'home' ? `<div style="margin-top:4px">${F('Income-producing use %', tpct(`${base}.assets.${i}.use`))}</div>` : ''}</td><td class="num">${o(`ents.${e.id}.a${i}`)}</td><td>${delBtn(`${base}.assets`, i)}</td></tr>`).join('')}
        </tbody></table></div>${addBtn(`${base}.assets`, 'asset', 'Add asset')}
        <div class="tw" style="margin-top:8px"><table class="t"><thead><tr><th>Liability / provision</th><th class="num">Amount</th><th>Deduct?</th><th></th></tr></thead><tbody>
        ${(d.liabs || []).map((x, i) => `<tr><td>${tin(`${base}.liabs.${i}.desc`, '', 'e.g. loan secured over premises; annual leave provision')}</td><td style="width:140px">${tmon(`${base}.liabs.${i}.amt`)}</td><td>${tsel(`${base}.liabs.${i}.treat`, [['inc', 'Yes – related to included assets / provision'], ['exc', 'No – relates to an excluded asset']])}</td><td>${delBtn(`${base}.liabs`, i)}</td></tr>`).join('')}
        </tbody></table></div>${addBtn(`${base}.liabs`, 'liab', 'Add liability or provision')}
        <table class="calc" style="margin-top:8px"><tr><td>Assets counted</td><td>${o(`ents.${e.id}.incl`)}</td></tr><tr><td>Less liabilities and provisions</td><td>${o(`ents.${e.id}.liab`)}</td></tr><tr class="tot"><td>Net value</td><td>${o(`ents.${e.id}.net`)}</td></tr></table></div>`;
    };
    return `<div class="card"><h3>Maximum net asset value test</h3><p class="lead">Just before the CGT event, the net value of the CGT assets of the taxpayer, its connected entities, and its affiliates and entities connected with them must not exceed <b>${money(R.T.mnav)}</b>.</p>
    <details class="more"><summary>What to include and exclude (s152-20)</summary><ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px;color:var(--muted)">
      <li>Net value = market value of CGT assets less related liabilities, and provisions for annual leave, long service leave, unearned income and tax.</li>
      <li>Individuals: exclude personal use assets, superannuation, life insurance, and the main residence (except the proportion used to produce income).</li>
      <li>Exclude shares, units or other interests (except debt) in connected entities, to avoid double counting.</li>
      <li>Connected entities: include the <b>full</b> net value, not just the taxpayer's share (e.g. 100% of a company the client owns 60% of).</li>
      <li>Only entities connected (or affiliates) just before the CGT event count. Entities already sold out of are excluded.</li>
      <li>Affiliates and entities connected with them: only include assets used or held ready for use in the business of the taxpayer or an entity connected with it (not one connected only because of an affiliate).</li>
      <li>Keep evidence supporting the market values.</li></ul></details>
    ${list.length === 1 && !S.noEnts && !S.entities.length ? `<div class="banner">No connected entities or affiliates entered yet. Add them in the <a href="#" data-act="goto" data-step="entities">entities step</a>, or tick "no connected entities".</div>` : ''}
    <div style="margin-top:10px">${list.map(card).join('')}</div>
    <div class="tw"><table class="t"><thead><tr><th>Entity</th><th>Relationship</th><th class="num">Net value</th></tr></thead><tbody>
    ${list.filter(e => R.ents[e.id].counts || e.id === 'tp').map(e => `<tr><td>${esc(e.name)}</td><td>${e.rel === 'tp' ? 'Taxpayer' : REL_NAME[e.rel]}</td><td class="num">${o(`ents.${e.id}.net`)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="2">Total net value</td><td class="num">${o('mnavTotal')}</td></tr></tbody></table></div>
    <div data-o="mnavRes" data-f="html"></div>
    ${notes('mnav')}</div>`;
};

P.sbe = () => {
    const list = R.entList.filter(e => ['tp', 'connected', 'affiliate', 'spouse'].includes(e.rel) || inObjGroup(e));
    const part = e => { const rr = R.ents[e.id]; const t = []; if (e.id !== 'tp' && rr.relT !== false) { if (!rr.inP && e.rel !== 'other') t.push('not connected in prior year – excluded'); else if (rr.partP) t.push('prior year: connected part of year only'); if (!rr.inC && e.rel !== 'other') t.push('not connected in current year – excluded'); else if (rr.partC) t.push('current year: connected part of year only'); } return t.length ? `<div style="font-size:11px;color:var(--amber)">${t.join(' · ')}</div>` : ''; };
    const base = e => e.id === 'tp' ? 'tpm' : `entities.${S.entities.findIndex(x => x.id === e.id)}`;
    return `<div class="card"><h3>CGT small business entity (turnover test)</h3><p class="lead">The taxpayer must carry on a business and have aggregated turnover under <b>${money(R.T.sbe)}</b>. Aggregated turnover = annual turnover of the taxpayer plus its connected entities and affiliates, less dealings between them.${R.T.red !== R.T.sbe ? ` From FY2028 a <b>${money(R.T.red)}</b> threshold applies for the 50% active asset reduction only.` : ''}</p>
    ${yn('tp.business', 'Is the taxpayer carrying on a business?', { ref: '328-110', hint: 'If not, it can\'t be a CGT small business entity. Check the passive-asset routes in the Basic conditions step.' })}
    ${R.post2018 && R.equity ? `<div class="res info"><b>Shares / trust interests (events from 8 Feb 2018)</b>The turnover test can only be used if the taxpayer was carrying on a business just before the CGT event.</div>` : ''}
    <h4>Annual turnover by entity</h4>
    <p class="muted" style="font-size:12.5px">Ordinary income in the course of business (gross, not profit). Exclude retail fuel sales and GST. Enter each entity's <b>full</b> turnover, not the taxpayer's share. Deduct dealings with the taxpayer, connected entities and affiliates. Where an entity was only connected for part of a year (see connection dates in the register), enter only the turnover earned while it was connected. Annualise part-year businesses.</p>
    <div class="tw"><table class="t"><thead><tr><th>Entity</th><th class="num">Prior year turnover</th><th class="num">Less group dealings</th><th class="num">Current year turnover</th><th class="num">Less group dealings</th></tr></thead><tbody>
    ${list.map(e => `<tr><td><b>${esc(e.name)}</b><div class="muted" style="font-size:11px">${e.rel === 'tp' ? 'Taxpayer' : REL_NAME[e.rel]} ${entTag(e)}</div>${part(e)}</td><td>${tmon(`${base(e)}.to.prior`)}</td><td>${tmon(`${base(e)}.to.dPrior`)}</td><td>${tmon(`${base(e)}.to.cur`)}</td><td>${tmon(`${base(e)}.to.dCur`)}</td></tr>`).join('')}
    <tr class="tot"><td>Aggregated turnover</td><td class="num" colspan="2">${o('toPrior')}</td><td class="num" colspan="2">${o('toCur')}</td></tr></tbody></table></div>
    <div class="grid" style="margin-top:10px">${F('Aggregated turnover 2 years before', tmon('sbe.y2'), 'only needed for the "likely" test')}${F('Likely current-year turnover (as at start of year)', tmon('sbe.likely'))}</div>
    <h4>Test result</h4>
    <div data-o="sbeRes" data-f="html"></div>
    ${notes('sbe')}</div>`;
};

P.people = () => {
    if (!R.needPeople) return `<div class="card"><h3>Significant individuals &amp; stakeholders</h3>${res('na', 'Not needed', 'The taxpayer is an individual selling an asset other than shares or a trust interest. Significant individual and stakeholder tests don\'t apply.')}${notes('people')}</div>`;
    const tpCols = R.isEntity, obCols = R.equity;
    const tpIsCo = R.isCo, obIsCo = R.objType === 'company';
    const entName = S.tp.name || TYPE_NAME[S.tp.type];
    const objName = (S.entities.find(e => String(e.id) === String(S.shr.objEnt)) || {}).name || (R.objType === 'company' ? 'the company sold' : 'the trust sold');
    const block = (pre, isCo, i, p, label, target) => {
        const rows = p[pre + 'Ind'] || [];
        return `<h4>${label}</h4>
        <div class="grid" style="grid-template-columns:repeat(${isCo ? 3 : 2},minmax(90px,1fr));gap:6px">${isCo ? F('Voting %', tpct(`people.${i}.${pre}V`)) : ''}${F(isCo ? 'Dividend %' : (pre === 'tp' ? R.isDT : R.objType === 'dtrust') ? 'Income distributed %' : 'Income %', tpct(`people.${i}.${pre}D`))}${F((pre === 'tp' ? R.isDT : R.objType === 'dtrust') ? 'Capital distributed %' : 'Capital %', tpct(`people.${i}.${pre}C`))}</div>
        <div style="margin-top:8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">Held indirectly through other companies / trusts</div>
        ${rows.length ? `<div class="tw"><table class="t"><thead><tr><th>Through (interposed entity)</th><th class="num">Individual's % in it</th><th class="num">Its % in ${esc(target)}</th><th class="num">Indirect</th><th></th></tr></thead><tbody>
          ${rows.map((x, j) => `<tr><td><input type="text" data-k="people.${i}.${pre}Ind.${j}.via" value="${esc(x.via)}" placeholder="Interposed company or trust" list="sbc-entlist"></td><td style="width:110px">${tpct(`people.${i}.${pre}Ind.${j}.a`)}</td><td style="width:110px">${tpct(`people.${i}.${pre}Ind.${j}.b`)}</td><td class="num"><span data-o="pind.${p.id}.${pre}.${j}" data-f="html"></span></td><td>${delBtn(`people.${i}.${pre}Ind`, j)}</td></tr>`).join('')}
          </tbody></table></div>` : ''}
        ${has(p[pre + 'I']) ? `<div class="grid" style="margin-top:6px">${F('Indirect % entered previously', tpct(`people.${i}.${pre}I`))}</div>` : ''}
        <button type="button" class="btn small" style="margin-top:6px" data-act="add" data-path="people.${i}.${pre}Ind" data-tpl="ind">${icon('plus')} Add indirect holding</button>
        <div style="font-size:12.5px;margin-top:8px" data-o="pstat.${p.id}.${pre}" data-f="html"></div>`;
    };
    const cards = S.people.map((p, i) => `<div class="ent${p.isTp ? ' tp' : ''}"><div class="eh"><b><span data-o="pname.${p.id}" data-f="text"></span>${p.isTp ? ' (taxpayer)' : ''}</b>${p.isTp ? '' : delBtn('people', i)}</div>
        <div class="grid">${F('Name', tin(`people.${i}.name`))}${F('Date of birth', tdate(`people.${i}.dob`))}${F('Spouse of', tsel(`people.${i}.spouseOf`, [['', '—']].concat(S.people.filter(x => x.id !== p.id).map(x => [String(x.id), x.name || 'Unnamed']))), 'spouse of a significant individual can be a stakeholder')}</div>
        ${tpCols ? block('tp', tpIsCo, i, p, `Participation in the taxpayer (${esc(entName)})`, entName) : ''}
        ${obCols ? block('ob', obIsCo, i, p, `Participation in ${esc(objName)} (the shares / interest sold)`, objName) : ''}
        </div>`).join('');
    return `<div class="card"><h3>Significant individuals &amp; CGT concession stakeholders</h3>
    <p class="lead">Significant individual: small business participation of at least 20%, direct plus indirect (s152-55). Direct participation is the <b>smallest</b> of the voting, dividend (income) and capital entitlements. Indirect holdings are traced through every interposed company or trust, whether or not it is controlled (s152-70). CGT concession stakeholder: a significant individual, or the spouse of one with a participation above 0% (s152-60).</p>
    <datalist id="sbc-entlist">${S.entities.map(e => `<option value="${esc(e.name)}">`).join('')}</datalist>
    ${obCols ? `<div class="grid">${F('Type of entity sold', tsel('objType', [['company', 'Company'], ['fixed', 'Unit / fixed trust'], ['dtrust', 'Discretionary trust']]))}</div>` : ''}
    <div style="margin-top:10px">${cards}</div>
    ${addBtn('people', 'person', 'Add individual')}
    <div data-o="pTotRes" data-f="html"></div>
    <p class="muted" style="font-size:12px">For discretionary trusts, use the distributions for the year (or the last year one was made). Insert 100% voting where shares are held jointly. Check the constitution or trust deed for different share or unit classes.</p>
    <div data-o="pResult" data-f="html"></div>
    ${notes('people')}</div>`;
};

// Where each basic condition is worked out (step, optional anchor on that page)
const GO = { B1: ['asset'], B2: ['gain'], B3: ['asset'], B4: ['aat'], B5: ['mnav'], C1: ['people'], 'C2.1': ['basic', 'sbc-c21'], 'C2.2': ['basic', 'sbc-c22'], P1: ['basic', 'sbc-p1'] };
const goAttrs = k => { const g = GO[k] || ['basic']; return `data-act="goto" data-step="${g[0]}"${g[1] ? ` data-anchor="${g[1]}"` : ''}`; };
const ROUTE_GO = [['mnav'], ['sbe'], ['basic', 'sbc-routes'], ['basic', 'sbc-routes'], ['basic', 'sbc-routes']];

P.basic = () => {
    const shr = R.equity && R.post2018;
    const routeOpen = R.mnavPass !== true && R.sbe.s !== 'pass';
    const ot = R.objTest || {};
    const objOpts = [['', 'Not in the register – enter figures below']].concat(S.entities.map(e => [String(e.id), e.name || 'Unnamed entity']));
    return `<div class="card"><h3>Basic conditions</h3><p class="lead">Every basic condition must be met to apply any of the four concessions (s152-10). Click a condition to go to where it is worked out.</p>
    <div class="tw"><table class="t"><thead><tr><th></th><th>Condition</th><th class="num">Result</th></tr></thead><tbody>
    ${R.basicItems.map(x => `<tr class="go" ${goAttrs(x.k)}><td style="width:44px"><b>${x.k}</b></td><td>${x.t} <span class="muted" style="font-size:11px">s${x.ref}</span></td><td class="num">${badge(x.s)} <span class="muted">›</span></td></tr>`).join('')}</tbody></table></div>
    <h4 id="sbc-routes">Size / entity tests (B5 – at least one)</h4>
    <table class="t"><tbody>${R.routes.map((x, i) => `<tr class="go" data-act="goto" data-step="${ROUTE_GO[i][0]}"${ROUTE_GO[i][1] ? ` data-anchor="${ROUTE_GO[i][1]}"` : ''}><td>${x.t} <span class="muted" style="font-size:11px">s${x.ref}</span></td><td class="num">${badge(x.s)} <span class="muted">›</span></td></tr>`).join('')}</tbody></table>
    <details class="more"${routeOpen ? ' open' : ''}><summary>Passive asset and partnership routes</summary>
      ${S.tp.partner === 'yes' || S.tp.type === 'individual' || S.tp.type === 'company' ? yn('alt.partnerAsset', 'Is the taxpayer a partner in a partnership that is a CGT small business entity, and the asset an interest in a partnership asset?', { ref: '152-10(1)(c)(iii)', na: true }) : ''}
      ${yn('alt.passive', 'Does the taxpayer not carry on a business (other than in partnership), with the asset used in a business of an affiliate or connected entity that is a CGT small business entity?', { ref: '152-10(1A)', na: true, hint: 'Test the business entity\'s aggregated turnover as if the taxpayer were its affiliate or connected entity.' })}
      ${yn('alt.partnerPassive', 'Is the taxpayer a partner in a CGT SBE partnership, with the asset (not a partnership asset) used in the partnership business, and no other business carried on?', { ref: '152-10(1B)', na: true })}
    </details>
    ${shr ? `<h4 id="sbc-c21">C2.1 – Carrying on a business (shares / trust interests, events from 8 Feb 2018)</h4>
      ${R.mnavPass !== true ? yn('shr.bizBefore', 'Relying on the turnover test: was the taxpayer carrying on a business just before the CGT event?', { ref: '152-10(2)(c)' }) : `<p class="muted" style="font-size:12.5px">Not needed: the taxpayer passes the $6m net asset test.</p>`}
      <h4 id="sbc-c22">C2.2 – The company / trust being sold</h4>
      <p class="muted" style="font-size:12.5px">The company or trust whose shares or interests were sold must itself pass the $6m net asset test or be a CGT small business entity. Test it on its own group only: that entity, its affiliates and entities it controls using a <b>20%</b> control threshold (not the taxpayer's other entities).</p>
      <div class="grid">${F('Company / trust being sold', tsel('shr.objEnt', objOpts), 'pick it from the entities register')}</div>
      ${has(S.shr.objEnt) ? `<p style="font-size:12.5px;margin:8px 0">Group from the register: <b>${esc((ot.grp || []).join(', ') || '—')}</b>. Tick "in the group of the company / trust being sold" on any other entity in the <a href="#" data-act="goto" data-step="entities">register</a> that belongs to it. Enter their assets on the <a href="#" data-act="goto" data-step="mnav">$6m page</a> and turnover on the <a href="#" data-act="goto" data-step="sbe">turnover page</a>.</p>` : ''}
      <table class="calc"><tr><td>Group net asset value ${ot.netV != null ? `<span class="muted" style="font-size:11px">(${ot.netSrc})</span>` : ''}</td><td>${ot.netV != null ? money(ot.netV) + ' ' + badge(ot.on ? 'pass' : 'fail', ot.on ? '≤ ' + money(R.T.mnav) : 'over') : '—'}</td></tr>
        <tr><td>Group aggregated turnover ${ot.turnV != null ? `<span class="muted" style="font-size:11px">(${ot.turnSrc})</span>` : ''}</td><td>${ot.turnV != null ? money(ot.turnV) + ' ' + badge(ot.ot ? 'pass' : 'fail', ot.ot ? '< ' + money(R.T.sbe) : 'over') : '—'}</td></tr></table>
      <details class="more"${has(S.shr.objNet) || has(S.shr.objTurn) ? ' open' : ''}><summary>Enter the figures directly instead (overrides the register)</summary>
        <div class="grid" style="margin-top:8px">${F('Group net asset value', tmon('shr.objNet', 'from register'), `must be ≤ ${money(R.T.mnav)}`)}${F('Group aggregated turnover', tmon('shr.objTurn', 'from register'), `must be < ${money(R.T.sbe)}`)}</div></details>
      ${res(ot.s || 'inc', ot.s === 'pass' ? 'C2.2 satisfied' : ot.s === 'fail' ? 'C2.2 not satisfied: the company / trust being sold fails both tests' : 'C2.2 incomplete: choose the company / trust being sold, or enter its figures')}` : ''}
    ${S.asset.kind === 'partnership' ? `<div id="sbc-p1">${yn('shr.membership', 'Is the right or interest in partnership income / capital a membership interest (the entity is, or becomes, a partner)?', { ref: '152-10(2C)', hint: 'Assignments of income or capital only (e.g. Everett assignments) on or after 8 May 2018 don\'t qualify.' })}</div>` : ''}
    ${res(R.basicS, R.basicS === 'pass' ? (R.viaEstate ? 'Basic conditions met through the deceased estate rules' : 'Basic conditions satisfied') : R.basicS === 'fail' ? 'Basic conditions not satisfied' : 'Some conditions are incomplete', R.basicS === 'pass' ? 'At least some concessions can apply. Continue to the 15 year exemption.' : '')}
    ${R.basicS === 'fail' || R.viaEstate ? `<h4>Deceased estate (s152-80)</h4>
      ${yn('dec.deceased', 'Was the asset owned by a deceased individual (estate asset, or passed to a surviving joint tenant)?')}
      ${yes(S.dec.deceased) ? yn('dec.could', 'Could the deceased have applied the concessions if the CGT event had happened just before death?', { hint: 'Work through the basic conditions as if the taxpayer were the deceased.' }) : ''}
      ${yes(S.dec.deceased) ? yn('dec.within2', 'Did the CGT event happen within 2 years of death (or a longer period allowed by the Commissioner)?') : ''}` : ''}
    ${notes('basic')}</div>`;
};

P.fifteen = () => {
    if (!R.basicOk) return `<div class="card"><h3>15 year exemption</h3>${res('na', 'Basic conditions not yet satisfied', 'Complete the basic conditions first.')}${notes('fifteen')}</div>`;
    const ind = R.isInd;
    const sis = S.people.map((p, i) => ({ p, i, rr: R.people[p.id] })).filter(x => x.rr && x.rr.siTp);
    return `<div class="card"><h3>15 year exemption</h3><p class="lead">The whole capital gain is disregarded, and capital losses are not applied against it. If available, no other concession is needed.</p>
    ${ind ? `<div class="grid">${F('Taxpayer date of birth', tdate('tp.dob'))}${F('Age at CGT event', `<input type="text" disabled value="${R.tpAge ?? '—'}">`)}</div>
      ${yn('tp.retireConn', 'Did the CGT event happen in connection with the taxpayer\'s retirement?', { hint: 'Retirement can be a significant reduction in hours or a change in role; it does not have to be complete or permanent.' })}
      ${yn('tp.incap', 'Was the taxpayer permanently incapacitated at the time of the CGT event?')}
      ${R.equity ? `<div class="grid">${F('Years the company / trust had a significant individual (during ownership)', tin('f15.siYears', 'pct'))}</div>` : ''}`
    : `<div class="grid">${F('Years the entity had a significant individual during ownership', tin('f15.siYears', 'pct'), 'need not be continuous or the same person')}</div>
      ${R.isDT ? yn('f15.dtLoss', 'Discretionary trust with loss years: is the 15 years satisfied using the special rules for years with no distributions?', { ref: '152-110(1A)', hint: 'Events from 22 March 2012: in a loss year with no distributions, use the distributions in the year of the CGT event, or the last year a distribution was made.' }) : ''}
      <h4>Significant individuals just before the CGT event</h4>
      ${sis.length ? `<div class="tw"><table class="t"><thead><tr><th>Name</th><th>Age at event</th><th>In connection with retirement?</th><th>Permanently incapacitated?</th></tr></thead><tbody>
        ${sis.map(x => `<tr><td>${esc(x.p.name || 'Unnamed')}</td><td>${x.rr.age ?? '<span class="muted">add DOB</span>'}</td><td>${tsel(`people.${x.i}.retire`, [['', '—'], ['yes', 'Yes'], ['no', 'No']])}</td><td>${tsel(`people.${x.i}.incap`, [['', '—'], ['yes', 'Yes'], ['no', 'No']])}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="banner">No significant individuals identified. Add them in the <a href="#" data-act="goto" data-step="people">significant individuals step</a>.</div>`}`}
    ${checks(R.f15Items)}
    ${res(R.f15S === 'pass' ? 'pass' : R.f15S, R.f15 ? `15 year exemption applies: ${money(R.gross)} disregarded` : R.f15S === 'fail' ? '15 year exemption not available: consider the other concessions' : 'Complete the questions above')}
    ${R.f15 && !ind ? `<h4>Exempt payments to CGT concession stakeholders</h4>
      <p class="muted" style="font-size:12.5px">${R.isDT ? 'Discretionary trust: each stakeholder\'s percentage is 100% divided by the number of stakeholders.' : 'Each stakeholder\'s small business participation percentage.'} Pay within 2 years of the CGT event (by <b>${fdate(R.f15Due)}</b>) so the payments are not assessable.</p>
      <div class="tw"><table class="t"><thead><tr><th>Stakeholder</th><th class="num">Participation</th><th class="num">Maximum exempt payment</th></tr></thead><tbody>${(R.f15Pay || []).map(x => `<tr><td>${esc(x.name)}</td><td class="num">${pct(x.part, 2)}</td><td class="num">${money(x.amt)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${R.f15 ? `<div class="res info"><b>Super contributions – CGT cap (s292-100)</b>Proceeds can be contributed under the lifetime CGT cap (${R.rt.cgtCap ? money(R.rt.cgtCap) : 'not yet announced'} for ${R.rt.name}). ${ind ? 'Contribute by the later of the tax return due date and 30 days after receiving the proceeds.' : 'Stakeholders contribute within 30 days of receiving the payment.'} Give the fund the election form on or before contributing. Total super balance does not prevent use of the CGT cap.</div>` : ''}
    ${notes('fifteen')}</div>`;
};

P.reduction = () => {
    if (!R.redAvail) return `<div class="card"><h3>50% active asset reduction</h3>${res('na', R.f15 ? 'Not needed: 15 year exemption applies' : 'Basic conditions not satisfied', '')}${notes('reduction')}</div>`;
    const g2 = R.W.afterLoss - R.W.disc;
    return `<div class="card"><h3>50% active asset reduction</h3><p class="lead">Reduces the gain remaining after capital losses and the CGT discount by 50%. Applies automatically unless the taxpayer chooses not to.</p>
    ${R.T.red !== R.T.sbe ? `<div class="res info"><b>FY2028 onwards</b>For this concession only, the turnover threshold is ${money(R.T.red)}. ${R.basicOk ? '' : 'The basic conditions are met using the higher threshold.'}</div>` : ''}
    ${yn('conc.apply50', 'Apply the 50% active asset reduction?', { ref: '152-205' })}
    ${(R.isCo || S.tp.type === 'utrust') ? `<div class="banner"><b>Consider not applying it.</b> For companies and unit trusts, skipping the reduction can allow a larger tax-free payment to CGT concession stakeholders under the retirement exemption. A reduced gain that is later distributed by a company may be taxed as a dividend.</div>` : ''}
    ${R.isInd ? `<p class="muted" style="font-size:12.5px">An individual may choose not to apply it to contribute more to super under the retirement exemption and the CGT cap.</p>` : ''}
    ${S.tp.type === 'company' ? `<p class="muted" style="font-size:12.5px">If the company will be wound up, consider whether a liquidation distribution helps pass the reduced amount to shareholders tax-efficiently.</p>` : ''}
    <table class="calc"><tr><td>Gain after losses and discount</td><td>${money(g2)}</td></tr><tr><td>50% active asset reduction</td><td>${money(R.W.red)}</td></tr><tr class="tot"><td>Gain remaining</td><td>${money(g2 - R.W.red)}</td></tr></table>
    ${!yes(S.conc.apply50) ? `<p class="muted" style="font-size:12.5px">Record the reason for choosing not to apply the reduction in the file notes.</p>` : ''}
    ${notes('reduction')}</div>`;
};

P.retire = () => {
    if (!R.basicOk || R.f15) return `<div class="card"><h3>Retirement exemption</h3>${res('na', R.f15 ? 'Not needed: 15 year exemption applies' : 'Basic conditions not satisfied', '')}${notes('retire')}</div>`;
    const ind = R.isInd;
    const head = `<div class="card"><h3>Retirement exemption</h3><p class="lead">Disregards a chosen CGT exempt amount up to the ${money(R.T.ret)} lifetime limit per individual. The choice must be made in writing by the time the return is lodged.</p>`;
    if (ind) {
        return head + `<div class="grid">${F('Retirement exemption already used', tmon('tp.priorUsed'), 'lifetime, before this event')}${F('Date of birth', tdate('tp.dob'))}${F('Date choice made', tdate('tp.choiceDate'), 'can be just before lodgement')}${F('Date capital proceeds received', tdate('tp.proceedsDate'))}</div>
        <table class="calc" style="margin-top:10px"><tr><td>Lifetime limit</td><td>${money(R.T.ret)}</td></tr><tr><td>Remaining limit</td><td>${money(R.retRemaining)}</td></tr><tr><td>Gain available after the 50% reduction</td><td>${money(R.W.g3)}</td></tr><tr class="tot"><td>Maximum exempt amount</td><td>${money(R.retMax)}</td></tr></table>
        <div class="grid" style="margin-top:10px;align-items:end">${F('CGT exempt amount to apply', tmon('conc.retAmt'))}<div><button type="button" class="btn small" data-act="maxret">Use maximum</button></div></div>
        ${R.retCapped ? `<div class="banner">The amount entered is more than the maximum; ${money(R.retMax)} has been used.</div>` : ''}
        ${R.retAge == null ? '' : R.retSuper ? `<div class="res warn"><b>Under 55 when the choice is made (age ${R.retAge})</b>The exempt amount must be contributed to a complying super fund or RSA by the later of making the choice and receiving the proceeds${R.retDue ? `: <b>${fdate(R.retDue)}</b>` : ''}. For J2, J5 or J6 gains, contribute when the choice is made.</div>` : `<div class="res pass"><b>55 or over when the choice is made (age ${R.retAge})</b>No super contribution is required.</div>`}
        <div class="res info"><b>CGT cap</b>A contribution of the exempt amount can count toward the lifetime CGT cap (${R.rt.cgtCap ? money(R.rt.cgtCap) : 'not yet announced'}) if made by the later of the return due date and 30 days after receiving the proceeds, with the election form given to the fund at or before contributing.</div>
        ${notes('retire')}</div>`;
    }
    const rows = R.retRows || [];
    return head + `${!R.siTpAny ? res('fail', 'No significant individual just before the CGT event', 'A company or trust must satisfy the significant individual test to use the retirement exemption (s152-305(2)).') : ''}
    <div class="grid">${F('Date choice made', tdate('tp.choiceDate'))}${F('Date capital proceeds received', tdate('tp.proceedsDate'))}</div>
    <h4>CGT concession stakeholders</h4>
    ${rows.length ? `<div class="tw"><table class="t"><thead><tr><th>Stakeholder</th><th>Age</th><th class="num">Limit already used</th><th class="num">% of exempt amount</th><th class="num">Share</th><th class="num">Remaining limit</th><th>Paid as</th></tr></thead><tbody>
      ${rows.map(x => { const i = S.people.findIndex(p => p.id === x.id); return `<tr><td>${esc(x.name)}</td><td>${x.age ?? '—'}</td><td style="width:130px">${tmon(`people.${i}.priorUsed`)}</td><td style="width:90px">${tpct(`people.${i}.retPct`)}</td><td class="num">${money(x.amt || 0)}${x.over ? ' ' + badge('fail', 'over limit') : ''}</td><td class="num">${money(x.rem)}</td><td>${x.age == null ? '<span class="muted">add DOB</span>' : x.age < SBC_RULES.retirementAge ? 'Super contribution' : 'Direct payment'}</td></tr>`; }).join('')}
      <tr class="tot"><td colspan="3">Total</td><td class="num">${pct(R.retPctTot, 2)}</td><td class="num">${money(R.W.ret)}</td><td colspan="2"></td></tr></tbody></table></div>
      ${Math.abs(R.retPctTot - 1) > 1e-6 ? `<div class="banner">Stakeholder percentages must add up to 100% (some can be nil).</div>` : ''}`
    : `<div class="banner">No CGT concession stakeholders identified. Add them in the <a href="#" data-act="goto" data-step="people">significant individuals step</a>.</div>`}
    <table class="calc" style="margin-top:10px"><tr><td>Gain available after the 50% reduction</td><td>${money(R.W.g3)}</td></tr><tr class="tot"><td>Maximum exempt amount (within each stakeholder's limit)</td><td>${money(R.retMax)}</td></tr></table>
    <div class="grid" style="margin-top:10px;align-items:end">${F('CGT exempt amount to apply', tmon('conc.retAmt'))}<div><button type="button" class="btn small" data-act="maxret">Use maximum</button></div></div>
    ${R.retCapped ? `<div class="banner">The amount entered is more than the maximum; ${money(R.retMax)} has been used.</div>` : ''}
    <div class="res info"><b>Payments</b>Pay each stakeholder's share by the later of 7 days after the choice and 7 days after receiving the proceeds${R.retDue ? `: <b>${fdate(R.retDue)}</b>` : ''}. For stakeholders <b>55 or over</b>, pay them directly. For those <b>under 55</b>, contribute directly to their complying super fund or RSA and notify the trustee that it is made under s152-325. For J2, J5 or J6 gains, pay by the time the choice is made.</div>
    ${notes('retire')}</div>`;
};

P.rollover = () => {
    if (!R.basicOk || R.f15) return `<div class="card"><h3>Roll-over relief</h3>${res('na', R.f15 ? 'Not needed: 15 year exemption applies' : 'Basic conditions not satisfied', '')}${notes('rollover')}</div>`;
    const rp = S.conc.repl;
    return `<div class="card"><h3>Small business roll-over</h3><p class="lead">Defers all or part of the remaining gain. The gain crystallises (CGT event J5 / J6) if replacement active assets aren't acquired, or capital expenditure on them isn't incurred, from 1 year before to 2 years after the last CGT event in the year. Unlike most roll-overs, it doesn't change the replacement asset's cost base.</p>
    <table class="calc"><tr><td>Gain remaining after the retirement exemption</td><td>${money(R.W.g4)}</td></tr></table>
    <div class="grid" style="margin-top:10px;align-items:end">${F('Capital gain to roll over', tmon('conc.rollAmt'))}<div><button type="button" class="btn small" data-act="maxroll">Roll over all</button></div></div>
    ${R.rollCapped ? `<div class="banner">The amount entered is more than the gain remaining; ${money(R.W.g4)} has been used.</div>` : ''}
    <p class="muted" style="font-size:12.5px">The roll-over can be chosen without planning to buy replacement assets, to defer the gain for 2 years. If the client is 53–55, deferring may let the retirement exemption apply later without a super contribution.</p>
    <h4>Replacement asset period</h4>
    <div class="grid">${F('Window opens', `<input type="text" disabled value="${fdate(R.winStart)}">`)}${F('Window closes', `<input type="text" disabled value="${fdate(R.winEnd)}">`)}</div>
    <h4>Replacement assets</h4>
    <div class="tw"><table class="t"><thead><tr><th>Asset</th><th>Type</th><th>Acquired</th><th>Became active</th><th class="num">Cost / capital expenditure</th><th></th><th></th></tr></thead><tbody>
    ${rp.map((x, i) => `<tr><td>${tin(`conc.repl.${i}.desc`)}</td><td>${tsel(`conc.repl.${i}.kind`, [['asset', 'Active asset / improvement'], ['equity', 'Shares / trust interest']])}</td><td>${tdate(`conc.repl.${i}.acq`)}</td><td>${tdate(`conc.repl.${i}.active`)}</td><td style="width:140px">${tmon(`conc.repl.${i}.cost`)}</td><td>${R.repl[i] && D(x.acq) ? badge(R.repl[i].inWin ? 'pass' : 'fail', R.repl[i].inWin ? 'in window' : 'outside') : ''}</td><td>${delBtn('conc.repl', i)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="4">Qualifying expenditure</td><td class="num">${money(R.replCost)}</td><td colspan="2"></td></tr></tbody></table></div>
    ${addBtn('conc.repl', 'repl', 'Add replacement asset')}
    ${rp.some(x => x.kind === 'equity') ? `<div class="res info"><b>Replacement shares or trust interests</b>${R.isInd ? 'The taxpayer (or a connected entity) must be a CGT concession stakeholder of the company / trust.' : 'The 90% test must be satisfied for the object company / trust.'} The 80% test applies to the replacement shares or interests.</div>` : ''}
    ${R.W.roll > 0 ? (R.j6 > 0 ? `<div class="res warn"><b>${money(R.j6)} would crystallise at ${fdate(R.winEnd)}</b>${R.replCost ? 'Qualifying expenditure is less than the rolled-over gain (CGT event J6).' : 'No replacement asset yet (CGT event J5). Diary a follow-up.'} The retirement exemption may be available for the crystallised gain.</div>` : `<div class="res pass"><b>Rolled-over gain covered by replacement expenditure</b>Review each year: if a replacement asset is disposed of, stops being active, or becomes trading stock, CGT event J2 happens.</div>`) : ''}
    ${notes('rollover')}</div>`;
};

P.result = () => {
    return `<div class="card"><h3>Net capital gain</h3><p class="lead">Concessions applied in the order the law requires. Include the net capital gain in the return for the income year of the CGT event.</p>
    ${calcTable('calc')}
    ${followUps().length ? `<h4>Follow-ups &amp; deadlines</h4><ul style="margin:0 0 0 18px;padding:0;font-size:13px">${followUps().map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    <div class="navrow" style="margin-top:14px"><span class="muted" style="font-size:12.5px">The report below is what prints. Use <b>Save case</b> to keep an editable copy.</span><button type="button" class="btn primary" data-act="print">${icon('printer')} Print report</button></div>
    ${notes('result')}</div>`;
};

function calcTable(cls) {
    const W = R.W;
    const rows = [['Capital proceeds', R.proceeds], ['Less: cost base', -R.cb], ['Gross capital gain', R.gross, 'b']];
    if (R.f15) rows.push(['Less: 15 year exemption (whole gain disregarded)', -W.f15]);
    else {
        rows.push(['Less: capital losses applied', -W.lossUsed]);
        rows.push([`Less: CGT discount (${pct(R.discPct, 2)})`, -W.disc]);
        rows.push(['Less: 50% small business active asset reduction', -W.red]);
        rows.push(['Less: small business retirement exemption', -W.ret]);
        rows.push(['Less: small business roll-over', -W.roll]);
    }
    rows.push(['Net capital gain', W.net, 'tot']);
    if (cls === 'calc') return `<table class="calc">${rows.map(([t, v, c]) => `<tr class="${c === 'tot' ? 'tot' : ''}"><td>${c === 'b' ? '<b>' + t + '</b>' : t}</td><td>${money(v)}</td></tr>`).join('')}</table>`;
    return `<table>${rows.map(([t, v, c]) => `<tr class="${c === 'tot' ? 'tot' : ''}"><td>${c === 'b' ? '<b>' + t + '</b>' : t}</td><td class="n">${money(v)}</td></tr>`).join('')}</table>`;
}

function followUps() {
    const f = [];
    const W = R.W;
    if (R.f15 && R.isEntity && R.f15Pay && R.f15Pay.length) f.push(`Pay exempt amounts to CGT concession stakeholders by <b>${fdate(R.f15Due)}</b> (2 years after the CGT event).`);
    if (R.f15) f.push('Consider CGT cap super contributions (s292-100) and lodge the election with the fund at or before contributing.');
    if (W.ret > 0) {
        f.push('Make the retirement exemption choice in writing (CGT exempt amount' + (R.isEntity ? ' and each stakeholder\'s percentage' : '') + ') before the return is lodged.');
        if (R.isInd && R.retSuper) f.push(`Contribute ${money(W.ret)} to a complying super fund / RSA${R.retDue ? ` by <b>${fdate(R.retDue)}</b>` : ' (later of choice and receipt of proceeds)'}.`);
        if (R.isEntity) f.push(`Make retirement exemption payments / super contributions for stakeholders${R.retDue ? ` by <b>${fdate(R.retDue)}</b>` : ' within 7 days of the later of the choice and receipt of proceeds'}.`);
        f.push(`Update the retirement exemption lifetime limit records${R.isInd ? ` (remaining after this event: ${money(Math.max(R.retRemaining - W.ret, 0))})` : ' for each stakeholder'}.`);
    }
    if (W.roll > 0) {
        f.push(`Acquire replacement active assets or incur capital expenditure by <b>${fdate(R.winEnd)}</b>; otherwise ${money(R.j6)} crystallises (J5 / J6).`);
        f.push('Review replacement assets each year (J2 if disposed of, no longer active, or held as trading stock). Check any transfers under the small business restructure roll-over.');
    }
    if ((R.isTrust || R.isSuper) && W.net > 0) f.push(`Trust beneficiaries gross up their share of the gain (×${W.red > 0 && W.disc > 0 ? 4 : W.disc > 0 || W.red > 0 ? 2 : 1}) before applying their own losses and discount.`);
    if (R.reform && (R.isInd || R.isTrust)) f.push('CGT event on or after 1 July 2027: confirm the 1 July 2027 market value / apportionment split and any 30% minimum tax.');
    return f;
}

/* ======================= sidebar & nav ======================= */
function renderNav() {
    let h = '', n = 0;
    STEPS.forEach(s => { if (s.g) h += `<div class="grp">${s.g}</div>`; n++; const st = R.st[s.id]; h += `<button type="button" data-act="goto" data-step="${s.id}" class="${s.id === step ? 'active' : ''}"><span class="n">${n}</span><span>${s.t.replace('$6m', money(R.T.mnav).replace(',000,000', 'm')).replace('$2m', money(R.T.sbe).replace(',000,000', 'm'))}</span>${st ? `<span class="dot ${st === 'inc' ? '' : st}"></span>` : ''}</button>`; });
    $('#sbc-nav').innerHTML = h;
}
function renderSide() {
    const W = R.W;
    const line = (t, v, neg) => `<div class="bc"><span>${t}</span><b>${neg && v ? '(' + money(v) + ')' : money(v)}</b></div>`;
    $('#sbc-side').innerHTML = `<div class="card"><h5>Running calculation</h5>
      ${line('Gross capital gain', R.gross)}
      ${R.f15 ? line('15 year exemption', W.f15, 1) : line('Capital losses', W.lossUsed, 1) + line('CGT discount', W.disc, 1) + line('50% reduction', W.red, 1) + line('Retirement exemption', W.ret, 1) + line('Roll-over', W.roll, 1)}
      <div style="margin-top:10px"><div class="muted" style="font-size:11px;text-transform:uppercase;font-weight:800;letter-spacing:.5px">Net capital gain</div><div class="big">${money(W.net)}</div></div></div>
      <div class="card"><h5>Basic conditions</h5>
      ${R.basicItems.map(x => `<div class="bc go" ${goAttrs(x.k)} title="Go to this test"><span>${x.k} ${x.t.length > 46 ? x.t.slice(0, 44) + '…' : x.t}</span>${badge(x.s)}</div>`).join('')}
      <div style="margin-top:8px">${badge(R.basicS, R.basicS === 'pass' ? 'Basic conditions met' : R.basicS === 'fail' ? 'Not met' : 'Incomplete')}</div></div>
      <div class="card"><h5>Thresholds – ${esc(R.fyName)}</h5>
      <div class="bc"><span>Net asset value</span><b>${money(R.T.mnav)}</b></div><div class="bc"><span>CGT SBE turnover</span><b>${money(R.T.sbe)}</b></div>${R.T.red !== R.T.sbe ? `<div class="bc"><span>50% reduction turnover</span><b>${money(R.T.red)}</b></div>` : ''}<div class="bc"><span>Retirement limit</span><b>${money(R.T.ret)}</b></div><div class="bc"><span>CGT cap</span><b>${R.rt.cgtCap ? money(R.rt.cgtCap) : 'TBA'}</b></div></div>`;
}

function renderMain() {
    const s = STEPS.find(x => x.id === step) || STEPS[0];
    const idx = STEPS.indexOf(s);
    const flags = R.flags.length ? R.flags.map(f => `<div class="banner">${f}</div>`).join('') : '';
    $('#sbc-main').innerHTML = flags + P[s.id]() + `<div class="navrow">${idx > 0 ? `<button type="button" class="btn" data-act="goto" data-step="${STEPS[idx - 1].id}">${icon('arrow-left')} ${STEPS[idx - 1].t}</button>` : '<span></span>'}${idx < STEPS.length - 1 ? `<button type="button" class="btn primary" data-act="goto" data-step="${STEPS[idx + 1].id}">${STEPS[idx + 1].t} ${icon('arrow-right')}</button>` : ''}</div>`;
    $('#sbc-report-wrap').classList.toggle('hidden', step !== 'result');
}

function fillOutputs() {
    const root = ROOT();
    // per-asset counted values
    R.entList.forEach(e => (e.data.assets || []).forEach((x, i) => { const mv = num(x.mv); R.ents[e.id]['a' + i] = x.treat === 'inc' ? mv : x.treat === 'home' ? mv * Math.min(Math.max(num(x.use), 0), 100) / 100 : 0; }));
    R.gainRes = res(R.gainS, R.gainS === 'pass' ? 'Capital gain arises' : R.gainS === 'fail' ? (R.loss > 0 ? `Capital loss of ${money(R.loss)}: the concessions do not apply` : 'No capital gain: the concessions do not apply') : 'Enter capital proceeds and cost base');
    root.querySelectorAll('.rcbcol').forEach(el => el.classList.toggle('hidden', !(R.gainEntered && R.diff < 0)));
    R.mnavRes = R.mnavPass == null ? res('inc', 'Enter asset values') : res(R.mnavPass ? 'pass' : 'fail', R.mnavPass ? `Maximum net asset value test passed: ${money(R.mnavTotal)} ≤ ${money(R.T.mnav)}` : `Maximum net asset value test failed: ${money(R.mnavTotal)} exceeds ${money(R.T.mnav)}`, !R.mnavPass ? (R.sbePass ? 'The turnover test is passed, so the basic conditions can still be met.' : 'Check the turnover test or the passive asset routes.') : '');
    const sbeBlock = (x, T, lbl) => checks(x.steps) + res(x.s, x.s === 'pass' ? `${lbl}: CGT small business entity (${x.why.toLowerCase()})` : x.s === 'fail' ? `${lbl}: not a CGT small business entity` : `${lbl}: incomplete`, '');
    R.sbeRes = sbeBlock(R.sbe, R.T.sbe, money(R.T.sbe) + ' test') + (R.T.red !== R.T.sbe ? sbeBlock(R.sbe10, R.T.red, money(R.T.red) + ' test (50% reduction only)') : '');
    // --- significant individuals: live names, participation and status
    R.pname = {}; R.pstat = {}; R.pind = {};
    S.people.forEach((p, i) => {
        const rr = R.people[p.id] || {};
        R.pname[p.id] = p.name || 'Individual ' + (i + 1);
        R.pstat[p.id] = {}; R.pind[p.id] = {};
        ['tp', 'ob'].forEach(pre => {
            const d = rr[pre + 'D'] || {}, part = rr[pre + 'Part'], si = rr['si' + (pre === 'tp' ? 'Tp' : 'Ob')], st = rr['st' + (pre === 'tp' ? 'Tp' : 'Ob')];
            R.pind[p.id][pre] = {};
            (p[pre + 'Ind'] || []).forEach((x, j) => { R.pind[p.id][pre][j] = has(x.a) && has(x.b) ? pct(num(x.a) * num(x.b) / 10000, 2) : '—'; });
            const sp = S.people.find(x => String(x.id) === String(p.spouseOf));
            const spNote = !si && st && sp ? ` (spouse of ${esc(sp.name || 'a significant individual')})` : '';
            R.pstat[p.id][pre] = d.err ? `<span class="badge fail">Check</span> <b style="color:var(--red)">${d.err}</b>`
                : part == null ? '<span class="muted">Enter holdings to calculate participation.</span>'
                : `Direct <b>${pct(d.direct, 2)}</b> + indirect <b>${pct(d.ind, 2)}</b> = participation <b>${pct(part, 2)}</b> · ${badge(si ? 'pass' : 'na', si ? 'Significant individual' : 'Not significant (under 20%)')} ${st ? badge('pass', 'CGT concession stakeholder') + spNote : ''}`;
        });
    });
    const totNote = (t, label) => { const w = []; if (t.D > 100.0001) w.push(`dividend / income entitlements total ${t.D}%`); if (t.C > 100.0001) w.push(`capital entitlements total ${t.C}%`); const v = t.V > 100.0001 ? ` Voting totals ${t.V}%, which is only possible where shares are held jointly (each joint holder counts 100%).` : ''; return w.length ? res('warn', `${label}: ${w.join(' and ')}, more than 100%`, 'Direct entitlements of all individuals can\'t add up to more than 100%. Check the figures.' + v) : v ? res('info', label, v.trim()) : ''; };
    R.pTotRes = (R.isEntity ? totNote(R.pTot.tp, 'Taxpayer') : '') + (R.equity ? totNote(R.pTot.ob, 'Entity sold') : '');
    R.pResult = !R.needPeople ? '' : (R.equity ? (R.isInd ? res(R.stakeS, R.stakeS === 'pass' ? 'Taxpayer is a CGT concession stakeholder' : R.stakeS === 'fail' ? 'Taxpayer is not a CGT concession stakeholder' : 'Enter the taxpayer\'s participation in the entity sold', R.stakeWhy || '')
        : res(R.stakeS, R.stakeS === 'pass' ? '90% test satisfied' : R.stakeS === 'fail' ? '90% test not satisfied' : 'Add the individuals', R.stakeWhy || '')) : '')
        + (R.isEntity ? res(R.siTpAny ? 'pass' : 'warn', R.siTpAny ? 'The taxpayer has at least one significant individual' : 'No significant individual of the taxpayer identified', 'Needed for the 15 year exemption and the retirement exemption.') : '');
    // --- entities: live names and control check result
    R.entName = {}; R.entSugg = {};
    S.entities.forEach((e, i) => {
        R.entName[e.id] = e.name || 'Entity ' + (i + 1);
        const sg = ctlSuggest(e);
        R.entSugg[e.id] = (sg && sg.rel ? `<div class="res info"><b>${e.relAuto ? 'Relationship set to' : 'Control check suggests'}: ${REL_NAME[sg.rel]}</b>${sg.t}${!e.relAuto && sg.rel !== e.rel ? ` <button type="button" class="btn small" data-act="relauto" data-i="${i}">Use control check</button>` : ''}</div>` : '')
            + (sg && sg.warn ? `<div class="res warn"><b>Indirect holding doesn't count toward control</b>${sg.warn}</div>` : '');
    });
    // --- keep dropdowns in step with names typed elsewhere
    const syncSel = (sel, opts) => { const cur = sel.value; sel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(''); sel.value = opts.some(x => String(x[0]) === cur) ? cur : ''; };
    root.querySelectorAll('select[data-k]').forEach(sel => {
        const k = sel.getAttribute('data-k');
        let m;
        if ((m = /^people\.(\d+)\.spouseOf$/.exec(k))) { const me = S.people[+m[1]]; if (me) syncSel(sel, [['', '—']].concat(S.people.filter(x => x.id !== me.id).map(x => [String(x.id), x.name || 'Unnamed']))); }
        else if ((m = /^entities\.(\d+)\.ctl\.via$/.exec(k))) { const me = S.entities[+m[1]]; if (me) syncSel(sel, [['', '—']].concat(S.entities.filter(x => x.id !== me.id).map(x => [String(x.id), x.name || 'Unnamed entity']))); }
        else if (/^aat\.periods\.\d+\.user$/.test(k)) syncSel(sel, [['tp', S.tp.name || 'Taxpayer']].concat(S.entities.map(e => [String(e.id), e.name || 'Unnamed entity'])));
        else if (k === 'shr.objEnt') syncSel(sel, [['', 'Not in the register – enter figures below']].concat(S.entities.map(e => [String(e.id), e.name || 'Unnamed entity'])));
        else if ((m = /^entities\.(\d+)\.rel$/.exec(k))) { const me = S.entities[+m[1]]; if (me && sel.value !== me.rel) sel.value = me.rel; }
    });
    root.querySelectorAll('[data-o]').forEach(el => {
        const k = el.getAttribute('data-o'), f = el.getAttribute('data-f');
        const v = k.split('.').reduce((o, kk) => (o == null ? undefined : o[kk]), R);
        if (f === 'html') el.innerHTML = v || '';
        else if (f === 'money-in') el.value = money(v || 0);
        else if (f === 'text-in') el.value = v == null ? '' : v;
        else if (f === 'text') el.textContent = v == null ? '' : v;
        else el.textContent = f === 'pct' ? pct(v) : money(v || 0);
    });
}

function report() {
    const c = S.client, a = S.asset, tp = S.tp, W = R.W;
    const st = s => `<span class="st ${s || 'inc'}">${LBL[s] || ''}</span>`;
    const kv = rows => `<table class="kv">${rows.filter(Boolean).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
    const tbl = items => `<table><thead><tr><th>Test</th><th>Ref</th><th class="n">Result</th></tr></thead><tbody>${items.map(x => `<tr><td>${x.t}</td><td>${x.ref ? 's' + x.ref : ''}</td><td class="n">${st(x.s)}</td></tr>`).join('')}</tbody></table>`;
    const note = id => S.notes[id] ? `<div class="note">${esc(S.notes[id])}</div>` : '';
    const g = S.gain;
    const cbRows = [['First element', R.cb1], ['Incidental costs (2nd element)', R.cb2], ['Costs of ownership (3rd element)', R.cb3], ['Capital expenditure (4th element)', R.cb4], ['Title costs (5th element)', R.cb5], ['Less reductions', -R.cbRed]];
    let h = `<div class="rhead"><div><div class="firm">Quin &amp; Bourke</div><h1>Small business CGT concessions – workpaper</h1><div style="color:#4b5563">Division 152 ITAA 1997 · ${esc(R.fyName)}</div></div><div style="text-align:right;font-size:11px">${esc(c.name || '')}${c.code ? '<br>Client code ' + esc(c.code) : ''}</div></div>`;
    h += `<div class="two">${kv([['Client', esc(c.name || '—')], ['Taxpayer', esc(tp.name || '—') + ' (' + TYPE_NAME[tp.type] + ')'], ['Income year', esc(R.fyName)], ['Prepared by', esc(c.preparer || '—') + (c.prepDate ? ' · ' + fdate(D(c.prepDate)) : '')], ['Reviewed by', esc(c.reviewer || '—') + (c.revDate ? ' · ' + fdate(D(c.revDate)) : '')]])}
      ${kv([['Asset', esc(a.desc || '—')], ['Asset type', KIND_NAME[a.kind]], ['CGT event', esc((EVENTS.find(e => e[0] === a.event) || [, a.event])[1])], ['Event date', fdate(R.ev)], ['Acquired', fdate(R.acq) + (yes(a.deemed) && a.deemedDate ? ` (treated as ${fdate(D(a.deemedDate))})` : '')], ['Ownership period', R.ownDays ? R.ownDays.toLocaleString() + ' days (' + R.ownYears.toFixed(2) + ' years)' : '—']])}</div>`;
    h += `<h2>Summary</h2><div class="two"><div>${calcTable('rep')}</div><div>${kv([['Basic conditions', st(R.basicS) + (R.viaEstate ? ' (deceased estate)' : '')], ['15 year exemption', R.f15 ? st('pass') + ' applied' : st(R.basicOk ? (R.f15S === 'inc' ? 'inc' : 'na') : 'na')], ['50% active asset reduction', W.red > 0 ? 'Applied' : R.redAvail ? 'Not applied (choice)' : 'Not available'], ['Retirement exemption', W.ret > 0 ? money(W.ret) : 'Not applied'], ['Roll-over', W.roll > 0 ? money(W.roll) : 'Not applied']])}</div></div>`;
    if (R.flags.length) h += R.flags.map(f => `<div class="note">${f}</div>`).join('');
    h += `<h2>1. CGT event and asset</h2>${tbl(R.gate.items)}${note('setup')}${note('asset')}`;
    h += `<h2>2. Capital gain</h2><div class="two"><table><tbody>${cbRows.map(([t, v]) => `<tr><td>${t}</td><td class="n">${money(v)}</td></tr>`).join('')}<tr class="tot"><td>Cost base</td><td class="n">${money(R.cb)}</td></tr></tbody></table>
      <table><tbody><tr><td>Capital proceeds</td><td class="n">${money(R.proceeds)}</td></tr><tr><td>Cost base</td><td class="n">${money(R.cb)}</td></tr><tr class="tot"><td>Gross capital gain</td><td class="n">${money(R.gross)}</td></tr>${R.loss ? `<tr><td>Capital loss (reduced cost base ${money(R.rcb)})</td><td class="n">${money(R.loss)}</td></tr>` : ''}<tr><td>Capital losses available</td><td class="n">${money(R.lossAvail)}</td></tr></tbody></table></div>${note('gain')}`;
    h += `<h2>3. CGT discount</h2>${R.isCo ? '<p>Not available to companies (s115-10).</p>' : tbl(R.discItems) + `<p>Discount percentage applied: <b>${pct(R.discPct, 2)}</b>${R.discOverride ? ' (override)' : ''}${R.discFactor ? ` – foreign / temporary resident days after 8 May 2012: ${R.discFactor.inel.toLocaleString()}` : ''}.</p>`}${note('discount')}`;
    const ents = R.entList.filter(e => e.id !== 'tp');
    h += `<h2>4. Connected entities and affiliates</h2>${ents.length ? `<table><thead><tr><th>Entity</th><th>Type</th><th>Relationship</th><th>Period</th><th>Basis</th></tr></thead><tbody>${ents.map(e => { const sg = ctlSuggest(e.data); const d = e.data; return `<tr><td>${esc(e.name)}</td><td>${TYPE_NAME[e.type] || e.type}</td><td>${REL_NAME[e.rel]}${d.relAuto === false ? ' (set by hand)' : ''}${inObjGroup(e) ? '<br><span style="color:#6b7280">C2.2 group</span>' : ''}</td><td>${d.connFrom || d.connTo ? `${d.connFrom ? fdate(D(d.connFrom)) : 'throughout'} – ${d.connTo ? fdate(D(d.connTo)) : 'event'}` : 'Throughout'}</td><td>${sg && sg.t ? sg.t : ''}${sg && sg.warn ? '<br>' + sg.warn : ''}</td></tr>`; }).join('')}</tbody></table>` : `<p>${S.noEnts ? 'The taxpayer has no connected entities or affiliates.' : 'None recorded.'}</p>`}${note('entities')}`;
    h += `<h2>5. Active asset test (s152-35)</h2>${a.event !== 'D1' ? kv([['Relevant period', `${fdate(R.start)} – ${fdate(R.relEnd)} (${R.relDays.toLocaleString()} days)${yes(S.aat.ceased) ? ' – business ceased' : ''}`], ['Days active', R.activeDays.toLocaleString()], ['Days required', `${R.needDays.toLocaleString()} (${R.longHold ? '7½ years' : 'half the period'})`]]) : ''}
      ${S.aat.periods.length ? `<table><thead><tr><th>Active from</th><th>To</th><th>Used in business of</th><th>Notes</th></tr></thead><tbody>${S.aat.periods.map(p => `<tr><td>${fdate(D(p.from))}</td><td>${fdate(D(p.to))}</td><td>${p.user === 'tp' ? esc(tp.name || 'Taxpayer') : esc((S.entities.find(e => String(e.id) === String(p.user)) || {}).name || '')}</td><td>${esc(p.note)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${R.equity && S.aat.bs.length ? `<h3>80% test</h3><table><thead><tr><th>Item</th><th>Category</th><th class="n">Market value</th></tr></thead><tbody>${S.aat.bs.map(b => `<tr><td>${esc(b.desc)}</td><td>${BS_NAME[b.cat]}${b.cat === 'cashConn' && b.purpose ? ' – acquired to pass test (excluded)' : ''}${b.cat === 'sub' && has(b.subTotal) ? ` – look-through ${num(b.subPct)}% of ${money(num(b.subActive))} active / ${money(num(b.subTotal))} total` : ''}</td><td class="n">${money(num(b.mv))}</td></tr>`).join('')}<tr class="tot"><td colspan="2">Active / total (${R.e80 && R.e80.pct != null ? pct(R.e80.pct, 1) : '—'})</td><td class="n">${R.e80 ? money(R.e80.nmr) + ' / ' + money(R.e80.den) : ''}</td></tr></tbody></table>` : ''}
      ${tbl(R.aatItems)}${note('aat')}`;
    const mList = R.entList.filter(e => e.rel !== 'other');
    h += `<h2>6. Maximum net asset value test (s152-15)</h2>${mList.map(e => { const d = e.data, rr = R.ents[e.id]; if (!(d.assets || []).length && !(d.liabs || []).length) return ''; return `<h3>${esc(e.name)} – ${e.rel === 'tp' ? 'Taxpayer' : REL_NAME[e.rel]}</h3><table><thead><tr><th>Asset / liability</th><th>Treatment</th><th class="n">Amount</th><th class="n">Counted</th></tr></thead><tbody>${(d.assets || []).map((x, i) => `<tr><td>${esc(x.desc)}</td><td>${TREAT_NAME[x.treat]}${x.treat === 'home' ? ` (${num(x.use)}%)` : ''}</td><td class="n">${money(num(x.mv))}</td><td class="n">${money(rr['a' + i] || 0)}</td></tr>`).join('')}${(d.liabs || []).map(x => `<tr><td>${esc(x.desc)}</td><td>${x.treat === 'exc' ? 'Not deducted' : 'Liability / provision'}</td><td class="n">${money(num(x.amt))}</td><td class="n">${x.treat === 'exc' ? money(0) : '(' + money(num(x.amt)) + ')'}</td></tr>`).join('')}<tr class="tot"><td colspan="3">Net value</td><td class="n">${money(rr.net)}</td></tr></tbody></table>`; }).join('')}
      <table><tbody><tr class="tot"><td>Total net value v ${money(R.T.mnav)}</td><td class="n">${money(R.mnavTotal)} ${st(R.mnavPass == null ? 'inc' : R.mnavPass ? 'pass' : 'fail')}</td></tr></tbody></table>${note('mnav')}`;
    const tList = R.entList.filter(e => ['tp', 'connected', 'affiliate', 'spouse'].includes(e.rel));
    h += `<h2>7. CGT small business entity (s152-10(1AA), s328-110)</h2><p>Carrying on a business: <b>${yes(tp.business) ? 'Yes' : no(tp.business) ? 'No' : '—'}</b></p>
      <table><thead><tr><th>Entity</th><th class="n">Prior year (net)</th><th class="n">Current year (net)</th></tr></thead><tbody>${tList.map(e => `<tr><td>${esc(e.name)}</td><td class="n">${money(R.ents[e.id].pNet)}</td><td class="n">${money(R.ents[e.id].cNet)}</td></tr>`).join('')}<tr class="tot"><td>Aggregated turnover</td><td class="n">${money(R.toPrior)}</td><td class="n">${money(R.toCur)}</td></tr></tbody></table>
      ${tbl(R.sbe.steps)}${R.T.red !== R.T.sbe ? `<p>${money(R.T.red)} test (50% reduction): ${st(R.sbe10.s)}</p>` : ''}${note('sbe')}`;
    if (R.needPeople && S.people.length) {
        h += `<h2>8. Significant individuals and CGT concession stakeholders (s152-50 to 152-75)</h2><table><thead><tr><th>Individual</th><th>Spouse of</th>${R.isEntity ? '<th class="n">In taxpayer</th><th>Status</th>' : ''}${R.equity ? '<th class="n">In object entity</th><th>Status</th>' : ''}</tr></thead><tbody>${S.people.map(p => { const rr = R.people[p.id]; const sp = S.people.find(x => String(x.id) === String(p.spouseOf)); return `<tr><td>${esc(p.name)}${p.isTp ? ' (taxpayer)' : ''}</td><td>${sp ? esc(sp.name) : ''}</td>${R.isEntity ? `<td class="n">${rr.tpPart != null ? pct(rr.tpPart, 2) + (rr.tpD.ind ? `<br><span style="color:#6b7280">${pct(rr.tpD.direct, 2)} + ${pct(rr.tpD.ind, 2)} indirect</span>` : '') : '—'}</td><td>${rr.siTp ? 'Significant individual' : ''}${rr.stTp ? (rr.siTp ? ', ' : '') + 'Stakeholder' : ''}</td>` : ''}${R.equity ? `<td class="n">${rr.obPart != null ? pct(rr.obPart, 2) + (rr.obD.ind ? `<br><span style="color:#6b7280">${pct(rr.obD.direct, 2)} + ${pct(rr.obD.ind, 2)} indirect</span>` : '') : '—'}</td><td>${rr.siOb ? 'Significant individual' : ''}${rr.stOb ? (rr.siOb ? ', ' : '') + 'Stakeholder' : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table>${S.people.some(p => (p.tpInd || []).length || (p.obInd || []).length) ? `<h3>Indirect holdings</h3><table><thead><tr><th>Individual</th><th>In</th><th>Through</th><th class="n">Individual's %</th><th class="n">Entity's %</th><th class="n">Indirect</th></tr></thead><tbody>${S.people.flatMap(p => ['tp', 'ob'].flatMap(pre => (p[pre + 'Ind'] || []).filter(x => has(x.a) && has(x.b)).map(x => `<tr><td>${esc(p.name)}</td><td>${pre === 'tp' ? esc(tp.name || 'Taxpayer') : 'Entity sold'}</td><td>${esc(x.via)}</td><td class="n">${num(x.a)}%</td><td class="n">${num(x.b)}%</td><td class="n">${pct(num(x.a) * num(x.b) / 10000, 2)}</td></tr>`))).join('')}</tbody></table>` : ''}${R.equity ? `<p>${esc(R.stakeWhy || '')} ${st(R.stakeS)}</p>` : ''}${note('people')}`;
    }
    h += `<h2>9. Basic conditions (s152-10)</h2><table><thead><tr><th></th><th>Condition</th><th>Ref</th><th class="n">Result</th></tr></thead><tbody>${R.basicItems.map(x => `<tr><td>${x.k}</td><td>${x.t}</td><td>s${x.ref}</td><td class="n">${st(x.s)}</td></tr>`).join('')}</tbody></table>
      <h3>Size / entity tests</h3>${tbl(R.routes)}${R.objTest ? `<h3>C2.2 – company / trust sold</h3>${kv([['Group', esc((R.objTest.grp || []).join(', ') || 'entered directly')], ['Net asset value', R.objTest.netV != null ? money(R.objTest.netV) + ' (' + R.objTest.netSrc + ')' : '—'], ['Aggregated turnover', R.objTest.turnV != null ? money(R.objTest.turnV) + ' (' + R.objTest.turnSrc + ')' : '—']])}` : ''}${R.viaEstate ? '<p>Basic conditions met through the deceased estate rules (s152-80).</p>' : ''}${note('basic')}`;
    if (R.basicOk) {
        h += `<h2>10. 15 year exemption (Subdiv 152-B)</h2>${tbl(R.f15Items)}${R.f15 && R.f15Pay && R.f15Pay.length ? `<table><thead><tr><th>Stakeholder</th><th class="n">Participation</th><th class="n">Exempt payment</th></tr></thead><tbody>${R.f15Pay.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${pct(x.part, 2)}</td><td class="n">${money(x.amt)}</td></tr>`).join('')}</tbody></table><p>Payments due by ${fdate(R.f15Due)}.</p>` : ''}${note('fifteen')}`;
        if (!R.f15) {
            h += `<h2>11. 50% active asset reduction (Subdiv 152-C)</h2><p>${W.red > 0 ? `Applied: ${money(W.red)}.` : 'Taxpayer chose not to apply the reduction.'}</p>${note('reduction')}`;
            h += `<h2>12. Retirement exemption (Subdiv 152-D)</h2>${W.ret > 0 ? (R.isInd ? kv([['CGT exempt amount', money(W.ret)], ['Limit used before this event', money(num(tp.priorUsed))], ['Limit remaining after', money(Math.max(R.retRemaining - W.ret, 0))], ['Age when choice made', R.retAge ?? '—'], ['Super contribution required', R.retSuper ? 'Yes' + (R.retDue ? ' – by ' + fdate(R.retDue) : '') : 'No']]) : `<table><thead><tr><th>Stakeholder</th><th>Age</th><th class="n">%</th><th class="n">Exempt amount</th><th class="n">Limit remaining after</th><th>Paid as</th></tr></thead><tbody>${(R.retRows || []).map(x => `<tr><td>${esc(x.name)}</td><td>${x.age ?? '—'}</td><td class="n">${pct(x.share, 2)}</td><td class="n">${money(x.amt || 0)}</td><td class="n">${money(Math.max(x.rem - (x.amt || 0), 0))}</td><td>${x.age != null && x.age < SBC_RULES.retirementAge ? 'Super contribution' : 'Direct payment'}</td></tr>`).join('')}</tbody></table><p>Payments / contributions due by ${R.retDue ? fdate(R.retDue) : '7 days after the later of the choice and receipt of proceeds'}.</p>`) : '<p>Not applied.</p>'}${note('retire')}`;
            h += `<h2>13. Small business roll-over (Subdiv 152-E)</h2>${W.roll > 0 ? kv([['Gain rolled over', money(W.roll)], ['Replacement period', `${fdate(R.winStart)} – ${fdate(R.winEnd)}`], ['Qualifying expenditure to date', money(R.replCost)], ['Exposure to J5 / J6', money(R.j6)]]) + (S.conc.repl.length ? `<table><thead><tr><th>Replacement asset</th><th>Acquired</th><th>Active from</th><th class="n">Cost</th></tr></thead><tbody>${S.conc.repl.map(x => `<tr><td>${esc(x.desc)}</td><td>${fdate(D(x.acq))}</td><td>${fdate(D(x.active))}</td><td class="n">${money(num(x.cost))}</td></tr>`).join('')}</tbody></table>` : '') : '<p>Not applied.</p>'}${note('rollover')}`;
        }
    }
    const fu = followUps();
    if (fu.length) h += `<h2>Follow-ups and deadlines</h2><ul>${fu.map(x => `<li>${x}</li>`).join('')}</ul>`;
    h += note('result');
    h += `<div class="sign"><div>Prepared by: ${esc(c.preparer || '')}<br>Date: ${c.prepDate ? fdate(D(c.prepDate)) : ''}</div><div>Reviewed by: ${esc(c.reviewer || '')}<br>Date: ${c.revDate ? fdate(D(c.revDate)) : ''}</div></div>`;
    h += `<div class="foot">Prepared under Division 152 ITAA 1997 using thresholds for ${esc(R.rt.name)}. This workpaper supports the tax return position and should be kept with the client file. Generated ${fdate(D(todayIso()))}.</div>`;
    $('#sbc-report').innerHTML = h;
}

/* ======================= render / refresh ======================= */
function ensureTaxpayerRow() {
    const need = S.tp.type === 'individual' && (S.asset.kind === 'shares' || S.asset.kind === 'units');
    const row = S.people.find(p => p.isTp);
    if (need && !row) S.people.unshift(Object.assign(TPL.person(), { isTp: true, name: S.tp.name || 'Taxpayer', dob: S.tp.dob }));
    if (row) { row.name = S.tp.name || 'Taxpayer'; if (S.tp.dob) row.dob = S.tp.dob; }
    if (!need && row) S.people = S.people.filter(p => !p.isTp);
}
function refresh() { applyAutoRel(); R = compute(); renderNav(); renderSide(); fillOutputs(); report(); save(); }
function rerender() {
    // remember which field had the cursor so it survives the redraw
    const ae = document.activeElement, root = ROOT();
    let sel = null, pos = null;
    if (ae && root.contains(ae)) {
        const k = ae.getAttribute('data-date') ? `[data-date="${ae.getAttribute('data-date')}"]` : ae.getAttribute('data-k') ? `[data-k="${ae.getAttribute('data-k')}"]:not(.dtn)` : null;
        sel = k; try { pos = ae.selectionStart; } catch (e) { pos = null; }
    }
    ensureTaxpayerRow(); applyAutoRel(); R = compute(); renderMain(); renderNav(); renderSide(); fillOutputs(); report();
    if (typeof renderIcons === 'function') renderIcons(root);
    if (sel) { const el = root.querySelector(sel); if (el) { el.focus(); try { if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); } catch (e) { /* not a text field */ } } }
    save();
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
function load(obj) {
    const b = blankState();
    const merge = (t, s) => { Object.keys(s || {}).forEach(k => { if (t[k] && typeof t[k] === 'object' && !Array.isArray(t[k]) && s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) merge(t[k], s[k]); else t[k] = s[k]; }); return t; };
    S = merge(b, obj);
    const ids = [].concat(S.entities.map(e => e.id), S.people.map(p => p.id)).map(Number).filter(isFinite);
    uidN = (ids.length ? Math.max(...ids) : 0) + 1;
}

/* ======================= events ======================= */
function bind() {
    const root = ROOT();
    root.addEventListener('input', e => {
        const t = e.target, k = t.getAttribute && t.getAttribute('data-k');
        const dk = t.getAttribute && t.getAttribute('data-date');
        if (dk) {
            const deleting = (e.inputType || '').startsWith('delete');
            const out = maskDate(t.value, deleting);
            if (out !== t.value) { t.value = out; t.setSelectionRange(out.length, out.length); }
            const iso = auToIso(out);
            t.classList.toggle('bad', out.length === 10 && !iso);
            if (iso || !out) { setP(dk, iso || ''); const n = t.parentNode.querySelector('.dtn'); if (n) n.value = iso || ''; refresh(); }
            return;
        }
        if (!k || t.type === 'checkbox' || t.tagName === 'SELECT' || t.type === 'date') return;
        setP(k, t.value);
        refresh();
    });
    root.addEventListener('change', e => {
        const t = e.target;
        if (t.id === 'sbc-file') {
            const f = t.files && t.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => { try { load(JSON.parse(rd.result)); step = 'setup'; rerender(); if (typeof showToast === 'function') showToast('Case opened'); } catch (err) { alert('That file could not be read as a saved case.'); } };
            rd.readAsText(f); t.value = '';
            return;
        }
        const k = t.getAttribute && t.getAttribute('data-k');
        if (!k) return;
        if (t.type === 'checkbox') setP(k, t.checked);
        else if (t.tagName === 'SELECT' || t.type === 'date') { setP(k, t.value); const m = /^entities\.(\d+)\.rel$/.exec(k); if (m) S.entities[+m[1]].relAuto = false;
            const sm = /^people\.(\d+)\.spouseOf$/.exec(k);
            if (sm) { const me = S.people[+sm[1]], other = S.people.find(x => String(x.id) === String(t.value)); if (me && other && !other.spouseOf) other.spouseOf = String(me.id); } }
        else return; // text inputs already handled
        rerender();
    });
    root.addEventListener('focusin', e => { const t = e.target; if (t.getAttribute && t.getAttribute('data-date')) t.dataset.was = getP(t.getAttribute('data-date')) || ''; });
    root.addEventListener('focusout', e => {
        const t = e.target;
        if (t.getAttribute && t.getAttribute('data-date')) {
            const v = t.value.trim();
            if (v && !auToIso(v)) { t.classList.add('bad'); return; } // keep what was typed so it can be fixed
            t.classList.remove('bad');
            if (t.dataset.was !== (getP(t.getAttribute('data-date')) || '')) setTimeout(rerender, 0); // redraw once the date is finished
            return;
        }
        if (t.classList && t.classList.contains('money') && t.value) t.value = fmtNum(t.value);
    });
    root.addEventListener('click', e => {
        const b = e.target.closest('[data-yn],[data-act]');
        if (!b || !root.contains(b)) return;
        if (b.hasAttribute('data-yn')) {
            const p = b.getAttribute('data-yn'), v = b.getAttribute('data-v');
            setP(p, getP(p) === v ? '' : v);
            rerender(); return;
        }
        e.preventDefault();
        const act = b.getAttribute('data-act');
        if (act === 'goto') {
            step = b.getAttribute('data-step'); rerender();
            const anc = b.getAttribute('data-anchor');
            const target = (anc && document.getElementById(anc)) || document.getElementById('sbc-tool');
            const hdr = document.querySelector('header'); const off = (hdr ? hdr.offsetHeight : 120) + 16;
            if (target) window.scrollTo({ top: Math.max(target.getBoundingClientRect().top + window.scrollY - off, 0), behavior: 'smooth' });
            if (anc && target) { target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 1600); }
        }
        else if (act === 'add') { const p = b.getAttribute('data-path'); let arr = getP(p); if (!Array.isArray(arr)) { arr = []; setP(p, arr); } arr.push(TPL[b.getAttribute('data-tpl')](p)); rerender(); }
        else if (act === 'del') { const p = b.getAttribute('data-path'); const arr = getP(p); const i = +b.getAttribute('data-i'); const gone = arr[i]; arr.splice(i, 1); if (p === 'entities' && gone) S.aat.periods.forEach(x => { if (String(x.user) === String(gone.id)) x.user = 'tp'; }); if (p === 'people' && gone) S.people.forEach(x => { if (String(x.spouseOf) === String(gone.id)) x.spouseOf = ''; }); rerender(); }
        else if (act === 'relauto') { S.entities[+b.getAttribute('data-i')].relAuto = true; rerender(); }
        else if (act === 'maxret') { S.conc.retAmt = String(Math.floor(R.retMax)); rerender(); }
        else if (act === 'maxroll') { S.conc.rollAmt = String(Math.floor(R.W.g4)); rerender(); }
        else if (act === 'print') doPrint();
        else if (act === 'pick') { const n = b.parentNode.querySelector('.dtn'); if (n) { try { n.showPicker(); } catch (err) { n.focus(); n.click(); } } }
    });
    $('#sbc-btn-print').onclick = doPrint;
    $('#sbc-btn-save').onclick = () => {
        const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const aEl = document.createElement('a'); aEl.href = url;
        const nm = [S.client.name || S.tp.name || 'client', S.asset.desc || 'asset'].join(' ').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
        aEl.download = `SB-CGT-${nm}-${todayIso()}.json`; document.body.appendChild(aEl); aEl.click(); aEl.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (typeof showToast === 'function') showToast('Case saved to your downloads');
    };
    $('#sbc-btn-load').onclick = () => $('#sbc-file').click();
    $('#sbc-btn-reset').onclick = () => { if (confirm('Start a new case? Unsaved inputs will be cleared.')) { S = blankState(); step = 'setup'; rerender(); } };
}
function doPrint() { report(); window.print(); }

registerTab('sb-cgt', {
    init() {
        try { const raw = localStorage.getItem(STORE_KEY); if (raw) load(JSON.parse(raw)); } catch (e) { /* ignore */ }
        bind();
        rerender();
    },
    onShow() { rerender(); },
    onReset() { if (confirm('Start a new case? Unsaved inputs will be cleared.')) { S = blankState(); step = 'setup'; rerender(); } }
});
})();
