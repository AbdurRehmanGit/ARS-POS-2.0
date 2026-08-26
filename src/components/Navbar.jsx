import React from 'react';
import { Utensils, LogOut, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, profile, organization, signOut } = useAuth();

  return (
    <header className="app-navbar">
      <div className="navbar-brand">
        <div className="navbar-brand-icon">
          <Utensils size={18} />
        </div>
        <div>
          <span>{organization?.name || 'Restaurant POS'}</span>
        </div>
      </div>

      <div className="navbar-actions">
        {organization && (
          <span className={`badge ${organization.status === 10 ? 'badge-active' : 'badge-pending'}`}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: organization.status === 10 ? '#10b981' : '#f59e0b'
            }} />
            {organization.status === 10 ? 'Status: Active (10)' : `Status: Pending (${organization.status})`}
          </span>
        )}

        <div className="user-badge">
          <div className="user-avatar">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User size={14} />}
          </div>
          <div className="user-meta">
            <span className="user-name">{profile?.full_name || user?.email}</span>
            <span className="user-role-tag">{profile?.role || 'Member'}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="btn btn-ghost"
          title="Sign Out"
          style={{ padding: '0.45rem 0.75rem', fontSize: '0.825rem' }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
