// src/components/Labs/pharmacyMedHistory.component.jsx
import React, { useRef, useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import DragBox from "../DragBox/Drag/dragBox.component.jsx";


pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// ---------- Helpers ----------

// Read all text from a PDF file client-side
const readPdfToText = async (file) => {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let rawText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent({ normalizeWhitespace: true });
        let pageText = "";
        for (const it of content.items) {
            const s = typeof it.str === "string" ? it.str : "";
            pageText += s;
            pageText += it.hasEOL ? "\n" : " ";
        }
        rawText += pageText + "\n";
    }
    return rawText;
};

const API_Endpoint = 'https://www.gdmt.ca/PHP/labData.php';
const normalizeText = (txt) =>
    (txt || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .trim();

/**
 * Extract basic patient meta from the pharmacy med history PDF.
 *
 * Uses the working address logic:
 *  - Name = first "Last, First" line
 *  - Street = first non-empty line under name (before "Plan:")
 *  - City / Prov / Postal pulled from following lines (Hawkesbury ON / K6A 1A5, etc.)
 * Also:
 *  - HCN from "Billing Info ... Rel: 0", formatted as "XXXX XXX XXX"
 *  - Date of Birth from "Date of Birth" line
 */
const extractPatientMetaFromPharm = (rawText) => {
    const rawLines = rawText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    const normText = normalizeText(rawText);

    const meta = {
        name: "",
        healthNumber: "",
        healthNumberRaw: "",
        dateOfBirth: "",
        street: "",
        city: "",
        province: "",
        postalCode: "",
        allergies: [],
        conditions: [],
    };

    // --- Name: first "Last, First" style line, track its index ---
    let nameIndex = -1;
    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const m = line.match(/^([A-ZÀ-Ÿ][^,]+,\s*[A-ZÀ-Ÿ][^,]+)$/);
        if (m) {
            meta.name = m[1].trim();
            nameIndex = i;
            break;
        }
    }

    // --- HCN: "Billing Info XXXXX Rel: 0" ---
    const hcnMatch = normText.match(/Billing Info\s+([A-Z0-9 ]{6,})\s+Rel:/i);
    if (hcnMatch) {
        const raw = hcnMatch[1].replace(/\s+/g, "").trim(); // digits only
        meta.healthNumberRaw = raw;

        // Format as 4-3-3 => "XXXX XXX XXX" if we have 10 digits
        if (raw.length === 10) {
            meta.healthNumber = `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
        } else {
            meta.healthNumber = raw;
        }
    }

    // --- Date of Birth: handles "Date of Birth - 25-07-1990" etc. ---
    const dobMatch = normText.match(
        /date\s*of\s*birth\s*[-–—]?\s*([0-3]?\d[-\/][0-1]?\d[-\/][12]\d{3})/i
    );

    if (dobMatch) {
        meta.dateOfBirth = dobMatch[1].trim();
    }

    // --- Address: street = line under name; city/prov/postal from the next lines ---
    if (nameIndex !== -1) {
        // 1) Street: first non-empty line after name, trimmed before "Plan:"
        for (let i = nameIndex + 1; i < Math.min(nameIndex + 5, rawLines.length); i++) {
            const line = rawLines[i];
            if (!line) continue;
            if (/^Date of Birth/i.test(line)) break; // safety guard

            const streetPart = line.split(/Plan:/i)[0].trim();
            if (streetPart) {
                meta.street = streetPart;
            }

            // 2) City / Province / Postal: search the next few lines
            const provinceRegex =
                /^(.+?)\s+(ON|QC|NB|NS|BC|MB|SK|AB|NL|PE|YT|NT|NU)\b/;
            const postalRegex = /\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/;

            for (let j = i + 1; j < Math.min(i + 6, rawLines.length); j++) {
                const l2 = rawLines[j];
                if (!l2) continue;

                const cityProvMatch = l2.match(provinceRegex);
                if (cityProvMatch) {
                    meta.city = cityProvMatch[1].trim();
                    meta.province = cityProvMatch[2];
                }

                const postalMatch = l2.match(postalRegex);
                if (postalMatch) {
                    meta.postalCode = postalMatch[1];
                }

                if (meta.city && meta.province && meta.postalCode) {
                    break;
                }
            }

            // Once we’ve processed from the first address line after the name, we’re done
            break;
        }
    }

    // --- Allergies ---
    const allergyMatch = normText.match(/Allergies\s*-\s*([^\n]+)/i);
    if (allergyMatch) {
        meta.allergies = allergyMatch[1]
            .split(/[;,\|]/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    // --- Conditions ---
    const condMatch = normText.match(/Conditions?\s*-\s*([^\n]+)/i);
    if (condMatch) {
        meta.conditions = condMatch[1]
            .split(/[;,\|]/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    return meta;
};

/**
 * Extract medication names/DINs and First/Last Fill dates from the Drug Name table.
 *
 * Pattern in normalized text (single-line):
 *   "... TAB Irbesartan 150mg 02317079 Dr. QUENNEVILLE, MI 20-Jun-2025 29-Oct-2025 ..."
 *
 * We capture:
 *   - med name (between form and DIN)
 *   - DIN (8 digits)
 *   - first date after "Dr."  => firstFill
 *   - second date after that  => lastFill
 */
const extractMedicationsFromPharm = (rawText) => {
    const text = normalizeText(rawText);

    const formPattern = "(?:TAB|CAP|ML|DEV|SUSP|INJ|SOLN|SR|CR|ER)";
    const datePattern = "([0-3][0-9]-[A-Za-z]{3}-[12][0-9]{3})";

    const regex = new RegExp(
        // form + med name + DIN + "Dr." then any text, then first date, optional second date
        `\\b${formPattern}\\s+(.+?)\\s+(\\d{8})\\s+Dr\\..*?${datePattern}(?:\\s+${datePattern})?`,
        "g"
    );

    const meds = [];
    const seen = new Set();

    let m;
    while ((m = regex.exec(text)) !== null) {
        const fullName = m[1].trim(); // e.g. "Irbesartan 150mg"
        const din = m[2];
        const firstFill = m[3] || "";
        const lastFill = m[4] || "";

        const key = `${fullName}__${din}__${firstFill}__${lastFill}`;
        if (!seen.has(key)) {
            seen.add(key);
            meds.push({
                medication: fullName,
                din,
                firstFill,
                lastFill,
            });
        }
    }

    return meds;
};

// ---------- Component ----------

export default function PharmacyMedHistory({ onParsed }) {
    const [msg, setMsg] = useState("");
    const [fileKey, setFileKey] = useState(0);
    const fileInputRef = useRef(null);

    const [record, setRecord] = useState(null);
    // record = {
    //   name, healthNumber, healthNumberRaw, dateOfBirth,
    //   street, city, province, postalCode,
    //   allergies: [], conditions: [],
    //   medications: [{ medication, din, firstFill, lastFill }]
    // }

    useEffect(() => {
        if (onParsed && record) {
            onParsed(record);
        }
    }, [record, onParsed]);

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== "application/pdf") return;

        try {
            setMsg("Reading PDF…");
            const rawText = await readPdfToText(file);

            const meta = extractPatientMetaFromPharm(rawText);
            const meds = extractMedicationsFromPharm(rawText);
            const response = await fetch(API_Endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scriptName: 'processPharmacyMeds',
                    medications: meds,
                }),
            });
            const result = await response.json();
            const processedMeds = result.meds || meds;

            const next = {
                ...meta,
                medications: processedMeds,
                rawText, // keep for debugging if needed
            };
            // Send to backend for processing
            await fetch('/labData.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'processPharmacyMeds',
                    patientData: meta,
                    medications: meds,
                }),
            });
            setRecord(next);
            setMsg("");
        } catch (err) {
            console.error(err);
            setMsg("Could not read/parse PDF.");
            setRecord(null);
        }
    };

    const resetAll = () => {
        setRecord(null);
        setMsg("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setFileKey((k) => k + 1);
    };

    const hasAny = (arr) => Array.isArray(arr) && arr.length > 0;

    return (
        <DragBox
            id="PharmacyMedHistory"
            storageKey="PharmacyMedHistory_POSITION"
            defaultPos={{ x: 260, y: 320 }}
            title="Pharmacy Medication History Parser [LOCAL ONLY]"
            width={1400}
            onAdd={null}
            zIndex={2050}
            addNote="-"
        >
            <div
                className="container my-3"
                style={{ maxHeight: "75vh", overflowY: "auto", overflowX: "hidden" }}
            >
                {/* Header + controls */}
                <div className="row mb-2">
                    <div className="col-48 d-flex align-items-center">
                        <h5 className="m-0">
                            Monthly Pharmacy Medication History – Parse &amp; Review
                        </h5>
                        <div className="ms-auto d-flex gap-2">
                            <button className="btn btn-outline-secondary" onClick={resetAll}>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                {/* File picker + status */}
                <div className="row g-2 mb-3">
                    <div className="col-24">
                        <input
                            key={fileKey}
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                        />
                    </div>
                    <div className="col-24">
                        {msg && <div className="alert alert-info py-2 m-0">{msg}</div>}
                    </div>
                </div>

                {/* Empty state */}
                {!record && !msg && (
                    <div className="row">
                        <div className="col-48 text-muted">
                            <em>Select a Pharmacy Medication History PDF to parse and review.</em>
                        </div>
                    </div>
                )}

                {/* Parsed content */}
                {record && (
                    <>
                        {/* Patient summary */}
                        <div className="row g-3 mb-3">
                            <div className="col-48">
                                <div className="card p-2">
                                    {/* Row 1: Name / HCN / DOB */}
                                    <div className="row">
                                        <div className="col-16">
                                            <div className="fw-bold">Name</div>
                                            <div>{record.name || <em>Unknown</em>}</div>
                                        </div>
                                        <div className="col-16">
                                            <div className="fw-bold">Health Card Number</div>
                                            <div>{record.healthNumber || <em>Unknown</em>}</div>
                                        </div>
                                        <div className="col-16">
                                            <div className="fw-bold">Date of Birth</div>
                                            <div>{record.dateOfBirth || <em>Unknown</em>}</div>
                                        </div>
                                    </div>

                                    {/* Row 2: Address */}
                                    <div className="row mt-2">
                                        <div className="col-24">
                                            <div className="fw-bold">Street</div>
                                            <div>{record.street || <em>Unknown</em>}</div>
                                        </div>
                                        <div className="col-24">
                                            <div className="fw-bold">City / Prov / Postal</div>
                                            <div>
                                                {record.city || record.province || record.postalCode ? (
                                                    <>
                                                        {record.city && <span>{record.city}</span>}{" "}
                                                        {record.province && <span>{record.province}</span>}{" "}
                                                        {record.postalCode && <span>{record.postalCode}</span>}
                                                    </>
                                                ) : (
                                                    <em>Unknown</em>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Allergies / Conditions */}
                                    <div className="row mt-2">
                                        <div className="col-24">
                                            <div className="fw-bold">Allergies</div>
                                            {hasAny(record.allergies) ? (
                                                <ul className="mb-0">
                                                    {record.allergies.map((a) => (
                                                        <li key={a}>{a}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div>
                                                    <em>None listed</em>
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-24">
                                            <div className="fw-bold">Conditions</div>
                                            {hasAny(record.conditions) ? (
                                                <ul className="mb-0">
                                                    {record.conditions.map((c) => (
                                                        <li key={c}>{c}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div>
                                                    <em>None listed</em>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Medications list */}
                        <div className="row mt-3">
                            <div className="col-48">
                                <div className="card">
                                    <div className="card-header">
                                        Medications (from Pharmacy History)
                                    </div>
                                    <div className="card-body">
                                        {!hasAny(record.medications) ? (
                                            <div className="text-muted small">
                                                <em>No medications parsed from this file.</em>
                                            </div>
                                        ) : (
                                            <div className="row fs-7">
                                                <div className="col-48">
                                                    <table className="table table-sm table-striped mb-0">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: "30%" }}>Medication</th>
                                                                <th style={{ width: "15%", textAlign: "center" }}>DIN</th>
                                                                <th style={{ width: "10%" }}></th>
                                                                <th style={{ width: "15%", textAlign: "center" }}>First Fill</th>
                                                                <th style={{ width: "15%", textAlign: "center" }}>Last Fill</th>
                                                                <th style={{ width: "15%", textAlign: "center" }}>Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {record.medications.map((m, idx) => (
                                                                <tr key={`${m.medication}_${m.din}_${idx}`}>
                                                                    <td>{m.medication}</td>
                                                                    <td className="text-center">{m.din}</td>
                                                                    <td></td>
                                                                    <td className="text-center">
                                                                        {m.firstFill || (
                                                                            <span className="text-muted text-center">-</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="text-center">
                                                                        {m.lastFill || (
                                                                            <span className="text-muted text-center">-</span>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        {m.action || (
                                                                            <span className="text-muted text-center">Add or Update</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </DragBox>
    );
}
