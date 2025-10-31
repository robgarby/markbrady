import React from 'react';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import PatientRecs from './patientRecs.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

// Adjust the path to DragBox as needed

const Recommendations = () => {
    const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

    return (
        <DragBox
            id="REC"
            storageKey="RECOMMENDATIONS_POSITION"
            defaultPos={{ x: 300, y: 340 }}
            title= "Recommendations [FULLY WORKING]"
            width={600}
            onAdd={null}
            zIndex={2050}
            addNote="-"
            onClose={() => {
                const updatedButtons = selectedTopButtons.filter(btn => btn !== 'recommendations');
                setSelectedTopButtons(updatedButtons);
            }}
        >
           <PatientRecs />
        </DragBox>
    );
};

export default Recommendations;