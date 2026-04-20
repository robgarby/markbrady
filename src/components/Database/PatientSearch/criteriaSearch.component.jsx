// src/components/Labs/criteriaSearch.component.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";
import { getUserFromToken } from "../../../Context/functions";
import { useNavigate } from "react-router-dom";

// ───────────────────────── constants / helpers ─────────────────────────
const LAB_FIELDS = [
  ["cholesterol", "Cholesterol"],
  ["triglyceride", "Triglyceride"],
  ["hdl", "HDL"],
  ["ldl", "LDL"],
  ["nonHdl", "Non-HDL"],
  ["cholesterolHdlRatio", "Chol/HDL Ratio"],
  ["creatineKinase", "Creatine Kinase"],
  ["alanineAminotransferase", "ALT"],
  ["lipoproteinA", "Lipoprotein(a)"],
  ["apolipoproteinB", "Apolipoprotein B"],
  ["natriureticPeptideB", "BNP"],
  ["urea", "Urea"],
  ["creatinine", "Creatinine"],
  ["gfr", "GFR"],
  ["albumin", "Albumin"],
  ["sodium", "Sodium"],
  ["potassium", "Potassium"],
  ["vitaminB12", "Vitamin B12"],
  ["ferritin", "Ferritin"],
  ["hemoglobinA1C", "Hemoglobin A1C"],
  ["urineAlbumin", "Urine Albumin"],
  ["albuminCreatinineRatio", "Alb/Cr Ratio"],
];

const CAT_ENDPOINT = "https://gdmt.ca/PHP/special.php";
const LAB_ENDPOINT = "https://www.gdmt.ca/PHP/labData.php";
const GET_SCRIPT = "getMedsCategory";

const LS_KEYS = {
  conds: "criteria.conditions",
  labs: "criteria.labs",
  medCats: "criteria.medCats",
  nonMedCats: "criteria.nonMedCats",
  minPoints: "criteria.minPoints",
  maxPoints: "criteria.maxPoints",
  minLabs: "criteria.minLabs",
  maxLabs: "criteria.maxLabs",
  providerId: "criteria.providerId",
  privateNoteSearch: "criteria.privateNoteSearch",
  hospitalSearch: "criteria.hospitalSearch",
};

const cleanNum = (v) => {
  const s = (v ?? "").toString().replace(/[^\d.]/g, "");
  const parts = s.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : s;
};

const readJSON = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const readText = (k, fallback = "") => {
  try {
    const raw = localStorage.getItem(k);
    return raw ?? fallback;
  } catch {
    return fallback;
  }
};

const getProviderLabel = (p) => {
  const name = String(p?.pharmacyName ?? p?.providerName ?? p?.name ?? "").trim();
  const loc = String(p?.pharmacyLocation ?? p?.location ?? "").trim();
  const phone = String(p?.pharmacyPhone ?? p?.phone ?? "").trim();
  return [name, loc, phone].filter(Boolean).join(" — ");
};

// ───────────────────────── component ─────────────────────────
const CriteriaSearch = ({ onResults }) => {
  const {
    patientSearch,
    updatePatientSearch,
    setVisibleBox,
    conditionData,
    updateConditions,
    updateConditionData,
    medsCategory,
    updateMedsCategory,
    setPatientArray,
  } = useGlobalContext();

  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getUserFromToken();
      return userData;
    };

    fetchUser().then((userT) => {
      if (userT) setUser(userT);
      if (!userT) navigate("/signin");
    });
  }, [navigate]);

  // ─────────────── PERSISTED UI STATE ───────────────
  const [minPoints, setMinPoints] = useState(() => readText(LS_KEYS.minPoints, ""));
  const [maxPoints, setMaxPoints] = useState(() => readText(LS_KEYS.maxPoints, ""));
  const [minLabs, setMinLabs] = useState(() => readText(LS_KEYS.minLabs, ""));
  const [maxLabs, setMaxLabs] = useState(() => readText(LS_KEYS.maxLabs, ""));
  const [privateNoteSearch, setPrivateNoteSearch] = useState(() =>
    readText(LS_KEYS.privateNoteSearch, "")
  );
  const [hospitalSearch, setHospitalSearch] = useState(() =>
    readText(LS_KEYS.hospitalSearch, "")
  );

  // CONDITIONS
  const [condSelect, setCondSelect] = useState("");
  const [conditionSearchArray, setConditionSearchArray] = useState(() =>
    readJSON(LS_KEYS.conds, [])
  );
  const [condLoading, setCondLoading] = useState(false);
  const [condErr, setCondErr] = useState("");

  // LABS
  const [labSelect, setLabSelect] = useState("");
  const [labs, setLabs] = useState(() => readJSON(LS_KEYS.labs, []));
  const [labErr, setLabErr] = useState("");
  const [labLoading, setLabLoading] = useState(false);

  // MED CATS
  const [medSelect, setMedSelect] = useState("");
  const [medErr, setMedErr] = useState("");
  const [medLoading, setMedLoading] = useState(false);
  const [catSearchArray, setCatSearchArray] = useState(() =>
    readJSON(LS_KEYS.medCats, [])
  );

  // NOT-ON MED CATS
  const [nonMedSelect, setNonMedSelect] = useState("");
  const [nonMedCatSearchArray, setNonMedCatSearchArray] = useState(() =>
    readJSON(LS_KEYS.nonMedCats, [])
  );
  const [nonMedErr, setNonMedErr] = useState("");
  const [nonMedLoading, setNonMedLoading] = useState(false);

  // PROVIDERS
  const [providerData, setProviderData] = useState(null);
  const providerOptions = Array.isArray(providerData)
    ? providerData
    : providerData
      ? [providerData]
      : [];

  // Hydration guard
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Provider ID
  const [providerId, setProviderID] = useState(() => {
    const raw = readText(LS_KEYS.providerId, "");
    return raw || null;
  });

  // Persist
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_KEYS.conds, JSON.stringify(conditionSearchArray));
  }, [conditionSearchArray, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_KEYS.labs, JSON.stringify(labs));
  }, [labs, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_KEYS.medCats, JSON.stringify(catSearchArray));
  }, [catSearchArray, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_KEYS.nonMedCats, JSON.stringify(nonMedCatSearchArray));
  }, [nonMedCatSearchArray, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (minPoints) localStorage.setItem(LS_KEYS.minPoints, minPoints);
    else localStorage.removeItem(LS_KEYS.minPoints);
  }, [minPoints, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (maxPoints) localStorage.setItem(LS_KEYS.maxPoints, maxPoints);
    else localStorage.removeItem(LS_KEYS.maxPoints);
  }, [maxPoints, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (minLabs) localStorage.setItem(LS_KEYS.minLabs, minLabs);
    else localStorage.removeItem(LS_KEYS.minLabs);
  }, [minLabs, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (maxLabs) localStorage.setItem(LS_KEYS.maxLabs, maxLabs);
    else localStorage.removeItem(LS_KEYS.maxLabs);
  }, [maxLabs, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (providerId) localStorage.setItem(LS_KEYS.providerId, providerId);
    else localStorage.removeItem(LS_KEYS.providerId);
  }, [providerId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (privateNoteSearch) {
      localStorage.setItem(LS_KEYS.privateNoteSearch, privateNoteSearch);
    } else {
      localStorage.removeItem(LS_KEYS.privateNoteSearch);
    }
  }, [privateNoteSearch, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (hospitalSearch) {
      localStorage.setItem(LS_KEYS.hospitalSearch, hospitalSearch);
    } else {
      localStorage.removeItem(LS_KEYS.hospitalSearch);
    }
  }, [hospitalSearch, hydrated]);

  // Load providers same as Pharmacy Multiple
  useEffect(() => {
    let mounted = true;

    const fetchProviders = async () => {
      try {
        const res = await fetch(LAB_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scriptName: "getProvider" }),
        });

        const json = await res.json();
        if (!mounted) return;

        if (json?.success) {
          setProviderData(json.provider ?? json.providers ?? null);
        } else {
          setProviderData(null);
        }
      } catch (err) {
        console.error("getProvider failed:", err);
        if (mounted) setProviderData(null);
      }
    };

    fetchProviders();

    return () => {
      mounted = false;
    };
  }, []);

  // Load meds categories
  useEffect(() => {
    if (!Array.isArray(medsCategory) || medsCategory.length === 0) {
      (async () => {
        try {
          const res = await fetch(CAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script: GET_SCRIPT }),
          });
          const text = await res.text();
          let data = null;
          try {
            data = JSON.parse(text);
          } catch { }
          if (typeof updateMedsCategory === "function") updateMedsCategory(data);
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [medsCategory, updateMedsCategory]);

  // Load condition master
  useEffect(() => {
    const needsLoad = !Array.isArray(conditionData) || conditionData.length === 0;
    const setConditions =
      typeof updateConditions === "function"
        ? updateConditions
        : typeof updateConditionData === "function"
          ? updateConditionData
          : null;

    if (!needsLoad || !setConditions) return;

    fetch("https://gdmt.ca/PHP/noDB.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "getConditionData" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.conditions)) setConditions(data.conditions);
        else if (Array.isArray(data)) setConditions(data);
      })
      .catch(() => { });
  }, [conditionData, updateConditions, updateConditionData]);

  const allConditions = useMemo(() => {
    if (Array.isArray(conditionData)) return conditionData;
    if (conditionData && typeof conditionData === "object") return Object.values(conditionData);
    return [];
  }, [conditionData]);

  const normalizedConditions = useMemo(
    () =>
      allConditions
        .map((c) => {
          const code = String(c?.conditionCode ?? c?.code ?? "").trim().toUpperCase();
          const label = String(c?.conditionName ?? c?.name ?? "").trim();
          const id = String(c?.ID ?? c?.id ?? c?.conditionID ?? "");
          const value = code || label;
          return { value, code, label, id };
        })
        .filter((c) => c.value),
    [allConditions]
  );

  const displayConds = useMemo(
    () =>
      (Array.isArray(conditionSearchArray) ? conditionSearchArray : []).map((c) => ({
        id: String(c?.ID ?? ""),
        name: String(c?.condition_name ?? ""),
        code: String(c?.condition_code ?? "").toUpperCase(),
      })),
    [conditionSearchArray]
  );

  const filteredMedsCategory = useMemo(() => {
    if (!Array.isArray(medsCategory)) return [];

    return medsCategory.filter((m) => {
      const label = String(m?.catName ?? "").trim().toLowerCase();
      return label !== "" && label !== "not used" && label !== "- not used -";
    });
  }, [medsCategory]);

  // Condition handlers
  const addCondition = (val) => {
    const selectedVal = (typeof val === "string" ? val : "") || condSelect;
    if (!selectedVal) return;

    const chosen =
      normalizedConditions.find((c) => c.value === selectedVal) || {
        value: selectedVal,
        code: selectedVal.toUpperCase(),
        label: selectedVal,
        id: "",
      };

    const exists = displayConds.some((c) =>
      chosen.code ? c.code === chosen.code : c.name === chosen.label
    );
    if (exists) return;

    setConditionSearchArray((prev) => [
      ...prev,
      {
        ID: String(chosen.id || ""),
        condition_name: chosen.label,
        condition_code: chosen.code || "",
      },
    ]);
    setCondSelect("");
  };

  const removeCondition = (idx) => {
    setConditionSearchArray((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearConditions = () => {
    setCondSelect("");
    setConditionSearchArray([]);
    setCondErr("");
  };

  // Labs
  const addLab = (field) => {
    const key = String(field || "");
    if (!key || labs.some((r) => r.field === key)) return;
    setLabs((prev) => [...prev, { field: key, gt: "", lt: "" }]);
  };

  const updateLabBound = (idx, bound, val) => {
    setLabs((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [bound]: cleanNum(val) } : r))
    );
  };

  const removeLab = (idx) => setLabs((prev) => prev.filter((_, i) => i !== idx));

  const clearLabs = () => {
    setLabSelect("");
    setLabs([]);
    setLabErr("");
  };

  // Med Category (ON)
  const addMed = (val) => {
    const selectedMed = Array.isArray(filteredMedsCategory)
      ? filteredMedsCategory.find((m) => String(m.ID ?? m.id ?? "") === String(val))
      : null;

    if (!selectedMed) return;

    const id = String(selectedMed.ID ?? selectedMed.id ?? "");
    const exists = catSearchArray.some((c) => String(c.ID) === id);

    if (!exists) {
      setCatSearchArray((prev) => [
        ...prev,
        { ID: id, catName: selectedMed.catName },
      ]);
    }
    setMedSelect("");
  };

  const removeMed = (idx) => {
    setCatSearchArray((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearMeds = () => {
    setCatSearchArray([]);
    setMedSelect("");
    setMedErr("");
  };

  // Not-on Med Category (OFF)
  const addNonMed = (val) => {
    const selected = Array.isArray(filteredMedsCategory)
      ? filteredMedsCategory.find((m) => String(m.ID ?? m.id ?? "") === String(val))
      : null;

    if (!selected) return;

    const id = String(selected.ID ?? selected.id ?? "");
    if (nonMedCatSearchArray.some((c) => String(c.ID) === id)) return;

    setNonMedCatSearchArray((prev) => [
      ...prev,
      { ID: id, catName: selected.catName },
    ]);
    setNonMedSelect("");
  };

  const removeNonMed = (idx) => {
    setNonMedCatSearchArray((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearNonMeds = () => {
    setNonMedCatSearchArray([]);
    setNonMedSelect("");
    setNonMedErr("");
  };

  // ─────────────── SUPER SEARCH ───────────────
  const [superLoading, setSuperLoading] = useState(false);

  const handleSuperSearch = async () => {
    setPatientArray([]);

    const conditionCodes = displayConds.map((x) => x.code).filter(Boolean);
    const labsPayload = labs.map((r) => ({
      field: r.field,
      gt: String(r.gt ?? "").trim(),
      lt: String(r.lt ?? "").trim(),
    }));

    const medCategoryIds = catSearchArray.map((m) => m.ID);
    const nonMedCategoryIds = nonMedCatSearchArray.map((m) => m.ID);

    const payload = {
      script: "superSearch",
      labs: labsPayload,
      conditionCodes,
      minPoints: String(minPoints || "").trim(),
      maxPoints: String(maxPoints || "").trim(),
      minLabs: String(minLabs || "").trim(),
      maxLabs: String(maxLabs || "").trim(),
      privateNoteSearch: String(privateNoteSearch || "").trim(),
      hospitalSearch: String(hospitalSearch || "").trim(),
      medCategoryIds,
      providerId,
      nonMedCategoryIds,
      patientDB: user?.patientTable || "Patient",
      historyDB: user?.historyTable || "Patient_History",
    };

    console.log("SUPER SEARCH PAYLOAD:", payload);
    console.log("SUPER SEARCH PAYLOAD JSON:", JSON.stringify(payload, null, 2));

    setSuperLoading(true);
    try {
      const res = await fetch("https://gdmt.ca/PHP/supersearch.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      console.log("SUPER SEARCH RAW RESPONSE:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }

      console.log("SUPER SEARCH PARSED RESPONSE:", data);

      onResults?.(data);
      setPatientArray?.(Array.isArray(data) ? data : []);
      updatePatientSearch?.({
        ...(patientSearch || {}),
        didSearch: true,
        mode: "super",
        results: Array.isArray(data) ? data : [],
      });
      setVisibleBox?.("results");
    } catch (e) {
      console.error("Super Search failed:", e);
      updatePatientSearch?.({
        ...(patientSearch || {}),
        didSearch: true,
        mode: "super",
        results: [],
      });
      setVisibleBox?.("results");
    } finally {
      setSuperLoading(false);
    }
  };

  const clearAll = () => {
    clearConditions();
    clearLabs();
    clearMeds();
    clearNonMeds();
    setMinPoints("");
    setMaxPoints("");
    setMinLabs("");
    setMaxLabs("");
    setPrivateNoteSearch("");
    setHospitalSearch("");
    setProviderID(null);
  };

  return (
    <div className="p-2">
      <div className="col-48">
        <div className="d-flex align-items-center justify-content-between">
          <h5 className="m-0">Super Search</h5>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-danger btn-sm" onClick={clearAll}>
              Clear All
            </button>
            <button
              className="btn btn-success btn-sm text-white"
              onClick={handleSuperSearch}
              disabled={false}
              title="Runs one query using all selected criteria"
            >
              {superLoading ? "Super Searching…" : "Run Super Search"}
            </button>
          </div>
        </div>
      </div>

      <div className="col-48 border rounded p-3 mt-3">
        <div className="row g-2 mb-3">
          <div className="col-12">
            <div className="alert alert-secondary mb-0 p-2 h-100">
              <div className="row g-2 align-items-end">
                <div className="col-48">
                  <div className="fw-semibold small">Points (Min Points gets everyone Higher)</div>
                </div>

                <div className="col-24">
                  <label htmlFor="minPoints" className="mb-1">Min. Points:</label>
                  <input
                    type="text"
                    id="minPoints"
                    className="form-control form-control-sm"
                    value={minPoints}
                    onChange={(e) => setMinPoints(cleanNum(e.target.value))}
                  />
                </div>

                <div className="col-24">
                  <label htmlFor="maxPoints" className="mb-1">Max. Points:</label>
                  <input
                    type="text"
                    id="maxPoints"
                    className="form-control form-control-sm"
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(cleanNum(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="alert alert-secondary mb-0 p-2 h-100">
              <div className="row g-2 align-items-end">
                <div className="col-48">
                  <div className="fw-semibold small">Labs (Max Labs 0: Returns Those with 0)</div>
                </div>

                <div className="col-24">
                  <label htmlFor="minLabs" className="mb-1">Min. Labs</label>
                  <input
                    type="text"
                    id="minLabs"
                    className="form-control form-control-sm"
                    value={minLabs}
                    onChange={(e) => setMinLabs(cleanNum(e.target.value))}
                  />
                </div>

                <div className="col-24">
                  <label htmlFor="maxLabs" className="mb-1">Max. Labs:</label>
                  <input
                    type="text"
                    id="maxLabs"
                    className="form-control form-control-sm"
                    value={maxLabs}
                    onChange={(e) => setMaxLabs(cleanNum(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="alert alert-secondary mb-0 p-2 h-100">
              <div className="row g-2 align-items-end">
                <div className="col-48">
                  <div className="fw-semibold small">Location (What Location for Patient)</div>
                </div>

                <div className="col-48">
                  <label htmlFor="providerId" className="mb-1">Provider:</label>
                  <select
                    id="providerId"
                    className={`form-select form-select-sm ${providerId !== null ? "alert-success" : ""}`}
                    value={providerId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setProviderID(val);
                    }}
                  >
                    <option value="">
                      {providerOptions.length === 0 ? "Loading providers..." : "Select Provider"}
                    </option>
                    {providerOptions.map((p, idx) => {
                      const id = String(p?.ID ?? p?.id ?? `provider_${idx}`);
                      const label = getProviderLabel(p) || id;
                      return (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="alert alert-secondary mb-0 p-2 h-100">
              <div className="row g-2 align-items-end">
                <div className="col-48">
                  <div className="fw-semibold small">Hospital Report Search</div>
                </div>

                <div className="col-48">
                  <label htmlFor="hospitalSearch" className="mb-1">Has Hospital Lab:</label>
                  <select
                    id="hospitalSearch"
                    className={`form-select form-select-sm ${
                      hospitalSearch ? "alert-success" : ""
                    }`}
                    value={hospitalSearch}
                    onChange={(e) => setHospitalSearch(e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-2 mb-3 alert-secondary">
          <div className="col-24 mb-3">
            <label htmlFor="privateNoteSearch" className="mb-1">
              Private Note Search (Enter Words, not Sentence)
            </label>
            <input
              type="text"
              id="privateNoteSearch"
              className="form-control form-control-sm"
              value={privateNoteSearch}
              onChange={(e) => setPrivateNoteSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="row g-1">
          <div className="col-11 p-0">
            <div className="d-flex align-items-center justify-content-between mb-2 ps-3 pe-2">
              <h6 className="m-0">Conditions</h6>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={clearConditions}
                disabled={condLoading}
              >
                Clear
              </button>
            </div>

            {condErr && <div className="alert alert-danger py-1">{condErr}</div>}

            <div className="p-2">
              <select
                className="form-select form-select-sm mb-2"
                value={condSelect}
                onChange={(e) => addCondition(e.target.value)}
              >
                <option value="">— Choose a condition —</option>
                {normalizedConditions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                    {c.code ? ` (${c.code})` : ""}
                  </option>
                ))}
              </select>

              {displayConds.length === 0 ? (
                <div className="text-muted small">
                  <em>No conditions added.</em>
                </div>
              ) : (
                <div className="row row-cols-1 g-2">
                  {conditionSearchArray.map((c, i) => (
                    <div key={i} className="col">
                      <div
                        className="text-start ps-1 text-purple border-bottom border-navy border-1 fs-6 d-flex align-items-center justify-content-between"
                        style={{ height: "50px" }}
                      >
                        <span className="text-truncate fs-7" title={c.condition_name}>
                          {c.condition_name}
                        </span>
                        <button
                          className="btn btn-sm btn-outline-danger me-1"
                          onClick={() => removeCondition(i)}
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-17">
            <div className="d-flex align-items-center justify-content-between mb-2 ps-3 pe-2">
              <h6 className="m-0">Lab Ranges</h6>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={clearLabs}
                disabled={labLoading}
              >
                Clear
              </button>
            </div>

            {labErr && <div className="py-1">{labErr}</div>}

            <div className="p-2">
              <select
                className="form-select form-select-sm mb-2"
                value={labSelect}
                onChange={(e) => {
                  setLabSelect(e.target.value);
                  if (e.target.value) addLab(e.target.value);
                }}
              >
                <option value="">— Choose a lab —</option>
                {LAB_FIELDS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              {labs.length === 0 ? (
                <div className="text-muted small">
                  <em>No labs added.</em>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {labs.map((r, i) => {
                    const label = LAB_FIELDS.find(([k]) => k === r.field)?.[1] || r.field;
                    return (
                      <div
                        key={`${r.field}_${i}`}
                        className="d-flex align-items-center border-bottom border-secondary"
                        style={{ height: "50px", lineHeight: "50px" }}
                      >
                        <div className="text-purple fs-7 col-20 overflow-hidden">
                          {label}
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-grow-1">
                          <div className="col-16">
                            <input
                              className={`form-control form-control-sm ${r.gt ? "alert-success" : ""}`}
                              placeholder="min"
                              value={r.gt}
                              onChange={(e) => updateLabBound(i, "gt", e.target.value)}
                              style={{ width: 90 }}
                              inputMode="decimal"
                            />
                          </div>

                          <div className="col-16 ps-1">
                            <input
                              className={`form-control form-control-sm ${r.lt ? "alert-success" : ""}`}
                              placeholder="max"
                              value={r.lt}
                              onChange={(e) => updateLabBound(i, "lt", e.target.value)}
                              style={{ width: 90 }}
                              inputMode="decimal"
                            />
                          </div>

                          <div className="col-16 text-end pe-3">
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeLab(i)}
                            >
                              X
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="col-10">
            <div className="d-flex align-items-center justify-content-between mb-2 ps-3 pe-2">
              <h6 className="m-0">On Medication</h6>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={clearMeds}
                disabled={medLoading}
              >
                Clear
              </button>
            </div>

            {medErr && <div className="alert alert-danger py-1">{medErr}</div>}

            <div className="p-2">
              <select
                className="form-select form-select-sm mb-2"
                value={medSelect}
                onChange={(e) => {
                  setMedSelect(e.target.value);
                  if (e.target.value) addMed(e.target.value);
                }}
              >
                <option value="">— Choose medication</option>
                {Array.isArray(filteredMedsCategory) && filteredMedsCategory.length > 0
                  ? filteredMedsCategory.map((m) => {
                    const id = String(m?.ID ?? m?.id ?? "");
                    const label = String(m?.catName ?? "");
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })
                  : null}
              </select>

              {catSearchArray.length === 0 ? (
                <div className="text-muted small">
                  <em>No medications added.</em>
                </div>
              ) : (
                <div className="row row-cols-1 g-2">
                  {catSearchArray.map((c, i) => (
                    <div key={c.ID ?? i} className="col">
                      <div
                        className="text-start ps-1 text-purple border-bottom border-navy border-1 fs-6 d-flex align-items-center justify-content-between"
                        style={{ height: "50px" }}
                      >
                        <span className="text-truncate fs-7" title={c.catName}>
                          {c.catName}
                        </span>
                        <button
                          className="btn btn-sm btn-outline-danger me-1"
                          onClick={() => removeMed(i)}
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-10">
            <div className="d-flex align-items-center justify-content-between mb-2 ps-3 pe-2">
              <h6 className="m-0 text-danger">Not On Medication</h6>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={clearNonMeds}
                disabled={nonMedLoading}
              >
                Clear
              </button>
            </div>

            {nonMedErr && <div className="alert alert-danger py-1">{nonMedErr}</div>}

            <div className="p-2">
              <select
                className="form-select form-select-sm mb-2"
                value={nonMedSelect}
                onChange={(e) => {
                  setNonMedSelect(e.target.value);
                  if (e.target.value) addNonMed(e.target.value);
                }}
              >
                <option value="">— Choose medication</option>
                {Array.isArray(filteredMedsCategory) && filteredMedsCategory.length > 0
                  ? filteredMedsCategory.map((m) => {
                    const id = String(m?.ID ?? m?.id ?? "");
                    const label = String(m?.catName ?? "");
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })
                  : null}
              </select>

              {nonMedCatSearchArray.length === 0 ? (
                <div className="text-muted small">
                  <em>No medications added.</em>
                </div>
              ) : (
                <div className="row row-cols-1 g-2">
                  {nonMedCatSearchArray.map((c, i) => (
                    <div key={c.ID ?? i} className="col">
                      <div
                        className="text-start ps-1 text-danger border-bottom border-danger border-1 fs-6 d-flex align-items-center justify-content-between"
                        style={{ height: "50px" }}
                      >
                        <span className="text-truncate fs-7" title={c.catName}>
                          {c.catName}
                        </span>
                        <button
                          className="btn btn-sm btn-outline-danger me-1"
                          onClick={() => removeNonMed(i)}
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CriteriaSearch;