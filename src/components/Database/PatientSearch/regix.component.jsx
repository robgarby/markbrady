import React, { useState } from "react";
import { getUserFromToken } from "../../../Context/functions";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from '../../../Context/global.context';

/**
 * Medication Recommendation Search
 *
 * Description: Medication Recommendation Search
 * Instruction: Press on the preferred Medication to display all patients in the Database
 * that meet the criteria for prescribing this medication
 *
 * Usage:
 * <MedicationRecommendationSearch
 *   medications={[{ id: 'm1', name: 'Aspirin' }, { id: 'm2', name: 'Metformin' }]}
 *   onMedicationSelect={(med) => console.log('selected', med)}
 * />
 *
 * Replace fetchPatientsForMedication with a real API call to your database.
 */
export default function MedicationRecommendationSearch({ medications = [{ id: "Finerenone", name: "Finerenone" }, { id: "Vescepa", name: "Vascepa" }, { id: "Repatha", name: "Repatha" }], }) {


    const [loading, setLoading] = useState(false);

    const {
        updatePatientSearch,
        setVisibleBox,
    } = useGlobalContext();

    const navigate = useNavigate();

    const handleSelect = async (med) => {
        console.log("Selected medication:", med);
        const user = await getUserFromToken();
        console.log("User data:", user);
        if (!user) {
            console.error("User not found.");
            navigate('/login');
            return;
        }
        try {
            const res = await fetch("https://gdmt.ca/PHP/database.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: "findPatientsForMedication",
                    medicationId: med.id,
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

    React.useEffect(() => {
        setLoading(false);
    }, []);

    return (
        <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" }}>
            <h2>Medication Recommendation Search</h2>
            <p>
                Press on the preferred Medication to display all patients in the Database that meet the
                criteria for prescribing this medication - <span className="text-danger">Adding Medications to this is Done by Administrator in Admin Panel</span>
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {medications.map((med) => (
                    <button
                        key={med.id}
                        onClick={() => handleSelect(med)}
                        className="btn btn-outline-primary"
                        disabled={loading}
                    >
                        {med.name}
                    </button>
                ))}
            </div>
        </div>
    );
}