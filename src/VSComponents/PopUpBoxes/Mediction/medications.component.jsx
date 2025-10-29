import React from 'react';
import PatientMeds from '../../../components/Database/DisplayPatient/Patient/patientMeds.component.jsx';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

// Adjust the path to DragBox as needed

const Medications = () => {
    const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

    return (
        <DragBox
            storageKey="NOTE_BOX_POSITION"
            defaultPos={{ x: 600, y: 340 }}
            title= "Medications"
            width={800}
            onAdd={null}
            zIndex={2050}
            addNote="-"
            onClose={() => {
                const updatedButtons = selectedTopButtons.filter(btn => btn !== 'medications');
                setSelectedTopButtons(updatedButtons);
            }}
        >
            <PatientMeds />
        </DragBox>
    );
};

export default Medications;