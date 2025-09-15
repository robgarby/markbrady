// src/components/Dashboard/dashboard.component.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/markbrady.png';
import { useGlobalContext } from '../../Context/global.context';

// Read values forwarded from package.json via env (see package.json scripts)
const version = process.env.REACT_APP_VERSION ?? 'Version 2.2.0';
const builtAt = process.env.REACT_APP_BUILT_AT ?? 'Wed Sept 14 -12:30 PM';
const fixNote = process.env.REACT_APP_FIX_NOTE ?? 'This has the 3 Labs - but not two line Meds yet cause of what you are suggesting.. I stopped on that.';

const DashBoard = () => {
  const navigate = useNavigate();
  const { setVisibleBox, visibleBox } = useGlobalContext(); // kept for consistency if used elsewhere

  const logout = () => {
    localStorage.removeItem('creds');
    window.location.href = '/signin';
  };

  const handleUploadClick = () => navigate('/upload');
  const handleDatabase = () => navigate('/database');

  return (
    <div className="container-fluid bg-light min-vh-100 d-flex align-items-center justify-content-center">
      <div className="col-36 bg-light">
        <div className="col-48 text-center mb-5">
          <img src={logo} alt="Dashboard Logo" style={{ maxWidth: '300px', height: 'auto' }} />
        </div>

        {/* Version banner (from package.json via env) */}
        <div className="col-48 text-muted text-center fs-7 mb-3">
          Version {version}{builtAt ? ` — ${builtAt}` : ''}
        </div>
        <div className="col-48 text-danger text-center fs-7 mb-3">
          {fixNote}
        </div>

        <div className="d-flex gap-2 flex-wrap justify-content-center">
          <div className="col-48 col-md-16 text-center mb-3">
            <button className="btn btn-primary w-100" onClick={handleUploadClick}>
              Upload New Lab
            </button>
          </div>
          <div className="col-48 col-md-16 text-center mb-3">
            <button className="btn btn-info w-100" onClick={handleDatabase}>
              Work on Database
            </button>
          </div>
          <div className="col-48 col-md-16 text-center">
            <button className="btn btn-danger w-100" onClick={logout}>
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashBoard;
