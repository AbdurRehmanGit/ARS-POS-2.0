import React from 'react';
import { 
  Building2, 
  CheckCircle2, 
  ShoppingBag, 
  UtensilsCrossed, 
  Receipt, 
  BarChart3, 
  Users, 
  Boxes,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard({ onNavigateToPage }) {
  const { organization, profile, user } = useAuth();
  const restaurantName = organization?.name || 'Restaurant';
  const currentRole = profile?.role || 'owner';

  const quickStats = [
    { title: 'POS Terminal', desc: 'Active Cashier & Orders', icon: ShoppingBag, page: 'pos', color: '#f97316' },
    { title: 'Menu Catalog', desc: 'Categories & Items', icon: UtensilsCrossed, page: 'menu_management', color: '#3b82f6' },
    { title: 'Order History', desc: 'Receipts & Sales', icon: Receipt, page: 'order_history', color: '#10b981' },
    { title: 'Reports', desc: 'Analytics & Revenue', icon: BarChart3, page: 'reports', color: '#8b5cf6' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Hero Welcome Banner */}
      <section className="dashboard-hero" style={{ margin: 0 }}>
        <div className="dashboard-header-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="badge badge-active">
                <CheckCircle2 size={13} />
                <span>Account Active (Status 10)</span>
              </span>
              <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>
                Role: {currentRole}
              </span>
            </div>
            <h1 className="welcome-title">Welcome, {restaurantName}</h1>
          </div>
        </div>

        <p className="dashboard-desc">
          Manage your restaurant operations, point of sale terminals, menu catalog, and billing in one unified dashboard.
        </p>
      </section>

      {/* Quick Launch Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {quickStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div 
              key={idx} 
              className="card"
              style={{
                cursor: 'pointer',
                transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onClick={() => onNavigateToPage(stat.page)}
            >
              <div>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-md)',
                  background: `${stat.color}15`,
                  color: stat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem'
                }}>
                  <Icon size={22} />
                </div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{stat.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{stat.desc}</p>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary-orange)', fontSize: '0.825rem', fontWeight: 700 }}>
                <span>Launch {stat.title}</span>
                <ArrowRight size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Restaurant Overview Card */}
      <div className="card">
        <h2 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={18} color="var(--primary-orange)" />
          <span>Restaurant Tenant Information</span>
        </h2>

        <div className="tenant-grid">
          <div className="tenant-item">
            <span className="tenant-item-label">Restaurant Name</span>
            <span className="tenant-item-val">{organization?.name || 'N/A'}</span>
          </div>

          <div className="tenant-item">
            <span className="tenant-item-label">Account Owner</span>
            <span className="tenant-item-val">{profile?.full_name || organization?.owner_name || 'N/A'}</span>
          </div>

          <div className="tenant-item">
            <span className="tenant-item-label">Owner Email</span>
            <span className="tenant-item-val">{profile?.email || user?.email || 'N/A'}</span>
          </div>

          <div className="tenant-item">
            <span className="tenant-item-label">Contact Phone</span>
            <span className="tenant-item-val">{profile?.phone || organization?.phone || 'Not specified'}</span>
          </div>

          <div className="tenant-item">
            <span className="tenant-item-label">Tax Rate</span>
            <span className="tenant-item-val">{organization?.tax_percent ?? 0}%</span>
          </div>

          <div className="tenant-item">
            <span className="tenant-item-label">Organization UUID</span>
            <span className="tenant-item-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem' }}>
              {organization?.id || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
