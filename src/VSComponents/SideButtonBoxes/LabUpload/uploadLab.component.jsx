// src/components/UploadLab/uploadLab.component.jsx

import React, { useState } from "react";
import DynacareLab from "./dynacareLab.component.jsx";
import LifeLab from "./lifeLab.component.jsx";

const UploadLab = ({ onParsed, onChange }) => {
    const [selectedLab, setSelectedLab] = useState("dynalab");

    return (
        <div className="container-fluid py-2">
            <div className="row g-2">
                <div className="col-48">
                    <div className="card p-2">
            <div className="row g-2 mb-3">
                <div className="col-48">
                    <div className="alert alert-navy mb-2 py-2">
                        <div className="row g-2 align-items-center">
                            <div className="col-24">
                                <button
                                    type="button"
                                    className={`btn w-100 ${
                                        selectedLab === "dynalab"
                                            ? "btn-primary"
                                            : "btn-outline-primary"
                                    }`}
                                    onClick={() => setSelectedLab("dynalab")}
                                >
                                    DynaLab
                                </button>
                            </div>

                            <div className="col-24">
                                <button
                                    type="button"
                                    className={`btn w-100 ${
                                        selectedLab === "lifelab"
                                            ? "btn-primary"
                                            : "btn-outline-primary"
                                    }`}
                                    onClick={() => setSelectedLab("lifelab")}
                                >
                                    LifeLab
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-48">
                    {selectedLab === "dynalab" ? (
                        <DynacareLab
                            onParsed={onParsed}
                            onChange={onChange}
                        />
                    ) : (
                        <LifeLab
                            onParsed={onParsed}
                            onChange={onChange}
                        />
                    )}
                </div>
            </div>
                            </div>
                </div>
            </div>
        </div>
    );
};

export default UploadLab;