import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { AlertCircle, X } from 'lucide-react';

export default function AppLayout({ 
  activePage, 
  onNavigate, 
  unauthorizedMessage, 
  onClearUnauthorized, 
  children 
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Persistent Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main App Content Viewport */}
      <div className="main-wrapper">
        <Header
          activePage={activePage}
          onToggleMobile={() => setIsMobileOpen(!isMobileOpen)}
          onDirectNavigate={onNavigate}
        />

        <main className="page-container">
          {/* Flash Unauthorized Warning Banner */}
          {unauthorizedMessage && (
            <div className="unauthorized-banner" role="alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{unauthorizedMessage}</span>
              </div>
              <button
                type="button"
                onClick={onClearUnauthorized}
                className="btn btn-ghost"
                style={{ padding: '0.2rem', color: '#fca5a5' }}
                aria-label="Dismiss alert"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
