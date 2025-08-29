import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './signin.style.scss';
import logo from '../../assets/markbrady.png';

const SignIn = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignIn = (e) => {
    e.preventDefault();
    if (username === 'MBrady' && password === 'MAKN2025++') {
     localStorage.setItem('creds', 'true');
      navigate('/dashboard');
    } else {
     localStorage.clear();
      alert('Invalid username or password');
    }
  };

  return (
    <div className="container-fluid min-vh-100 bg-light d-flex align-items-center justify-content-center">
      <div className="row w-100 justify-content-center">
        <div className="col-48 col-md-24 col-lg-16 bg-white p-4 shadow rounded">
          <form onSubmit={handleSignIn}>
            <div className="text-center mb-4">
              <img className="logo" src={logo} alt="Logo" style={{ maxWidth: '300px' }} />
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
              <button type="submit" className="btn btn-primary">
                Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
