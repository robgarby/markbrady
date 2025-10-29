import React, { useState } from "react";

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
export default function MedicationRecommendationSearch({
    medications = [
        { id: "med-aspirin", name: "Aspirin" },
        { id: "med-metformin", name: "Metformin" },
        { id: "med-lisinopril", name: "Lisinopril" },
    ],
    onMedicationSelect,
}) {
    const [selectedMed, setSelectedMed] = useState(null);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(false);

    // Placeholder: simulate fetching patients that meet prescribing criteria.
    // Replace this with a real API/DB call.
    const fetchPatientsForMedication = async (medId) => {
        setLoading(true);
        // simulate network delay
        await new Promise((r) => setTimeout(r, 400));
        setLoading(false);

        // Mocked patient data - replace with real results
        const mock = {
            "med-aspirin": [
                { id: 1, name: "John Doe", age: 65 },
                { id: 2, name: "Mary Smith", age: 72 },
            ],
            "med-metformin": [{ id: 3, name: "Alice Johnson", age: 54 }],
            "med-lisinopril": [
                { id: 4, name: "Bob Brown", age: 60 },
                { id: 5, name: "Eve Davis", age: 58 },
            ],
        };
        return mock[medId] || [];
    };

    const handleSelect = async (med) => {
        setSelectedMed(med);
        onMedicationSelect?.(med);
        const results = await fetchPatientsForMedication(med.id);
        setPatients(results);
    };

    return (
        <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" }}>
            <h2>Medication Recommendation Search</h2>
            <p>
                Press on the preferred Medication to display all patients in the Database that meet the
                criteria for prescribing this medication
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {medications.map((med) => (
                    <button
                        key={med.id}
                        onClick={() => handleSelect(med)}
                        style={{
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: selectedMed?.id === med.id ? "2px solid #2563eb" : "1px solid #ccc",
                            background: selectedMed?.id === med.id ? "#eef2ff" : "#fff",
                            cursor: "pointer",
                        }}
                    >
                        {med.name}
                    </button>
                ))}
            </div>

            {selectedMed && (
                <section>
                    <h3>
                        Patients meeting criteria for "{selectedMed.name}"
                        {loading ? " (loading...)" : ""}
                    </h3>
                    {!loading && patients.length === 0 && <p>No patients found.</p>}
                    {!loading && patients.length > 0 && (
                        <ul>
                            {patients.map((p) => (
                                <li key={p.id}>
                                    {p.name} {p.age ? `— ${p.age} y` : ""}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
}