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
        navigate('/signin');
        return;
      }
    });
  }, [navigate]);

  const {
    patientSearch,
    setVisibleBox,
    setActivePatient,
    setClientBox,
    privateMode,
    medsArray,
  } = useGlobalContext();

  const {
    mode = "",
    query = "",
    results = [],
  } = patientSearch || {};

  const [sortConfig, setSortConfig] = useState({
    key: "totalPoints",
    direction: "desc",
  });

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

  const demoPatientLabel = (healthNumber) => {
    const digits = String(healthNumber || "").replace(/\D/g, "");
    const first4 = digits.slice(0, 4) || "XXX";
    return `Patient ${first4}`;
  };

  const maskHealthNumber = (hcn, doMask) => {
    const digits = String(hcn || "").replace(/\D/g, "");
    if (!doMask) return hcn || "—";
    if (digits.length < 10) return hcn || "—";
    const first3 = digits.slice(0, 3);
    const last3 = digits.slice(7, 10);
    return `${first3} XXX ${last3}`;
  };

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
          patientDB: user?.patientTable || "Patient",
          historyDB: user?.historyTable || "Patient_History"
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
    const text = String(value || "").replace(/\s+/g, "");
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const [copiedKey, setCopiedKey] = useState(null);
  const copyTimerRef = useRef(null);

  const handleCopyClick = (rowKey, value) => {
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

  const splitCsv = (csv) =>
    String(csv || "")
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const normMed = (s) => String(s || "").trim().toLowerCase();

  const medNameSet = useMemo(() => {
    const set = new Set();
    const list = Array.isArray(medsArray) ? medsArray : [];
    for (const m of list) {
      const n = m?.medication_name ?? m?.medication ?? m?.name ?? m?.label ?? "";
      const key = normMed(n);
      if (key) set.add(key);
    }
    return set;
  }, [medsArray]);

  const requestSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key,
        direction: key === "totalPoints" ? "desc" : "asc",
      };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  const sortedResults = useMemo(() => {
    const list = Array.isArray(results) ? [...results] : [];

    const getRecommendedMedText = (p) =>
      splitCsv(p?.recommendedMed).join(", ").toLowerCase();

    list.sort((a, b) => {
      let aVal;
      let bVal;

      switch (sortConfig.key) {
        case "name":
          aVal = realPatientName(a).toLowerCase();
          bVal = realPatientName(b).toLowerCase();
          break;
        case "healthNumber":
          aVal = String(a?.healthNumber ?? "").replace(/\D/g, "");
          bVal = String(b?.healthNumber ?? "").replace(/\D/g, "");
          break;
        case "age":
          aVal = Number(calculateAge(a?.dateOfBirth)) || -1;
          bVal = Number(calculateAge(b?.dateOfBirth)) || -1;
          break;
        case "totalPoints":
          aVal = Number(a?.totalPoints ?? -1);
          bVal = Number(b?.totalPoints ?? -1);
          break;
        case "labCount":
          aVal = Number(a?.labCount ?? -1);
          bVal = Number(b?.labCount ?? -1);
          break;
        case "hospital":
          aVal = String(a?.HospitalLoaded ?? "").toLowerCase() === "yes" ? 1 : 0;
          bVal = String(b?.HospitalLoaded ?? "").toLowerCase() === "yes" ? 1 : 0;
          break;
        case "recommendedMed":
          aVal = getRecommendedMedText(a);
          bVal = getRecommendedMedText(b);
          break;
        case "privateNote":
          aVal = String(a?.privateNote ?? "").toLowerCase();
          bVal = String(b?.privateNote ?? "").toLowerCase();
          break;
        default:
          aVal = Number(a?.totalPoints ?? -1);
          bVal = Number(b?.totalPoints ?? -1);
          break;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [results, sortConfig, medsArray]);

  const SortHeader = ({ label, sortKey, className = "" }) => (
    <div
      className={`${className} fw-bold`}
      onClick={() => requestSort(sortKey)}
      style={{ cursor: "pointer", userSelect: "none" }}
      title={`Sort by ${label}`}
    >
      {label}{getSortIndicator(sortKey)}
    </div>
  );

  return (
    <div className="container-fluid d-flex flex-column" style={{ height: "calc(100vh - 60px)", maxHeight: "calc(100vh - 60px)", marginLeft: "10px" }}>
      <div className="d-flex align-items-center justify-content-between py-2">
        <h5 className="m-0">
          {title} <span className="text-muted px-2 fs-7">[{(sortedResults || []).length}] Records</span>
        </h5>
      </div>

      <div className="border rounded bg-white p-2" style={{ flexGrow: 1, minHeight: 0, overflowY: "scroll" }}>
        {!sortedResults || sortedResults.length === 0 ? (
          <div className="text-muted">No results.</div>
        ) : (
          <>
            <div className="border-bottom py-2 d-flex align-items-center fs-7 bg-light sticky-top">
              <SortHeader label="Name" sortKey="name" className="col-10" />
              <SortHeader label="Hospital" sortKey="hospital" className="col-3 text-center" />
              <SortHeader label="HCN" sortKey="healthNumber" className="col-4" />
              <SortHeader label="Age" sortKey="age" className="col-2 text-center" />
              <SortHeader label="Pts" sortKey="totalPoints" className="col-2" />
              <SortHeader label="Labs" sortKey="labCount" className="col-2" />
              <SortHeader label="Recommended" sortKey="recommendedMed" className="col-4" />
              <SortHeader label="Private Note" sortKey="privateNote" className="col-20" />
            </div>

            {sortedResults.map((p) => {
              const rowKey = String(
                (p && (p.id ?? p.healthNumber)) ??
                `${(p && p.clientName) || "Unknown"}-${(p && p.dateOfBirth) || "Unknown"}`
              );

              const hcn = (p && p.healthNumber) || "";
              const maskedHcn = maskHealthNumber(hcn, isPrivate);
              const canCopy = !!hcn && hcn !== "-";
              const isCopied = copiedKey === rowKey;

              const medItems = splitCsv(p?.recommendedMed);
              const renderedMeds =
                medItems.length === 0 ? (
                  "—"
                ) : (
                  medItems.map((m, i) => {
                    const matched = medNameSet.has(normMed(m));
                    return (
                      <span
                        key={`${rowKey}-med-${i}`}
                        className={matched ? "fw-bold text-success" : undefined}
                      >
                        {m}
                        {i < medItems.length - 1 ? ", " : ""}
                      </span>
                    );
                  })
                );

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
                  <div className="col-10 fw-bold" onClick={() => editClient(p)}>
                    {isPrivate ? demoPatientLabel(p.healthNumber) : realPatientName(p)}
                  </div>

                  <div className="col-3 text-center" onClick={() => editClient(p)}>
                    {String(p?.HospitalLoaded || "").toLowerCase() === "yes" ? (
                      <span className="text-success fw-bold">Yes</span>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="col-4 d-flex align-items-center">
                    <button
                      type="button"
                      className={`btn btn-sm px-2 ${isCopied ? "btn-success text-white" : "btn-outline-warning"}`}
                      style={{ width: "90%" }}
                      disabled={!canCopy}
                      onClick={() => canCopy && handleCopyClick(rowKey, hcn)}
                      aria-label="Copy health number"
                      title={canCopy ? "Copy health number" : "No health number to copy"}
                    >
                      {isCopied
                        ? "Copied"
                        : mode === "identity"
                          ? highlight(maskedHcn || "—", query)
                          : (maskedHcn || "—")}
                    </button>
                  </div>

                  <div className="col-2 text-center" onClick={() => editClient(p)}>{calculateAge(p.dateOfBirth)}</div>

                  <div className="col-2" onClick={() => editClient(p)}>
                    {p.totalPoints != null ? (
                      <span className="text-dark">{p.totalPoints} pts</span>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="col-2" onClick={() => editClient(p)}>
                    {p.labCount != null ? (
                      <span className="text-dark">{p.labCount} Labs</span>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="col-4" onClick={() => editClient(p)}>{renderedMeds}</div>

                  <div className="col-20" onClick={() => editClient(p)}>{p.privateNote || "—"}</div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default ResultsPage;