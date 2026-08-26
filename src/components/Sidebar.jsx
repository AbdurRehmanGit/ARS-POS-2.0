import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  UtensilsCrossed, 
  Boxes, 
  Receipt, 
  BarChart3, 
  Users, 
  Settings, 
  LogOut, 
  Utensils, 
  User,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pos', label: 'Point of Sale', icon: ShoppingBag },
  { key: 'menu_management', label: 'Menu Management', icon: UtensilsCrossed },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'order_history', label: 'Order History', icon: Receipt },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'staff_management', label: 'Staff Management', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activePage, onNavigate, isMobileOpen, onCloseMobile }) {
  const { organization, profile, user, signOut, isPageAllowed } = useAuth();

  // Filter items: 'owner' sees all; other roles see only allowed pages
  const visibleNavItems = NAV_ITEMS.filter((item) => isPageAllowed(item.key));

  const handleNavClick = (pageKey) => {
    onNavigate(pageKey);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        {/* Header Branding */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              {organization?.logo_url ? (
                <img src={organization.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }} />
              ) : (
                <img src="/logo.png" alt="AR Softwares" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">{organization?.name || 'My Restaurant'}</span>
              <span className="sidebar-brand-sub">ARS POS 2.0</span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-heading">Main Navigation</div>

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavClick(item.key)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <span className="nav-item-icon">
                  <Icon size={18} />
                </span>
                <span className="nav-item-title">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer User Profile Card */}
        <div className="sidebar-footer">
          <div className="profile-card">
            <div className="profile-info">
              <div className="profile-avatar">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User size={14} />}
              </div>
              <div className="profile-details">
                <span className="profile-name">{profile?.full_name || user?.email}</span>
                <span className="profile-role">{profile?.role || 'staff'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="btn btn-ghost"
              title="Sign Out"
              style={{ padding: '0.4rem', color: 'var(--text-muted)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
