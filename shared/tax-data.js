// Rates & thresholds for every financial year — the one place to update each year.

// SINGLE SOURCE OF TRUTH for rates & thresholds. Keyed by the year the FY ENDS ("2027" = FY 2026-27).
// Used by the Income Tax Calculator, Home Loan take-home sync, Div 296 panel, the Averaging tab and the PSI tab.
// To add a new year: copy the latest block, update every figure, and add an <option> to #fy-select.
const TAX_DATA = {
    "2027": {
        name: "2026 - 2027 (FY27)",
        sgRate: 0.120,
        concessionalCap: 32500,
        agePensionAge: 67,
        brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 45000, rate: 0.15 },
            { min: 45000, max: 135000, rate: 0.30 },
            { min: 135000, max: 190000, rate: 0.37 },
            { min: 190000, max: Infinity, rate: 0.45 }
        ],
        lito: { max: 66667, fullCutoff: 37500, maxOffset: 700 },
        sapto: {
            single: { maxOffset: 2230, shadeOut: 36034, cutOut: 53874 },
            couple_together: { maxOffset: 1602, shadeOut: 31847, cutOut: 44663 },
            couple_illness: { maxOffset: 2040, shadeOut: 34767, cutOut: 51087 },
            both_eligible: { maxOffset: 1602, shadeOut: 31847, cutOut: 44663 }
        },
        // FY27 Medicare low-income thresholds not yet announced — FY26 figures carried forward. UPDATE WHEN PUBLISHED.
        medicareLow: { lower: 28011, upper: 35013, saptoLower: 44268, saptoUpper: 55335, familyLower: 47238, saptoFamilyLower: 61623, perChildLower: 4338 },
        mlsThresholds: { singleBase: 105000, singleT2: 123000, singleT3: 164000, familyBase: 210000, familyT2: 246000, familyT3: 328000 },
        hecsThresholds: { isMarginal: true, lowerLimit: 69528, upperLimit: 129717, maxCapRate: 0.10 },
        companyTax: { baseRate: 0.25, fullRate: 0.3 },   // base rate entity / full rate
        div293Threshold: 250000,
        div296: { large: 3000000, veryLarge: 10000000, largeRate: 0.15, veryLargeRate: 0.10, transitionalEndOnly: true }
    },
    "2026": {
        name: "2025 - 2026 (FY26)",
        sgRate: 0.120,
        concessionalCap: 30000,
        agePensionAge: 67,
        brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 45000, rate: 0.16 },
            { min: 45000, max: 135000, rate: 0.30 },
            { min: 135000, max: 190000, rate: 0.37 },
            { min: 190000, max: Infinity, rate: 0.45 }
        ],
        lito: { max: 66667, fullCutoff: 37500, maxOffset: 700 },
        sapto: {
            single: { maxOffset: 2230, shadeOut: 34919, cutOut: 52759 },
            couple_together: { maxOffset: 1602, shadeOut: 30994, cutOut: 43810 },
            couple_illness: { maxOffset: 2040, shadeOut: 33732, cutOut: 50052 },
            both_eligible: { maxOffset: 1602, shadeOut: 30994, cutOut: 43810 }
        },
        medicareLow: { lower: 28011, upper: 35013, saptoLower: 44268, saptoUpper: 55335, familyLower: 47238, saptoFamilyLower: 61623, perChildLower: 4338 },
        mlsThresholds: { singleBase: 101000, singleT2: 118000, singleT3: 158000, familyBase: 202000, familyT2: 236000, familyT3: 316000 },
        hecsThresholds: { isMarginal: true, lowerLimit: 67000, upperLimit: 125000, maxCapRate: 0.10 },
        companyTax: { baseRate: 0.25, fullRate: 0.3 },   // base rate entity / full rate
        div293Threshold: 250000
    },
    "2025": {
        name: "2024 - 2025 (FY25)",
        sgRate: 0.115,
        concessionalCap: 30000,
        agePensionAge: 67,
        brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 45000, rate: 0.16 },
            { min: 45000, max: 135000, rate: 0.30 },
            { min: 135000, max: 190000, rate: 0.37 },
            { min: 190000, max: Infinity, rate: 0.45 }
        ],
        lito: { max: 66667, fullCutoff: 37500, maxOffset: 700 },
        sapto: {
            single: { maxOffset: 2230, shadeOut: 34919, cutOut: 52759 },
            couple_together: { maxOffset: 1602, shadeOut: 30994, cutOut: 43810 },
            couple_illness: { maxOffset: 2040, shadeOut: 33732, cutOut: 50052 },
            both_eligible: { maxOffset: 1602, shadeOut: 30994, cutOut: 43810 }
        },
        medicareLow: { lower: 27222, upper: 34027, saptoLower: 43020, saptoUpper: 53775, familyLower: 45907, saptoFamilyLower: 59886, perChildLower: 4216 },
        mlsThresholds: { singleBase: 97000, singleT2: 113000, singleT3: 151000, familyBase: 194000, familyT2: 226000, familyT3: 302000 },
        hecsThresholds: [
            { min: 54435, rate: 0.01 }, { min: 62851, rate: 0.02 }, { min: 66621, rate: 0.025 },
            { min: 70619, rate: 0.03 }, { min: 74856, rate: 0.035 }, { min: 79347, rate: 0.04 },
            { min: 84108, rate: 0.045 }, { min: 89155, rate: 0.05 }, { min: 94504, rate: 0.055 },
            { min: 100175, rate: 0.06 }, { min: 106186, rate: 0.065 }, { min: 112557, rate: 0.07 },
            { min: 119310, rate: 0.075 }, { min: 126468, rate: 0.08 }, { min: 134057, rate: 0.085 },
            { min: 142101, rate: 0.09 }, { min: 150627, rate: 0.095 }, { min: 159664, rate: 0.10 }
        ],
        companyTax: { baseRate: 0.25, fullRate: 0.3 },   // base rate entity / full rate
        div293Threshold: 250000
    },
    "2024": {
        name: "2023 - 2024 (FY24)",
        sgRate: 0.110,
        concessionalCap: 27500,
        agePensionAge: 67,
        brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 45000, rate: 0.19 },
            { min: 45000, max: 120000, rate: 0.325 },
            { min: 120000, max: 180000, rate: 0.37 },
            { min: 180000, max: Infinity, rate: 0.45 }
        ],
        lito: { max: 66667, fullCutoff: 37500, maxOffset: 700 },
        sapto: {
            single: { maxOffset: 2230, shadeOut: 33241, cutOut: 51081 },
            couple_together: { maxOffset: 1602, shadeOut: 29832, cutOut: 42648 },
            couple_illness: { maxOffset: 2040, shadeOut: 32332, cutOut: 48652 },
            both_eligible: { maxOffset: 1602, shadeOut: 29832, cutOut: 42648 }
        },
        medicareLow: { lower: 26000, upper: 32500, saptoLower: 41089, saptoUpper: 51361, familyLower: 43846, saptoFamilyLower: 57198, perChildLower: 4027 },
        mlsThresholds: { singleBase: 93000, singleT2: 108000, singleT3: 144000, familyBase: 186000, familyT2: 216000, familyT3: 288000 },
        hecsThresholds: [
            { min: 51550, rate: 0.01 }, { min: 59518, rate: 0.02 }, { min: 63089, rate: 0.025 },
            { min: 66875, rate: 0.03 }, { min: 70888, rate: 0.035 }, { min: 75140, rate: 0.04 },
            { min: 79649, rate: 0.045 }, { min: 84429, rate: 0.05 }, { min: 89494, rate: 0.055 },
            { min: 94865, rate: 0.06 }, { min: 100557, rate: 0.065 }, { min: 106590, rate: 0.07 },
            { min: 112985, rate: 0.075 }, { min: 119764, rate: 0.08 }, { min: 126950, rate: 0.085 },
            { min: 134568, rate: 0.09 }, { min: 142642, rate: 0.095 }, { min: 151201, rate: 0.10 }
        ],
        companyTax: { baseRate: 0.25, fullRate: 0.3 },   // base rate entity / full rate
        div293Threshold: 250000
    },
    "2023": {
        name: "2022 - 2023 (FY23)",
        sgRate: 0.105,
        concessionalCap: 27500,
        agePensionAge: 66.5,
        brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 45000, rate: 0.19 },
            { min: 45000, max: 120000, rate: 0.325 },
            { min: 120000, max: 180000, rate: 0.37 },
            { min: 180000, max: Infinity, rate: 0.45 }
        ],
        lito: { max: 66667, fullCutoff: 37500, maxOffset: 700 },
        sapto: {
            single: { maxOffset: 2230, shadeOut: 32279, cutOut: 50119 },
            couple_together: { maxOffset: 1602, shadeOut: 28974, cutOut: 41790 },
            couple_illness: { maxOffset: 2040, shadeOut: 31279, cutOut: 47599 },
            both_eligible: { maxOffset: 1602, shadeOut: 28974, cutOut: 41790 }
        },
        medicareLow: { lower: 24276, upper: 30345, saptoLower: 38365, saptoUpper: 47956, familyLower: 40939, saptoFamilyLower: 53406, perChildLower: 3760 },
        mlsThresholds: { singleBase: 90000, singleT2: 105000, singleT3: 140000, familyBase: 180000, familyT2: 210000, familyT3: 280000 },
        hecsThresholds: [
            { min: 48361, rate: 0.01 }, { min: 55837, rate: 0.02 }, { min: 59187, rate: 0.025 },
            { min: 62739, rate: 0.03 }, { min: 66503, rate: 0.035 }, { min: 70493, rate: 0.04 },
            { min: 74723, rate: 0.045 }, { min: 79207, rate: 0.05 }, { min: 83959, rate: 0.055 },
            { min: 88997, rate: 0.06 }, { min: 94337, rate: 0.065 }, { min: 99997, rate: 0.07 },
            { min: 105997, rate: 0.075 }, { min: 112356, rate: 0.08 }, { min: 119098, rate: 0.085 },
            { min: 126244, rate: 0.09 }, { min: 133819, rate: 0.095 }, { min: 141848, rate: 0.10 }
        ],
        companyTax: { baseRate: 0.25, fullRate: 0.3 },   // base rate entity / full rate
        div293Threshold: 250000
    },
    "2022": {
        name: "2021 - 2022 (FY22)",
        sgRate: 0.100,
        concessionalCap: 27500,
        agePensionAge: 66.5,
        brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 45000, rate: 0.19 },
            { min: 45000, max: 120000, rate: 0.325 },
            { min: 120000, max: 180000, rate: 0.37 },
            { min: 180000, max: Infinity, rate: 0.45 }
        ],
        lito: { max: 66667, fullCutoff: 37500, maxOffset: 700 },
        lmito: { max: 1500 },
        sapto: {
            single: { maxOffset: 2230, shadeOut: 32279, cutOut: 50119 },
            couple_together: { maxOffset: 1602, shadeOut: 28974, cutOut: 41790 },
            couple_illness: { maxOffset: 2040, shadeOut: 31279, cutOut: 47599 },
            both_eligible: { maxOffset: 1602, shadeOut: 28974, cutOut: 41790 }
        },
        medicareLow: { lower: 23365, upper: 29207, saptoLower: 36925, saptoUpper: 46156, familyLower: 39402, saptoFamilyLower: 51401, perChildLower: 3619 },
        mlsThresholds: { singleBase: 90000, singleT2: 105000, singleT3: 140000, familyBase: 180000, familyT2: 210000, familyT3: 280000 },
        hecsThresholds: [
            { min: 47014, rate: 0.01 }, { min: 54283, rate: 0.02 }, { min: 57539, rate: 0.025 },
            { min: 60992, rate: 0.03 }, { min: 64652, rate: 0.035 }, { min: 68530, rate: 0.04 },
            { min: 72642, rate: 0.045 }, { min: 77002, rate: 0.05 }, { min: 81622, rate: 0.055 },
            { min: 86519, rate: 0.06 }, { min: 91710, rate: 0.065 }, { min: 97213, rate: 0.07 },
            { min: 103046, rate: 0.075 }, { min: 109228, rate: 0.08 }, { min: 115782, rate: 0.085 },
            { min: 122729, rate: 0.09 }, { min: 130093, rate: 0.095 }, { min: 137898, rate: 0.10 }
        ],
        companyTax: { baseRate: 0.25, fullRate: 0.3 },   // base rate entity / full rate
        div293Threshold: 250000
    },
    "2021": {
        name: "2020 - 2021 (FY21)",
        sgRate: 0.095,
        concessionalCap: 25000,
        agePensionAge: 66,
        brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 45000, rate: 0.19 },
            { min: 45000, max: 120000, rate: 0.325 },
            { min: 120000, max: 180000, rate: 0.37 },
            { min: 180000, max: Infinity, rate: 0.45 }
        ],
        lito: { max: 66667, fullCutoff: 37500, maxOffset: 700 },
        lmito: { max: 1080 },
        sapto: {
            single: { maxOffset: 2230, shadeOut: 32279, cutOut: 50119 },
            couple_together: { maxOffset: 1602, shadeOut: 28974, cutOut: 41790 },
            couple_illness: { maxOffset: 2040, shadeOut: 31279, cutOut: 47599 },
            both_eligible: { maxOffset: 1602, shadeOut: 28974, cutOut: 41790 }
        },
        medicareLow: { lower: 23226, upper: 29032, saptoLower: 36705, saptoUpper: 45881, familyLower: 39167, saptoFamilyLower: 51094, perChildLower: 3597 },
        mlsThresholds: { singleBase: 90000, singleT2: 105000, singleT3: 140000, familyBase: 180000, familyT2: 210000, familyT3: 280000 },
        hecsThresholds: [
            { min: 46620, rate: 0.01 }, { min: 53827, rate: 0.02 }, { min: 57056, rate: 0.025 },
            { min: 60480, rate: 0.03 }, { min: 64109, rate: 0.035 }, { min: 67955, rate: 0.04 },
            { min: 72032, rate: 0.045 }, { min: 76355, rate: 0.05 }, { min: 80936, rate: 0.055 },
            { min: 85793, rate: 0.06 }, { min: 90940, rate: 0.065 }, { min: 96397, rate: 0.07 },
            { min: 102180, rate: 0.075 }, { min: 108310, rate: 0.08 }, { min: 114708, rate: 0.085 },
            { min: 121699, rate: 0.09 }, { min: 129000, rate: 0.095 }, { min: 136740, rate: 0.10 }
        ],
        companyTax: { baseRate: 0.26, fullRate: 0.3 },   // base rate entity / full rate
        div293Threshold: 250000
    },
    "2020": {
        name: "2019 - 2020 (FY20)",
        sgRate: 0.095,
        concessionalCap: 25000,
        agePensionAge: 66,
        brackets: [
            { min: 0, max: 18200, rate: 0 },
            { min: 18200, max: 37000, rate: 0.19 },
            { min: 37000, max: 90000, rate: 0.325 },
            { min: 90000, max: 180000, rate: 0.37 },
            { min: 180000, max: Infinity, rate: 0.45 }
        ],
        lito: { max: 66667, fullCutoff: 37000, maxOffset: 445 },
        lmito: { max: 1080 },
        sapto: {
            single: { maxOffset: 2230, shadeOut: 32279, cutOut: 50119 },
            couple_together: { maxOffset: 1602, shadeOut: 28974, cutOut: 41790 },
            couple_illness: { maxOffset: 2040, shadeOut: 31279, cutOut: 47599 },
            both_eligible: { maxOffset: 1602, shadeOut: 28974, cutOut: 41790 }
        },
        medicareLow: { lower: 22801, upper: 28501, saptoLower: 36056, saptoUpper: 45070, familyLower: 38474, saptoFamilyLower: 50191, perChildLower: 3533 },
        mlsThresholds: { singleBase: 90000, singleT2: 105000, singleT3: 140000, familyBase: 180000, familyT2: 210000, familyT3: 280000 },
        hecsThresholds: [
            { min: 45881, rate: 0.01 }, { min: 52974, rate: 0.02 }, { min: 56152, rate: 0.025 },
            { min: 59522, rate: 0.03 }, { min: 63093, rate: 0.035 }, { min: 66878, rate: 0.04 },
            { min: 70891, rate: 0.045 }, { min: 75145, rate: 0.05 }, { min: 79653, rate: 0.055 },
            { min: 84433, rate: 0.06 }, { min: 89499, rate: 0.065 }, { min: 94869, rate: 0.07 },
            { min: 100561, rate: 0.075 }, { min: 106594, rate: 0.08 }, { min: 112990, rate: 0.085 },
            { min: 119770, rate: 0.09 }, { min: 126956, rate: 0.095 }, { min: 134573, rate: 0.10 }
        ],
        companyTax: { baseRate: 0.275, fullRate: 0.3 },   // base rate entity / full rate
        div293Threshold: 250000
    }
};
