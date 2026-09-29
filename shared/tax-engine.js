// Shared tax maths and cross-tab state, used by more than one tab.

function computeRawIncomeTax(taxableIncome, brackets) {
    let tax = 0;
    for (let i = 0; i < brackets.length; i++) {
        const b = brackets[i];
        if (taxableIncome > b.min) {
            const chunk = Math.min(taxableIncome, b.max) - b.min;
            tax += chunk * b.rate;
        }
    }
    return tax;
}

function calculateOffsets(taxableIncome, yearKey, config) {
    let litoOffset = 0;
    if (config.lito && taxableIncome < config.lito.max) {
        if (taxableIncome <= config.lito.fullCutoff) {
            litoOffset = config.lito.maxOffset;
        } else if (taxableIncome <= 45000 && yearKey >= 2021) {
            litoOffset = config.lito.maxOffset - ((taxableIncome - config.lito.fullCutoff) * 0.05);
        } else {
            const baseCutoff = (yearKey >= 2021) ? 45000 : config.lito.fullCutoff;
            const baseOffset = (yearKey >= 2021) ? 325 : config.lito.maxOffset;
            litoOffset = Math.max(0, baseOffset - ((taxableIncome - baseCutoff) * 0.015));
        }
    }

    let lmitoOffset = 0;
    if (config.lmito) {
        const maxVal = config.lmito.max;
        if (taxableIncome <= 37000) {
            lmitoOffset = yearKey === "2022" ? 675 : 255;
        } else if (taxableIncome <= 48000) {
            const base = yearKey === "2022" ? 675 : 255;
            lmitoOffset = base + ((taxableIncome - 37000) * 0.075);
        } else if (taxableIncome <= 90000) {
            lmitoOffset = maxVal;
        } else if (taxableIncome <= 126000) {
            lmitoOffset = Math.max(0, maxVal - ((taxableIncome - 90000) * 0.03));
        }
    }

    return litoOffset + lmitoOffset;
}

/**
 * Medicare levy with low-income reductions (individual and family), per-year thresholds from TAX_DATA.
 * Shading: 10% of income over the lower threshold, capped at the full 2%. The upper threshold is
 * where the two meet (lower x 1.25). Family reduction (ATO): levy = your share of family income
 * x 10% x (family income - family lower threshold), if that is less than the individual result.
 */
function computeMedicareLevy(taxableIncome, config, isSaptoEligible = false, hasSpouse = false, spouseIncome = 0, numChildren = 0) {
    const m = config.medicareLow;
    const indLower = isSaptoEligible ? m.saptoLower : m.lower;
    const fullLevy = taxableIncome * 0.02;

    if (taxableIncome <= indLower) return 0;
    const individualLevy = Math.min(fullLevy, (taxableIncome - indLower) * 0.10);

    // Family reduction needs a spouse or dependants
    if (!(hasSpouse || numChildren > 0)) return individualLevy;

    const familyIncome = taxableIncome + (hasSpouse ? spouseIncome : 0);
    const famLower = (isSaptoEligible ? m.saptoFamilyLower : m.familyLower) + numChildren * m.perChildLower;
    if (familyIncome <= famLower) return 0;

    const share = familyIncome > 0 ? taxableIncome / familyIncome : 1;
    const familyLevy = share * 0.10 * (familyIncome - famLower);
    return Math.min(individualLevy, familyLevy);
}

// Store calculated tax details for sharing with Home Loan calc
let calculatedTaxState = {
    userIncome: 0,
    spouseIncome: 0,
    userTakeHome: 0,
    spouseTakeHome: 0,
    combinedTakeHome: 0
};

// Simple salary-only take-home (used for the spouse figure in the Home Loan tab)
function calculateIndividualTakeHome(salary, yearKey, config) {
    if (salary <= 0) return 0;
    const grossTax = computeRawIncomeTax(salary, config.brackets);
    const netTax = Math.max(0, grossTax - calculateOffsets(salary, yearKey, config));
    return Math.max(0, salary - (netTax + computeMedicareLevy(salary, config)));
}

function getMarginalTaxRate(income, brackets) {
    for (let i = brackets.length - 1; i >= 0; i--) {
        if (income > brackets[i].min) return brackets[i].rate;
    }
    return 0;
}

let lastTaxResult = null;
