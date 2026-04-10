import React, { useEffect, useMemo, useState } from "react";
import { getUserFromToken } from "../../../Context/functions";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from '../../../Context/global.context';

const PROVIDER_ENDPOINT = "https://www.gdmt.ca/PHP/labData.php";
const SEARCH_ENDPOINT = "https://gdmt.ca/PHP/database.php";

const getProviderLabel = (p) => {
    const name = String(p?.pharmacyName ?? p?.providerName ?? p?.name ?? "").trim();
    const loc = String(p?.pharmacyLocation ?? p?.location ?? "").trim();
    const phone = String(p?.pharmacyPhone ?? p?.phone ?? "").trim();
    return [name, loc, phone].filter(Boolean).join(" — ");
};

export default function MedicationRecommendationSearch({
    medications = [
        { id: "Finerenone", name: "Finerenone 10" },
        { id: "Finerenone20", name: "Finerenone 20" },
        { id: "Vescepa", name: "Vascepa" },
        { id: "Leqvio", name: "Leqvio" },
    ],
}) {
    const [loading, setLoading] = useState(false);
    const [providerLoading, setProviderLoading] = useState(false);
    const [providerData, setProviderData] = useState([]);
    const [providerId, setProviderId] = useState("");

    const {
        updatePatientSearch,
        setVisibleBox,
    } = useGlobalContext();

    const navigate = useNavigate();

    const providerOptions = useMemo(() => {
        return Array.isArray(providerData) ? providerData : [];
    }, [providerData]);

    useEffect(() => {
        let mounted = true;

        const fetchProviders = async () => {
            setProviderLoading(true);
            try {
                const res = await fetch(PROVIDER_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scriptName: "getProvider" }),
                });

                const json = await res.json().catch(() => null);
                if (!mounted) return;

                if (json?.success) {
                    const rows = Array.isArray(json?.provider)
                        ? json.provider
                        : Array.isArray(json?.providers)
                            ? json.providers
                            : [];
                    setProviderData(rows);
                } else {
                    setProviderData([]);
                }
            } catch (err) {
                console.error("getProvider failed:", err);
                if (mounted) setProviderData([]);
            } finally {
                if (mounted) setProviderLoading(false);
            }
        };

        fetchProviders();

        return () => {
            mounted = false;
        };
    }, []);

    const handleSelect = async (med) => {
        console.log("Selected medication:", med);
        setLoading(true);

        const user = await getUserFromToken();
        console.log("User data:", user);

        if (!user) {
            console.error("User not found.");
            navigate('/login');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(SEARCH_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: "findPatientsForMedication",
                    medicationId: med.id,
                    providerId: providerId || "",
                    patientDB: user?.patientTable || "Patient",
                    historyDB: user?.historyTable || "Patient_History"
                }),
            });

            const data = await res.json().catch(() => []);
            updatePatientSearch({ results: Array.isArray(data) ? data : [] });
            setVisibleBox?.('results');
        } catch (e) {
            console.error(e);
            updatePatientSearch({ results: [] });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" }}>
            <h2>Medication Recommendation Search</h2>
            <p>
                Press on the preferred Medication to display all patients in the Database that meet the
                criteria for prescribing this medication -{" "}
                <span className="text-danger">
                    Adding Medications to this is Done by Administrator in Admin Panel
                </span>
            </p>

            <div className="border rounded p-3 mb-3">
                <div className="row g-2 align-items-end">
                    <div className="col-48">
                        <label className="form-label fw-bold">Provider</label>
                        <select
                            className="form-select"
                            value={providerId}
                            onChange={(e) => setProviderId(e.target.value)}
                            disabled={providerLoading || loading}
                        >
                            <option value="">
                                {providerLoading ? "Loading providers..." : "ALL Providers"}
                            </option>

                            {providerOptions.map((p, idx) => {
                                const id = String(p?.ID ?? p?.id ?? `provider_${idx}`);
                                const label = getProviderLabel(p) || id;
                                return (
                                    <option key={id} value={id}>
                                        {label}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {medications.map((med) => (
                    <button
                        key={med.id}
                        onClick={() => handleSelect(med)}
                        className="btn btn-outline-primary"
                        disabled={loading}
                    >
                        {loading ? "Loading..." : med.name}
                    </button>
                ))}
            </div>
        </div>
    );
}