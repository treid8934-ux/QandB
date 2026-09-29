// INDEPENDENT CONTRACTOR TEST TAB (TR 2023/4, SGAA s12(3))

const questions = [
    {
        id: 'control',
        title: '1. Right of Control',
        category: 'Control',
        weight: 30,
        weightBadge: 'High Weight (+30 pts)',
        weightClass: 'bg-red-100 text-red-800 border-red-200',
        subtitle: 'Does the business hold legal authority over how, where, and when work is performed?',
        optionA: {
            label: 'Business Right to Control',
            text: 'Your business has the legal right to control how, where and when the worker does their work.'
        },
        optionB: {
            label: 'Worker Discretion / Autonomy',
            text: 'The worker can choose how, where and when their work is done, subject to reasonable direction by you.'
        }
    },
    {
        id: 'subcontracting',
        title: '2. Ability to Subcontract or Delegate',
        category: 'Delegation',
        weight: 30,
        weightBadge: 'High Weight (+30 pts)',
        weightClass: 'bg-red-100 text-red-800 border-red-200',
        subtitle: 'Can the worker delegate or hire someone else to perform the work?',
        optionA: {
            label: 'No Delegation Rights',
            text: 'There is no clause in the contract allowing delegation/subcontracting. The worker must perform work personally.'
        },
        optionB: {
            label: 'Valid Unlimited/Subject Delegation Right',
            text: 'There is a genuine contract clause granting the right to delegate or subcontract work to others.'
        }
    },
    {
        id: 'integration',
        title: '3. Integration / Serving in Business',
        category: 'Integration',
        weight: 20,
        weightBadge: 'Medium Weight (+20 pts)',
        weightClass: 'bg-amber-100 text-amber-800 border-amber-200',
        subtitle: 'Is the worker serving as a representative of your business or furthering their own enterprise?',
        optionA: {
            label: 'Serves in Business',
            text: 'The worker serves directly in your business and is required to perform work as a representative of your business.'
        },
        optionB: {
            label: 'Furthers Own Business',
            text: 'The worker provides services to your business to further their own independent business.'
        }
    },
    {
        id: 'risk',
        title: '4. Commercial Risk & Liability',
        category: 'Risk',
        weight: 20,
        weightBadge: 'Medium Weight (+20 pts)',
        weightClass: 'bg-amber-100 text-amber-800 border-amber-200',
        subtitle: 'Who bears the financial liability for defective work or costs arising out of injury?',
        optionA: {
            label: 'Business Bears Commercial Risk',
            text: 'The worker bears little or no risk. Your business bears commercial risk for costs or defective work.'
        },
        optionB: {
            label: 'Worker Bears Commercial Risk',
            text: 'The worker bears the commercial risk for any costs arising out of injury or defect in their work.'
        }
    },
    {
        id: 'remuneration',
        title: '5. Mode of Remuneration',
        category: 'Remuneration',
        weight: 10,
        weightBadge: 'Standard Weight (+10 pts)',
        weightClass: 'bg-slate-100 text-slate-700 border-slate-200',
        subtitle: 'How is payment structured under the contract?',
        optionA: {
            label: 'Time Worked / Activity / Commission',
            text: 'The worker is paid either for time worked, price per item/activity, or commission.'
        },
        optionB: {
            label: 'Fixed Fee for Achieved Result',
            text: 'The worker is contracted to achieve a specific result, paid upon completion (often fixed fee).'
        }
    },
    {
        id: 'tools',
        title: '6. Provision of Tools and Assets',
        category: 'Equipment',
        weight: 10,
        weightBadge: 'Standard Weight (+10 pts)',
        weightClass: 'bg-slate-100 text-slate-700 border-slate-200',
        subtitle: 'Who provides major equipment, tools, or vehicles required for the role?',
        optionA: {
            label: 'Business Provided / Reimbursed',
            text: 'Business provides all/most tools, or reimburses worker for expenses incurred.'
        },
        optionB: {
            label: 'Worker Substantial Asset Provision',
            text: 'Worker provides all/most equipment without reimbursement, or uses a substantial item wholly responsible for.'
        }
    },
    {
        id: 'goodwill',
        title: '7. Generation of Goodwill',
        category: 'Goodwill',
        weight: 10,
        weightBadge: 'Standard Weight (+10 pts)',
        weightClass: 'bg-slate-100 text-slate-700 border-slate-200',
        subtitle: 'Who accrues the long-term trade reputation and client goodwill?',
        optionA: {
            label: 'Business Accrues Goodwill',
            text: 'Your business benefits from any goodwill arising from the worker’s performance.'
        },
        optionB: {
            label: 'Worker Enterprise Accrues Goodwill',
            text: 'The worker’s own business benefits from goodwill generated, not your business.'
        }
    },
    {
        id: 'expectation',
        title: '8. Expectation of Ongoing Work',
        category: 'Ongoing Work',
        weight: 10,
        weightBadge: 'Standard Weight (+10 pts)',
        weightClass: 'bg-slate-100 text-slate-700 border-slate-200',
        subtitle: 'Is there an expectation of ongoing employment or engagement?',
        optionA: {
            label: 'Ongoing Expectation (No Fixed End Date)',
            text: 'Yes, there is an expectation of ongoing work with no fixed end date.'
        },
        optionB: {
            label: 'Project-Specific (No Ongoing Expectation)',
            text: 'No, they are engaged specifically to work on a particular project or discrete task.'
        }
    }
];

const userAnswers = {};
const superAnswers = {
    labour: null,
    personal: null,
    delegate: null
};

let categoryChart = null;

function initContractorApp() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    questions.forEach(q => {
        const qCard = document.createElement('div');
        qCard.className = 'bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all duration-200 hover:border-slate-300 card-shadow';
        qCard.id = `q-card-${q.id}`;
        qCard.innerHTML = `
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h3 class="font-bold text-slate-900 text-lg">${q.title}</h3>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${q.weightClass}">${q.weightBadge}</span>
                </div>
            </div>
            <p class="text-xs text-slate-500 mb-4">${q.subtitle}</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div onclick="selectOption('${q.id}', 'A')" id="btn-${q.id}-A" 
                     class="p-4 rounded-lg border-2 border-slate-200 cursor-pointer hover:border-indigo-400 transition-all duration-200 flex flex-col justify-between group">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider group-hover:text-indigo-700">Option A (+${q.weight} pts)</span>
                            <div class="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center radio-indicator">
                                <div class="w-2.5 h-2.5 rounded-full bg-indigo-600 hidden"></div>
                            </div>
                        </div>
                        <span class="font-semibold text-slate-800 text-sm block mb-1">${q.optionA.label}</span>
                        <p class="text-xs text-slate-600 leading-relaxed">${q.optionA.text}</p>
                    </div>
                    <div class="mt-3 pt-2 border-t border-slate-100 text-[10px] font-semibold text-indigo-600 flex items-center gap-1">
                        <i data-lucide="user" class="w-3 h-3"></i> Employee Indicia
                    </div>
                </div>

                <div onclick="selectOption('${q.id}', 'B')" id="btn-${q.id}-B" 
                     class="p-4 rounded-lg border-2 border-slate-200 cursor-pointer hover:border-emerald-400 transition-all duration-200 flex flex-col justify-between group">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider group-hover:text-emerald-700">Option B (+${q.weight} pts)</span>
                            <div class="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center radio-indicator">
                                <div class="w-2.5 h-2.5 rounded-full bg-emerald-600 hidden"></div>
                            </div>
                        </div>
                        <span class="font-semibold text-slate-800 text-sm block mb-1">${q.optionB.label}</span>
                        <p class="text-xs text-slate-600 leading-relaxed">${q.optionB.text}</p>
                    </div>
                    <div class="mt-3 pt-2 border-t border-slate-100 text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                        <i data-lucide="building" class="w-3 h-3"></i> Contractor Indicia
                    </div>
                </div>
            </div>
        `;
        container.appendChild(qCard);
    });

    initChart();
}

function selectOption(questionId, value) {
    userAnswers[questionId] = value;

    const btnA = document.getElementById(`btn-${questionId}-A`);
    const btnB = document.getElementById(`btn-${questionId}-B`);

    btnA.className = 'p-4 rounded-lg border-2 border-slate-200 cursor-pointer hover:border-indigo-400 transition-all duration-200 flex flex-col justify-between group';
    btnB.className = 'p-4 rounded-lg border-2 border-slate-200 cursor-pointer hover:border-emerald-400 transition-all duration-200 flex flex-col justify-between group';

    btnA.querySelector('.radio-indicator div').classList.add('hidden');
    btnB.querySelector('.radio-indicator div').classList.add('hidden');

    if (value === 'A') {
        btnA.className = 'p-4 rounded-lg border-2 border-indigo-600 bg-indigo-50/40 cursor-pointer transition-all duration-200 flex flex-col justify-between group shadow-sm';
        btnA.querySelector('.radio-indicator div').classList.remove('hidden');
    } else {
        btnB.className = 'p-4 rounded-lg border-2 border-emerald-600 bg-emerald-50/40 cursor-pointer transition-all duration-200 flex flex-col justify-between group shadow-sm';
        btnB.querySelector('.radio-indicator div').classList.remove('hidden');
    }

    updateProgress();
    calculateResult();
}

function updateProgress() {
    const count = Object.keys(userAnswers).length;
    const totalPoints = questions.reduce((acc, q) => acc + (userAnswers[q.id] ? q.weight : 0), 0);
    const percentage = (count / questions.length) * 100;

    document.getElementById('progress-bar').style.width = `${percentage}%`;
    document.getElementById('progress-text').innerText = `${count} of ${questions.length} Answered (${totalPoints} / 140 weighted pts calculated)`;
}

function calculateResult() {
    const count = Object.keys(userAnswers).length;
    const resultsSection = document.getElementById('results-section');

    if (count < questions.length) {
        resultsSection.classList.add('opacity-50', 'pointer-events-none', 'blur-sm');
        document.getElementById('result-title').innerText = 'Incomplete Questionnaire';
        document.getElementById('result-subtitle').innerText = `Please answer all questions above (${questions.length - count} remaining).`;
        return;
    }

    resultsSection.classList.remove('opacity-50', 'pointer-events-none', 'blur-sm');

    let empPoints = 0;
    let conPoints = 0;

    questions.forEach(q => {
        const ans = userAnswers[q.id];
        if (ans === 'A') empPoints += q.weight;
        if (ans === 'B') conPoints += q.weight;
    });

    document.getElementById('emp-score').innerText = `${empPoints} pts`;
    document.getElementById('con-score').innerText = `${conPoints} pts`;

    const empPct = Math.round((empPoints / 140) * 100);
    const conPct = Math.round((conPoints / 140) * 100);

    document.getElementById('emp-bar').style.width = `${empPct}%`;
    document.getElementById('con-bar').style.width = `${conPct}%`;

    const badge = document.getElementById('classification-badge');
    const statusCard = document.getElementById('status-card');
    const title = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    const desc = document.getElementById('classification-desc');
    const confText = document.getElementById('confidence-text');
    const confBadge = document.getElementById('confidence-badge');
    const superTestSection = document.getElementById('super-test-section');

    const superRequired = (superAnswers.labour && superAnswers.personal && superAnswers.delegate);

    if (empPoints > conPoints) {
        title.innerText = 'Strong Employee Classification Indicator';
        subtitle.innerText = 'High-weight criteria and overall score strongly indicate Common-Law Employee status.';
        badge.innerText = 'Employee Relationship (Super Payable)';
        badge.className = 'mt-2 text-lg font-bold text-indigo-700 flex items-center gap-1.5';
        statusCard.className = 'p-5 rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col justify-between';
        desc.innerText = 'The contract reserves significant control, personal service, or ongoing work expectations matching employee criteria. Full Superannuation Guarantee applies.';
        superTestSection.classList.add('hidden');
    } else if (conPoints > empPoints) {
        title.innerText = 'Likely Independent Contractor Relationship';
        subtitle.innerText = 'Weighted evaluation points primarily toward an Independent Contractor relationship.';

        if (superRequired) {
            badge.innerText = 'Independent Contractor (Super Guarantee Required)';
            badge.className = 'mt-2 text-lg font-bold text-amber-700 flex items-center gap-1.5';
            statusCard.className = 'p-5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between';
            desc.innerText = 'Classified as an Independent Contractor under Common Law, but SGAA 1992 s12(3) mandates Superannuation Guarantee contributions as work is principally for personal labour.';
        } else {
            badge.innerText = 'Independent Contractor (Exempt from Super)';
            badge.className = 'mt-2 text-lg font-bold text-emerald-700 flex items-center gap-1.5';
            statusCard.className = 'p-5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between';
            desc.innerText = 'Subcontracting rights, project-based engagement, or commercial risk outweigh employee control factors. Exempt from Superannuation Guarantee obligations.';
        }
        superTestSection.classList.remove('hidden');
    } else {
        title.innerText = 'Equivocal / High Risk Classification';
        subtitle.innerText = 'Weighted points are evenly balanced (70 pts / 70 pts). High risk of tax/super audit dispute.';

        if (superRequired) {
            badge.innerText = 'Equivocal (Super Guarantee Required)';
            badge.className = 'mt-2 text-lg font-bold text-amber-700 flex items-center gap-1.5';
            statusCard.className = 'p-5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between';
            desc.innerText = 'Primary common-law factors are balanced, but SGAA 1992 s12(3) criteria are met. Superannuation Guarantee contributions must be made to avoid shortfall penalties.';
        } else {
            badge.innerText = 'Equivocal / Borderline';
            badge.className = 'mt-2 text-lg font-bold text-amber-700 flex items-center gap-1.5';
            statusCard.className = 'p-5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between';
            desc.innerText = 'Primary factors conflict. Formal legal review or ATO advice is highly recommended.';
        }
        superTestSection.classList.remove('hidden');
    }

    const pointDiff = Math.abs(empPoints - conPoints);
    if (pointDiff >= 50) {
        confText.innerText = 'High Certainty';
        confBadge.innerText = `+${pointDiff} Point Margin`;
        confBadge.className = 'mt-4 inline-block px-2 py-1 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 w-max';
    } else if (pointDiff >= 20) {
        confText.innerText = 'Moderate Margin';
        confBadge.innerText = `+${pointDiff} Point Margin`;
        confBadge.className = 'mt-4 inline-block px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 w-max';
    } else {
        confText.innerText = 'Low Margin / Borderline';
        confBadge.innerText = `Only +${pointDiff} Point Margin`;
        confBadge.className = 'mt-4 inline-block px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 w-max';
    }

    updateChart();
    evaluateSuperGuarantee();
}

function setSuperTest(key, val) {
    superAnswers[key] = val;

    const btnYes = document.getElementById(`btn-super-${key}-yes`);
    const btnNo = document.getElementById(`btn-super-${key}-no`);

    if (val) {
        btnYes.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white shadow-sm';
        btnNo.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors';
    } else {
        btnYes.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors';
        btnNo.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 text-white shadow-sm';
    }

    calculateResult();
}

function evaluateSuperGuarantee() {
    const outcomeBox = document.getElementById('super-outcome-box');

    if (superAnswers.labour === null || superAnswers.personal === null || superAnswers.delegate === null) {
        outcomeBox.classList.add('hidden');
        return;
    }

    outcomeBox.classList.remove('hidden');

    const allThreeTrue = superAnswers.labour && superAnswers.personal && superAnswers.delegate;

    if (allThreeTrue) {
        outcomeBox.className = 'p-4 rounded-xl border bg-amber-50 border-amber-300 text-amber-900 text-xs leading-relaxed';
        outcomeBox.innerHTML = `
            <div class="flex items-center gap-2 font-bold text-amber-800 mb-1">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600"></i>
                Superannuation Guarantee Must Be Paid (SGAA 1992 s12(3))
            </div>
            <strong>Result:</strong> All 3 tests are met. Even though the worker is determined to be an <strong>Independent Contractor</strong> under common law, you are legally obligated to make <strong>Superannuation Guarantee contributions</strong> for this contractor based on ATO and Employment Hero compliance requirements.
        `;
    } else {
        outcomeBox.className = 'p-4 rounded-xl border bg-emerald-50 border-emerald-300 text-emerald-900 text-xs leading-relaxed';
        outcomeBox.innerHTML = `
            <div class="flex items-center gap-2 font-bold text-emerald-800 mb-1">
                <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
                No Superannuation Obligation Under Contractor Test
            </div>
            <strong>Result:</strong> Not all 3 criteria under section 12(3) are satisfied. Superannuation Guarantee is generally <strong>not required</strong> for this contractor engagement, provided the independent contractor classification remains accurate.
        `;
    }

    lucide.createIcons();
}

function initChart() {
    if (typeof Chart === 'undefined') { console.warn('Chart.js not loaded — skipping contractor chart'); return; }
    const ctx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: questions.map(q => `${q.category} (${q.weight}p)`),
            datasets: [
                {
                    label: 'Employee Weighted Score',
                    data: [0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#4f46e5'
                },
                {
                    label: 'Contractor Weighted Score',
                    data: [0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#10b981'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: { ticks: { stepSize: 10 }, min: 0, max: 30 }
            },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function updateChart() {
    if (!categoryChart) return;

    const empData = questions.map(q => userAnswers[q.id] === 'A' ? q.weight : 0);
    const conData = questions.map(q => userAnswers[q.id] === 'B' ? q.weight : 0);

    categoryChart.data.datasets[0].data = empData;
    categoryChart.data.datasets[1].data = conData;
    categoryChart.update();
}

function resetForm() {
    Object.keys(userAnswers).forEach(key => delete userAnswers[key]);
    superAnswers.labour = null;
    superAnswers.personal = null;
    superAnswers.delegate = null;

    questions.forEach(q => {
        const btnA = document.getElementById(`btn-${q.id}-A`);
        const btnB = document.getElementById(`btn-${q.id}-B`);

        btnA.className = 'p-4 rounded-lg border-2 border-slate-200 cursor-pointer hover:border-indigo-400 transition-all duration-200 flex flex-col justify-between group';
        btnB.className = 'p-4 rounded-lg border-2 border-slate-200 cursor-pointer hover:border-emerald-400 transition-all duration-200 flex flex-col justify-between group';

        btnA.querySelector('.radio-indicator div').classList.add('hidden');
        btnB.querySelector('.radio-indicator div').classList.add('hidden');
    });

    ['labour', 'personal', 'delegate'].forEach(key => {
        const btnYes = document.getElementById(`btn-super-${key}-yes`);
        const btnNo = document.getElementById(`btn-super-${key}-no`);
        if (btnYes) btnYes.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors';
        if (btnNo) btnNo.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors';
    });

    document.getElementById('super-outcome-box').classList.add('hidden');

    updateProgress();
    calculateResult();
    showToast('Form reset successfully');
}

function copySummary() {
    const count = Object.keys(userAnswers).length;
    if (count < questions.length) {
        showToast('Please complete all questions first');
        return;
    }

    let empPoints = 0;
    let conPoints = 0;
    questions.forEach(q => {
        if (userAnswers[q.id] === 'A') empPoints += q.weight;
        if (userAnswers[q.id] === 'B') conPoints += q.weight;
    });

    const superReq = (superAnswers.labour && superAnswers.personal && superAnswers.delegate);
    let status = '';
    if (empPoints > conPoints) {
        status = 'Likely Employee (Super Payable)';
    } else if (conPoints > empPoints) {
        status = superReq ? 'Independent Contractor (Super Guarantee Required)' : 'Independent Contractor (Exempt from Super)';
    } else {
        status = superReq ? 'Equivocal (Super Guarantee Required)' : 'Equivocal / Borderline';
    }

    let text = `QUIN & BOURKE EMPLOYEE V CONTRACTOR TEST REPORT (ATO TR 2023/4)\n`;
    text += `===========================================================\n`;
    text += `Primary Result: ${status}\n`;
    text += `Employee Weighted Score: ${empPoints} / 140 pts\n`;
    text += `Contractor Weighted Score: ${conPoints} / 140 pts\n\n`;
    text += `FACTOR BREAKDOWN:\n`;

    questions.forEach(q => {
        const ans = userAnswers[q.id];
        const type = ans === 'A' ? 'Employee' : 'Contractor';
        const label = ans === 'A' ? q.optionA.label : q.optionB.label;
        text += `- ${q.category} [${q.weight} pts]: ${type} (${label})\n`;
    });

    if (conPoints >= empPoints) {
        text += `\nSUPERANNUATION GUARANTEE (SGAA s12(3)) ASSESSMENT:\n`;
        text += `- Contract mainly for labour: ${superAnswers.labour ? 'Yes' : 'No'}\n`;
        text += `- For personal labour & skills: ${superAnswers.personal ? 'Yes' : 'No'}\n`;
        text += `- Work cannot be delegated: ${superAnswers.delegate ? 'Yes' : 'No'}\n`;
        text += `-> Superannuation Payable: ${superReq ? 'YES' : 'NO'}\n`;
    }

    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);

    showToast('Report copied to clipboard!');
}

registerTab('contractor', {
    init() { initContractorApp(); },
    onShow() { if (categoryChart) categoryChart.resize(); },
    onReset: resetForm          // shows the "Reset Form" button in the header on this tab
});
