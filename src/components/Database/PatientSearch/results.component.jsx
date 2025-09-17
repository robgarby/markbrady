// src/components/.../results.component.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../../Context/global.context";

/**
 * This version reads ONLY from the patientSearch context.
 * The results list is scrollable, while header stays fixed.
 * Shows real name when not in private mode; shows "Patient ####" when private.
 */
const ResultsPage = () => {
  const navigate = useNavigate();
  const {
    patientSearch,
    setVisibleBox,
    setActivePatient,
    setClientBox,
    privateMode, // 👈 read private mode from context
  } = useGlobalContext();

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

  // Masked demo label: "Patient ####" using first 4 digits of healthNumber
  const demoPatientLabel = (healthNumber) => {
    const digits = String(healthNumber || "").replace(/\D/g, "");
    const first4 = digits.slice(0, 4) || "XXXX";
    return `Patient ${first4}`;
  };

  // Compute a readable real name from record
  const realPatientName = (p) => {
    const raw =
      p?.clientName ||
      p?.name ||
      (p?.firstName && p?.lastName ? `${p.firstName} ${p.lastName}` : p?.lastFirstName || "");
    if (!raw) return "—";
    const s = String(raw).trim();
    if (s.includes(",")) {
      const [last = "", first = ""] = s.split(",");
      return `${first.trim()} ${last.trim()}`.trim();
    }
    return s;
  };

  const backToPatient = () => setVisibleBox("VerifyCount");
  const backToCriteria = () => setVisibleBox("CriteriaSearch");

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
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 ? age : "—";
  };

  // results.component.jsx
  const editClient = async (activeClient) => {
    try {
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        cache: "no-store",
        body: JSON.stringify({
          script: "getPatientById",
          patientID: Number(activeClient.id), // must be an integer per your PHP
        }),
      });

      // Be resilient to non-JSON responses
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }

      const full = res.ok && data?.success && data?.patient ? data.patient : activeClient;

      // Update context so displayPatient and PatientConditionDisplay react immediately
      setActivePatient(full);
    } catch (err) {
      // Network or parsing error – open with the row we already have
      setActivePatient(activeClient);
    } finally {
      setClientBox(true);
      setVisibleBox("ClientDetails");
    }
  };

  const isPrivate = Boolean(privateMode);

  return (
    <div className="container-fluid d-flex flex-column" style={{ height: "100vh" }}>
      {/* Top bar */}
      <div className="d-flex align-items-center justify-content-between py-2">
        <h5 className="m-0">
          {title} <span className="text-muted px-2 fs-7">[{results.length}] Records</span>
        </h5>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={backToPatient}>
            Patient Search
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={backToCriteria}>
            Criteria Search
          </button>
        </div>
      </div>

      {/* Scrollable results list only */}
      <div className="border rounded bg-white p-2 overflow-auto" style={{ flexGrow: 1, minHeight: 0 }}>
        {!results || results.length === 0 ? (
          <div className="text-muted">No results.</div>
        ) : (
          results.map((p) => (
            <div
              key={p.id || p.healthNumber || `${p.clientName}-${p.dateOfBirth}`}
              className="border-bottom py-2 d-flex align-items-center fs-7"
            >
              <div className="col-12 fw-bold">
                {/* 👇 Name obeys privateMode */}
                {isPrivate ? demoPatientLabel(p.healthNumber) : realPatientName(p)}
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
