// src/components/Patient/medBoxComplete.component.jsx
import React, { useEffect, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context.jsx"; // adjust path if needed
import MedsAdminPanel from "./editMedications.component.jsx"; // your existing admin UI

const deepClone = (v) => JSON.parse(JSON.stringify(v ?? []));

const MedBoxComplete = ({ user }) => {
  const { medsArray, updateMedsArray } = useGlobalContext() || {};

  const [adminDraft, setAdminDraft] = useState(() =>
    Array.isArray(medsArray) ? deepClone(medsArray) : []
  );
  const [dirty, setDirty] = useState(false);

  // Re-seed draft anytime the master list changes
  useEffect(() => {
    setAdminDraft(Array.isArray(medsArray) ? deepClone(medsArray) : []);
    setDirty(false);
  }, [medsArray]);

  const saveAdmin = () => {
    if (typeof updateMedsArray === "function") {
      updateMedsArray(adminDraft);
    }
    setDirty(false);
  };

  const resetAdmin = () => {
    setAdminDraft(Array.isArray(medsArray) ? deepClone(medsArray) : []);
    setDirty(false);
  };

  // Helper so ANY edits mark dirty
  const setDraft = (next) => {
    setAdminDraft(next);
    setDirty(true);
  };

  return (
    <div className="d-flex flex-column h-100 fs-7">
      <div className="flex-grow-1 overflow-auto">
        <MedsAdminPanel value={adminDraft} setValue={setDraft} onChange={setDraft} user={user} />
      </div>
    </div>
  );
};

export default MedBoxComplete;
