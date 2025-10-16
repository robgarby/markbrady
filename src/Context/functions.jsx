
import { jwtDecode } from "jwt-decode";

export async function getUserFromToken() {
    const token = localStorage.getItem('gdmtToken');
    if (!token) return null;
    // Import jwt-decode if not already imported
    // import jwt_decode from "jwt-decode";
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