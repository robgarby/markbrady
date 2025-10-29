
import { jwtDecode } from "jwt-decode";
const API_BASE_URL_DATABASE = 'https://gdmt.ca/PHP/database.php';

export async function getUserFromToken() {
    const token = localStorage.getItem('gdmtToken');
    if (!token) return null;
    try {
        const decoded = jwtDecode(token);
        if (decoded && decoded.exp) {
            const expiresInMs = decoded.exp * 1000 - Date.now();
            if (expiresInMs <= 0) {
                // Token is expired
                localStorage.removeItem('gdmtToken');
                return null;
            }
        }
        return decoded;
    } catch (error) {
        console.error('Invalid token:', error);
        return null;
    }
}

export async function getButtonsFromToken() {
    const token = localStorage.getItem('gdmtButtons');
    console.log('Retrieved buttons from token:', token);
    if (!token) {
        localStorage.setItem('gdmtButtons', JSON.stringify([]));
        return [];
    }
    try {
        const parsed = JSON.parse(token);
        console.log('Parsed buttons from token:', parsed);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

export const LoadMarkBrady = async () => {
    const user = await getUserFromToken();
    if (!user) return null;

    try {
        const resp = await fetch(API_BASE_URL_DATABASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                script: 'getMarkBrady',
                patientDB: user.patientTable,
                historyDB: user.historyTable
            }),
        });
        const data = await resp.json();
        return data?.patient ?? null;   // <-- RETURN it
    } catch (e) {
        console.error('LoadMarkBrady error:', e);
        return null;                    // <-- and RETURN on error
    }
};

export const getMedicationData = async () => {
    try {
        const resp = await fetch("https://gdmt.ca/PHP/noDB.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script: "getMeds" }), // should return [{ID, medication_name, medication_cat, medication_dose}, ...]
        });
        if (!resp.ok) {
            console.error('getMedicationData fetch failed:', resp.status, resp.statusText);
            return [];
        }
        const data = await resp.json();
        return Array.isArray(data.meds) ? data.meds : [];
    } catch (err) {
        return [];
    }
};

export const getConditionData = async () => {
    try {
        const resp = await fetch('https://gdmt.ca/PHP/noDB.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: 'getConditionData' }),
      })
        const data = await resp.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        return [];
    }
};
export const getProviderList = async () => {
    try {
        const resp = await fetch('https://gdmt.ca/PHP/noDB.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: 'getProviderList' }),
      })
        const data = await resp.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        return [];
    }
};
