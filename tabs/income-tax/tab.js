// INCOME TAX CALCULATOR TAB
// Rates come from shared/tax-data.js; shared maths from shared/tax-engine.js.

function updateCompanyRateLabel() {
    const val = document.getElementById('company-tax-rate').value;
    document.getElementById('company-rate-val').textContent = parseFloat(val).toFixed(0) + '%';
}

// Shows the spouse SAPTO toggle when relevant; "Both eligible" implies it is on
function syncSpouseSaptoToggle() {
    const hasSpouse = document.getElementById('has-spouse-toggle').checked;
    const cat = document.getElementById('sapto-category').value;
    const wrap = document.getElementById('spouse-sapto-wrap');
    const toggle = document.getElementById('spouse-sapto-toggle');
    const help = document.getElementById('spouse-sapto-help');
    const show = hasSpouse && cat !== 'single';
    wrap.classList.toggle('hidden', !show);
    if (cat === 'both_eligible') toggle.checked = true;
    toggle.disabled = cat === 'both_eligible';
    help.textContent = cat === 'both_eligible'
        ? 'Set by "Both eligible in a couple"'
        : 'Only then can their unused offset transfer to you';
    return show && toggle.checked;
}

function toggleSpouseSection() {
    const hasSpouse = document.getElementById('has-spouse-toggle').checked;
    const spouseContainer = document.getElementById('spouse-details-container');
    if (hasSpouse) {
        spouseContainer.classList.remove('hidden');
    } else {
        spouseContainer.classList.add('hidden');
    }
}

function computeHelpRepayment(repaymentIncome, config) {
    const t = config.hecsThresholds;
    if (t.isMarginal) {
        const { lowerLimit, upperLimit, maxCapRate } = t;
        if (repaymentIncome <= lowerLimit) return 0;
        let r = repaymentIncome <= upperLimit
            ? (repaymentIncome - lowerLimit) * 0.15
            : (upperLimit - lowerLimit) * 0.15 + (repaymentIncome - upperLimit) * 0.17;
        return Math.min(r, repaymentIncome * maxCapRate);
    }
    let rate = 0;
    for (let i = t.length - 1; i >= 0; i--) {
        if (repaymentIncome >= t[i].min) { rate = t[i].rate; break; }
    }
    return repaymentIncome * rate;
}

function computeMlsRate(testIncome, isFamily, numChildren, config) {
    const mls = config.mlsThresholds;
    const extra = (isFamily && numChildren > 1) ? (numChildren - 1) * 1500 : 0;
    const base = (isFamily ? mls.familyBase : mls.singleBase) + extra;
    const t2 = (isFamily ? mls.familyT2 : mls.singleT2) + extra;
    const t3 = (isFamily ? mls.familyT3 : mls.singleT3) + extra;
    if (testIncome > t3) return 0.015;
    if (testIncome > t2) return 0.0125;
    if (testIncome > base) return 0.010;
    return 0;
}

function calculateAgeOn30June(dobString, yearKey) {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const targetDate = new Date(parseInt(yearKey), 5, 30); // June 30 of FY
    let age = targetDate.getFullYear() - dob.getFullYear();
    const m = targetDate.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && targetDate.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

function computeSaptoOffset(rebateIncome, saptoCategory, config, hasSpouse = false, spouseRebateIncome = 0, spouseTaxableIncome = 0, yearKey = "2027", spouseEligible = false) {
    let effectiveCategory = saptoCategory;
    if (!hasSpouse) {
        effectiveCategory = 'single';
    }

    const saptoData = config.sapto[effectiveCategory] || config.sapto.single;
    const { maxOffset, shadeOut, cutOut } = saptoData;

    if (rebateIncome >= cutOut) {
        return { saptoOffset: 0, maxOffset, isEligible: true, note: 'Rebate income exceeds cut-out threshold' };
    }

    let individualOffset = maxOffset;
    if (rebateIncome > shadeOut) {
        individualOffset = Math.max(0, maxOffset - ((rebateIncome - shadeOut) * 0.125));
    }

    // Spouse transfer: only when the spouse is also SAPTO-eligible and can't use all of their own offset
    let transferredSpouseOffset = 0;
    if (hasSpouse && spouseEligible && effectiveCategory !== 'single') {
        const spouseData = effectiveCategory === 'couple_illness'
            ? config.sapto.couple_illness
            : config.sapto.couple_together;

        let spouseOwnOffset = spouseData.maxOffset;
        if (spouseRebateIncome > spouseData.shadeOut) {
            spouseOwnOffset = Math.max(0, spouseData.maxOffset - ((spouseRebateIncome - spouseData.shadeOut) * 0.125));
        }

        // Estimate spouse tax payable to check unused portion
        const spouseGrossTax = computeRawIncomeTax(spouseTaxableIncome, config.brackets);
        const spouseLito = calculateOffsets(spouseTaxableIncome, yearKey, config);
        const spouseTaxAfterLito = Math.max(0, spouseGrossTax - spouseLito);

        const unusedSpouseOffset = Math.max(0, spouseOwnOffset - spouseTaxAfterLito);
        transferredSpouseOffset = unusedSpouseOffset;
    }

    const totalSapto = individualOffset + transferredSpouseOffset;

    return {
        saptoOffset: totalSapto,
        individualOffset,
        transferredSpouseOffset,
        maxOffset,
        shadeOut,
        cutOut,
        isEligible: true
    };
}

function computeIndividualTax(p, yearKey, config) {
    const frankingCredits = p.frankedDiv > 0 ? p.frankedDiv * (p.companyTaxRate / (1 - p.companyTaxRate)) : 0;
    const totalCashDividends = p.frankedDiv + p.unfrankedDiv;

    const grossTaxableIncome = p.baseSalary + totalCashDividends + frankingCredits;
    const taxableIncome = Math.max(0, grossTaxableIncome - p.salarySacrifice);

    const grossTax = computeRawIncomeTax(taxableIncome, config.brackets);
    const litoLmitoOffset = calculateOffsets(taxableIncome, yearKey, config);

    // SAPTO Calculations
    const ageOnJune30 = calculateAgeOn30June(p.dob, yearKey);
    const ageEligible = ageOnJune30 !== null && ageOnJune30 >= (config.agePensionAge || 67);
    const isSaptoEligible = ageEligible || p.isPensionEligible;

    const rebateIncome = taxableIncome + p.rfba + p.salarySacrifice;
    let saptoResult = { saptoOffset: 0, isEligible: isSaptoEligible };

    if (isSaptoEligible) {
        saptoResult = computeSaptoOffset(rebateIncome, p.saptoCategory, config, p.hasSpouse, p.spouseSalary, p.spouseSalary, yearKey, p.spouseSaptoEligible);
    }

    const totalNonRefundableOffsets = litoLmitoOffset + (saptoResult.saptoOffset || 0);
    const offsetsApplied = Math.min(totalNonRefundableOffsets, grossTax);
    const incomeTaxAfterOffsets = grossTax - offsetsApplied;

    const medicareLevy = computeMedicareLevy(
        taxableIncome, 
        config, 
        isSaptoEligible && (saptoResult.saptoOffset > 0 || p.isPensionEligible), 
        p.hasSpouse,
        p.spouseSalary, 
        p.numChildren
    );

    const mlsTestIncome = taxableIncome + p.rfba + p.salarySacrifice;
    const isFamily = p.hasSpouse || (p.numChildren > 0);
    let mlsRate = 0;
    if (!p.hasPHI) {
        const incomeForTest = isFamily ? mlsTestIncome + (p.hasSpouse ? p.spouseSalary : 0) : mlsTestIncome;
        mlsRate = computeMlsRate(incomeForTest, isFamily, p.numChildren, config);
    }
    const mlsAmount = (taxableIncome + p.rfba) * mlsRate;

    const helpRepaymentIncome = taxableIncome + p.rfba + p.salarySacrifice;
    const hecsRepayment = p.hasHecs ? computeHelpRepayment(helpRepaymentIncome, config) : 0;

    const totalTaxAndLevies = incomeTaxAfterOffsets + medicareLevy + mlsAmount + hecsRepayment - frankingCredits;
    const contributionFromPay = p.contribType === 'personal' ? 0 : p.salarySacrifice;
    const netTakeHome = (p.baseSalary + totalCashDividends - contributionFromPay) - totalTaxAndLevies;

    const employerSuper = p.baseSalary * config.sgRate;
    const concessionalCap = config.concessionalCap || 0;
    const totalConcessional = employerSuper + p.salarySacrifice;
    const cfAvailable = p.cfAvailable || 0;
    const effectiveCap = concessionalCap + cfAvailable;
    const cfUsed = Math.min(cfAvailable, Math.max(0, totalConcessional - concessionalCap));
    const excessConcessional = concessionalCap > 0 ? Math.max(0, totalConcessional - effectiveCap) : 0;

    const lowTaxContributions = totalConcessional - excessConcessional;
    const div293Income = taxableIncome + p.rfba + lowTaxContributions;
    const div293Threshold = config.div293Threshold || 250000;
    const div293Tax = div293Income > div293Threshold
        ? 0.15 * Math.min(lowTaxContributions, div293Income - div293Threshold) : 0;

    return {
        frankingCredits, totalCashDividends, grossTaxableIncome, taxableIncome,
        grossTax, litoLmitoOffset, saptoResult, offsetsApplied, incomeTaxAfterOffsets, medicareLevy,
        mlsTestIncome, mlsRate, mlsAmount, isFamily,
        helpRepaymentIncome, hecsRepayment,
        totalTaxAndLevies, netTakeHome, ageOnJune30, isSaptoEligible, rebateIncome,
        employerSuper, concessionalCap, cfAvailable, effectiveCap, cfUsed, totalConcessional, excessConcessional,
        lowTaxContributions, div293Income, div293Tax
    };
}

let contributionType = 'sacrifice';

function setContributionType(type) {
    contributionType = type;
    const on = 'ctype-btn py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 text-white';
    const off = 'ctype-btn py-1.5 rounded-lg text-xs font-bold transition text-emerald-900 hover:bg-emerald-50';
    document.getElementById('ctype-sacrifice').className = type === 'sacrifice' ? on : off;
    document.getElementById('ctype-personal').className = type === 'personal' ? on : off;
    document.getElementById('contrib-label').textContent = type === 'personal'
        ? 'Personal Deductible Contribution ($/year)' : 'Salary Sacrifice Super ($/year)';
    document.getElementById('contrib-help').textContent = type === 'personal'
        ? 'Lump sum paid from savings, then claimed as a tax deduction. Take-home pay is unaffected; the tax saving arrives at lodgement.'
        : 'Paid from pre-tax salary by your employer. Reduces taxable income and is taxed at 15% inside super.';
    calculateTax();
}

// Carry-forward concessional logic
const CC_CAP_EXTRA = { 2019: 25000 };
const cfValues = {};   
let cfOpen = false;

function getConcessionalCap(key) {
    const d = TAX_DATA[String(key)];
    return d && d.concessionalCap ? d.concessionalCap : (CC_CAP_EXTRA[key] || 0);
}

function fyShort(key) { return `FY${String(key - 1).slice(-2)}-${String(key).slice(-2)}`; }

function toggleCarryForward() {
    cfOpen = !cfOpen;
    document.getElementById('cf-body').classList.toggle('hidden', !cfOpen);
    document.getElementById('cf-toggle-text').textContent = cfOpen ? 'Hide carry-forward' : 'Check carry-forward eligibility';
    calculateTax();
}

function setCfValue(key, val) {
    cfValues[key] = val;
    calculateTax();
}

function computeCarryForward(yearKey) {
    const K = Number(yearKey);
    const years = [];
    for (let y = K - 5; y < K; y++) if (y >= 2019) years.push(y);
    let pool = [];
    const rows = [];
    years.forEach(y => {
        pool = pool.filter(e => e.year >= y - 5);
        const cap = getConcessionalCap(y);
        const contrib = Math.max(0, parseFloat(cfValues[y]) || 0);
        if (contrib > cap) {
            let need = contrib - cap;
            pool.forEach(e => { const take = Math.min(e.amount, need); e.amount -= take; need -= take; });
        } else {
            pool.push({ year: y, amount: cap - contrib });
        }
        rows.push({ year: y, cap, contrib });
    });
    pool = pool.filter(e => e.year >= K - 5 && e.amount > 0);
    const atoOverride = parseFloat(document.getElementById('cf-ato').value);
    const hasOverride = !isNaN(atoOverride) && atoOverride >= 0;
    const available = hasOverride ? atoOverride : pool.reduce((a, e) => a + e.amount, 0);
    const tsb = Math.max(0, parseFloat(document.getElementById('cf-tsb').value) || 0);
    const eligible = tsb < 500000;
    return { K, rows, pool, available, hasOverride, tsb, eligible };
}

function renderCarryForward(cf, used) {
    document.getElementById('cf-tsb-label').textContent = `Total Super Balance at 30 June ${cf.K - 1}`;
    const tbody = document.getElementById('cf-rows');
    let toUse = used;
    const remaining = {};
    cf.pool.forEach(e => { const take = Math.min(e.amount, toUse); toUse -= take; remaining[e.year] = e.amount - take; });
    const active = document.activeElement && document.activeElement.id;
    tbody.innerHTML = cf.rows.map(rw => `
        <tr>
            <td class="py-1.5 px-2.5 font-semibold text-gray-800 whitespace-nowrap">${fyShort(rw.year)}</td>
            <td class="py-1.5 px-2.5 text-right text-gray-600">${formatCurrency(rw.cap)}</td>
            <td class="py-1.5 px-2.5">
                <input type="number" id="cf-y-${rw.year}" value="${cfValues[rw.year] ?? ''}" min="0" step="500" placeholder="0"
                    oninput="setCfValue(${rw.year}, this.value)"
                    class="w-28 px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-qbNavy-500 focus:outline-none">
            </td>
            <td class="py-1.5 px-2.5 text-right font-semibold ${remaining[rw.year] > 0 ? 'text-emerald-700' : 'text-gray-400'}">${formatCurrency(remaining[rw.year] || 0)}</td>
        </tr>`).join('') || `<tr><td colspan="4" class="py-2 px-2.5 text-gray-500">Carry-forward starts from FY2018-19 unused amounts.</td></tr>`;
    if (active && active.startsWith('cf-y-')) {
        const el = document.getElementById(active);
        if (el) { el.focus(); const v = el.value; el.value = ''; el.value = v; }
    }

    const expiring = cf.hasOverride ? null : (remaining[cf.K - 5] || 0);
    const box = document.getElementById('cf-result');
    if (!cf.eligible) {
        box.className = 'p-3 rounded-xl border space-y-1.5 bg-red-50 border-red-200 text-red-900';
        box.innerHTML = `<div class="font-bold flex items-center gap-1.5">✕ Not eligible</div>
            <div>Total super balance of ${formatCurrency(cf.tsb)} at 30 June ${cf.K - 1} is not under $500,000, so only the standard ${formatCurrency(getConcessionalCap(cf.K))} cap applies.</div>`;
    } else {
        const cap = getConcessionalCap(cf.K);
        box.className = 'p-3 rounded-xl border space-y-1.5 bg-emerald-50 border-emerald-200 text-emerald-900';
        box.innerHTML = `<div class="font-bold flex items-center gap-1.5">✓ Eligible to use carry-forward</div>
            <div class="flex justify-between"><span>Unused amounts available${cf.hasOverride ? ' (ATO figure)' : ''}:</span><strong>${formatCurrency(cf.available)}</strong></div>
            <div class="flex justify-between"><span>Effective cap this year (${formatCurrency(cap)} + carry-forward):</span><strong>${formatCurrency(cap + cf.available)}</strong></div>
            <div class="flex justify-between"><span>Carry-forward used this year:</span><strong>${formatCurrency(used)}</strong></div>
            <div class="flex justify-between"><span>Unused left after this year:</span><strong>${formatCurrency(Math.max(0, cf.available - used))}</strong></div>
            ${expiring ? `<div class="flex justify-between text-amber-800"><span>Expires 30 June ${cf.K} if not used (${fyShort(cf.K - 5)} amount):</span><strong>${formatCurrency(expiring)}</strong></div>` : ''}`;
    }
}

// Division 293
let div293Open = false;
function toggleDiv293() {
    div293Open = !div293Open;
    document.getElementById('div293-body').classList.toggle('hidden', !div293Open);
    document.getElementById('div293-chevron').style.transform = div293Open ? 'rotate(180deg)' : 'rotate(0deg)';
    document.getElementById('div293-toggle-text').textContent = div293Open ? 'Hide calculation' : 'Show calculation';
}

function renderDiv293(r, p, config) {
    const threshold = config.div293Threshold || 250000;
    const isp = r.taxableIncome + p.rfba;
    const over = Math.max(0, r.div293Income - threshold);
    const taxable = Math.min(r.lowTaxContributions, over);

    const badge = document.getElementById('div293-badge');
    if (r.div293Tax > 0) {
        badge.textContent = 'Applies: ' + formatCurrency(r.div293Tax);
        badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200';
    } else {
        badge.textContent = 'Not applicable';
        badge.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200';
    }

    const set = (id, v) => document.getElementById(id).textContent = v;
    set('d293-ti', formatCurrency(r.taxableIncome));
    set('d293-rfba', formatCurrency(p.rfba));
    set('d293-isp', formatCurrency(isp));
    set('d293-ltc', formatCurrency(r.lowTaxContributions));
    set('d293-income', formatCurrency(r.div293Income));
    set('d293-threshold', formatCurrency(threshold));
    set('d293-over', formatCurrency(over));
    set('d293-ltc2', formatCurrency(r.lowTaxContributions));
    set('d293-taxable', formatCurrency(taxable));
    set('d293-sg', formatCurrency(r.employerSuper));
    set('d293-contrib-label', p.contribType === 'personal' ? 'personal deductible' : 'salary sacrifice');
    set('d293-contrib', formatCurrency(p.salarySacrifice));
    set('d293-excess', formatCurrency(r.excessConcessional));
    set('d293-tax', formatCurrency(r.div293Tax));
    const eff = r.lowTaxContributions > 0 ? 0.15 + r.div293Tax / r.lowTaxContributions : 0.15;
    set('d293-eff', (eff * 100).toFixed(1) + '%');

    const status = document.getElementById('d293-status');
    if (r.div293Tax > 0) {
        status.className = 'p-3 rounded-xl border text-xs bg-amber-50 border-amber-200 text-amber-900';
        status.textContent = isp > threshold
            ? `Income for surcharge purposes already exceeds ${formatCurrency(threshold)}, so all ${formatCurrency(r.lowTaxContributions)} of low-tax contributions are taxed.`
            : `Only the ${formatCurrency(taxable)} of contributions that pushes Div 293 income over ${formatCurrency(threshold)} is taxed.`;
    } else {
        status.className = 'p-3 rounded-xl border text-xs bg-emerald-50 border-emerald-200 text-emerald-900';
        status.textContent = `Division 293 income of ${formatCurrency(r.div293Income)} does not exceed ${formatCurrency(threshold)} — no Division 293 tax. Headroom: ${formatCurrency(threshold - r.div293Income)}.`;
    }
}

function calculateTax() {
    const yearKey = document.getElementById('fy-select').value;
    const config = TAX_DATA[yearKey] || TAX_DATA["2027"];
    const num = id => Math.max(0, parseFloat(document.getElementById(id).value) || 0);

    const p = {
        baseSalary: num('gross-salary'),
        rfba: num('rfba-input'),
        frankedDiv: num('dividend-franked'),
        unfrankedDiv: num('dividend-unfranked'),
        companyTaxRate: parseFloat(document.getElementById('company-tax-rate').value) / 100,
        hasSpouse: document.getElementById('has-spouse-toggle').checked,
        spouseSalary: num('spouse-salary'),
        numChildren: Math.max(0, parseInt(document.getElementById('dependent-children').value) || 0),
        hasHecs: document.getElementById('hecs-toggle').checked,
        hasPHI: document.getElementById('phi-toggle').checked,
        salarySacrifice: num('salary-sacrifice'),
        contribType: contributionType,
        dob: document.getElementById('dob-input').value,
        isPensionEligible: document.getElementById('pension-eligible-toggle').checked,
        saptoCategory: document.getElementById('sapto-category').value,
        spouseSaptoEligible: syncSpouseSaptoToggle()
    };

    const cf = computeCarryForward(yearKey);
    p.cfAvailable = (cfOpen && cf.eligible) ? cf.available : 0;

    const r = computeIndividualTax(p, yearKey, config);
    lastTaxResult = { yearKey, config, p, r };
    if (cfOpen) renderCarryForward(cf, r.cfUsed);

    // Share results with the Home Loan tab (spouse only counts when "Has Spouse" is on)
    const spouseIncomeUsed = p.hasSpouse ? p.spouseSalary : 0;
    const spouseTakeHome = calculateIndividualTakeHome(spouseIncomeUsed, yearKey, config);
    calculatedTaxState = {
        userIncome: p.baseSalary,
        spouseIncome: spouseIncomeUsed,
        userTakeHome: r.netTakeHome,
        spouseTakeHome: spouseTakeHome,
        combinedTakeHome: r.netTakeHome + spouseTakeHome
    };

    // Update Age Display & SAPTO Feedback
    document.getElementById('age-at-fy').textContent = `30 June ${yearKey}`;
    const ageDisplay = document.getElementById('calc-age-display');
    if (r.ageOnJune30 !== null) {
        ageDisplay.textContent = `${r.ageOnJune30} yrs old`;
    } else {
        ageDisplay.textContent = '—';
    }

    const saptoStatus = document.getElementById('sapto-eligibility-status');
    if (r.isSaptoEligible) {
        const s = r.saptoResult;
        if (s.saptoOffset > 0) {
            saptoStatus.className = 'p-3 rounded-xl border text-xs bg-emerald-50 border-emerald-200 text-emerald-900';
            let transMsg = s.transferredSpouseOffset > 0 ? ` (Includes ${formatCurrency(s.transferredSpouseOffset)} transferred from spouse)` : (p.hasSpouse && !p.spouseSaptoEligible && p.saptoCategory !== 'single' ? ' (No spouse transfer — spouse not SAPTO-eligible)' : '');
            saptoStatus.textContent = `✓ Eligible for SAPTO offset of ${formatCurrency(s.saptoOffset)}${transMsg}. Rebate income: ${formatCurrency(r.rebateIncome)}.`;
        } else {
            saptoStatus.className = 'p-3 rounded-xl border text-xs bg-amber-50 border-amber-200 text-amber-900';
            saptoStatus.textContent = `Age/Pension eligible, but rebate income of ${formatCurrency(r.rebateIncome)} exceeds cut-out threshold (${formatCurrency(s.cutOut)}).`;
        }
    } else {
        saptoStatus.className = 'p-3 rounded-xl border text-xs bg-gray-50 border-gray-200 text-gray-600';
        saptoStatus.textContent = `Not eligible for SAPTO. Age Pension age required: ${config.agePensionAge} (or Govt Pension entitlement).`;
    }

    const effectiveRate = r.taxableIncome > 0 ? ((r.totalTaxAndLevies / r.taxableIncome) * 100).toFixed(1) : '0.0';
    const marginalRate = getMarginalTaxRate(r.taxableIncome, config.brackets);

    document.getElementById('res-net-annual').textContent = formatCurrency(r.netTakeHome);
    document.getElementById('res-effective-rate').textContent = effectiveRate + '%';
    document.getElementById('current-fy-badge').textContent = config.name;

    document.getElementById('freq-annual').textContent = formatCurrency(r.netTakeHome);
    document.getElementById('freq-monthly').textContent = formatCurrency(r.netTakeHome / 12);
    document.getElementById('freq-fortnightly').textContent = formatCurrency(r.netTakeHome / 26);
    document.getElementById('freq-weekly').textContent = formatCurrency(r.netTakeHome / 52);

    document.getElementById('res-base-salary').textContent = formatCurrency(p.baseSalary);
    document.getElementById('res-taxable-income').textContent = formatCurrency(r.taxableIncome);
    document.getElementById('res-gross-tax').textContent = formatCurrency(r.grossTax);
    document.getElementById('res-lito-offset').textContent = '-' + formatCurrency(r.litoLmitoOffset);

    // Dynamic SAPTO Row Display in Tax Summary
    const saptoRow = document.getElementById('sapto-row');
    if (r.saptoResult && r.saptoResult.saptoOffset > 0) {
        saptoRow.classList.remove('hidden');
        document.getElementById('res-sapto-offset').textContent = '-' + formatCurrency(r.saptoResult.saptoOffset);
        const transText = r.saptoResult.transferredSpouseOffset > 0 
            ? ` (incl. ${formatCurrency(r.saptoResult.transferredSpouseOffset)} spouse transfer)` 
            : '';
        document.getElementById('sapto-sub-text').textContent = `Applied against gross tax${transText}`;
    } else {
        saptoRow.classList.add('hidden');
    }

    document.getElementById('res-franking-offset').textContent = '-' + formatCurrency(r.frankingCredits);
    document.getElementById('res-medicare').textContent = formatCurrency(r.medicareLevy);
    document.getElementById('res-mls').textContent = formatCurrency(r.mlsAmount);
    document.getElementById('res-hecs').textContent = formatCurrency(r.hecsRepayment);

    const totalEl = document.getElementById('res-total-tax');
    const totalLabel = document.getElementById('res-total-tax-label');
    if (r.totalTaxAndLevies < 0) {
        totalLabel.textContent = 'Estimated Refund (Excess Franking Credits)';
        totalEl.textContent = formatCurrency(-r.totalTaxAndLevies);
        totalEl.className = 'text-emerald-600';
    } else {
        totalLabel.textContent = 'Net Tax & Levies Payable';
        totalEl.textContent = formatCurrency(r.totalTaxAndLevies);
        totalEl.className = 'text-red-600';
    }

    const rfbaRow = document.getElementById('rfba-row');
    if (p.rfba > 0) {
        rfbaRow.classList.remove('hidden');
        document.getElementById('res-rfba').textContent = formatCurrency(p.rfba);
    } else {
        rfbaRow.classList.add('hidden');
    }

    const divSummaryRow = document.getElementById('div-summary-row');
    if (r.totalCashDividends > 0 || r.frankingCredits > 0) {
        divSummaryRow.classList.remove('hidden');
        document.getElementById('res-div-cash').textContent = formatCurrency(r.totalCashDividends);
        document.getElementById('res-div-franking').textContent = '+' + formatCurrency(r.frankingCredits);
    } else {
        divSummaryRow.classList.add('hidden');
    }

    document.getElementById('lito-row').style.display = r.litoLmitoOffset > 0 ? 'flex' : 'none';
    document.getElementById('franking-offset-row').style.display = r.frankingCredits > 0 ? 'flex' : 'none';

    const mlsRow = document.getElementById('mls-row');
    if (!p.hasPHI) {
        mlsRow.style.display = 'flex';
        document.getElementById('mls-label-text').textContent = `Medicare Levy Surcharge (${(r.mlsRate * 100).toFixed(2)}%)`;
        const tier = r.isFamily
            ? `Family tier${p.numChildren > 1 ? ` (+$${((p.numChildren - 1) * 1500).toLocaleString()} child boost)` : ''}`
            : 'Single tier';
        const testIncome = r.isFamily ? r.mlsTestIncome + (p.hasSpouse ? p.spouseSalary : 0) : r.mlsTestIncome;
        document.getElementById('mls-sub-text').textContent = `${tier} · MLS test income ${formatCurrency(testIncome)}`;
    } else {
        mlsRow.style.display = 'none';
    }

    document.getElementById('hecs-row').style.display = p.hasHecs ? 'flex' : 'none';
    document.getElementById('res-hecs-income').textContent = `Repayment income ${formatCurrency(r.helpRepaymentIncome)}`;
    document.getElementById('chart-legend-hecs').style.display = p.hasHecs ? 'flex' : 'none';

    document.getElementById('res-sg-rate-badge').textContent = `SG Rate: ${(config.sgRate * 100).toFixed(1)}%`;
    document.getElementById('res-employer-super').textContent = formatCurrency(r.employerSuper);
    document.getElementById('res-marginal-rate').textContent = (marginalRate * 100).toFixed(1) + '%';

    const isPersonal = p.contribType === 'personal';
    const capPct = r.effectiveCap > 0 ? Math.min(100, (r.totalConcessional / r.effectiveCap) * 100) : 0;
    const capBar = document.getElementById('cap-bar');
    capBar.style.width = capPct + '%';
    capBar.className = 'h-full rounded-full transition-all duration-300 ' + (r.excessConcessional > 0 ? 'bg-red-500' : (capPct >= 90 ? 'bg-amber-500' : 'bg-qbTeal-500'));
    document.getElementById('cap-used').textContent = formatCurrency(r.totalConcessional);
    document.getElementById('cap-total').textContent = formatCurrency(r.concessionalCap) + ' cap' +
        (r.cfAvailable > 0 ? ` + ${formatCurrency(r.cfAvailable)} carry-forward` : '');
    document.getElementById('cap-sg').textContent = formatCurrency(r.employerSuper);
    document.getElementById('cap-contrib').textContent = formatCurrency(p.salarySacrifice);
    document.getElementById('cap-contrib-label').textContent = isPersonal ? 'personal deductible' : 'salary sacrifice';
    document.getElementById('cap-remaining').textContent = r.excessConcessional > 0
        ? formatCurrency(r.excessConcessional) + ' over cap'
        : formatCurrency(Math.max(0, r.effectiveCap - r.totalConcessional)) + ' remaining' + (r.cfUsed > 0 ? ` (${formatCurrency(r.cfUsed)} carry-forward used)` : '');

    const excessBox = document.getElementById('cap-excess-box');
    if (r.excessConcessional > 0) {
        excessBox.classList.remove('hidden');
        const taxOn = ti => Math.max(0, computeRawIncomeTax(ti, config.brackets) - calculateOffsets(ti, yearKey, config)) + computeMedicareLevy(ti, config, r.isSaptoEligible, p.hasSpouse, p.spouseSalary, p.numChildren);
        const extraTax = Math.max(0, taxOn(r.taxableIncome + r.excessConcessional) - taxOn(r.taxableIncome) - 0.15 * r.excessConcessional);
        document.getElementById('cap-excess').textContent = formatCurrency(r.excessConcessional);
        document.getElementById('cap-excess-tax').textContent = formatCurrency(extraTax);
    } else {
        excessBox.classList.add('hidden');
    }

    renderDiv293(r, p, config);

    const sacBox = document.getElementById('super-sac-detail-box');
    if (p.salarySacrifice > 0) {
        sacBox.classList.remove('hidden');
        const noSac = computeIndividualTax({ ...p, salarySacrifice: 0 }, yearKey, config);

        const totalTaxSaved = noSac.totalTaxAndLevies - r.totalTaxAndLevies;
        const extraDiv293 = Math.max(0, r.div293Tax - noSac.div293Tax);
        const superFundTax = p.salarySacrifice * 0.15 + extraDiv293;
        const netOutofPocketTaxSave = totalTaxSaved - superFundTax;
        const netSuperAdded = p.salarySacrifice - superFundTax;
        const netCost = p.salarySacrifice - totalTaxSaved;
        const netWealthGain = netSuperAdded - netCost;

        document.getElementById('sac-fund-tax-label').textContent = extraDiv293 > 0
            ? 'Contributions Tax (15% + Div 293):' : 'Super Contributions Tax (15%):';
        document.getElementById('sac-amount-label').textContent = isPersonal ? 'Contributed from Savings:' : 'Amount Sacrificed:';
        document.getElementById('sac-takehome-label').textContent = isPersonal ? 'Net Cost After Tax Saving:' : 'Take-Home Pay Reduced By:';
        document.getElementById('sac-amount').textContent = formatCurrency(p.salarySacrifice);
        document.getElementById('sac-tax-saved').textContent = '+' + formatCurrency(totalTaxSaved);
        document.getElementById('sac-fund-tax').textContent = '-' + formatCurrency(superFundTax);
        document.getElementById('sac-net-tax-save').textContent = formatCurrency(netOutofPocketTaxSave);
        document.getElementById('sac-takehome-drop').textContent = '-' + formatCurrency(netCost);
        document.getElementById('sac-net-benefit').textContent = (netWealthGain >= 0 ? '+' : '-') + formatCurrency(Math.abs(netWealthGain));

        document.getElementById('sac-box-title').textContent = isPersonal ? 'Personal Deductible Contribution Analysis' : 'Salary Sacrifice Impact Analysis';
        document.getElementById('sac-box-badge').textContent = isPersonal ? 'Claimed as Deduction' : 'Pre-tax Super';
        document.getElementById('personal-deduct-note').classList.toggle('hidden', !isPersonal);
        document.getElementById('pd-paid').textContent = formatCurrency(p.salarySacrifice);
        document.getElementById('pd-refund').textContent = formatCurrency(totalTaxSaved);

        const b = v => `<span class="font-bold">${formatCurrency(v)}</span>`;
        document.getElementById('sac-summary').innerHTML = isPersonal
            ? `Contributing ${b(p.salarySacrifice)} from savings and claiming a deduction saves ${b(totalTaxSaved)} in tax, so the net cost is ${b(netCost)}. ${b(netSuperAdded)} lands in super after contributions tax — a net gain of ${b(netWealthGain)}.`
            : `By sacrificing ${b(p.salarySacrifice)}, your take-home pay reduces by only ${b(netCost)}, while adding ${b(netSuperAdded)} into super after contributions tax — a net gain of ${b(netWealthGain)}.`;

        const refundNote = document.getElementById('res-refund-note');
        refundNote.classList.toggle('hidden', !isPersonal);
        refundNote.textContent = `Includes ${formatCurrency(totalTaxSaved)} tax saving from the deduction. The ${formatCurrency(p.salarySacrifice)} contribution is paid from savings, not pay.`;
    } else {
        sacBox.classList.add('hidden');
        document.getElementById('res-refund-note').classList.add('hidden');
    }

    let frankLeft = r.frankingCredits;
    const taxSlice = Math.max(0, r.incomeTaxAfterOffsets - frankLeft);
    frankLeft = Math.max(0, frankLeft - r.incomeTaxAfterOffsets);
    const medSlice = Math.max(0, r.medicareLevy + r.mlsAmount - frankLeft);
    frankLeft = Math.max(0, frankLeft - (r.medicareLevy + r.mlsAmount));
    const hecsSlice = Math.max(0, r.hecsRepayment - frankLeft);
    renderChart(Math.max(0, r.netTakeHome), taxSlice, medSlice, hecsSlice);

    calculateDiv296();
    // Keep the Home Loan tab in sync (only if that tab is installed)
    if (typeof recalculateHomeLoan === 'function') recalculateHomeLoan();
}

// DIVISION 296
function toggleDiv296() {
    const body = document.getElementById('div296-body');
    const chev = document.getElementById('div296-chevron');
    const open = body.classList.toggle('hidden') === false;
    chev.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
    document.getElementById('div296-toggle-text').textContent = open ? 'Hide calculation' : 'Show calculation';
    if (open) calculateDiv296();
}

function getDiv296Config(yearKey) {
    const keys = Object.keys(TAX_DATA).map(Number).sort((a, b) => a - b);
    for (let i = keys.length - 1; i >= 0; i--) {
        if (keys[i] <= Number(yearKey) && TAX_DATA[String(keys[i])].div296) {
            return { cfg: TAX_DATA[String(keys[i])].div296, fromKey: keys[i] };
        }
    }
    return null;
}

function calculateDiv296() {
    if (!lastTaxResult) return;
    const body = document.getElementById('div296-body');
    if (!body || body.classList.contains('hidden')) return;

    const { yearKey, config, p, r } = lastTaxResult;
    const num = id => Math.max(0, parseFloat(document.getElementById(id).value) || 0);
    const na = document.getElementById('div296-na');
    const content = document.getElementById('div296-content');
    const d = getDiv296Config(yearKey);

    if (!d) {
        na.classList.remove('hidden');
        content.classList.add('hidden');
        na.textContent = `Division 296 commences 1 July 2026. Select FY27 (2026-27) or later in the Financial Year dropdown to model it.`;
        return;
    }
    na.classList.add('hidden');
    content.classList.remove('hidden');

    const cfg = d.cfg;
    const isTransitional = Number(yearKey) === 2027 && cfg.transitionalEndOnly;
    const tsbStart = num('div296-tsb-start');
    const tsbEnd = num('div296-tsb-end');
    const withdrawals = num('div296-withdrawals');
    const mode = document.getElementById('div296-earnings-mode').value;

    const contributions = r.employerSuper + p.salarySacrifice;
    const netContributions = contributions * 0.85;
    document.getElementById('div296-contribs').textContent = formatCurrency(contributions);
    document.getElementById('div296-net-contribs').textContent = formatCurrency(netContributions);

    document.getElementById('div296-start-wrap').classList.toggle('opacity-50', isTransitional);
    document.getElementById('div296-start-note').textContent = isTransitional
        ? 'Not used in 2026-27 (transitional: 30 June 2027 TSB only)'
        : 'Higher of start and end TSB is used';

    const realisedWrap = document.getElementById('div296-realised-wrap');
    const estimateWrap = document.getElementById('div296-estimate-wrap');
    let earnings;
    if (mode === 'realised') {
        realisedWrap.classList.remove('hidden');
        estimateWrap.classList.add('hidden');
        earnings = parseFloat(document.getElementById('div296-earnings').value) || 0;
    } else {
        realisedWrap.classList.add('hidden');
        estimateWrap.classList.remove('hidden');
        earnings = tsbEnd - tsbStart + withdrawals - netContributions;
        document.getElementById('div296-est-earnings').textContent = formatCurrency(earnings);
    }

    const tsb = isTransitional ? tsbEnd : Math.max(tsbStart, tsbEnd);
    const propLarge = tsb > cfg.large ? (tsb - cfg.large) / tsb : 0;
    const propVeryLarge = tsb > cfg.veryLarge ? (tsb - cfg.veryLarge) / tsb : 0;
    const taxableEarnings = Math.max(0, earnings);
    const taxLarge = cfg.largeRate * propLarge * taxableEarnings;
    const taxVeryLarge = cfg.veryLargeRate * propVeryLarge * taxableEarnings;
    const total = taxLarge + taxVeryLarge;
    const effRate = taxableEarnings > 0 ? total / taxableEarnings : 0;

    document.getElementById('div296-fy').textContent = config.name;
    document.getElementById('div296-thresholds').textContent =
        `${formatCurrency(cfg.large)} / ${formatCurrency(cfg.veryLarge)}${d.fromKey !== Number(yearKey) ? ` (FY${String(d.fromKey).slice(-2)} thresholds — update TAX_DATA)` : ''}`;
    document.getElementById('div296-tsb-used').textContent = formatCurrency(tsb);
    document.getElementById('div296-earnings-used').textContent = formatCurrency(earnings);
    document.getElementById('div296-prop-large').textContent = (propLarge * 100).toFixed(2) + '%';
    document.getElementById('div296-prop-vlarge').textContent = (propVeryLarge * 100).toFixed(2) + '%';
    document.getElementById('div296-tax-large').textContent = formatCurrency(taxLarge);
    document.getElementById('div296-tax-vlarge').textContent = formatCurrency(taxVeryLarge);
    document.getElementById('div296-total').textContent = formatCurrency(total);
    document.getElementById('div296-eff').textContent = (effRate * 100).toFixed(2) + '%';
    document.getElementById('div296-combined').textContent = taxableEarnings > 0 ? ((0.15 + effRate) * 100).toFixed(2) + '%' : '—';

    const status = document.getElementById('div296-status');
    if (tsb <= cfg.large) {
        status.className = 'p-3 rounded-xl border text-xs bg-emerald-50 border-emerald-200 text-emerald-900';
        status.textContent = `TSB of ${formatCurrency(tsb)} does not exceed the ${formatCurrency(cfg.large)} threshold — no Division 296 tax.`;
    } else if (earnings <= 0) {
        status.className = 'p-3 rounded-xl border text-xs bg-emerald-50 border-emerald-200 text-emerald-900';
        status.textContent = 'Division 296 earnings are nil or negative — assessment is nil (negative earnings are not refunded or carried forward).';
    } else {
        status.className = 'p-3 rounded-xl border text-xs bg-amber-50 border-amber-200 text-amber-900';
        status.textContent = `Estimated Division 296 assessment of ${formatCurrency(total)}. Assessed to the individual; may be paid personally or released from super.`;
    }
}

function renderChart(net, tax, medicare, hecs) {
    const svg = document.getElementById('donut-chart');
    const total = net + tax + medicare + hecs;
    if (total <= 0) {
        svg.innerHTML = '';
        return;
    }

    const slices = [
        { value: net, color: '#10b981' },
        { value: tax, color: '#ef4444' },
        { value: medicare, color: '#f59e0b' },
        { value: hecs, color: '#a855f7' }
    ];

    let cumulativePercent = 0;
    let pathsHtml = '';

    slices.forEach(slice => {
        if (slice.value <= 0) return;
        const percent = slice.value / total;
        const strokeDasharray = `${percent * 283} 283`;
        const strokeDashoffset = -cumulativePercent * 283;

        pathsHtml += `
            <circle cx="50" cy="50" r="45" fill="transparent" 
                    stroke="${slice.color}" stroke-width="10" 
                    stroke-dasharray="${strokeDasharray}" 
                    stroke-dashoffset="${strokeDashoffset}" />
        `;
        cumulativePercent += percent;
    });

    svg.innerHTML = pathsHtml;
}

registerTab('income-tax', {
    init() {
        updateCompanyRateLabel();
        toggleSpouseSection();
        calculateTax();
    }
});
