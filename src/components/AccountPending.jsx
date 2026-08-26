import React, { useState } from 'react';
import { 
  ShieldAlert, 
  RotateCw, 
  LogOut, 
  Building2, 
  Mail, 
  Phone, 
  User, 
  Database, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfigAlert from './ConfigAlert';

export default function AccountPending() {
  const { organization, profile, user, signOut, refreshTenantStatus, isSandboxMode, updateSandboxOrgStatus } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showTester, setShowTester] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshTenantStatus();
    setTimeout(() => setRefreshing(false), 500);
  };

  const sqlCommand = organization?.id
    ? `UPDATE public.organizations\nSET status = 10\nWHERE id = '${organization.id}';`
    : `UPDATE public.organizations\nSET status = 10\nWHERE name = '${organization?.name || 'My Restaurant'}';`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlCommand);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <main className="gate-screen">
      <ConfigAlert />

      <div className="gate-card">
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <img src="/logo.png" alt="AR Softwares - ARS POS 2.0" style={{ height: '60px', width: 'auto', margin: '0 auto 0.5rem auto' }} />
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ARS POS 2.0</div>
        </div>

        <div className="gate-icon-wrapper">
          <ShieldAlert size={36} />
        </div>

        <span className="badge badge-pending" style={{ marginBottom: '0.85rem' }}>
          Status: 0 • Inactive
        </span>

        <h1 className="gate-title">Account Pending Activation</h1>

        <div className="gate-message-box">
          <p className="gate-message-text">
            Your account is not yet active. Please contact support to complete your subscription payment.
          </p>
        </div>

        {/* Tenant Details Summary */}
        <div className="tenant-info-card">
          <div className="tenant-info-title">Account &amp; Tenant Details</div>
          <div className="tenant-grid">
            <div className="tenant-item">
              <span className="tenant-item-label">Restaurant</span>
              <span className="tenant-item-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Building2 size={14} color="var(--primary)" />
                {organization?.name || 'Pending...'}
              </span>
            </div>

            <div className="tenant-item">
              <span className="tenant-item-label">Owner Name</span>
              <span className="tenant-item-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} color="var(--text-muted)" />
                {profile?.full_name || organization?.owner_name || 'Owner'}
              </span>
            </div>

            <div className="tenant-item">
              <span className="tenant-item-label">Registered Email</span>
              <span className="tenant-item-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} color="var(--text-muted)" />
                {profile?.email || user?.email || 'N/A'}
              </span>
            </div>

            <div className="tenant-item">
              <span className="tenant-item-label">Phone</span>
              <span className="tenant-item-val" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={14} color="var(--text-muted)" />
                {profile?.phone || organization?.phone || 'Not provided'}
              </span>
            </div>

            <div className="tenant-item" style={{ gridColumn: '1 / -1' }}>
              <span className="tenant-item-label">Organization UUID</span>
              <span className="tenant-item-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {organization?.id || 'Pending...'}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="gate-actions">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            <RotateCw size={16} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Checking...' : 'Check Status'}</span>
          </button>

          <button
            type="button"
            onClick={signOut}
            className="btn btn-ghost"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Test Checklist Assistant & SQL Snippet */}
        <div className="dev-helper">
          <div 
            className="dev-helper-summary"
            onClick={() => setShowTester(!showTester)}
          >
            <Database size={15} />
            <span>Sprint Test Checklist: How to activate this account</span>
            {showTester ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>

          {showTester && (
            <div className="dev-helper-content">
              <p style={{ marginBottom: '0.6rem', color: 'var(--text-secondary)' }}>
                To test the payment gate transition per the sprint checklist:
              </p>
              <ol style={{ paddingLeft: '1.2rem', marginBottom: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li>Run the following SQL in your <strong>Supabase SQL Editor</strong> to update status to 10:</li>
              </ol>

              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <pre className="code-box" style={{ margin: 0, paddingRight: '2.5rem' }}>
                  {sqlCommand}
                </pre>
                <button
                  type="button"
                  onClick={copySql}
                  title="Copy SQL"
                  className="btn btn-ghost"
                  style={{ position: 'absolute', right: '4px', top: '4px', padding: '0.3rem' }}
                >
                  {copiedSql ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.775rem' }}>
                Then click <strong>"Check Status"</strong> or log out and log back in to access the placeholder dashboard!
              </p>

              {isSandboxMode && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                  <button
                    type="button"
                    onClick={() => updateSandboxOrgStatus(10)}
                    className="btn btn-primary btn-block"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Sparkles size={16} />
                    <span>Simulate Payment Now (Set Status = 10)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .spinning {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
