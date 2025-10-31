import React from 'react';
import MedBoxComplete from './medBoxComplete.component.jsx';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

// Adjust the path to DragBox as needed

const Medications = ({ user }) => {
    const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

    return (
        <DragBox
            id="MED"
            storageKey="NOTE_BOX_POSITION"
            defaultPos={{ x: 600, y: 340 }}
            title= "Medications [FULLY WORKING]"
            width={900}
            onAdd={null}
            zIndex={2050}
            addNote="-"
            onClose={() => {
                const updatedButtons = selectedTopButtons.filter(btn => btn !== 'medications');
                setSelectedTopButtons(updatedButtons);
            }}
        >
            <MedBoxComplete user={user} />
        </DragBox>
    );
};

export default Medications;