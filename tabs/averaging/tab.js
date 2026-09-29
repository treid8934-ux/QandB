// --- SPECIAL PROFESSIONALS INCOME AVERAGING (DIVISION 405) LOGIC ---
// Self-contained: takes no figures from the other tabs. Tax rates come from TAX_DATA
// above, so adding a new financial year there automatically flows through here.
(function() {
    const collapsedCards = new Set();
    let lastResults = [];

    // TAX_DATA is keyed by the year the FY ENDS (e.g. "2027" = FY 2026-27).
    // This tool works in FY start years (2026 = FY 2026-27), so key = fyStart + 1.
    function getTaxYearKeys() {
        return Object.keys(TAX_DATA).map(Number).sort((a, b) => a - b);
    }

    function getRatesForFy(fyStart) {
        const key = fyStart + 1;
        if (TAX_DATA[String(key)]) {
            return { config: TAX_DATA[String(key)], key, status: 'exact' };
        }
        const keys = getTaxYearKeys();
        const latest = keys[keys.length - 1];
        const earliest = keys[0];
        if (key > latest) return { config: TAX_DATA[String(latest)], key: latest, status: 'projected' };
        return { config: TAX_DATA[String(earliest)], key: earliest, status: 'backfilled' };
    }

    function basicTax(income, fyStart) {
        return computeRawIncomeTax(Math.max(0, income), getRatesForFy(fyStart).config.brackets);
    }

    function fyLabelFromStart(fyStart) {
        return `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`;
    }

    function formatCurr(val) {
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(val || 0);
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function populateStartYears() {
        const select = document.getElementById('avg-start-year');
        const keys = getTaxYearKeys();
        const latest = keys[keys.length - 1];
        const previous = select.value;
        select.innerHTML = '';
        keys.forEach(key => {
            const fyStart = key - 1;
            const opt = document.createElement('option');
            opt.value = fyStart;
            opt.textContent = fyLabelFromStart(fyStart);
            select.appendChild(opt);
        });
        // Default: three years before the latest loaded year, so a 3-year model uses published rates
        const defaultStart = Math.max(keys[0], latest - 3) - 1;
        select.value = previous && select.querySelector(`option[value="${previous}"]`) ? previous : String(defaultStart);
    }

    function getStartYear() { return parseInt(document.getElementById('avg-start-year').value); }
    function getNumYears() { return parseInt(document.getElementById('avg-num-years').value); }

    function renderInputRows() {
        const startYear = getStartYear();
        const numYears = getNumYears();
        const tbody = document.getElementById('avg-input-body');

        const existingTPI = [];
        const existingOther = [];
        for (let i = 0; i < 8; i++) {
            const elTpi = document.getElementById(`avg-tpi-${i}`);
            const elOther = document.getElementById(`avg-other-${i}`);
            existingTPI[i] = elTpi && elTpi.value !== '' ? elTpi.value : '0';
            existingOther[i] = elOther && elOther.value !== '' ? elOther.value : '0';
        }

        tbody.innerHTML = '';

        for (let i = 0; i < numYears; i++) {
            const fyStart = startYear + i;
            const rates = getRatesForFy(fyStart);
            const ratesFlag = rates.status === 'exact' ? '' :
                `<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200" title="No rates loaded for this year — using FY${String(rates.key).slice(-2)} rates">FY${String(rates.key).slice(-2)} rates</span>`;
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50/80 transition';
            row.innerHTML = `
                <td class="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap">${fyLabelFromStart(fyStart)}${ratesFlag}</td>
                <td class="py-2.5 px-3">
                    <span class="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${i === 0 ? 'bg-qbTeal-500/10 text-qbTeal-600 border border-qbTeal-500/30' : 'bg-gray-100 text-gray-700 border border-gray-200'}">
                        ${i === 0 ? 'Year 1 (Base)' : `Year ${i + 1}`}
                    </span>
                </td>
                <td class="py-2.5 px-3 min-w-[160px]">
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-bold text-xs">$</span>
                        <input type="number" id="avg-tpi-${i}" value="${existingTPI[i]}" step="1000" min="0"
                            class="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-qbNavy-500 focus:outline-none"
                            oninput="window.SpecialProfAveragingApp.calculate()">
                    </div>
                </td>
                <td class="py-2.5 px-3 min-w-[160px]">
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-bold text-xs">$</span>
                        <input type="number" id="avg-other-${i}" value="${existingOther[i]}" step="1000" min="0"
                            class="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-qbNavy-500 focus:outline-none"
                            oninput="window.SpecialProfAveragingApp.calculate()">
                    </div>
                </td>
                <td class="py-2.5 px-3 text-right font-bold text-qbNavy-600 whitespace-nowrap" id="avg-total-${i}">$0.00</td>
            `;
            tbody.appendChild(row);
        }
    }

    function computeResults() {
        const startYear = getStartYear();
        const numYears = getNumYears();
        const years = [];

        for (let i = 0; i < numYears; i++) {
            const tpi = Math.max(0, parseFloat(document.getElementById(`avg-tpi-${i}`)?.value) || 0);
            const nonProf = Math.max(0, parseFloat(document.getElementById(`avg-other-${i}`)?.value) || 0);
            years.push({ fyStart: startYear + i, fyLabel: fyLabelFromStart(startYear + i), tpi, nonProf, totalIncome: tpi + nonProf });
        }

        return years.map((cur, i) => {
            const yearNum = i + 1;
            let atpi = 0;
            // Division 405 phase-in of Average Taxable Professional Income
            if (yearNum === 2) atpi = years[0].tpi / 3;
            else if (yearNum === 3) atpi = (years[0].tpi + years[1].tpi) / 4;
            else if (yearNum === 4) atpi = (years[0].tpi + years[1].tpi + years[2].tpi) / 4;
            else if (yearNum >= 5) atpi = (years[i - 1].tpi + years[i - 2].tpi + years[i - 3].tpi + years[i - 4].tpi) / 4;

            const aaspi = Math.max(0, cur.tpi - atpi);
            // Normal taxable income = total taxable income less AASPI
            // (when TPI <= ATPI there is no AASPI, so this is simply total income)
            const otherIncome = cur.totalIncome - aaspi;
            const sliceIncome = otherIncome + (0.20 * aaspi);

            const stepATax = basicTax(otherIncome, cur.fyStart);
            const stepBTax = basicTax(sliceIncome, cur.fyStart);
            const aaspiTax = 5 * (stepBTax - stepATax);
            const averagedTax = stepATax + aaspiTax;
            const standardTax = basicTax(cur.totalIncome, cur.fyStart);
            const taxSavings = Math.max(0, standardTax - averagedTax);
            const rates = getRatesForFy(cur.fyStart);

            return { ...cur, yearNum, atpi, aaspi, otherIncome, sliceIncome, stepATax, stepBTax, aaspiTax, averagedTax, standardTax, taxSavings, ratesKey: rates.key, ratesStatus: rates.status };
        });
    }

    function calculateAveraging() {
        const results = computeResults();
        lastResults = results;

        results.forEach((r, i) => {
            const el = document.getElementById(`avg-total-${i}`);
            if (el) el.textContent = formatCurr(r.totalIncome);
        });

        const sum = k => results.reduce((a, r) => a + r[k], 0);
        document.getElementById('avg-kpi-tpi').textContent = formatCurr(sum('tpi'));
        document.getElementById('avg-kpi-standard').textContent = formatCurr(sum('standardTax'));
        document.getElementById('avg-kpi-averaged').textContent = formatCurr(sum('averagedTax'));
        document.getElementById('avg-kpi-savings').textContent = formatCurr(sum('taxSavings'));

        const clientName = document.getElementById('avg-client-name').value.trim();
        const category = document.getElementById('avg-category').value;
        document.getElementById('avg-client-badge').textContent = `${clientName || 'Client'} · ${category}`;

        // Rates-source warning
        const flagged = results.filter(r => r.ratesStatus !== 'exact');
        const warn = document.getElementById('avg-rates-warning');
        if (flagged.length) {
            const list = flagged.map(r => `${r.fyLabel} (using FY${String(r.ratesKey).slice(-2)} rates)`).join(', ');
            document.getElementById('avg-rates-warning-text').innerHTML =
                `<strong>Rates not yet loaded:</strong> ${list}. Add the new year to <code>TAX_DATA</code> to update the Income Tax Calculator and this tool together.`;
            warn.classList.remove('hidden');
        } else {
            warn.classList.add('hidden');
        }

        renderSummaryTable(results);
        renderBreakdownCards(results);
    }

    function renderSummaryTable(results) {
        const tbody = document.getElementById('avg-summary-body');
        const tfoot = document.getElementById('avg-summary-foot');
        tbody.innerHTML = results.map(r => `
            <tr class="hover:bg-gray-50 transition">
                <td class="py-3 px-3 font-semibold text-gray-800 whitespace-nowrap">${r.fyLabel} <span class="text-xs font-normal text-gray-500">(Yr ${r.yearNum})</span></td>
                <td class="py-3 px-3 text-right text-gray-800 font-medium">${formatCurr(r.tpi)}</td>
                <td class="py-3 px-3 text-right text-gray-600">${formatCurr(r.atpi)}</td>
                <td class="py-3 px-3 text-right font-semibold ${r.aaspi > 0 ? 'text-amber-700 bg-amber-50/60' : 'text-gray-400'}">${formatCurr(r.aaspi)}</td>
                <td class="py-3 px-3 text-right font-semibold text-gray-800">${formatCurr(r.totalIncome)}</td>
                <td class="py-3 px-3 text-right text-red-600">${formatCurr(r.standardTax)}</td>
                <td class="py-3 px-3 text-right font-semibold text-qbNavy-600">${formatCurr(r.averagedTax)}</td>
                <td class="py-3 px-3 text-right font-bold ${r.taxSavings > 0 ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-400'}">${r.taxSavings > 0 ? '+' + formatCurr(r.taxSavings) : formatCurr(0)}</td>
            </tr>`).join('');

        const sum = k => results.reduce((a, r) => a + r[k], 0);
        tfoot.innerHTML = `
            <tr>
                <td class="py-3 px-3 text-qbNavy-600">Total (${results.length} Year${results.length > 1 ? 's' : ''})</td>
                <td class="py-3 px-3 text-right">${formatCurr(sum('tpi'))}</td>
                <td class="py-3 px-3 text-right">${formatCurr(sum('atpi'))}</td>
                <td class="py-3 px-3 text-right">${formatCurr(sum('aaspi'))}</td>
                <td class="py-3 px-3 text-right">${formatCurr(sum('totalIncome'))}</td>
                <td class="py-3 px-3 text-right text-red-600">${formatCurr(sum('standardTax'))}</td>
                <td class="py-3 px-3 text-right text-qbNavy-600">${formatCurr(sum('averagedTax'))}</td>
                <td class="py-3 px-3 text-right text-emerald-700 font-extrabold">${formatCurr(sum('taxSavings'))}</td>
            </tr>`;
    }

    const chevronSvg = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;

    function renderBreakdownCards(results) {
        const container = document.getElementById('avg-breakdown-container');
        container.innerHTML = results.map((r, idx) => {
            const hasSavings = r.taxSavings > 0;
            const collapsed = collapsedCards.has(idx);
            return `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div class="bg-gray-50 hover:bg-gray-100/80 px-5 py-3.5 border-b border-gray-100 cursor-pointer flex flex-wrap items-center justify-between gap-2" onclick="window.SpecialProfAveragingApp.toggleCard(${idx})">
                    <div class="flex items-center gap-3">
                        <span class="text-gray-400 transition-transform no-print" style="transform: rotate(${collapsed ? '-90deg' : '0deg'})">${chevronSvg}</span>
                        <div>
                            <span class="text-sm font-bold text-qbNavy-600">${r.fyLabel} Assessment</span>
                            <span class="ml-2 text-xs text-gray-500 font-medium">(Year ${r.yearNum})</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 text-xs">
                        <span class="text-gray-600">Total Taxable: <strong>${formatCurr(r.totalIncome)}</strong></span>
                        <span class="px-2.5 py-1 rounded-full font-semibold ${hasSavings ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-200 text-gray-700'}">
                            ${hasSavings ? 'Averaging Benefit: ' + formatCurr(r.taxSavings) : 'No Averaging Benefit'}
                        </span>
                    </div>
                </div>

                <div class="p-5 space-y-4 ${collapsed ? 'hidden' : ''}">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
                        <div class="flex items-center gap-3">
                            <div class="bg-qbNavy-600 text-white font-bold text-xs px-2 py-1 rounded-lg whitespace-nowrap">Label Z</div>
                            <div class="text-xs">
                                <span class="text-gray-500 block">Q24 – Average taxable professional income (ATPI)</span>
                                <span class="text-sm font-bold text-gray-900">${formatCurr(r.atpi)}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="bg-qbNavy-600 text-white font-bold text-xs px-2 py-1 rounded-lg whitespace-nowrap">Label V</div>
                            <div class="text-xs">
                                <span class="text-gray-500 block">Q24 – Above-average special professional income (AASPI)</span>
                                <span class="text-sm font-bold text-gray-900">${formatCurr(r.aaspi)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-700">
                        <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                            <h4 class="font-bold text-qbNavy-600 border-b border-gray-200 pb-1.5">Step 1: AASPI & Normal Income</h4>
                            <div class="flex justify-between"><span>TPI (current year):</span><span class="font-semibold">${formatCurr(r.tpi)}</span></div>
                            <div class="flex justify-between"><span>ATPI (phase-in average):</span><span class="font-semibold">${formatCurr(r.atpi)}</span></div>
                            <div class="flex justify-between pt-1 border-t border-gray-200 text-amber-700 font-bold"><span>AASPI (TPI − ATPI):</span><span>${formatCurr(r.aaspi)}</span></div>
                            <div class="flex justify-between"><span>Total taxable income:</span><span>${formatCurr(r.totalIncome)}</span></div>
                            <div class="flex justify-between pt-1 border-t border-gray-200 font-semibold"><span>Normal income (Total − AASPI):</span><span>${formatCurr(r.otherIncome)}</span></div>
                        </div>

                        <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                            <h4 class="font-bold text-qbNavy-600 border-b border-gray-200 pb-1.5">Step 2: Step A & B Basic Tax</h4>
                            <div class="flex justify-between"><span>Normal income:</span><span>${formatCurr(r.otherIncome)}</span></div>
                            <div class="flex justify-between text-qbNavy-600 font-medium"><span>Step A tax (normal income):</span><span class="font-bold">${formatCurr(r.stepATax)}</span></div>
                            <div class="flex justify-between pt-1 border-t border-gray-200"><span>⅕ of AASPI:</span><span>${formatCurr(r.aaspi * 0.20)}</span></div>
                            <div class="flex justify-between"><span>Normal income + ⅕ AASPI:</span><span>${formatCurr(r.sliceIncome)}</span></div>
                            <div class="flex justify-between text-qbNavy-600 font-medium"><span>Step B tax:</span><span class="font-bold">${formatCurr(r.stepBTax)}</span></div>
                        </div>

                        <div class="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                            <h4 class="font-bold text-qbNavy-600 border-b border-gray-200 pb-1.5">Step 3: Tax Comparison</h4>
                            <div class="flex justify-between"><span>Differential (B − A):</span><span>${formatCurr(r.stepBTax - r.stepATax)}</span></div>
                            <div class="flex justify-between"><span>Tax on AASPI (5 × diff):</span><span>${formatCurr(r.aaspiTax)}</span></div>
                            <div class="flex justify-between pt-1 border-t border-gray-200 font-bold text-gray-900"><span>Averaged basic tax:</span><span>${formatCurr(r.averagedTax)}</span></div>
                            <div class="flex justify-between text-gray-500"><span>Standard basic tax:</span><span>${formatCurr(r.standardTax)}</span></div>
                            <div class="flex justify-between pt-1 border-t border-gray-200 font-extrabold ${hasSavings ? 'text-emerald-700' : 'text-gray-600'}"><span>Tax benefit:</span><span>${formatCurr(r.taxSavings)}</span></div>
                        </div>
                    </div>
                    <p class="text-[11px] text-gray-400">Rates applied: ${TAX_DATA[String(r.ratesKey)].name}${r.ratesStatus !== 'exact' ? ' <span class="text-amber-700 font-semibold">(substituted — rates for this year not yet loaded)</span>' : ''}</p>
                </div>
            </div>`;
        }).join('');
    }

    function toggleCard(idx) {
        if (collapsedCards.has(idx)) collapsedCards.delete(idx);
        else collapsedCards.add(idx);
        renderBreakdownCards(lastResults);
    }

    function resetInputs() {
        for (let i = 0; i < 8; i++) {
            const t = document.getElementById(`avg-tpi-${i}`);
            const o = document.getElementById(`avg-other-${i}`);
            if (t) t.value = 0;
            if (o) o.value = 0;
        }
        calculateAveraging();
        showToast('Averaging inputs cleared');
    }

    function exportToCSV() {
        calculateAveraging();
        const clientName = document.getElementById('avg-client-name').value.trim() || 'Client';
        const category = document.getElementById('avg-category').value;
        const q = v => `"${String(v).replace(/"/g, '""')}"`;

        const lines = [];
        lines.push(q('ATO Special Professionals Income Averaging Schedule (Division 405)'));
        lines.push(`${q('Client')},${q(clientName)}`);
        lines.push(`${q('Category')},${q(category)}`);
        lines.push(`${q('Date Exported')},${q(new Date().toLocaleDateString('en-AU'))}`);
        lines.push('');
        lines.push(['Financial Year', 'Year Phase', 'Rates Applied', 'TPI ($)', 'Other Income ($)', 'Total Income ($)', 'ATPI - Label Z ($)', 'AASPI - Label V ($)', 'Standard Basic Tax ($)', 'Averaged Basic Tax ($)', 'Tax Benefit ($)'].map(q).join(','));
        lastResults.forEach(r => {
            lines.push([
                q(r.fyLabel), q(`Year ${r.yearNum}`), q(TAX_DATA[String(r.ratesKey)].name),
                r.tpi.toFixed(2), r.nonProf.toFixed(2), r.totalIncome.toFixed(2),
                r.atpi.toFixed(2), r.aaspi.toFixed(2),
                r.standardTax.toFixed(2), r.averagedTax.toFixed(2), r.taxSavings.toFixed(2)
            ].join(','));
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Income_Averaging_${clientName.replace(/[^\w-]+/g, '_')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('CSV exported');
    }

    window.SpecialProfAveragingApp = {
        init: function() {
            populateStartYears();
            renderInputRows();
            calculateAveraging();
            document.getElementById('avg-client-name').addEventListener('input', calculateAveraging);
            document.getElementById('avg-category').addEventListener('change', calculateAveraging);
        },
        renderRows: renderInputRows,
        calculate: calculateAveraging,
        reset: resetInputs,
        toggleCard: toggleCard,
        exportToCSV: exportToCSV
    };
})();

registerTab('averaging', {
    init() { window.SpecialProfAveragingApp.init(); },
    onShow() { window.SpecialProfAveragingApp.calculate(); }
});
