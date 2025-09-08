import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../../Context/global.context";

/**
 * This version reads ONLY from the patientSearch context.
 * The results list is scrollable, while header stays fixed.
 */
const ResultsPage = () => {
  const navigate = useNavigate();
  const { patientSearch, setVisibleBox, setActivePatient, setClientBox } = useGlobalContext();

  const {
    mode = "",
    query = "",
    noteQuery = "",
    providerQuery = "",
    appointmentDate = "",
    results = [],
    didSearch = false,
  } = patientSearch;

  const title = useMemo(() => {
    switch (mode) {
      case "identity":
        return "Patient Search Results";
      case "notes":
        return "Notes Search Results";
      case "provider":
        return "Provider Search Results";
      case "privateNotes":
        return "Private Notes Search Results";
      default:
        return "Search Results";
    }
  }, [mode]);

  const backToPatient = () => setVisibleBox('VerifyCount');
  const backToCriteria = () => setVisibleBox('CriteriaSearch');

  const highlight = (text, term) => {
    if (!text || !term) return text || "—";
    const i = text.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark>{text.slice(i, i + term.length)}</mark>
        {text.slice(i + term.length)}
      </>
    );
  };

  const calculateAge = (dob) => {
    if (!dob) return "—";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : "—";
  }

  const editClient = (activeClient) => {
          setActivePatient(activeClient);
          setClientBox(true);
          setVisibleBox('ClientDetails');
     };

  return (
    <div className="container-fluid d-flex flex-column" style={{ height: "100vh" }}>
      {/* Top bar */}
      <div className="d-flex align-items-center justify-content-between py-2">
        <h5 className="m-0">{title}</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={backToPatient}>
            Patient Search
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={backToCriteria}>
            Criteria Search
          </button>
        </div>
      </div>

      {/* Parameters summary */}
      {/* <div className="small text-muted mb-2">
        <strong>Parameters:</strong>{" "}
        {mode === "identity" && <code>query: "{query}"</code>}
        {mode === "notes" && <code>noteQuery: "{noteQuery}"</code>}
        {mode === "provider" && (
          <code>
            provider: "{providerQuery}"{" "}
            {appointmentDate && <> • date: "{appointmentDate}"</>}
          </code>
        )}
      </div> */}

      {/* Scrollable results list only */}
      <div
        className="border rounded bg-white p-2 overflow-auto"
        style={{ flexGrow: 1, minHeight: 0 }}
      >
        {!results || results.length === 0 ? (
          <div className="text-muted">No results.</div>
        ) : (
          results.map((p) => (
            <div
              key={p.id || p.healthNumber || `${p.clientName}-${p.dateOfBirth}`}
              className="border-bottom py-2 d-flex align-items-center fs-7"
            >
              <div className="col-12 fw-bold">
                {mode === "identity" ? highlight(p.clientName || "", query) : p.clientName || "—"}
              </div>
              <div className="col-5">
                {mode === "identity" ? highlight(p.healthNumber || "", query) : p.healthNumber || "—"}
              </div>
              {/* <div className="col-6">{p.city || "—"}</div> */}
              <div className="col-3">{calculateAge(p.dateOfBirth)}</div>
              <div className="col-4">{p.nextAppointment || "—"}</div>
              <div className="flex-grow-1">{p.privateNote || "—"}</div>

              <div className="ms-auto flex-grow-1 d-flex justify-content-end">
                <button
                  className="btn btn-sm btn-info"
                  style={{ width: 100, marginLeft: 8 }}
                  onClick={() => editClient(p)}
                >
                  Select
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ResultsPage;
