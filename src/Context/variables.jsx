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

export const version = "v3.0.5";
export const versionDate = "2025-11-06";
export const versionTime = "5:30 AM";
export const versionNotes = "Many Changes, but Most Important is Medication Recommendation Search Feature Added";

// Standardized recommendation texts for popup Medications Below This.. put other variables Above This

// -------------------------------------------------------------
// Recommendation texts (standout)
export const recommendationTexts = {
    finerenone: [
        "Finerenone Recommendations:",
        "This Patient is (T2D) and (eGFR ≥25) and (ACR ≥3) and (on ACEi/ARB at target/tolerated) and (K+ ≤5.0):",
        "RECOMMEND finerenone (start 10–20 mg based on eGFR/K+), especially if albuminuria persists despite SGLT2i.",
        "Else: NOT INDICATED or CONSIDER after optimizing ACEi/ARB ± SGLT2i and correcting K+.",
        "MONITORING:",
        "Check K+ and eGFR at 4 weeks, then q4 months; hold/titrate per K+; continue ACEi/ARB and SGLT2i where possible.",
    ].join("\n"),
};

/** Lookup helper: get standardized text by key/value */
export const getRecommendationText = (value) => {
  if (!value) return "";
  const key = String(value).trim().toLowerCase();
  return recommendationTexts[key] ?? "";
};
