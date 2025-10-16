// signIn.component.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./signin.style.scss";
import logo from "../../assets/markbrady.png";

const PRIMARY_API = "https://www.gdmt.ca/PHP/abc.php";

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  // ✅ use the React context properly


  // Parse JSON even if server prints warnings before/after it
  const safeParseJSON = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      if (s !== -1 && e !== -1 && e > s) {
        try { return JSON.parse(raw.slice(s, e + 1)); } catch { /* noop */ }
      }
      return null;
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      // ✅ form-encoded body = what PHP expects for $_POST
      const res = await fetch(PRIMARY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "login", username, password })
      });

      const data = await res.json();
      if (data.success && data.jwt) {
        localStorage.setItem("gdmtToken", data.jwt);
        navigate("/dashboard");
        return;
      }

      // Not success
      console.warn("Login failed payload:", data);
      localStorage.clear();
      alert("Invalid username or password");
    } catch (err) {
      console.error("Sign-in error:", err);
      localStorage.clear();
      alert("Error signing in. Please try again.");
    }
  };

  return (
    <div className="container-fluid min-vh-100 bg-light d-flex align-items-center justify-content-center">
      <div className="row w-100 justify-content-center">
        <div className="col-48 col-md-24 col-lg-16 bg-white p-4 shadow rounded">
          <form onSubmit={handleSignIn}>
            <div className="text-center mb-4">
              <img className="logo" src={logo} alt="Logo" style={{ maxWidth: "300px" }} />
              <h2 className="mt-3">Sign In</h2>
            </div>

            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            <div className="d-grid">
              <button type="submit" className="btn btn-primary">Sign In</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
