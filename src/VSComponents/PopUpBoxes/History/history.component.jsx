import React from 'react';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";
import DisplayPatientHistory from './displayPatientHistory.component.jsx';

// Adjust the path to DragBox as needed

const HistoryBox = ({ activePatient, user }) => {
    const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

    const patient = activePatient || {};

    const renderRow = (label, value) => (
      <div className="d-flex mb-2 fs-7">
        <strong className="me-2" style={{ minWidth: '150px' }}>{label}:</strong>
        <span>{value || '—'}</span>
      </div>
    );  

    const editBox = () => {
      // Logic to open the address edit box goes here
      console.log("Edit Address box opened");
    };

    return (
        <DragBox
            id="HISTORY"
            storageKey="HISTORY_POSITION"
            defaultPos={{ x: 300, y: 340 }}
            title= "Patient History [FULLY WORKING]"
            width={800}
            onAdd={null}
            zIndex={2050}
            addNote="-"
            onAddText='Edit History'
            onAddFunction={editBox}
            onClose={() => {
                const updatedButtons = selectedTopButtons.filter(btn => btn !== 'history');
                setSelectedTopButtons(updatedButtons);
            }}
        >
           <DisplayPatientHistory />
        </DragBox>
    );
};

export default HistoryBox;