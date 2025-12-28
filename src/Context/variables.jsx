import React from "react";



export const navButtons = [
    { security: "20", id: "address", text: "Address", color: "light" },
    { security: "20", id: "dr", text: "Dr. Note", color: "light" },
    { security: "20", id: "history", text: "History", color: "light" },
    { security: "20", id: "private", text: "Private Note", color: "light" },
    { security: "20", id: "medications", text: "Medications", color: "light" },
    { security: "20", id: "conditions", text: "Conditions", color: "light" },
    { security: "20", id: "suspected", text: "Suspected", color: "light" },
    { security: "20", id: "recommendations", text: "Recommendations", color: "light" },
    { security: "20", id: "lab", text: "Lab Results", color: "light" },
    { security: "1", id: "locations", text: "Locations", color: "light" },
    { security: "1", id: "users", text: "Users", color: "light" },
];

export const version = "v3.3.5";
export const versionDate = "2025-11-28";
export const versionTime = "6:30 AM";
export const versionNotes = "Pharmacy Lab Work Updates";

// Standardized recommendation texts for popup Medications Below This.. put other variables Above This

// -------------------------------------------------------------
// Recommendation texts (standout)
export const getRecommendationText = (key) => {
    switch (key.toLowerCase()) {
        case "finerenone":
            return [
                "Finerenone Recommendations:",
                "This Patient is (T2D) and (eGFR ≥25) and (ACR ≥3) and (on ACEi/ARB at target/tolerated) and (K+ ≤5.0):",
                "RECOMMEND finerenone (start 10–20 mg based on eGFR/K+), especially if albuminuria persists despite SGLT2i.",
                "Else: NOT INDICATED or CONSIDER after optimizing ACEi/ARB ± SGLT2i and correcting K+.",
                "MONITORING:",
                "Check K+ and eGFR at 4 weeks, then q4 months; hold/titrate per K+; continue ACEi/ARB and SGLT2i where possible.",
            ].join("\n");
        case "vascepa":
            return [
                "Vascepa Recommendations:",
                "This Medication is not currently included in the published recommendations with GDMT.CA. Contact Mark Brady for more information.",
            ].join("\n");
        case "repatha":
            return [
                "Repatha (evolocumab) Recommendations:",
                "",
                "CLINICAL SUMMARY:",
                "• Patient meets very-high-risk ASCVD criteria per 2021 CCS Dyslipidemia Guidelines (clinical ASCVD and/or diabetes with target organ damage and/or CKD).",
                "• Despite maximally tolerated lipid-lowering therapy, LDL-C, non-HDL-C, and/or ApoB remain above secondary-prevention targets.",
                "",
                "GUIDELINE BASIS:",
                "• CCS 2021: If LDL-C remains ≥1.8 mmol/L despite maximally tolerated statin ± ezetimibe, addition of a PCSK9 inhibitor is recommended.",
                "• PCSK9 inhibitors provide an additional ~50–60% LDL-C reduction and lower major CV events.",
                "",
                "SPECIFIC RECOMMENDATION:",
                "• Initiate Repatha (evolocumab) 140 mg SC every 2 weeks OR 420 mg SC monthly.",
                "• Continue current statin at maximally tolerated dose and ezetimibe 10 mg daily (if applicable).",
                "• Treatment goal: LDL-C <1.8 mmol/L and ideally ApoB <0.7 g/L in very-high-risk disease.",
                "",
                "MONITORING / SAFETY:",
                "• Repeat lipid panel 8–12 weeks after initiation, then periodically.",
                "• Continue background risk-factor management (BP, CKD, diabetes, lifestyle).",
                "• Main adverse effects are mild injection-site reactions; no signal for myopathy, hepatic, or renal toxicity.",
                "",
                "OVERALL:",
                "• Given persistent elevation of LDL-C on optimized therapy and very-high-risk status, adding Repatha is guideline-concordant and expected to significantly reduce future cardiovascular events."
            ].join("\n");

        default:
            return "";
    }
};

/** Lookup helper: get standardized text by key/value */
// export const getRecommendationText = (value) => {
//   if (!value) return "";
//   const key = String(value).trim().toLowerCase();
//   return recommendationTexts[key] ?? "";
// };
