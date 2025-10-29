import React, { useState } from "react";
import PatientSearch from "../components/Database/PatientSearch/patientSearch.component";
import CriteriaSearch from "../components/Database/PatientSearch/criteriaSearch.component";
import MedicationRecommendationSearch from "../components/Database/PatientSearch/regix.component";

/**
 * NewSearchCombo component
 * - Uses Bootstrap 5 (48-column setup assumed)
 * - Tabs are laid out in a row where each tab uses 16 columns (48/3)
 *
 * Props:
 *   regular, advanced, regix: JSX or null
 *   defaultTab: "regular" | "advanced" | "regix"
 */

export default function NewSearchCombo({
    regular = null,
    advanced = null,
    regix = null,
    defaultTab = "super",
}) {
    const [active, setActive] = useState(defaultTab);

    const tabs = [
        { key: "super", label: "Super Search", content: regular },
        { key: "regular", label: "Regular Search", content: advanced },
        { key: "regix", label: "Regix", content: regix },
    ];

    const renderPanelContent = (t) => {
        // If explicit content was passed via props, use it
        if (t.content) return t.content;

        // Otherwise choose a component based on the tab key/label
        switch (t.key) {
            case "regular":
                // Super Search uses PatientSearch with a "super" type
                return <PatientSearch searchType="regular" />;
            case "super":
                // Regular Search uses PatientSearch with a "regular" type (or pass other props)
                return <CriteriaSearch searchType="super" />;
            case "regix":
                // Regix placeholder — replace with a Regix component if/when available
                return <MedicationRecommendationSearch />;
            default:
                return null;
        }
    };

    return (
        <div className="container border border-primary border-1 rounded p-3" role="region" aria-label="Search modes container">
            {/* Tab buttons row: each button occupies 16 columns of a 48-column grid */}
            <div className="row g-2" role="tablist" aria-label="Search tabs">
                {tabs.map((t) => (
                    <div key={t.key} className="col-16">
                        <button
                            id={`tab-${t.key}`}
                            role="tab"
                            aria-selected={active === t.key}
                            aria-controls={`panel-${t.key}`}
                            type="button"
                            className={`btn w-100 ${active === t.key ? "btn-primary text-white" : "btn-outline-primary"}`}
                            onClick={() => setActive(t.key)}
                        >
                            {t.label}
                        </button>
                    </div>
                ))}
            </div>

            {/* Panels */}
            <div className="row mt-3">
                {tabs.map((t) => (
                    <div
                        key={t.key}
                        id={`panel-${t.key}`}
                        role="tabpanel"
                        aria-labelledby={`tab-${t.key}`}
                        className="col-48 ns-panel"
                        hidden={active !== t.key}
                    >
                        {renderPanelContent(t)}
                    </div>
                ))}
            </div>
        </div>
    );
}