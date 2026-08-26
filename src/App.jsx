import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import AccountPending from './components/AccountPending';
import LoadingSpinner from './components/LoadingSpinner';
import AppLayout from './components/AppLayout';
import { NAV_ITEMS } from './components/Sidebar';

// Sprint 2 Pages
import Dashboard from './pages/Dashboard';
import Pos from './pages/Pos';
import MenuManagement from './pages/MenuManagement';
import Inventory from './pages/Inventory';
import OrderHistory from './pages/OrderHistory';
import Reports from './pages/Reports';
import StaffManagement from './pages/StaffManagement';
import Settings from './pages/Settings';

import { ShieldAlert, LogOut } from 'lucide-react';

export default function App() {
  const { user, profile, organization, loading, isPageAllowed, signOut } = useAuth();
  const [authView, setAuthView] = useState('signup'); // 'signup' | 'login'
  const [activePage, setActivePage] = useState('dashboard');
  const [unauthorizedMessage, setUnauthorizedMessage] = useState(null);

  // Auto-dismiss unauthorized flash message after 6 seconds
  useEffect(() => {
    if (unauthorizedMessage) {
      const timer = setTimeout(() => setUnauthorizedMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [unauthorizedMessage]);

  // Route Guard Navigator
  const handleNavigate = (pageKey) => {
    const isAllowed = isPageAllowed(pageKey);
    const item = NAV_ITEMS.find((n) => n.key === pageKey);
    const pageTitle = item ? item.label : pageKey;
    const currentRole = profile?.role || 'staff';

    if (isAllowed) {
      setActivePage(pageKey);
      setUnauthorizedMessage(null);
    } else {
      // Unauthorized direct navigation attempt -> Redirect to dashboard & alert
      setActivePage('dashboard');
      setUnauthorizedMessage(
        `Access Denied: Your role (${currentRole}) is not permitted to access ${pageTitle}.`
      );
    }
  };

  // When role changes (e.g. via testing switcher), verify current page is still allowed
  useEffect(() => {
    if (activePage !== 'dashboard' && !isPageAllowed(activePage)) {
      setActivePage('dashboard');
      const item = NAV_ITEMS.find((n) => n.key === activePage);
      const pageTitle = item ? item.label : activePage;
      const currentRole = profile?.role || 'staff';
      setUnauthorizedMessage(
        `Access Denied: Your role was changed to ${currentRole}, which cannot view ${pageTitle}. Redirected to Dashboard.`
      );
    }
  }, [profile?.role, isPageAllowed, activePage]);

  // 1. Loading State
  if (loading) {
    return <LoadingSpinner message="Loading POS Application..." />;
  }

  // 2. Unauthenticated State
  if (!user) {
    return authView === 'signup' ? (
      <SignUp onNavigateToLogin={() => setAuthView('login')} />
    ) : (
      <Login onNavigateToSignUp={() => setAuthView('signup')} />
    );
  }

  // 3. Authenticated State: Payment Gatekeeper Check (Status 0 vs 10)
  const orgStatus = organization ? organization.status : 0;

  if (orgStatus === 0) {
    return <AccountPending />;
  }

  if (orgStatus === 10) {
    const renderPageContent = () => {
      switch (activePage) {
        case 'dashboard':
          return <Dashboard onNavigateToPage={handleNavigate} />;
        case 'pos':
          return <Pos />;
        case 'menu_management':
          return <MenuManagement />;
        case 'inventory':
          return <Inventory />;
        case 'order_history':
          return <OrderHistory />;
        case 'reports':
          return <Reports />;
        case 'staff_management':
          return <StaffManagement />;
        case 'settings':
          return <Settings />;
        default:
          return <Dashboard onNavigateToPage={handleNavigate} />;
      }
    };

    return (
      <AppLayout
        activePage={activePage}
        onNavigate={handleNavigate}
        unauthorizedMessage={unauthorizedMessage}
        onClearUnauthorized={() => setUnauthorizedMessage(null)}
      >
        {renderPageContent()}
      </AppLayout>
    );
  }

  // Other status (e.g. suspended)
  return (
    <div className="gate-screen">
      <div className="gate-card">
        <div className="gate-icon-wrapper" style={{ borderColor: 'var(--status-danger-border)', color: 'var(--status-danger-text)' }}>
          <ShieldAlert size={36} />
        </div>
        <span className="badge badge-muted" style={{ marginBottom: '0.85rem' }}>
          Status Code: {orgStatus}
        </span>
        <h1 className="gate-title">Account Notice</h1>
        <div className="gate-message-box" style={{ background: 'var(--status-danger-bg)', borderColor: 'var(--status-danger-border)' }}>
          <p className="gate-message-text" style={{ color: '#fca5a5' }}>
            Your account status ({orgStatus}) requires attention. Please contact support.
          </p>
        </div>
        <div className="gate-actions" style={{ justifyContent: 'center' }}>
          <button type="button" onClick={signOut} className="btn btn-secondary">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
