import React from 'react';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import PatientConditionBox from '../../../components/Database/DisplayPatient/Patient/patientCondition.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

// Adjust the path to DragBox as needed

const Conditions = () => {
    const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

    return (
        <DragBox
            storageKey="CONDITIONS_POSITION"
            defaultPos={{ x: 300, y: 340 }}
            title= "Conditions"
            width={800}
            onAdd={null}
            zIndex={2050}
            addNote="-"
            onClose={() => {
                const updatedButtons = selectedTopButtons.filter(btn => btn !== 'conditions');
                setSelectedTopButtons(updatedButtons);
            }}
        >
            <PatientConditionBox />
        </DragBox>
    );
};

export default Conditions;