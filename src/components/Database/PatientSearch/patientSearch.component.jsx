import React, { useState, useEffect } from 'react';
import { useGlobalContext } from '../../../Context/global.context';
import { getUserFromToken } from '../../../Context/functions';
import { useNavigate } from 'react-router-dom';

const PatientSearch = () => {
  const {
    patientSearch,
    updatePatientSearch,
    clearPatientSearch,
    setVisibleBox,
  } = useGlobalContext();

  const {
    mode,
    query,
    noteQuery,
    privateNoteQuery,     // NEW
    providerQuery,
    appointmentDate,
  } = patientSearch;

  const [loading, setLoading] = useState(false);

  const [user, setUser] = React.useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getUserFromToken();
      return userData;
    };
    fetchUser().then((userT) => {
      if (userT && userT.dayOfWeek) {
        setUser(userT);
      }
      if (!userT) {
        // If no user is found, redirect to sign-in page
        navigate('/signin');
        return;
      }
    });
  }, []);

  // Focus handlers: clear other lines so user knows which search is active
  const focusIdentity = () => {
    updatePatientSearch({ noteQuery: '', privateNoteQuery: '', providerQuery: '', appointmentDate: '' });
  };
  const focusNotes = () => {
    updatePatientSearch({ query: '', privateNoteQuery: '', providerQuery: '', appointmentDate: '' });
  };
  const focusPrivateNotes = () => { // NEW
    updatePatientSearch({ query: '', noteQuery: '', providerQuery: '', appointmentDate: '' });
  };
  const focusProvider = () => {
    updatePatientSearch({ query: '', noteQuery: '', privateNoteQuery: '' });
  };

  // --- Identity search (unchanged) ---
  const handleSearchIdentity = async () => {
    const value = (query || '').trim();
    if (!value) return;
    setLoading(true);
    updatePatientSearch({ didSearch: true, mode: 'identity' });
    try {
      const res = await fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "patientSearch", searchTerm: value, patientDB: user?.patientTable || "Patient", historyDB: user?.historyTable || "Patient_History" }),
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

  // --- Public Note search (unchanged) ---
  const handleSearchNotes = async () => {
    const value = (noteQuery || '').trim();
    if (!value) return;
    setLoading(true);
    updatePatientSearch({ didSearch: true, mode: 'notes' });
    try {
      const res = await fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "patientNoteSearch", noteTerm: value, patientDB: user?.patientTable || "Patient", historyDB: user?.historyTable || "Patient_History" }),
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

  // --- NEW: Private Note search (searches privateNote field) ---
  const handleSearchPrivateNotes = async () => {
    const value = (privateNoteQuery || '').trim();
    if (!value) return;
    setLoading(true);
    updatePatientSearch({ didSearch: true, mode: 'privateNotes' });
    try {
      const res = await fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // If your API expects a different script name or field, adjust here:
        body: JSON.stringify({ script: "privateNoteSearch", privateNote: value, patientDB: user?.patientTable || "Patient", historyDB: user?.historyTable || "Patient_History" }),
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

  // --- Provider search (unchanged) ---
  const handleSearchProvider = async () => {
    const providerTerm = (providerQuery || '').trim();
    const appt = (appointmentDate || '').trim();
    if (!providerTerm && !appt) return;
    setLoading(true);
    updatePatientSearch({ didSearch: true, mode: 'provider' });
    try {
      const res = await fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "providerSearch",
          providerTerm,
          appointmentDate: appt,
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

  const clearAll = () => {
    clearPatientSearch();
  };

  const onEnter = (fn) => (e) => {
    if (e.key === 'Enter') fn();
  };

  return (
    <div className="d-flex flex-column h-100" style={{ minHeight: 0 }}>
      {/* Line 1: Identity */}
      <div className="d-flex align-items-center justify-content-center mb-3">
        <div className="col-16">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Last Name, First Name, or HCN"
            value={query}
            onFocus={focusIdentity}
            onChange={(e) => updatePatientSearch({ query: e.target.value })}
            onKeyDown={onEnter(handleSearchIdentity)}
          />
        </div>
        <div className="justify-content-end">
          <button
            className="btn btn-success text-white"
            onClick={handleSearchIdentity}
            style={{ width: "150px", marginLeft: 8, marginTop: 2 }}
            disabled={loading || !query?.trim()}
          >
            {loading && mode === 'identity' ? 'Searching…' : 'Search'}
          </button>
          <button
            className="btn btn-danger"
            onClick={clearAll}
            style={{ width: "150px", marginLeft: 8, marginTop: 2 }}
            disabled={loading}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Line 2: Notes */}
      {/* <div className="d-flex align-items-center justify-content-center mb-3">
        <div className="col-16">
          <input
            type="text"
            className="form-control"
            placeholder="Search Patient Notes"
            value={noteQuery}
            onFocus={focusNotes}
            onChange={(e) => updatePatientSearch({ noteQuery: e.target.value })}
            onKeyDown={onEnter(handleSearchNotes)}
          />
        </div>
        <div className="justify-content-end">
          <button
            className="btn btn-success text-white"
            onClick={handleSearchNotes}
            style={{ width: "150px", marginLeft: 8, marginTop: 2 }}
            disabled={loading || !noteQuery?.trim()}
          >
            {loading && mode === 'notes' ? 'Searching…' : 'Search'}
          </button>
          <button
            className="btn btn-danger"
            onClick={clearAll}
            style={{ width: "150px", marginLeft: 8, marginTop: 2 }}
            disabled={loading}
          >
            Clear All
          </button>
        </div>
      </div> */}

      {/* Line 3: Private Notes (NEW) */}
      {/* <div className="d-flex align-items-center justify-content-center mb-3">
        <div className="col-16">
          <input
            type="text"
            className="form-control"
            placeholder="Search Private Notes"
            value={privateNoteQuery || ''}
            onFocus={focusPrivateNotes}
            onChange={(e) => updatePatientSearch({ privateNoteQuery: e.target.value })}
            onKeyDown={onEnter(handleSearchPrivateNotes)}
          />
        </div>
        <div className="justify-content-end">
          <button
            className="btn btn-success text-white"
            onClick={handleSearchPrivateNotes}
            style={{ width: "150px", marginLeft: 8, marginTop: 2 }}
            disabled={loading || !privateNoteQuery?.trim()}
            title="Searches the privateNote field"
          >
            {loading && mode === 'privateNotes' ? 'Searching…' : 'Private Search'}
          </button>
          <button
            className="btn btn-danger"
            onClick={clearAll}
            style={{ width: "150px", marginLeft: 8, marginTop: 2 }}
            disabled={loading}
          >
            Clear All
          </button>
        </div>
      </div> */}

      {/* Line 4: Provider & Date */}
      {/* <div className="d-flex align-items-center justify-content-center mb-2">
        <div className="col-10">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Provider / Doctor name"
            value={providerQuery}
            onFocus={focusProvider}
            onChange={(e) => updatePatientSearch({ providerQuery: e.target.value })}
            onKeyDown={onEnter(handleSearchProvider)}
          />
        </div>
        <div className="col-6 ps-2">
          <input
            type="date"
            className="form-control"
            value={appointmentDate}
            onFocus={focusProvider}
            onChange={(e) => updatePatientSearch({ appointmentDate: e.target.value })}
            onKeyDown={onEnter(handleSearchProvider)}
            aria-label="Appointment Date"
          />
        </div>
        <div className="justify-content-end">
          <button
            className="btn btn-success text-white"
            onClick={handleSearchProvider}
            style={{ width: "150px", marginLeft: 8, marginTop: 2 }}
            disabled={loading || (!providerQuery?.trim() && !appointmentDate)}
          >
            {loading && mode === 'provider' ? 'Searching…' : 'Search'}
          </button>
          <button
            className="btn btn-danger"
            onClick={clearAll}
            style={{ width: "150px", marginLeft: 8, marginTop: 2 }}
            disabled={loading}
          >
            Clear All
          </button>
        </div>
      </div> */}
    </div>
  );
};

export default PatientSearch;
