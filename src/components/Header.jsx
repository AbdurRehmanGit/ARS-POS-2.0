import React from 'react';
import { Menu, Shield, User, Utensils } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAV_ITEMS } from './Sidebar';

export default function Header({ activePage, onToggleMobile }) {
  const { organization, profile } = useAuth();

  const currentPageItem = NAV_ITEMS.find((item) => item.key === activePage) || {
    label: 'Dashboard',
  };

  const currentRole = profile?.role || 'owner';

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          onClick={onToggleMobile}
          className="mobile-menu-btn"
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="page-breadcrumb">
          <span>{currentPageItem.label}</span>
        </div>
      </div>

      <div className="header-right">
        {/* Role Badge */}
        <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>
          <Shield size={12} color="var(--primary-orange)" />
          <span>Role: {currentRole}</span>
        </span>

        {/* Restaurant Name Tag */}
        <span className="badge badge-active">
          {organization?.name || 'Restaurant POS'}
        </span>
      </div>
    </header>
  );
}
