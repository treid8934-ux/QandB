// SMALL BUSINESS CGT CONCESSIONS — thresholds and fixed rules.
// Kept separate from TAX_DATA on purpose. Used by the Small Business CGT tab (tabs/sb-cgt).
//
// SBC_DATA is keyed by the year the FY ENDS ("2027" = FY 2026-27), worked out from the CGT event date.
// To add a new year: copy the latest block, update the figures, done. If an event falls in a year that
// isn't listed, the tab uses the latest year it has and shows a warning.

const SBC_DATA = {
    "2024": {
        name: "2023 - 2024 (FY24)",
        mnav: 6000000,                // s152-15 maximum net asset value test
        sbeTurnover: 2000000,         // s152-10(1AA) CGT small business entity turnover (all four concessions)
        reductionTurnover: 2000000,   // turnover threshold usable for the 50% active asset reduction
        retirementLimit: 500000,      // s152-320 lifetime CGT retirement exemption limit
        cgtCap: 1705000               // s292-105 CGT cap amount (super contributions)
    },
    "2025": {
        name: "2024 - 2025 (FY25)",
        mnav: 6000000, sbeTurnover: 2000000, reductionTurnover: 2000000, retirementLimit: 500000,
        cgtCap: 1780000
    },
    "2026": {
        name: "2025 - 2026 (FY26)",
        mnav: 6000000, sbeTurnover: 2000000, reductionTurnover: 2000000, retirementLimit: 500000,
        cgtCap: 1865000
    },
    "2027": {
        name: "2026 - 2027 (FY27)",
        mnav: 6000000, sbeTurnover: 2000000, reductionTurnover: 2000000, retirementLimit: 500000,
        cgtCap: 1935000
    },
    "2028": {
        name: "2027 - 2028 (FY28)",
        mnav: 6000000, sbeTurnover: 2000000,
        reductionTurnover: 10000000,  // Tax Reform No. 1 Act 2026: $10m aggregated turnover for the 50% reduction only
        retirementLimit: 500000,
        cgtCap: null,                 // not yet announced — UPDATE WHEN PUBLISHED
        reformYear: true              // CGT discount replaced by indexation for individuals/trusts from 1 July 2027
    }
};

// Fixed rules (not indexed). Change only if the law changes.
const SBC_RULES = {
    activeAssetPct: 0.80,        // s152-40(3) 80% test for shares / trust interests
    ninetyPct: 0.90,             // s152-10(2)(b) 90% test
    controlPct: 0.40,            // s328-125 control percentage
    controlPctObject: 0.20,      // s152-10(2)(c) — control threshold when testing the object company or trust
    commissionerBand: 0.50,      // 40%–<50%: Commissioner may determine another entity controls
    significantPct: 0.20,        // s152-55 significant individual
    retirementAge: 55,
    longHoldYears: 15,           // s152-35(1)(b): if held > 15 years, active for 7.5 years
    longHoldActiveYears: 7.5,
    fifteenYears: 15,            // Subdiv 152-B continuous ownership
    discount: { individual: 0.5, dtrust: 0.5, utrust: 0.5, super: 1 / 3, company: 0 },
    dates: {
        preCGT: '1985-09-20',         // acquired before 20 Sep 1985: gain generally disregarded
        indexationFrozen: '1999-09-21',
        foreignResident: '2012-05-08',
        sharesRules: '2018-02-08',    // extra conditions for shares / trust interests
        partnershipRules: '2018-05-08',
        dtLossRule: '2012-03-22',
        cgtReform: '2027-07-01'       // discount replaced by indexation (individuals, trusts, partnerships)
    },
    replacementBefore: 1,        // roll-over replacement window: 1 year before ...
    replacementAfter: 2,         // ... to 2 years after the last CGT event in the year
    fifteenPayYears: 2           // 15 year exemption: pay stakeholders within 2 years
};
