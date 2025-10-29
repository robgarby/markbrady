import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalContext } from './Context/global.context.jsx';
import SignIn from './components/SignIn/signIn.component';
import Dashboard from './components/Dashboard/dashboard.component';
import Database from './components/Database/Database/database.component';
import AdminPanel from './components/Admin/adminPanel.component.jsx';
import UploadThree from './components/UploadLab/uploadThree.component.jsx';
import Layout from './VSComponents/layout.component.jsx';
import { AllButtonsProvider } from './Context/buttons.context.jsx';

function App() {
  return (
    <GlobalContext>
      <AllButtonsProvider>
        <Router>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/database" element={<Database />} />
            <Route path="/dashboard-main" element={<Dashboard />} />
            <Route path="/dashboard" element={<Layout />} />
            <Route path="/upload" element={<UploadThree />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<Navigate to="/signin" />} />
          </Routes>
        </Router>
      </AllButtonsProvider>
    </GlobalContext>
  );
}

export default App;

