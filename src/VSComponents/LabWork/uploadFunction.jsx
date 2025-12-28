// uploadFunction.jsx
// Centralized helpers + per-test extractors (JSX-friendly, no TS types)

/* ------------------ Shared utils ------------------ */
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const scrub = (raw) =>
    (raw || "")
        .replace(/Page No:\s*\d+/gi, "")
        .replace(/Privacy Disclaimer:[\s\S]*?(ConnectingOntario|Generated from ConnectingOntario)/gi, "")
        .replace(/Generated from OLIS[\s\S]*?(EDT|EST)/gi, "")
        .replace(/User Id:.*?Organization:.*?Date:.*?(AM|PM)/gi, "")
        .replace(/\(An age[- ]based population\)/gi, "")
        .replace(/^\s*Test:\s.*$/gim, "")
        .replace(/^\s*Last Updated:\s.*$/gim, "")
        .replace(/\s*\(?\bLifeLabs\b\)?\s*/gi, " ")
        .replace(/\s*\(?\bLab\s*[:#]?\s*\d{3,}\)?\s*/gi, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{2,}/g, "\n")
        .trim();


export const HEADER_REGEXES = [
    /Name\s+Result\s+Flag\s+Ref(?:\.|)\s*Range\s+Units/i,
    /Name\s+Result\s+Ref(?:\.|)\s*Range\s+Units/i,
    /Name\s+Result\s+Units/i, // compact tables (e.g., some Lipid Assessment blocks)
];

// find every header
export const findAllHeaderSpans = (t) => {
    const spans = [];
    for (const re of HEADER_REGEXES) {
        const g = new RegExp(re.source, "ig");
        let m;
        while ((m = g.exec(t)) !== null) spans.push({ index: m.index, length: m[0].length });
    }
    spans.sort((a, b) => a.index - b.index);
    // de-dupe near overlaps
    const out = [];
    for (const s of spans) {
        if (!out.length || s.index - out[out.length - 1].index > 8) out.push(s);
    }
    return out;
};

// slice doc into blocks after each header (local table windows)
export const sliceBlocksByHeaders = (t, windowSize = 60000) => {
    const spans = findAllHeaderSpans(t);
    if (!spans.length) return [];
    const blocks = [];
    for (let i = 0; i < spans.length; i++) {
        const start = spans[i].index + spans[i].length;
        const end = i < spans.length - 1 ? spans[i + 1].index : start + windowSize;
        blocks.push(t.slice(start, Math.min(t.length, end)));
    }
    return blocks;
};

// REPLACE your grabRefRange with this
const NUM_FRAG = String.raw`(?:\d+(?:\.\d+)?|\d+\.(?!\d))`; // accepts "89", "89.0", and "89."

export const grabRefRange = (txt) => {
    // Try common patterns in order of specificity
    const m =
        // "Ref Range < 6.0", "Ref. Range 4.0 - 6.2", etc.
        txt.match(new RegExp(String.raw`Ref(?:\.|)?\s*Range\s*([<>]=?\s*${NUM_FRAG}(?:\s*-\s*<?\s*${NUM_FRAG})?)`, "i")) ||
        // Plain hyphen range near the hit, e.g., "60. - 110. umol/L"
        txt.match(new RegExp(String.raw`(${NUM_FRAG}\s*-\s*${NUM_FRAG})\s*(?:%|mmol\/L|umol\/L|mL\/min(?:\s*\/\s*1\.?73(?:\s*(?:m2|m\.?2|m\^2|m\*\s*2|m\*2))?)?)?`, "i")) ||
        // Single threshold like "< 6.0 %", ">= 60."
        txt.match(new RegExp(String.raw`([<>]=?\s*${NUM_FRAG})\s*(?:%|mmol\/L|umol\/L|mL\/min(?:\s*\/\s*1\.?73(?:\s*(?:m2|m\.?2|m\^2|m\*\s*2|m\*2))?)?)?`, "i"));

    return m ? m[1].replace(/\s+/g, " ").trim() : undefined;
};


export const extractCholesterol = (text) => {
    // NOTE: no "Desired:" stripping here (it caused over-deletion)
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };

    const CHOL_RE = new RegExp(
        String.raw`\bCholesterol\b(?!\s+(?:In|Non)\b)[\s\S]{0,200}?` + // stand-alone "Cholesterol"
        String.raw`([0-9]+(?:\.[0-9]+)?)` +                           // first number = value
        String.raw`(?:\s+(N|H|L|NA\.?))?` +                           // optional flag
        String.raw`[\s\S]{0,60}?\bmmol\/L\b`,                         // units nearby
        "i"
    );

    for (const block of blocks) {
        const m = block.match(CHOL_RE);
        if (m) {
            const around = block.slice(m.index ?? 0, (m.index ?? 0) + 320);
            return {
                value: m[1],
                flag: (m[2] || "").toUpperCase(),
                units: "mmol/L",
                refRange: grabRefRange(around),
            };
        }
    }
    return { value: null };
};

export const extractTriglyceride = (text) => {
    // NOTE: do NOT strip "Desired:" here; rely on title+units to avoid false hits
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };

    const TRIG_RE = new RegExp(
        String.raw`\bTriglyceride\b(?!s\b)[\s\S]{0,200}?` + // exact row name, not narrative "triglycerides"
        String.raw`(?:\([^)]*\)\s*)?` +                   // optional parenthetical line
        String.raw`([0-9]+(?:\.[0-9]+)?)` +               // first number = value
        String.raw`(?:\s+(N|H|L|NA\.?))?` +               // optional flag
        String.raw`[\s\S]{0,120}?\bmmol\/L\b`,            // units must be nearby
        "i"
    );

    for (const block of blocks) {
        const m = block.match(TRIG_RE);
        if (m) {
            const around = block.slice(m.index ?? 0, (m.index ?? 0) + 320);
            return {
                value: m[1],
                flag: (m[2] || "").toUpperCase(),
                units: "mmol/L",
                refRange: grabRefRange(around),
            };
        }
    }
    return { value: null };
};

// SPECIAL: Chol/HDL Ratio (handles line breaks, fused words like "InHDL", unitless, optional 2nd number)
export const extractCholHdlRatio = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`; // accepts "6.4" or "6."
    const norm = (s) => (s ? s.replace(/\.$/, "") : s);

    // Flexible row title:
    // - Cholesterol/Cholesterol In HDL Ratio
    // - Cholesterol/Cholesterol InHDL Ratio  (no space)
    // - Chol/HDL Ratio, Total Cholesterol/HDL-C Ratio, etc.
    const ROW_TITLE = new RegExp(
        String.raw`\b(?:Total\s+)?(?:Chol|Cholesterol)\s*\/\s*` +
        // either "Cholesterol In HDL" with optional spaces **or** just "HDL"/"HDL-C"
        String.raw`(?:Chol(?:esterol)?\s*In\s*HDL|HDL(?:-C)?)` +
        // sometimes labs include an extra trailing "Cholesterol"
        String.raw`(?:\s*Chol(?:esterol)?)?\s*Ratio\b`,
        "i"
    );

    // Allow an optional parenthetical note line, then value, optional flag, optional second number
    const VALUE_AFTER_TITLE = new RegExp(
        String.raw`(?:\([^)]*\)\s*)?` + // e.g., "(None - generic normal range)" possibly split over lines
        String.raw`${NUM}` +            // first number = ratio
        String.raw`(?:\s+(N|H|L|NA\.?))?` + // optional flag
        String.raw`(?:\s+${NUM})?`,     // optional target (e.g., "5.00")
        "i"
    );

    // 1) Prefer searching inside each header "block"
    for (const block of blocks) {
        const hit = block.match(ROW_TITLE);
        if (!hit) continue;

        // Start AFTER the title so we can't grab digits from the title itself
        const start = (hit.index ?? 0) + hit[0].length;
        const after = block.slice(start, start + 2000);

        // Direct try (keeps line breaks)
        let m = after.match(VALUE_AFTER_TITLE);
        if (m) {
            return { value: norm(m[1]), flag: (m[2] || "").toUpperCase(), units: "", refRange: norm(m[3] || "") || undefined };
        }

        // Fallback inside the block with whitespace flattened (handles weird line wraps/spaces)
        const flat = after.replace(/\s+/g, " ");
        m = flat.match(new RegExp(String.raw`^(?:\([^)]*\)\s*)?${NUM}(?:\s+(N|H|L|NA\.?))?(?:\s+${NUM})?`, "i"));
        if (m) {
            return { value: norm(m[1]), flag: (m[2] || "").toUpperCase(), units: "", refRange: norm(m[3] || "") || undefined };
        }
    }

    // 2) Global fallback across the whole doc with whitespace flattened
    const flatAll = t.replace(/\s+/g, " ");
    const ANYWHERE = new RegExp(
        String.raw`(?:Total\s+)?(?:Chol|Cholesterol)\s*\/\s*(?:Chol(?:esterol)?\s*In\s*HDL|HDL(?:-C)?)` +
        String.raw`(?:\s*Chol(?:esterol)?)?\s*Ratio\b\s*` +
        String.raw`(?:\([^)]*\)\s*)?` +
        NUM +
        String.raw`(?:\s+(N|H|L|NA\.?))?` +
        String.raw`(?:\s+${NUM})?`,
        "i"
    );
    const g = flatAll.match(ANYWHERE);
    if (g) {
        return { value: norm(g[1]), flag: (g[2] || "").toUpperCase(), units: "", refRange: norm(g[3] || "") || undefined };
    }

    return { value: null };
};

export const extractA1CStandalone = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };

    // Accept common title variants
    const TITLES = [
        /\bHemoglobin\s*A1C\/Total\s*Hemoglobin;\s*Blood\b/i,
        /\bHemoglobin\s*A1\s*C\/Total\s*Hemoglobin;\s*Blood\b/i,
        /\bHemoglobin\s*A1C\b/i,            // fallback (some labs shorten)
        /\bHemoglobin\s*A1\s*C\b/i,
    ];

    for (const block of blocks) {
        // Find the first matching title in this block
        let th = null;
        let titleEnd = -1;
        for (const TR of TITLES) {
            const m = block.match(TR);
            if (m) { th = m; titleEnd = (m.index ?? 0) + m[0].length; break; }
        }
        if (!th) continue;

        // IMPORTANT: start AFTER the title so we don't catch the "1" in "A1C"
        const after = block.slice(titleEnd, titleEnd + 1200);

        // First *real* number = value; optional flag; must see % nearby to avoid narrative
        const m = after.match(
            /(?:^|[\s(])([0-9]+(?:\.[0-9]+)?)(?:\s+(N|H|L|NA\.?))?[\s\S]{0,120}?%/i
        );
        if (m) {
            const around = after.slice(m.index ?? 0, (m.index ?? 0) + 360);

            // Try to capture a reference nearby:
            // - "Ref Range < 6.0"
            // - "4.0 - 6.2 %"
            // - "< 6.0 %"
            const ref =
                (around.match(/Ref(?:\.|)?\s*Range\s*([<>]=?\s*\d+(?:\.\d+)?(?:\s*-\s*<?\s*\d+(?:\.\d+)?)?)/i)?.[1] ||
                    around.match(/([0-9]+(?:\.[0-9]+)?\s*-\s*[0-9]+(?:\.[0-9]+)?)\s*%/i)?.[1] ||
                    around.match(/([<>]=?\s*\d+(?:\.\d+)?)\s*%/i)?.[1] ||
                    undefined);

            return {
                value: m[1],
                flag: (m[2] || "").toUpperCase(),
                units: "%",
                refRange: ref,
            };
        }
    }
    return { value: null };
};

export const extractSodiumSolid = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };

    // Accept integers, normal decimals, OR a trailing dot with no decimals (e.g., "143.")
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;

    const SODIUM_RE = new RegExp(
        String.raw`\bSodium\b[\s\S]{0,200}?` + // row title
        String.raw`(?:\([^)]*\)\s*)?` +        // optional parenthetical note
        NUM +                                  // first number = value
        String.raw`(?:\s+(N|H|L|NA\.?))?` +    // optional flag
        String.raw`[\s\S]{0,80}?\bmmol\/L\b`,  // units nearby
        "i"
    );

    for (const block of blocks) {
        const m = block.match(SODIUM_RE);
        if (m) {
            const around = block.slice(m.index ?? 0, (m.index ?? 0) + 320);
            // normalize: drop trailing dot if present ("143." -> "143")
            const value = m[1].replace(/\.$/, "");
            return {
                value,
                flag: (m[2] || "").toUpperCase(),
                units: "mmol/L",
                refRange: grabRefRange(around),
            };
        }
    }
    return { value: null };
};

// REPLACE your extractGFRStandalone with this
export const extractGFRStandalone = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000); // allow spans across page breaks
    if (!blocks.length) return { value: null };

    const TITLE_VARIANTS = [
        /\bGlomerular\s+Filtration\s+Rate\s+Predicted\b/i,          // NEW
        /\bGlomerular\s+Filtration\s+Rate\s*\(Predicted\)\b/i,      // NEW
        /\bGFR\/1\.?73(?:\s*(?:sq|squared)?\s*M\.?)?\s*Predicted;?\s*CKD-?EPI\b/i,
        /\beGFR\/1\.?73\b/i,
        /\bGFR\/1\.?73\b/i,
        /\beGFR\b/i,
        /\bGFR\b/i,
    ];

    // mL/min, optionally "/1.73 m2" with quirky forms like "m* 2"
    const UNITS_RE = /\bmL\/min(?:\s*\/\s*1\.?73(?:\s*(?:m2|m\.?2|m\^2|m\*\s*2|m\*2))?)?\b/i;

    // number accepting trailing dot
    const NUM = /(?:^|[\s(>])([0-9]{1,3}(?:\.[0-9]+)?|[0-9]{1,3}\.(?![0-9]))\b(?:\s+(N|H|L|NA\.?))?/i;

    for (const block of blocks) {
        // find title; start AFTER it
        let titleEnd = -1;
        for (const TR of TITLE_VARIANTS) {
            const m = block.match(TR);
            if (m) { titleEnd = (m.index ?? 0) + m[0].length; break; }
        }
        if (titleEnd < 0) continue;

        const after = block.slice(titleEnd, titleEnd + 8000);

        const val = after.match(NUM);
        if (!val) continue;

        // ensure proper units shortly after the numeric
        const tail = after.slice(val.index ?? 0, (val.index ?? 0) + 400);
        const unitsHit = tail.match(UNITS_RE);
        if (!unitsHit) continue;

        // Try to capture a simple threshold like ">= 60." or ">89"
        const ref =
            (tail.match(new RegExp(String.raw`(>[=]?\s*${NUM_FRAG})`, "i"))?.[1] ||
                tail.match(new RegExp(String.raw`Ref(?:\.|)?\s*Range\s*([<>]=?\s*${NUM_FRAG}(?:\s*-\s*<?\s*${NUM_FRAG})?)`, "i"))?.[1] ||
                undefined);

        const value = (val[1] || "").replace(/\.$/, ""); // "77." -> "77"
        return { value, flag: (val[2] || "").toUpperCase(), units: unitsHit[0].replace(/\s+/g, " ").trim(), refRange: ref };
    }

    return { value: null };
}


// ADD this new dedicated extractor
export const extractCreatinineSolid = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };

    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`; // accept trailing-dot
    const RE = new RegExp(
        String.raw`\bCreatinine\b[\s\S]{0,200}?` +   // title
        String.raw`(?:\([^)]*\)\s*)?` +              // optional note line
        NUM +                                        // value (e.g., "89.")
        String.raw`(?:\s+(N|H|L|NA\.?))?` +          // optional flag
        String.raw`[\s\S]{0,100}?\bumol\/L\b`,       // units nearby
        "i"
    );

    for (const block of blocks) {
        const m = block.match(RE);
        if (m) {
            const around = block.slice(m.index ?? 0, (m.index ?? 0) + 360);
            const value = m[1].replace(/\.$/, ""); // normalize "89." -> "89"
            return { value, flag: (m[2] || "").toUpperCase(), units: "umol/L", refRange: grabRefRange(around) };
        }
    }
    return { value: null };
};

// REPLACE the numeric parts inside extractNearestHeader with NUM that accepts trailing dot
export const extractNearestHeader = (text, opts) => {
    const {
        aliases,
        allowedUnits = [],
        allowUnitless = false,
        flagOptional = true,
        windowSize = 20000,
    } = opts || {};

    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, windowSize);
    if (!blocks.length) return { value: null };

    const unitGroup = allowedUnits.length ? `(?:${allowedUnits.map(esc).join("|")})` : `(?:[A-Za-z/%0-9.^-]+)`;
    const title = new RegExp(`\\b(?:${aliases.map(esc).join("|")})\\b`, "i");
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`; // <- accepts "140." style

    const withFlag = new RegExp(
        String.raw`${NUM}\s+(N|H|L|NA\.?)\b[\s\S]{0,80}\b${unitGroup}\b`, "i"
    );
    const noFlag = new RegExp(
        String.raw`${NUM}\b[\s\S]{0,80}\b${unitGroup}\b`, "i"
    );
    const unitlessWithFlag = new RegExp(String.raw`${NUM}\s+(N|H|L|NA\.?)\b`, "i");
    const unitlessNoFlag = new RegExp(String.raw`${NUM}`, "i");

    for (const block of blocks) {
        const titleHit = block.match(title);
        if (!titleHit) continue;
        const after = block.slice(titleHit.index ?? 0);

        if (!allowUnitless) {
            if (!flagOptional) {
                const m = after.match(withFlag);
                if (m) return { value: m[1].replace(/\.$/, ""), flag: (m[2] || "").toUpperCase(), units: allowedUnits[0] || "", refRange: grabRefRange(after) };
            } else {
                const m1 = after.match(withFlag);
                if (m1) return { value: m1[1].replace(/\.$/, ""), flag: (m1[2] || "").toUpperCase(), units: allowedUnits[0] || "", refRange: grabRefRange(after) };
                const m2 = after.match(noFlag);
                if (m2) return { value: m2[1].replace(/\.$/, ""), flag: "", units: allowedUnits[0] || "", refRange: grabRefRange(after) };
            }
        } else {
            const m1 = after.match(unitlessWithFlag);
            if (m1) return { value: m1[1].replace(/\.$/, ""), flag: (m1[2] || "").toUpperCase(), units: "", refRange: grabRefRange(after) };
            const m2 = after.match(unitlessNoFlag);
            if (m2) return { value: m2[1].replace(/\.$/, ""), flag: "", units: "", refRange: grabRefRange(after) };
        }
    }
    return { value: null };
};

// SPECIAL: Creatine Kinase (CK) — U/L or IU/L; flag optional; trailing-dot numbers OK
export const extractCreatineKinase = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };

    // number: "250", "250.0", or "250."
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;
    // title variants: "Creatine Kinase", "Creatine Kinase [CK]", or plain "CK" (not CKD)
    const TITLE = new RegExp(String.raw`\b(?:Creatine\s+Kinase(?:\s*\[CK\])?|CK)\b(?!D)`, "i");
    const UNITS = /\b(?:U\/L|IU\/L)\b/i;

    for (const block of blocks) {
        const th = block.match(TITLE);
        if (!th) continue;
        const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1200);

        const m = after.match(new RegExp(
            String.raw`(?:\([^)]*\)\s*)?` + // optional note line
            NUM +                            // value
            String.raw`(?:\s+(N|H|L|NA\.?))?`, "i"
        ));
        if (!m) continue;

        // require units soon after to avoid narrative hits
        const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 200);
        if (!UNITS.test(tail)) continue;

        const around = tail;
        return {
            value: m[1].replace(/\.$/, ""),
            flag: (m[2] || "").toUpperCase(),
            units: (tail.match(UNITS) || [""])[0],
            refRange: grabRefRange(around),
        };
    }
    return { value: null };
};

// SPECIAL: Alanine Aminotransferase (ALT) — U/L or IU/L; handles "Aminotransaminase" header; flag optional
export const extractALTSolid = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };

    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;
    // Accept: "Alanine Aminotransferase", "Alanine Aminotransaminase", optional [ALT], or lone "ALT"
    const TITLE = /\b(?:Alanine\s+Aminotrans(?:ferase|aminase)(?:\s*\[ALT\])?|ALT)\b/i;
    const UNITS = /\b(?:U\/L|IU\/L)\b/i;

    for (const block of blocks) {
        const th = block.match(TITLE);
        if (!th) continue;
        const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1200);

        const m = after.match(new RegExp(
            String.raw`(?:\([^)]*\)\s*)?` + // optional note line
            NUM +                            // value
            String.raw`(?:\s+(N|H|L|NA\.?))?`, "i"
        ));
        if (!m) continue;

        const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 240);
        if (!UNITS.test(tail)) continue;

        const around = tail;
        return {
            value: m[1].replace(/\.$/, ""),
            flag: (m[2] || "").toUpperCase(),
            units: (tail.match(UNITS) || [""])[0],
            refRange: grabRefRange(around),
        };
    }
    return { value: null };
};

// SPECIAL: Urea — mmol/L or mg/dL; avoids "Urate"; flag optional
export const extractUreaSolid = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };

    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;

    // Two passes:
    //  1) "Urea" (common in Canadian reports, mmol/L)
    //  2) "Urea Nitrogen" or "BUN" (may be mg/dL or mmol/L)
    const TITLE_UREA = /\bUrea\b(?!\s*Nitrogen)\b/i;
    const TITLE_BUN = /\b(?:Urea\s+Nitrogen|BUN)\b/i;
    const UNITS_UREA = /\bmmol\/L\b/i;
    const UNITS_BUN = /\b(?:mg\/dL|mmol\/L)\b/i;

    // helper to search with a given title + units
    const findWith = (titleRe, unitsRe) => {
        for (const block of blocks) {
            const th = block.match(titleRe);
            if (!th) continue;
            const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1200);

            const m = after.match(new RegExp(
                String.raw`(?:\([^)]*\)\s*)?` + // optional note line
                NUM +                            // value
                String.raw`(?:\s+(N|H|L|NA\.?))?`, "i"
            ));
            if (!m) continue;

            const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 240);
            if (!unitsRe.test(tail)) continue;

            const around = tail;
            return {
                value: m[1].replace(/\.$/, ""),
                flag: (m[2] || "").toUpperCase(),
                units: (tail.match(unitsRe) || [""])[0],
                refRange: grabRefRange(around),
            };
        }
        return null;
    };

    return findWith(TITLE_UREA, UNITS_UREA) || findWith(TITLE_BUN, UNITS_BUN) || { value: null };
};

// ---- NEW: Lipoprotein(a) / Lp(a) ------------------------------------------
export const extractLipoproteinA = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;
    const TITLE = /\b(?:Lipoprotein\s*\(?a\)?|Lp\(?a\)?)\b/i;
    const UNITS = /\b(?:nmol\/L|mg\/dL)\b/i;

    for (const block of blocks) {
        const th = block.match(TITLE);
        if (!th) continue;
        const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1400);
        const m = after.match(new RegExp(String.raw`(?:\([^)]*\)\s*)?${NUM}(?:\s+(N|H|L|NA\.?))?`, "i"));
        if (!m) continue;
        const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 240);
        if (!UNITS.test(tail)) continue;
        const around = tail;
        return {
            value: m[1].replace(/\.$/, ""),
            flag: (m[2] || "").toUpperCase(),
            units: (tail.match(UNITS) || [""])[0],
            refRange: grabRefRange(around),
        };
    }
    return { value: null };
};

// ---- NEW: Apolipoprotein B / Apo B ----------------------------------------
export const extractApolipoproteinB = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;
    const TITLE = /\b(?:Apolipoprotein\s*B|Apo\s*B)\b/i;
    const UNITS = /\b(?:g\/L|mg\/dL)\b/i;

    for (const block of blocks) {
        const th = block.match(TITLE);
        if (!th) continue;
        const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1400);
        const m = after.match(new RegExp(String.raw`(?:\([^)]*\)\s*)?${NUM}(?:\s+(N|H|L|NA\.?))?`, "i"));
        if (!m) continue;
        const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 240);
        if (!UNITS.test(tail)) continue;
        const around = tail;
        return {
            value: m[1].replace(/\.$/, ""),
            flag: (m[2] || "").toUpperCase(),
            units: (tail.match(UNITS) || [""])[0],
            refRange: grabRefRange(around),
        };
    }
    return { value: null };
};

// ---- NEW: BNP (B-type natriuretic peptide) --------------------------------
export const extractBNP = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;
    // include common variants; if you want to EXCLUDE NT-proBNP, remove it here
    const TITLE = /\b(?:BNP|B-?\s*type\s+Natriuretic\s+Peptide|pro-?BNP|NT-?proBNP)\b/i;
    const UNITS = /\b(?:ng\/L|pg\/mL)\b/i;

    for (const block of blocks) {
        const th = block.match(TITLE);
        if (!th) continue;
        const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1600);
        const m = after.match(new RegExp(String.raw`(?:\([^)]*\)\s*)?${NUM}(?:\s+(N|H|L|NA\.?))?`, "i"));
        if (!m) continue;
        const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 260);
        if (!UNITS.test(tail)) continue;
        const around = tail;
        return {
            value: m[1].replace(/\.$/, ""),
            flag: (m[2] || "").toUpperCase(),
            units: (tail.match(UNITS) || [""])[0],
            refRange: grabRefRange(around),
        };
    }
    return { value: null };
};

// ---- NEW: Albumin (SERUM) --------------------------------------------------
export const extractAlbuminSerum = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;
    const TITLE = /\bAlbumin\b/i;           // units will disambiguate from urine
    const UNITS = /\bg\/L\b/i;              // serum uses g/L

    for (const block of blocks) {
        const th = block.match(TITLE);
        if (!th) continue;
        const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1000);
        const m = after.match(new RegExp(String.raw`(?:\([^)]*\)\s*)?${NUM}(?:\s+(N|H|L|NA\.?))?`, "i"));
        if (!m) continue;
        const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 200);
        if (!UNITS.test(tail)) continue;      // avoids "Albumin; Urine" (mg/L)
        const around = tail;
        return {
            value: m[1].replace(/\.$/, ""),
            flag: (m[2] || "").toUpperCase(),
            units: (tail.match(UNITS) || [""])[0],
            refRange: grabRefRange(around),
        };
    }
    return { value: null };
};

// ---- NEW: Vitamin B12 (Cobalamins) ----------------------------------------
export const extractVitaminB12 = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;
    const TITLE = /\bVitamin\s*B\s*12\b/i;
    const UNITS = /\bpmol\/L\b/i;

    for (const block of blocks) {
        const th = block.match(TITLE);
        if (!th) continue;
        const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1000);
        const m = after.match(new RegExp(String.raw`(?:\([^)]*\)\s*)?${NUM}(?:\s+(N|H|L|NA\.?))?`, "i"));
        if (!m) continue;
        const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 240);
        if (!UNITS.test(tail)) continue;
        const around = tail;
        return {
            value: m[1].replace(/\.$/, ""),
            flag: (m[2] || "").toUpperCase(),
            units: (tail.match(UNITS) || [""])[0],
            refRange: grabRefRange(around),
        };
    }
    return { value: null };
};

// ---- NEW: Ferritin ---------------------------------------------------------
export const extractFerritinSolid = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 60000);
    if (!blocks.length) return { value: null };
    const NUM = String.raw`([0-9]+(?:\.[0-9]+)?|[0-9]+\.(?![0-9]))`;
    const TITLE = /\bFerritin\b/i;
    const UNITS = /\bug\/L\b/i;

    for (const block of blocks) {
        const th = block.match(TITLE);
        if (!th) continue;
        const after = block.slice((th.index ?? 0) + th[0].length, (th.index ?? 0) + th[0].length + 1200);
        const m = after.match(new RegExp(String.raw`(?:\([^)]*\)\s*)?${NUM}(?:\s+(N|H|L|NA\.?))?`, "i"));
        if (!m) continue;
        const tail = after.slice(m.index ?? 0, (m.index ?? 0) + 260);
        if (!UNITS.test(tail)) continue;
        const around = tail;
        return {
            value: m[1].replace(/\.$/, ""),
            flag: (m[2] || "").toUpperCase(),
            units: (tail.match(UNITS) || [""])[0],
            refRange: grabRefRange(around),
        };
    }
    return { value: null };
};

//Works Kinda
export const extractUrineAlbumin = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 80000);
    if (!blocks.length) return { value: null };

    const TITLE = /\bAlbumin;\s*Urine\b(?:\s*\(amended\))?/gi;
    const NUM = /([<>]=?)?\s*([0-9]+(?:\.[0-9]+)?)(?:\s+(N|H|L|NA\.?))?/gi;
    const UNITS = /mg\/L/i;

    const isDetectionCtx = (s) =>
        /(detection\s*limit|below\s*limit|less\s*than|unable\s*to\s*calculate)/i.test(s);

    for (const block of blocks) {
        let mTitle;
        while ((mTitle = TITLE.exec(block)) !== null) {
            const start = mTitle.index + mTitle[0].length;
            const after = block.slice(start, start + 2000); // look ahead near the title

            let m;
            NUM.lastIndex = 0;
            while ((m = NUM.exec(after)) !== null) {
                const op = (m[1] || "").trim();
                const valStr = (m[2] || "").replace(/\.$/, "");
                const flag = (m[3] || "").toUpperCase();

                // Ensure units are in the vicinity of this match
                const vicinity = after.slice(Math.max(0, m.index - 80), Math.min(after.length, m.index + 200));
                if (!UNITS.test(vicinity)) continue;

                // Skip detection-limit and comparator values; keep scanning next match
                if (op === "<" || op === "≤" || op === ">" || isDetectionCtx(vicinity)) continue;

                return {
                    value: valStr,
                    flag,
                    units: "mg/L",
                    refRange: grabRefRange(vicinity),
                };
            }
            // if this title didn’t yield a value, loop to next title occurrence
        }
    }
    return { value: null };
};

// Works Kinda
export const extractACR = (text) => {
    const t = scrub(text);
    const blocks = sliceBlocksByHeaders(t, 80000);
    if (!blocks.length) return { value: null };

    const TITLE = new RegExp(
        String.raw`\b(?:` +
        // Albumin/Creatinine Ratio variants, optional "; Urine", optional "(Amended)"
        String.raw`(?:Albumin\s*\/\s*Creatinine|Albumin\s*(?:to|:)\s*Creatinine)\s*Ratio` +
        String.raw`(?:\s*;\s*Urine)?(?:\s*\(amended\))?` +
        String.raw`|ACR)\b`,
        "gi"
    );

    const NUM = /([0-9]+(?:\.[0-9]+)?)(?:\s+(N|H|L|NA\.?))?/gi;
    const UNITS = /\bmg\s*\/\s*mmol(?:\s*(?:creat(?:inine)?|cr)\.?)?/i;

    for (const block of blocks) {
        let mTitle;
        while ((mTitle = TITLE.exec(block)) !== null) {
            const start = mTitle.index + mTitle[0].length;
            const after = block.slice(start, start + 2500);

            // If this page occurrence is just a header, there might be "Result: NOT APPLICABLE" near it — keep scanning.
            // We look for the first numeric followed by acceptable units in the vicinity.
            let m;
            NUM.lastIndex = 0;
            while ((m = NUM.exec(after)) !== null) {
                const tail = after.slice(m.index, m.index + 600).replace(/\s+/g, " ");
                if (!UNITS.test(tail)) continue;

                return {
                    value: m[1].replace(/\.$/, ""),
                    flag: (m[2] || "").toUpperCase(),
                    units: (tail.match(UNITS) || ["mg/mmol"])[0],
                    refRange: grabRefRange(tail) || undefined,
                };
            }
            // try the next title occurrence if no value found here
        }
    }

    // Global fallback if titles are oddly split across blocks
    const flat = t.replace(/\s+/g, " ");
    const ANY = new RegExp(
        String.raw`(?:Albumin\s*\/\s*Creatinine|Albumin\s*(?:to|:)\s*Creatinine)\s*Ratio(?:\s*;\s*Urine)?(?:\s*\(amended\))?\s*` +
        String.raw`([0-9]+(?:\.[0-9]+)?)(?:\s+(N|H|L|NA\.?))?.{0,80}?` +
        String.raw`(mg\s*\/\s*mmol(?:\s*(?:creat(?:inine)?|cr)\.?)?)`,
        "i"
    );
    const g = flat.match(ANY);
    if (g) {
        return {
            value: g[1],
            flag: (g[2] || "").toUpperCase(),
            units: g[3],
        };
    }

    return { value: null };
};


// -- Address & telephone from PATIENT panel (two-line "Address" format) --
const extractPatientAddressFromPanel = (panel) => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

    const normalizePostal = (pcRaw) => {
        const m = (pcRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        // K0B 1B0 style
        return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(m) ? `${m.slice(0, 3)} ${m.slice(3)}` : "";
    };

    // Telephone: supports "Telephone 613-..." or line-break after label; trim stray trailing punctuation
    const telMatchSame = panel.match(/Telephone\s+([+0-9()\-\s]{7,})(?:\s*\(Home\)|\s*\(.*?\))?/i);
    const telMatchNext = panel.match(/Telephone\s*\n\s*([+0-9()\-\s]{7,})(?:\s*\(.*?\))?/i);
    let telephone = norm((telMatchSame?.[1] || telMatchNext?.[1] || ""));
    telephone = telephone.replace(/[^\d+)]*$/g, "").replace(/\s+$/, "");

    // Address label can be "Address" or "Address:" and may have "(Home)" on the label line
    // Expect two lines after the label:
    //   Line 1: street
    //   Line 2: CITY PROV POSTAL  (commas optional, city can be multi-word)
    const addrBlock =
        panel.match(/Address:?(?:\s*\(Home\))?\s*\n([^\n]+)\n([^\n]+)(?:\s*\(Home\))?/i) ||
        panel.match(/Address:?(?:\s*\(Home\))?\s*\n\s*\n([^\n]+)\n([^\n]+)(?:\s*\(Home\))?/i);

    let street = "", city = "", province = "", postalCode = "", fullAddress = "";

    if (addrBlock) {
        street = norm(addrBlock[1] || "");
        const line2 = norm(addrBlock[2] || "");

        // Preferred: "CITY PROV POSTAL"
        let m = line2.match(/^(.+?)\s+([A-Z]{2})\s+([A-Z]\d[A-Z][ -]?\d[A-Z]\d)$/i);
        if (m) {
            city = norm(m[1]);
            province = m[2].toUpperCase();
            postalCode = normalizePostal(m[3]);
        } else {
            // Variants: "CITY, PROV POSTAL" or odd spacing
            m = line2.match(/^(.+?)[,\s]+([A-Z]{2})[,\s]+([A-Z]\d[A-Z][ -]?\d[A-Z]\d)$/i);
            if (m) {
                city = norm(m[1]);
                province = m[2].toUpperCase();
                postalCode = normalizePostal(m[3]);
            } else {
                // Last resort: find PROV + POSTAL anywhere; left side is city
                const pp = line2.match(/\b([A-Z]{2})\b\s+([A-Z]\d[A-Z][ -]?\d[A-Z]\d)/i);
                if (pp) {
                    province = pp[1].toUpperCase();
                    postalCode = normalizePostal(pp[2]);
                    city = norm(line2.slice(0, pp.index).replace(/[,\s]+$/g, ""));
                } else {
                    // keep data if unparsable
                    city = line2;
                }
            }
        }

        fullAddress = [street, [city, province].filter(Boolean).join(" "), postalCode]
            .filter(Boolean)
            .join(", ");
    }

    return { street, city, province, postalCode, telephone, fullAddress };
};

// ===================== extractPatientMeta (paste this once) =====================
export const extractPatientMeta = (raw) => {
    const cleaned = scrub(raw);

    // Narrow to the PATIENT panel to avoid facility/provider addresses
    const patStart = cleaned.search(/\bPATIENT\b/i);
    const provStart = cleaned.search(/\bPROVIDER\b/i);
    const patPanel =
        patStart >= 0
            ? cleaned.slice(patStart, provStart > patStart ? provStart : patStart + 2000)
            : cleaned;

    // Name (prefer "PATIENT: LAST, FIRST |", else "Patient LAST, FIRST")
    const rawName =
        (patPanel.match(/PATIENT:\s*([A-Z ,.'-]+)\s*\|/i)?.[1] ||
            patPanel.match(/\bPatient\s+([A-Z ,.'-]+)\b/i)?.[1] ||
            cleaned.match(/^([A-Z ,.'-]+)\s+DOB:/m)?.[1] ||
            "").trim();
    const parts = rawName.split(",");
    const name = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : rawName;

    // ✅ Address + Telephone using the robust two-line parser
    const { street, city, province, postalCode, telephone, fullAddress } =
        extractPatientAddressFromPanel(patPanel);

    return {
        // Core identity
        name,

        // Dates / sex
        dateOfBirth:
            (patPanel.match(/Date of Birth\s+([0-9]{1,2} [A-Za-z]+ \d{4})/i)?.[1] || "").trim(),
        sex: (patPanel.match(/Sex\s+(Female|Male)/i)?.[1] || "").trim(),

        // Contact / identifiers
        telephone,
        healthNumber: (() => {
            const hcn =
                cleaned.match(/HCN:\s*([\d ]{10,})/)?.[1] ||
                patPanel.match(/\bONTARIO Health Number\s+([\d ]{10,})/i)?.[1] ||
                "";
            const digits = hcn.replace(/\D+/g, "").slice(0, 10);
            return digits ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}` : "";
        })(),

        // ✅ Address fields (your 'address' field is the street line)
        address: street,
        street,
        city,
        province,
        postalCode,
        fullAddress,

        // Provider info (unchanged)
        providerName:
            (cleaned.match(/Ordering Provider\s+([A-Z ,.'-]+)/i)?.[1] ||
                cleaned.match(/Provider\s+([A-Z ,.'-]+)\s+\(MDL/i)?.[1] ||
                "").trim(),
        providerNumber: cleaned.match(/\(MDL\s+(\d+)\)/i)?.[1] || null,

        // Order / last updated (unchanged)
        orderDate:
            (cleaned.match(/Order Date\s+([0-9]{1,2} [A-Za-z]+ \d{4})/i)?.[1] || "").trim(),
        lastUpdated:
            (cleaned.match(/Last Updated(?: in OLIS)?:?\s+([0-9]{1,2} [A-Za-z]+ \d{4}(?: \d{2}:\d{2}(?::\d{2})?)?)/i)?.[1] ||
                "").trim(),
    };
};



/* ------------------ Registry / one-call runner ------------------ */
const LIPID_UNITS = ["mmol/L"];
const ELECTROLYTE_UNITS = ["mmol/L"];
const A1C_UNITS = ["%"];
const CREATININE_UNITS = ["umol/L", "mg/dL"];
const GFR_UNITS = ["mL/min/1.73", "mL/min/1.73m2", "mL/min/1.73 m2", "mL/min/1.73m^2"];

export const EXTRACTORS = {
    cholesterol: (t) => extractCholesterol(t),
    triglyceride: (t) => extractTriglyceride(t),
    hdl: (t) => extractNearestHeader(t, { aliases: ["Cholesterol In HDL"], allowedUnits: ["mmol/L"] }),
    ldl: (t) => extractNearestHeader(t, { aliases: ["Cholesterol In LDL; Calculated", "Cholesterol In LDL"], allowedUnits: ["mmol/L"] }),
    nonHdl: (t) => extractNearestHeader(t, { aliases: ["Cholesterol Non HDL", "Cholesterol Non-HDL"], allowedUnits: ["mmol/L"] }),
    cholesterolHdlRatio: (t) => extractCholHdlRatio(t),
    hemoglobinA1C: (t) => extractA1CStandalone(t),
    creatinine: (t) => extractCreatinineSolid(t),
    sodium: (t) => extractSodiumSolid(t),   // already added earlier
    potassium: (t) => extractNearestHeader(t, { aliases: ["Potassium"], allowedUnits: ["mmol/L"] }),
    calcium: (t) => extractNearestHeader(t, { aliases: ["Calcium"], allowedUnits: ["mmol/L"] }),
    gfr: (t) => extractGFRStandalone(t),
    creatineKinase: (t) => extractCreatineKinase(t),
    alanineAminotransferase: (t) => extractALTSolid(t),
    urea: (t) => extractUreaSolid(t),
    lipoproteinA: (t) => extractLipoproteinA(t),
    apolipoproteinB: (t) => extractApolipoproteinB(t),
    bnp: (t) => extractBNP(t),

    albumin: (t) => extractAlbuminSerum(t),    // serum albumin (g/L)
    vitaminB12: (t) => extractVitaminB12(t),   // pmol/L
    ferritin: (t) => extractFerritinSolid(t),  // ug/L
    urineAlbumin: (t) => extractUrineAlbumin(t),
    albuminCreatinineRatio: (t) => extractACR(t),
};

// Convenience: run everything and return a {key:value} map
export const runAllExtractors = (text) =>
    Object.fromEntries(Object.entries(EXTRACTORS).map(([k, fn]) => [k, fn(text).value || ""]));
