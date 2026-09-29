// HOME LOAN TAB (New Purchase + Existing Mortgage)
// Reads income and take-home pay from the Income Tax tab via calculatedTaxState / lastTaxResult.

const homeLoanState = {
    frequency: 'monthly'
};

function calculateStampDuty(stateCode, price, isFho) {
    switch(stateCode) {
        case 'VIC':
            if (isFho) {
                if (price <= 600000) return 0;
                if (price <= 750000) {
                    const fullDuty = calculateVICStandardDuty(price);
                    return fullDuty * ((price - 600000) / 150000);
                }
            }
            return calculateVICStandardDuty(price);

        case 'NSW':
            if (isFho) {
                if (price <= 800000) return 0;
                if (price <= 1000000) {
                    const fullDuty = calculateNSWStandardDuty(price);
                    return fullDuty * ((price - 800000) / 200000);
                }
            }
            return calculateNSWStandardDuty(price);

        case 'QLD':
            if (isFho) {
                if (price <= 700000) return 0;
                if (price <= 800000) {
                    const fullDuty = calculateQLDStandardDuty(price);
                    return fullDuty * ((price - 700000) / 100000);
                }
            }
            return calculateQLDStandardDuty(price);

        case 'WA':
            if (isFho) {
                if (price <= 450000) return 0;
                if (price <= 600000) return (price - 450000) * 0.1919;
            }
            return price * 0.038;

        case 'SA':
            if (isFho && price <= 650000) return 0;
            return price * 0.042;

        case 'TAS':
            if (isFho && price <= 750000) return (price * 0.035) * 0.5;
            return price * 0.036;

        case 'ACT':
            if (isFho) return 0;
            return price * 0.032;

        case 'NT':
            if (isFho && price <= 650000) return Math.max(0, (price * 0.03) - 10000);
            return price * 0.035;

        default:
            return price * 0.04;
    }
}

function calculateVICStandardDuty(price) {
    if (price <= 25000) return price * 0.014;
    if (price <= 130000) return 350 + (price - 25000) * 0.024;
    if (price <= 960000) return 2870 + (price - 130000) * 0.06;
    return price * 0.055;
}

function calculateNSWStandardDuty(price) {
    if (price <= 32000) return price * 0.0125;
    if (price <= 87000) return 400 + (price - 32000) * 0.015;
    if (price <= 327000) return 1225 + (price - 87000) * 0.035;
    if (price <= 1089000) return 9625 + (price - 327000) * 0.045;
    return 43915 + (price - 1089000) * 0.055;
}

function calculateQLDStandardDuty(price) {
    if (price <= 75000) return price * 0.015;
    if (price <= 540000) return 1125 + (price - 75000) * 0.035;
    if (price <= 1000000) return 17400 + (price - 540000) * 0.045;
    return 38100 + (price - 1000000) * 0.0575;
}

function calculateLMI(loanAmount, propertyValue, isWaived) {
    if (propertyValue <= 0) return 0;
    if (isWaived) return 0;

    const lvr = (loanAmount / propertyValue) * 100;
    if (lvr <= 80) return 0;

    let rate = 0;
    if (lvr <= 85) rate = 0.012;
    else if (lvr <= 90) rate = 0.024;
    else if (lvr <= 95) rate = 0.042;
    else rate = 0.055;

    return loanAmount * rate;
}

function calcRepayment(principal, annualRatePct, years, freq = 'monthly') {
    if (principal <= 0 || annualRatePct <= 0) return 0;

    let periodsPerYear = 12;
    if (freq === 'fortnightly') periodsPerYear = 26;
    if (freq === 'weekly') periodsPerYear = 52;

    const totalPeriods = years * periodsPerYear;
    const periodicRate = (annualRatePct / 100) / periodsPerYear;

    const repayment = principal * (periodicRate * Math.pow(1 + periodicRate, totalPeriods)) / (Math.pow(1 + periodicRate, totalPeriods) - 1);
    return repayment;
}

function drawLoanTrajectory(loanAmount, annualRatePct, years, extraRepay, freq) {
    const pathStd = document.getElementById('pathStandard');
    const pathExt = document.getElementById('pathExtra');

    if (!pathStd || !pathExt) return;

    if (loanAmount <= 0) {
        pathStd.setAttribute('d', 'M 0 160 L 500 160');
        pathExt.setAttribute('d', 'M 0 160 L 500 160');
        return;
    }

    const periodsPerYr = freq === 'weekly' ? 52 : (freq === 'fortnightly' ? 26 : 12);
    const r = (annualRatePct / 100) / periodsPerYr;
    const stdPmt = calcRepayment(loanAmount, annualRatePct, years, freq);
    const extPmt = stdPmt + extraRepay;

    let balStd = loanAmount;
    const stdPoints = [];
    const totalPeriods = years * periodsPerYr;

    for (let i = 0; i <= totalPeriods; i += Math.max(1, Math.floor(totalPeriods / 50))) {
        const x = (i / totalPeriods) * 500;
        const y = 160 - ((balStd / loanAmount) * 150);
        stdPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);

        for (let k = 0; k < Math.max(1, Math.floor(totalPeriods / 50)); k++) {
            if (balStd <= 0) break;
            const interest = balStd * r;
            balStd = balStd - (stdPmt - interest);
        }
        if (balStd < 0) balStd = 0;
    }

    let balExt = loanAmount;
    const extPoints = [];
    for (let i = 0; i <= totalPeriods; i += Math.max(1, Math.floor(totalPeriods / 50))) {
        const x = (i / totalPeriods) * 500;
        const y = 160 - ((balExt / loanAmount) * 150);
        extPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);

        for (let k = 0; k < Math.max(1, Math.floor(totalPeriods / 50)); k++) {
            if (balExt <= 0) break;
            const interest = balExt * r;
            balExt = balExt - (extPmt - interest);
        }
        if (balExt < 0) balExt = 0;
    }

    pathStd.setAttribute('d', `M ${stdPoints.join(' L ')}`);
    pathExt.setAttribute('d', `M ${extPoints.join(' L ')}`);

    document.getElementById('chartMaxLoanLabel').textContent = formatCurrency(loanAmount);
    document.getElementById('chartMaxYearsLabel').textContent = `${years} Yrs`;
}

function recalculateHomeLoan() {
    // Read populated figures directly from calculatedTaxState
    const userInc = calculatedTaxState.userIncome;
    const spouseInc = calculatedTaxState.spouseIncome;
    const combinedTakeHomeAnnual = calculatedTaxState.combinedTakeHome;
    const combinedTakeHomeMonthly = combinedTakeHomeAnnual / 12;

    const combinedGrossAnnual = userInc + spouseInc;
    const combinedGrossMonthly = combinedGrossAnnual / 12;

    // Sync readonly fields in Home Loan tab
    document.getElementById('userIncome').value = userInc;
    document.getElementById('spouseIncome').value = spouseInc;
    document.getElementById('combinedIncomeDisplay').textContent = formatCurrency(combinedGrossAnnual) + ' / yr';
    document.getElementById('combinedTakeHomeDisplay').textContent = formatCurrency(combinedTakeHomeAnnual) + ' / yr';

    const stateCode = document.getElementById('stateSelect').value;
    const isFho = document.getElementById('fhoToggle').checked;
    const usingFhg = document.getElementById('fhgToggle').checked;
    const fhgLocation = document.getElementById('fhgLocation').value;
    const deposit = parseFloat(document.getElementById('depositInput').value) || 0;
    const targetProperty = parseFloat(document.getElementById('targetPropertyValue').value) || 0;
    const rate = parseFloat(document.getElementById('interestRate').value) || 6.25;
    const loanTermYears = parseInt(document.getElementById('loanTerm').value) || 30;
    const extraRepay = parseFloat(document.getElementById('extraRepayment').value) || 0;

    // Minimum deposit verification
    const fhg = getHomeGuaranteeStatus(stateCode, fhgLocation, targetProperty, deposit, isFho, usingFhg);
    document.getElementById('fhgFields').classList.toggle('hidden', !usingFhg);
    document.getElementById('fhgCapText').textContent = formatCurrency(fhg.cap);
    const fhgStatusEl = document.getElementById('fhgStatusText');
    fhgStatusEl.classList.toggle('hidden', !usingFhg);
    fhgStatusEl.textContent = (fhg.applies ? '✓ ' : '✕ ') + fhg.reason;
    fhgStatusEl.className = 'text-[11px] font-semibold ' + (fhg.applies ? 'text-emerald-700' : 'text-amber-700') + (usingFhg ? '' : ' hidden');

    const minDepositPct = usingFhg ? 5 : 10;
    const reqMinDeposit = (targetProperty * minDepositPct) / 100;
    const depositWarningEl = document.getElementById('depositWarning');

    if (deposit < reqMinDeposit && targetProperty > 0) {
        depositWarningEl.classList.remove('hidden');
        depositWarningEl.textContent = `Warning: ${usingFhg ? 'Home Guarantee buyers (5% min)' : 'Standard buyers (10% min)'} require a minimum deposit of ${formatCurrency(reqMinDeposit)} for this property value.`;
    } else {
        depositWarningEl.classList.add('hidden');
    }

    // LMI Calculation logic
    const initialLoanNeeded = Math.max(0, targetProperty - deposit);
    const lmiAmount = calculateLMI(initialLoanNeeded, targetProperty, fhg.applies);
    const totalLoan = initialLoanNeeded;
    const actualLvr = targetProperty > 0 ? (initialLoanNeeded / targetProperty) * 100 : 0;

    // Repayment Calculations
    const mainRepayment = calcRepayment(totalLoan, rate, loanTermYears, homeLoanState.frequency);
    const bufferedRate = rate + 0.50;
    const bufferedRepayment = calcRepayment(totalLoan, bufferedRate, loanTermYears, homeLoanState.frequency);

    // Monthly equivalent for stress check
    let monthlyEquivalent = mainRepayment;
    if (homeLoanState.frequency === 'fortnightly') monthlyEquivalent = (mainRepayment * 26) / 12;
    if (homeLoanState.frequency === 'weekly') monthlyEquivalent = (mainRepayment * 52) / 12;

    const stressPct = combinedGrossMonthly > 0 ? (monthlyEquivalent / combinedGrossMonthly) * 100 : 0;

    // Borrowing Capacity
    const dtiCap = combinedGrossAnnual * 6.0;
    const apraBufferRate = rate + 3.00;
    const maxMonthlyServiceable = combinedGrossMonthly * 0.35;

    const rPerMonth = (apraBufferRate / 100) / 12;
    const nMonths = loanTermYears * 12;
    const servCap = maxMonthlyServiceable * (Math.pow(1 + rPerMonth, nMonths) - 1) / (rPerMonth * Math.pow(1 + rPerMonth, nMonths));

    const estimatedMaxBorrowing = Math.min(dtiCap, servCap);

    // Stamp Duty & Fees
    const stampDuty = calculateStampDuty(stateCode, targetProperty, isFho);
    const transferFees = 1650;
    const totalUpfront = deposit + stampDuty + transferFees + lmiAmount;

    const maxHousePrice = Math.max(0, estimatedMaxBorrowing + deposit - stampDuty);

    // Extra Repayments Savings
    let interestSaved = 0;
    let monthsSaved = 0;
    if (extraRepay > 0 && totalLoan > 0) {
        const periodsPerYr = homeLoanState.frequency === 'weekly' ? 52 : (homeLoanState.frequency === 'fortnightly' ? 26 : 12);
        const r = (rate / 100) / periodsPerYr;
        const standardPmt = calcRepayment(totalLoan, rate, loanTermYears, homeLoanState.frequency);
        const totalPmt = standardPmt + extraRepay;

        let balance = totalLoan;
        let periodCount = 0;
        let totalInterestPaidExtra = 0;

        while (balance > 0 && periodCount < (loanTermYears * periodsPerYr)) {
            const interest = balance * r;
            const principal = totalPmt - interest;
            totalInterestPaidExtra += interest;
            balance -= principal;
            periodCount++;
        }

        const standardTotalInterest = (standardPmt * loanTermYears * periodsPerYr) - totalLoan;
        interestSaved = Math.max(0, standardTotalInterest - totalInterestPaidExtra);
        const totalOriginalPeriods = loanTermYears * periodsPerYr;
        const periodDiff = Math.max(0, totalOriginalPeriods - periodCount);
        monthsSaved = Math.floor((periodDiff / periodsPerYr) * 12);
    }

    drawLoanTrajectory(totalLoan, rate, loanTermYears, extraRepay, homeLoanState.frequency);

    // Update UI Header & Indicators
    document.getElementById('mainRepaymentDisplay').textContent = formatCurrency(mainRepayment);
    document.getElementById('repaymentFreqLabel').textContent = `/ ${homeLoanState.frequency.replace('ly', '')}`;
    document.getElementById('currentRateLabel').textContent = `${rate.toFixed(2)}%`;
    document.getElementById('bufferedRateLabel').textContent = `${bufferedRate.toFixed(2)}%`;
    document.getElementById('bufferedRepaymentDisplay').textContent = formatCurrency(bufferedRepayment);
    document.getElementById('bufferedFreqLabel').textContent = `/ ${homeLoanState.frequency.replace('ly', '')}`;

    // Stress Badge & Banner
    const stressBadge = document.getElementById('stressBadge');
    const stressBanner = document.getElementById('stressBanner');
    const stressBannerTitle = document.getElementById('stressBannerTitle');

    document.getElementById('stressPercentText').textContent = `${stressPct.toFixed(1)}%`;
    document.getElementById('grossMonthlyIncomeText').textContent = Math.round(combinedGrossMonthly).toLocaleString();

    if (stressPct > 30) {
        stressBadge.className = "px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40";
        stressBadge.textContent = "Financial Stress Warning";

        stressBanner.className = "text-xs p-3 rounded-xl flex items-start gap-2 bg-rose-950/60 border border-rose-800/60 text-rose-200";
        stressBannerTitle.textContent = "Financial Stress Rule Exceeded (>30%)";
        document.getElementById('stressBannerIcon').innerHTML = `<svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else {
        stressBadge.className = "px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
        stressBadge.textContent = "Comfortable Borrowing Ratio";

        stressBanner.className = "text-xs p-3 rounded-xl flex items-start gap-2 bg-emerald-950/60 border border-emerald-800/60 text-emerald-200";
        stressBannerTitle.textContent = "Safe Serviceability Range (<=30%)";
        document.getElementById('stressBannerIcon').innerHTML = `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    // Borrowing Cards
    document.getElementById('maxBorrowingDisplay').textContent = formatCurrency(estimatedMaxBorrowing);
    document.getElementById('dtiCapText').textContent = formatCurrency(dtiCap);
    document.getElementById('servCapText').textContent = formatCurrency(servCap);

    document.getElementById('maxHousePriceDisplay').textContent = formatCurrency(maxHousePrice);
    document.getElementById('lvrDisplay').textContent = `${actualLvr.toFixed(1)}%`;

    const lmiStatusBadge = document.getElementById('lmiStatusBadge');
    if (fhg.applies) {
        lmiStatusBadge.textContent = "Waived (Home Guarantee)";
        lmiStatusBadge.className = "text-emerald-600 font-bold";
    } else if (lmiAmount > 0) {
        lmiStatusBadge.textContent = formatCurrency(lmiAmount);
        lmiStatusBadge.className = "text-amber-600 font-bold";
    } else {
        lmiStatusBadge.textContent = "$0 (LVR <= 80%)";
        lmiStatusBadge.className = "text-slate-700";
    }

    // 50/30/20 Gauge calculations using COMBINED POST-TAX TAKE HOME PAY
    const needs50 = combinedTakeHomeMonthly * 0.50;
    const wants30 = combinedTakeHomeMonthly * 0.30;
    const savings20 = combinedTakeHomeMonthly * 0.20;

    document.getElementById('gaugeGrossMonthly').textContent = `${formatCurrency(combinedTakeHomeMonthly)}/mo`;
    document.getElementById('needsValue').textContent = formatCurrency(needs50);
    document.getElementById('wantsValue').textContent = formatCurrency(wants30);
    document.getElementById('savingsValue').textContent = formatCurrency(savings20);

    const mortgageShareOfNeeds = needs50 > 0 ? (monthlyEquivalent / needs50) * 100 : 0;
    document.getElementById('mortgageShareText').textContent = `Mortgage: ${mortgageShareOfNeeds.toFixed(0)}% of Needs`;

    // Extra Repayments Savings
    document.getElementById('extraInterestSaved').textContent = formatCurrency(interestSaved);
    const yrsSaved = Math.floor(monthsSaved / 12);
    const remMonthsSaved = monthsSaved % 12;
    document.getElementById('extraTimeSaved').textContent = `${yrsSaved} Yrs, ${remMonthsSaved} Mos`;

    // Upfront Cash Breakdown Table
    document.getElementById('breakdownPropertyValue').textContent = targetProperty.toLocaleString();
    document.getElementById('breakdownDeposit').textContent = formatCurrency(deposit);
    const depositPctOfProp = targetProperty > 0 ? ((deposit / targetProperty) * 100).toFixed(1) : 0;
    document.getElementById('breakdownDepositPctText').textContent = `(${depositPctOfProp}% of Property Value)`;

    document.getElementById('breakdownStateLabel').textContent = stateCode;
    document.getElementById('breakdownFhoLabel').textContent = isFho ? 'First Home Buyer' : 'Standard';
    document.getElementById('breakdownStampDuty').textContent = formatCurrency(stampDuty);

    const lmiRow = document.getElementById('breakdownLmiRow');
    if (fhg.applies || lmiAmount <= 0) {
        lmiRow.classList.add('hidden');
    } else {
        lmiRow.classList.remove('hidden');
        document.getElementById('breakdownLmi').textContent = formatCurrency(lmiAmount);
        document.getElementById('lmiSubtext').textContent = usingFhg
            ? `Home Guarantee not available — ${fhg.reason}`
            : 'Required for deposits under 20%';
    }

    document.getElementById('breakdownTotalUpfront').textContent = formatCurrency(totalUpfront);
}

// --- HOME GUARANTEE (5% DEPOSIT SCHEME) PRICE CAPS ---
// Source: firsthomebuyers.gov.au property price caps. 'capital' = capital city & regional centres.
const FHG_PRICE_CAPS = {
    NSW: { capital: 1500000, rest: 800000 },
    VIC: { capital: 950000, rest: 650000 },
    QLD: { capital: 1000000, rest: 700000 },
    WA:  { capital: 850000, rest: 600000 },
    SA:  { capital: 900000, rest: 500000 },
    TAS: { capital: 700000, rest: 550000 },
    ACT: { capital: 1000000, rest: 1000000 },
    NT:  { capital: 750000, rest: 600000 }
};

function getHomeGuaranteeStatus(stateCode, location, price, deposit, isFirstHomeBuyer, usingScheme) {
    const caps = FHG_PRICE_CAPS[stateCode] || FHG_PRICE_CAPS.VIC;
    const cap = caps[location] || caps.capital;
    if (!usingScheme) return { applies: false, cap, reason: 'Not using the Home Guarantee Scheme' };
    if (!isFirstHomeBuyer) return { applies: false, cap, reason: 'Scheme requires a first home buyer' };
    if (price > cap) return { applies: false, cap, reason: `Price exceeds the ${stateCode} ${formatCurrency(cap)} cap` };
    if (price > 0 && deposit < price * 0.05) return { applies: false, cap, reason: 'Deposit below the 5% minimum' };
    return { applies: true, cap, reason: `Waived under Home Guarantee (cap ${formatCurrency(cap)})` };
}

// --- HOME LOAN MODE SWITCH ---
let homeLoanMode = 'new';
function setHomeLoanMode(mode) {
    homeLoanMode = mode;
    document.getElementById('hl-new-view').classList.toggle('hidden', mode !== 'new');
    document.getElementById('hl-existing-view').classList.toggle('hidden', mode !== 'existing');
    const on = 'hl-mode-btn px-4 py-2 rounded-lg text-sm font-bold transition bg-qbNavy-600 text-white shadow-sm';
    const off = 'hl-mode-btn px-4 py-2 rounded-lg text-sm font-bold transition text-gray-600 hover:bg-white';
    document.getElementById('hl-mode-new').className = mode === 'new' ? on : off;
    document.getElementById('hl-mode-existing').className = mode === 'existing' ? on : off;
    document.getElementById('hl-title').textContent = mode === 'new'
        ? 'Home Loan Borrowing & Repayment Calculator' : 'Existing Mortgage Interest Savings';
    document.getElementById('hl-subtitle').textContent = mode === 'new'
        ? 'Estimate borrowing capacity, stamp duty concessions, Home Guarantee LMI waiver, serviceability stress, and loan payoff trajectory.'
        : 'See how much interest extra repayments and an offset account save on your current loan.';
    if (mode === 'existing') recalcExistingMortgage();
    else recalculateHomeLoan();
}

// --- EXISTING MORTGAGE INTEREST SAVINGS ---
const EM_SERIES = {
    current:  { label: 'Current', color: '#64748b', dash: '6,4' },
    extra:    { label: 'Extra repayments', color: '#2563eb' },
    offset:   { label: 'Offset account', color: '#d97706' },
    combined: { label: 'Combined', color: '#0d9488' }
};
let emFrequency = 'monthly';
let emChartData = null;

function simulateMortgage({ balance, ratePct, periodsPerYear, payment, extra = 0, offset = 0, offsetTopUp = 0 }) {
    const r = ratePct / 100 / periodsPerYear;
    let bal = balance, off = offset, totalInterest = 0, periods = 0, firstYearInterest = 0;
    const maxPeriods = periodsPerYear * 60;
    const netDebt = [Math.max(0, bal - off)];
    while (bal > 0.005 && periods < maxPeriods) {
        const interest = Math.max(0, bal - off) * r;
        totalInterest += interest;
        if (periods < periodsPerYear) firstYearInterest += interest;
        bal = bal + interest - (payment + extra);
        off += offsetTopUp;
        periods++;
        // Loan is effectively cleared once the offset covers the remaining balance
        if (off > 0 && bal <= off) { bal = 0; }
        netDebt.push(Math.max(0, bal - off));
    }
    return { periods, totalInterest, firstYearInterest, netDebt, neverRepaid: periods >= maxPeriods && bal > 0 };
}

function periodsToText(periods, ppy) {
    const months = Math.round(periods * 12 / ppy);
    return `${Math.floor(months / 12)} yrs ${months % 12} mos`;
}

function payoffDateText(periods, ppy) {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.round(periods * 12 / ppy));
    return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

function recalcExistingMortgage() {
    const num = id => Math.max(0, parseFloat(document.getElementById(id).value) || 0);
    const balance = num('em-balance');
    const ratePct = num('em-rate');
    const ppy = emFrequency === 'weekly' ? 52 : (emFrequency === 'fortnightly' ? 26 : 12);
    const termPeriods = Math.max(1, Math.round((num('em-years') + Math.min(11, num('em-months')) / 12) * ppy));
    const r = ratePct / 100 / ppy;

    const minPayment = balance > 0 && r > 0
        ? balance * (r * Math.pow(1 + r, termPeriods)) / (Math.pow(1 + r, termPeriods) - 1)
        : balance / termPeriods;
    const entered = parseFloat(document.getElementById('em-repayment').value);
    const payment = !isNaN(entered) && entered > minPayment ? entered : minPayment;
    document.getElementById('em-min-repay').textContent = formatCurrency(minPayment) + ' / ' + emFrequency.replace('ly', '');

    const extraOn = document.getElementById('em-extra-toggle').checked;
    const offsetOn = document.getElementById('em-offset-toggle').checked;
    document.getElementById('em-extra-fields').classList.toggle('hidden', !extraOn);
    document.getElementById('em-offset-fields').classList.toggle('hidden', !offsetOn);
    const extra = extraOn ? num('em-extra') : 0;
    const offset = offsetOn ? num('em-offset') : 0;
    const topUp = offsetOn ? num('em-offset-topup') : 0;

    const base = { balance, ratePct, periodsPerYear: ppy, payment };
    const results = { current: simulateMortgage(base) };
    if (extraOn && extra > 0) results.extra = simulateMortgage({ ...base, extra });
    if (offsetOn && (offset > 0 || topUp > 0)) results.offset = simulateMortgage({ ...base, offset, offsetTopUp: topUp });
    if (results.extra && results.offset) results.combined = simulateMortgage({ ...base, extra, offset, offsetTopUp: topUp });

    const cur = results.current;
    const bestKey = results.combined ? 'combined' : (results.extra && results.offset
        ? 'combined' : (results.extra ? 'extra' : (results.offset ? 'offset' : 'current')));
    const best = results[bestKey];

    // Hero
    const saved = Math.max(0, cur.totalInterest - best.totalInterest);
    const periodsSaved = Math.max(0, cur.periods - best.periods);
    document.getElementById('em-hero-label').textContent = bestKey === 'current'
        ? 'Interest Remaining on Current Loan' : `Total Interest Saved — ${EM_SERIES[bestKey].label}`;
    document.getElementById('em-hero-saved').textContent = formatCurrency(bestKey === 'current' ? cur.totalInterest : saved);
    document.getElementById('em-hero-time').textContent = periodsToText(periodsSaved, ppy);
    document.getElementById('em-hero-sub').textContent = bestKey === 'current'
        ? `Paid off ${payoffDateText(cur.periods, ppy)}. Turn on a strategy to see savings.`
        : `Paid off ${payoffDateText(best.periods, ppy)} instead of ${payoffDateText(cur.periods, ppy)}`;

    const warn = document.getElementById('em-warning');
    if (cur.neverRepaid) {
        warn.classList.remove('hidden');
        document.getElementById('em-warning-text').textContent = 'The repayment does not cover the interest — the loan would never be repaid at this rate.';
    } else warn.classList.add('hidden');

    // Comparison table
    const order = ['current', 'extra', 'offset', 'combined'].filter(k => results[k]);
    document.getElementById('em-table-body').innerHTML = order.map(k => {
        const res = results[k];
        const isCur = k === 'current';
        const sv = cur.totalInterest - res.totalInterest;
        const ps = cur.periods - res.periods;
        return `<tr class="${k === bestKey && !isCur ? 'bg-emerald-50/50' : ''}">
            <td class="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap"><span class="inline-block w-3 h-3 rounded-full mr-2 align-middle" style="background:${EM_SERIES[k].color}"></span>${EM_SERIES[k].label}</td>
            <td class="py-2.5 px-3 text-right text-gray-700 whitespace-nowrap">${periodsToText(res.periods, ppy)}</td>
            <td class="py-2.5 px-3 text-right text-gray-700">${formatCurrency(res.totalInterest)}</td>
            <td class="py-2.5 px-3 text-right font-bold ${isCur ? 'text-gray-400' : 'text-emerald-600'}">${isCur ? '—' : formatCurrency(sv)}</td>
            <td class="py-2.5 px-3 text-right font-semibold whitespace-nowrap ${isCur ? 'text-gray-400' : 'text-qbNavy-600'}">${isCur ? '—' : periodsToText(ps, ppy)}</td>
        </tr>`;
    }).join('');

    // Offset insight (uses marginal rate from the Income Tax tab)
    const insight = document.getElementById('em-offset-insight');
    if (results.offset) {
        insight.classList.remove('hidden');
        const marginal = lastTaxResult ? getMarginalTaxRate(lastTaxResult.r.taxableIncome, lastTaxResult.config.brackets) : 0;
        const effMarginal = marginal > 0 ? marginal + 0.02 : 0;
        document.getElementById('em-offset-return').textContent = ratePct.toFixed(2) + '%';
        document.getElementById('em-offset-pretax').textContent = (ratePct / (1 - effMarginal)).toFixed(2) + '%';
        document.getElementById('em-offset-marginal').textContent = `At ${(effMarginal * 100).toFixed(0)}% marginal rate incl. Medicare`;
        document.getElementById('em-offset-y1').textContent = formatCurrency(cur.firstYearInterest - results.offset.firstYearInterest);
    } else {
        insight.classList.add('hidden');
    }

    emChartData = { results, order, ppy, balance };
    renderEmChart();
}

function renderEmChart() {
    if (!emChartData) return;
    const { results, order, ppy, balance } = emChartData;
    const svg = document.getElementById('em-chart');
    const W = 600, H = 240, L = 56, R = 12, T = 12, B = 28;
    const pw = W - L - R, ph = H - T - B;
    const maxPeriods = Math.max(...order.map(k => results[k].netDebt.length - 1), 1);
    const years = maxPeriods / ppy;
    const x = p => L + (p / maxPeriods) * pw;
    const y = v => T + ph - (balance > 0 ? (v / balance) * ph : 0);

    let g = '';
    // Recessive grid & y labels
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
        const yy = y(balance * f);
        g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#e5e7eb" stroke-width="1"/>`;
        g += `<text x="${L - 6}" y="${yy + 3}" text-anchor="end" font-size="10" fill="#6b7280">${formatCompact(balance * f)}</text>`;
    });
    // X labels every 5 years
    const step = years > 20 ? 5 : (years > 8 ? 2 : 1);
    for (let yr = 0; yr <= Math.floor(years); yr += step) {
        g += `<text x="${x(yr * ppy)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#6b7280">${yr}y</text>`;
    }
    // Series (current drawn first, underneath)
    order.forEach(k => {
        const s = EM_SERIES[k], data = results[k].netDebt;
        const stride = Math.max(1, Math.floor(data.length / 150));
        const pts = [];
        for (let i = 0; i < data.length; i += stride) pts.push(`${x(i).toFixed(1)},${y(data[i]).toFixed(1)}`);
        pts.push(`${x(data.length - 1).toFixed(1)},${y(data[data.length - 1]).toFixed(1)}`);
        g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
    });
    g += `<line id="em-crosshair" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="#94a3b8" stroke-width="1" visibility="hidden"/>`;
    g += `<rect id="em-hit" x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent" style="cursor:crosshair"/>`;
    svg.innerHTML = g;

    document.getElementById('em-legend').innerHTML = order.map(k =>
        `<span class="flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="${EM_SERIES[k].color}" stroke-width="2" ${EM_SERIES[k].dash ? 'stroke-dasharray="4,3"' : ''}/></svg>${EM_SERIES[k].label}</span>`).join('');

    // Hover: crosshair + tooltip
    const hit = document.getElementById('em-hit');
    const tip = document.getElementById('em-tooltip');
    const cross = document.getElementById('em-crosshair');
    const wrap = document.getElementById('em-chart-wrap');
    hit.addEventListener('mousemove', ev => {
        const rect = svg.getBoundingClientRect();
        const sx = (ev.clientX - rect.left) * (W / rect.width);
        const p = Math.max(0, Math.min(maxPeriods, Math.round(((sx - L) / pw) * maxPeriods)));
        cross.setAttribute('x1', x(p)); cross.setAttribute('x2', x(p));
        cross.setAttribute('visibility', 'visible');
        const months = Math.round(p * 12 / ppy);
        tip.innerHTML = `<div class="font-bold mb-1">Year ${Math.floor(months / 12)}, month ${months % 12}</div>` +
            order.map(k => {
                const d = results[k].netDebt;
                const v = p < d.length ? d[p] : 0;
                return `<div class="flex justify-between gap-3"><span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full inline-block" style="background:${EM_SERIES[k].color}"></span>${EM_SERIES[k].label}</span><span class="font-semibold">${formatCurrency(v)}</span></div>`;
            }).join('');
        tip.classList.remove('hidden');
        const px = (x(p) / W) * rect.width;
        const left = px > rect.width / 2 ? px - tip.offsetWidth - 12 : px + 12;
        tip.style.left = left + 'px';
        tip.style.top = '8px';
    });
    hit.addEventListener('mouseleave', () => {
        tip.classList.add('hidden');
        cross.setAttribute('visibility', 'hidden');
    });
}

function formatCompact(v) {
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'm';
    if (v >= 1000) return '$' + Math.round(v / 1000) + 'k';
    return '$' + Math.round(v);
}

function initExistingMortgageListeners() {
    document.querySelectorAll('.em-input').forEach(el => {
        el.addEventListener('input', recalcExistingMortgage);
        el.addEventListener('change', recalcExistingMortgage);
    });
    document.querySelectorAll('.em-freq-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.em-freq-btn').forEach(b =>
                b.className = 'em-freq-btn py-1.5 rounded-lg text-xs font-bold transition text-gray-600 hover:bg-white');
            btn.className = 'em-freq-btn py-1.5 rounded-lg text-xs font-bold transition bg-qbNavy-600 text-white';
            emFrequency = btn.getAttribute('data-emfreq');
            recalcExistingMortgage();
        });
    });
}

// Attach listeners for home loan inputs
function initHomeLoanListeners() {
    const inputs = [
        'stateSelect', 'fhoToggle', 'fhgToggle', 'fhgLocation', 'depositInput', 
        'targetPropertyValue', 'interestRate', 'loanTerm', 'extraRepayment'
    ];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', recalculateHomeLoan);
            el.addEventListener('change', recalculateHomeLoan);
        }
    });

    document.querySelectorAll('.freq-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.freq-btn').forEach(b => {
                b.classList.remove('bg-brand-600', 'text-white');
                b.classList.add('bg-slate-100', 'text-slate-600');
            });
            e.target.classList.remove('bg-slate-100', 'text-slate-600');
            e.target.classList.add('bg-brand-600', 'text-white');

            homeLoanState.frequency = e.target.getAttribute('data-freq');
            recalculateHomeLoan();
        });
    });
}

registerTab('home-loan', {
    init() {
        initHomeLoanListeners();
        initExistingMortgageListeners();
        recalculateHomeLoan();
    },
    onShow() {
        recalculateHomeLoan();
        if (homeLoanMode === 'existing') recalcExistingMortgage();
    }
});
