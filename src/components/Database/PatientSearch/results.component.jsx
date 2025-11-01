// src/components/.../results.component.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../../Context/global.context";
import { getUserFromToken } from '../../../Context/functions';

const ResultsPage = () => {
  const navigate = useNavigate();

  const [user, setUser] = React.useState(null);
  const [hoveredKey, setHoveredKey] = useState(null);


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
  const {
    patientSearch,
    setVisibleBox,
    setActivePatient,
    setClientBox,
    privateMode,
  } = useGlobalContext();

  const {
    mode = "",
    query = "",
    noteQuery = "",
    providerQuery = "",
    appointmentDate = "",
    results = [],
    didSearch = false,
  } = patientSearch || {};

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
    const first4 = digits.slice(0, 4) || "XXX";
    return `Patient ${first4}`;
  };

  // 🔒 Mask the HCN if private: replace the 4 middle digits with XXXX (keep first 3 and last 3)
  const maskHealthNumber = (hcn, doMask) => {
    const digits = String(hcn || "").replace(/\D/g, "");
    if (!doMask) return hcn || "—";
    if (digits.length < 10) return hcn || "—";
    const first3 = digits.slice(0, 3);
    const last3 = digits.slice(7, 10); // indices 3..6 replaced by XXXX
    return `${first3} XXX ${last3}`;
  };

  // Compute a readable real name from record
  const realPatientName = (p) => {
    const raw =
      (p && p.clientName) ||
      (p && p.name) ||
      ((p && p.firstName) && (p && p.lastName) ? `${p.firstName} ${p.lastName}` : (p && p.lastFirstName) || "");
    if (!raw) return "—";
    const s = String(raw).trim();
    if (s.includes(",")) {
      const parts = s.split(",");
      const last = (parts[0] || "").trim();
      const first = (parts[1] || "").trim();
      return `${first} ${last}`.trim();
    }
    return s;
  };

  const backToPatient = () => setVisibleBox("VerifyCount");
  const backToCriteria = () => setVisibleBox("CriteriaSearch");

  const highlight = (text, term) => {
    if (!text || !term) return text || "—";
    const i = String(text).toLowerCase().indexOf(String(term).toLowerCase());
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
    if (isNaN(birthDate.getTime())) return "—";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 ? age : "—";
  };

  const editClient = async (activeClient) => {
    try {
      const res = await fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        cache: "no-store",
        body: JSON.stringify({
          script: "getPatientById",
          patientID: Number(activeClient.id),
          patientDB: user?.patientTable || "Patient", historyDB: user?.historyTable || "Patient_History"
        }),
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = {};
      }
      const full = data.patient;
      setActivePatient(full);
    } catch (err) {
      setActivePatient([]);
    } finally {
      setClientBox(true);
      setVisibleBox(null);
    }
  };

  const isPrivate = Boolean(privateMode);

  const copyToClipboard = async (value) => {
    const text = String(value || "").replace(/\s+/g, ""); // strip spaces
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  // --- minimal UI feedback state for "Copied" ---
  const [copiedKey, setCopiedKey] = useState(null);
  const copyTimerRef = useRef(null);

  const handleCopyClick = (rowKey, value) => {
    // Flip UI immediately, then copy, then auto-revert
    setCopiedKey(rowKey);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyToClipboard(value).finally(() => {
      copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1200);
    });
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  return (
    <div className="container-fluid d-flex flex-column" style={{ height: "100vh" }}>
      {/* Top bar */}
      <div className="d-flex align-items-center justify-content-between py-2">
        <h5 className="m-0">
          {title} <span className="text-muted px-2 fs-7">[{(results || []).length}] Records</span>
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
          results.map((p) => {
            // 🔒 Make rowKey a stable STRING to avoid type mismatches
            const rowKey = String(
              (p && (p.id ?? p.healthNumber)) ??
              `${(p && p.clientName) || "Unknown"}-${(p && p.dateOfBirth) || "Unknown"}`
            );

            const hcn = (p && p.healthNumber) || "";
            const maskedHcn = maskHealthNumber(hcn, isPrivate);
            const canCopy = !!hcn && hcn !== "-";
            const isCopied = copiedKey === rowKey;

            return (
              <div
                key={rowKey}
                className="border-bottom py-2 d-flex align-items-center fs-7 results-row"
                onMouseEnter={() => setHoveredKey(rowKey)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  backgroundColor: hoveredKey === rowKey ? "#dfe9f0ff" : undefined,
                  transition: "background-color 120ms ease",
                  cursor: "pointer",
                }}
              >
                <div className="col-12 fw-bold" onClick={() => editClient(p)}>
                  {/* 👇 Name obeys privateMode */}
                  {isPrivate ? demoPatientLabel(p.healthNumber) : realPatientName(p)}
                </div>

                <div className="col-5 d-flex align-items-center">
                  <button
                    type="button"
                    className={`btn btn-sm col-40 ${isCopied ? "btn-success text-white" : "btn-outline-warning"}`}
                    disabled={!canCopy}
                    onClick={() => canCopy && handleCopyClick(rowKey, hcn)}
                    aria-label="Copy health number"
                    title={canCopy ? "Copy health number" : "No health number to copy"}
                  >
                    {/* 👇 Display masked number in private mode (and highlight if needed) */}
                    {isCopied
                      ? "Copied"
                      : mode === "identity"
                        ? highlight(maskedHcn || "—", query)
                        : (maskedHcn || "—")}
                  </button>
                </div>

                <div className="col-3" onClick={() => editClient(p)} >{calculateAge(p.dateOfBirth)}</div>
                <div className="col-4" onClick={() => editClient(p)}>
                  {(p.nextAppointment === "0000-00-00" || !p.nextAppointment) ? "—" : p.nextAppointment}
                </div>
                <div className="col-6" onClick={() => editClient(p)}>{p.recommendedMed}</div>
                <div className="flex-grow-1" onClick={() => editClient(p)}>{p.privateNote || "—"}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ResultsPage;
