import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon, Save, Upload, Building2, Percent,
  ChefHat, Shield, KeyRound, Mail, Check, X, AlertCircle,
  RefreshCw, User, Users, ToggleLeft, ToggleRight, Eye, EyeOff,
  Coins
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CURRENCIES, DEFAULT_CURRENCY } from '../utils/currency';

const PAGE_KEYS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pos', label: 'POS' },
  { key: 'menu_management', label: 'Menu Mgmt' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'order_history', label: 'Orders' },
  { key: 'reports', label: 'Reports' },
  { key: 'staff_management', label: 'Staff Mgmt' },
  { key: 'settings', label: 'Settings' },
];

const ROLES = ['manager', 'cashier', 'waiter'];
const ROLE_LABELS = { manager: 'Manager', cashier: 'Cashier', waiter: 'Waiter' };

export default function Settings() {
  const { organization, profile, user, refreshOrganization } = useAuth();

  // Profile section state
  const [profileForm, setProfileForm] = useState({
    name: '', owner_name: '', phone: '', address: '',
    tax_percent: '0', kitchen_invoice_enabled: false,
    currency: DEFAULT_CURRENCY,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Role permissions matrix
  const [permissions, setPermissions] = useState({});
  const [savingPerms, setSavingPerms] = useState(false);
  const [permsLoaded, setPermsLoaded] = useState(false);

  // Password section
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [staffWithAccess, setStaffWithAccess] = useState([]);
  const [selectedStaffReset, setSelectedStaffReset] = useState('');
  const [staffResetSending, setStaffResetSending] = useState(false);
  const [staffResetSent, setStaffResetSent] = useState('');

  // Notifications
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Populate profile form from organization context
  useEffect(() => {
    if (organization) {
      setProfileForm({
        name: organization.name || '',
        owner_name: organization.owner_name || '',
        phone: organization.phone || '',
        address: organization.address || '',
        tax_percent: (organization.tax_percent ?? 0).toString(),
        kitchen_invoice_enabled: organization.kitchen_invoice_enabled ?? false,
        currency: organization.currency || DEFAULT_CURRENCY,
      });
      if (organization.logo_url) setLogoPreview(organization.logo_url);
    }
  }, [organization]);

  // Load Role Permissions from DB
  const loadPermissions = useCallback(async () => {
    if (!organization?.id) return;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error: err } = await supabase
          .from('role_permissions')
          .select('role, page_key, allowed')
          .eq('organization_id', organization.id);
        if (err) throw err;

        const matrix = {};
        // Default: all false
        ROLES.forEach((role) => {
          matrix[role] = {};
          PAGE_KEYS.forEach((p) => { matrix[role][p.key] = false; });
        });
        // Fill from DB
        (data || []).forEach((row) => {
          if (matrix[row.role]) {
            matrix[row.role][row.page_key] = row.allowed;
          }
        });
        setPermissions(matrix);
      } else {
        // Default sensible permissions for sandbox
        const matrix = {};
        ROLES.forEach((role) => {
          matrix[role] = {};
          PAGE_KEYS.forEach((p) => {
            matrix[role][p.key] = ['dashboard', 'pos'].includes(p.key);
          });
        });
        setPermissions(matrix);
      }
      setPermsLoaded(true);
    } catch (err) {
      console.error('Error loading permissions:', err);
      setError('Failed to load role permissions.');
    }
  }, [organization?.id]);

  // Load staff with dashboard access for password reset
  const loadStaffWithAccess = useCallback(async () => {
    if (!organization?.id) return;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data } = await supabase
          .from('staff')
          .select('id, name, email')
          .eq('organization_id', organization.id)
          .eq('has_dashboard_access', true);
        setStaffWithAccess(data || []);
      }
    } catch (_) {}
  }, [organization?.id]);

  useEffect(() => {
    loadPermissions();
    loadStaffWithAccess();
  }, [loadPermissions, loadStaffWithAccess]);

  // 1. Save Restaurant Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      const updates = {
        name: profileForm.name.trim(),
        owner_name: profileForm.owner_name.trim(),
        phone: profileForm.phone.trim() || null,
        address: profileForm.address.trim() || null,
        tax_percent: parseFloat(profileForm.tax_percent) || 0,
        kitchen_invoice_enabled: profileForm.kitchen_invoice_enabled,
        currency: profileForm.currency || DEFAULT_CURRENCY,
      };

      if (isSupabaseConfigured() && supabase) {
        const { error: err } = await supabase
          .from('organizations')
          .update(updates)
          .eq('id', organization.id);
        if (err) throw err;
      } else {
        // Sandbox update
        const sandbox = JSON.parse(localStorage.getItem('restaurant_pos_sandbox_data') || '{}');
        if (sandbox.organizations) {
          const idx = sandbox.organizations.findIndex((o) => o.id === organization.id);
          if (idx !== -1) {
            sandbox.organizations[idx] = { ...sandbox.organizations[idx], ...updates };
            localStorage.setItem('restaurant_pos_sandbox_data', JSON.stringify(sandbox));
          }
        }
      }

      // Refresh auth context so POS & other pages pick up new settings
      if (typeof refreshOrganization === 'function') {
        await refreshOrganization();
      }

      showSuccess('Restaurant profile and currency saved successfully!');
    } catch (err) {
      setError(err.message || 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // 2. Upload Logo
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!logoFile || !organization?.id) return;
    setUploadingLogo(true);
    setError(null);
    try {
      if (isSupabaseConfigured() && supabase) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${organization.id}/logo.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile, { upsert: true, contentType: logoFile.type });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        const { error: updateErr } = await supabase
          .from('organizations')
          .update({ logo_url: publicUrl })
          .eq('id', organization.id);

        if (updateErr) throw updateErr;
        setLogoPreview(publicUrl);
        if (typeof refreshOrganization === 'function') await refreshOrganization();
        showSuccess('Logo uploaded and saved!');
      } else {
        showSuccess('Logo preview saved (connect Supabase Storage to persist).');
      }
    } catch (err) {
      setError(`Logo upload failed: ${err.message}. Ensure a public "logos" bucket exists in Supabase Storage.`);
    } finally {
      setUploadingLogo(false);
      setLogoFile(null);
    }
  };

  // 3. Toggle permission in matrix (local state)
  const handleTogglePermission = (role, pageKey) => {
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [pageKey]: !prev[role]?.[pageKey],
      },
    }));
  };

  // 4. Save Permissions
  const handleSavePermissions = async () => {
    setSavingPerms(true);
    setError(null);
    try {
      if (isSupabaseConfigured() && supabase) {
        const rows = [];
        ROLES.forEach((role) => {
          PAGE_KEYS.forEach((p) => {
            rows.push({
              organization_id: organization.id,
              role,
              page_key: p.key,
              allowed: permissions[role]?.[p.key] ?? false,
            });
          });
        });

        // Upsert all permission rows
        const { error: err } = await supabase
          .from('role_permissions')
          .upsert(rows, { onConflict: 'organization_id,role,page_key' });

        if (err) throw err;
      }
      showSuccess('Role permissions updated! Staff will see changes on their next login.');
    } catch (err) {
      setError(err.message || 'Failed to save permissions.');
    } finally {
      setSavingPerms(false);
    }
  };

  // 5. Reset My Password
  const handleResetMyPassword = async () => {
    if (!user?.email) return;
    setResetSending(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: err } = await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: window.location.origin,
        });
        if (err) throw err;
      }
      setResetSent(true);
      showSuccess(`Password reset email sent to ${user.email}`);
    } catch (err) {
      setError(err.message || 'Failed to send password reset.');
    } finally {
      setResetSending(false);
    }
  };

  // 6. Reset Staff Password
  const handleResetStaffPassword = async () => {
    const staffMember = staffWithAccess.find((s) => s.id === selectedStaffReset);
    if (!staffMember?.email) return;
    setStaffResetSending(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: err } = await supabase.auth.resetPasswordForEmail(staffMember.email, {
          redirectTo: window.location.origin,
        });
        if (err) throw err;
      }
      setStaffResetSent(staffMember.name);
      showSuccess(`Password reset email sent to ${staffMember.name} (${staffMember.email})`);
    } catch (err) {
      setError(err.message || 'Failed to send staff password reset.');
    } finally {
      setStaffResetSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <SettingsIcon size={28} color="var(--primary-orange)" />
          <span>Settings</span>
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Configure your restaurant profile, tax rates, kitchen invoice, role permissions, and password management.</p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 0 }}>
          <AlertCircle size={18} /><span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '2px' }}><X size={16} /></button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 0 }}>
          <Check size={18} /><span>{successMsg}</span>
        </div>
      )}

      {/* ============================================================
          SECTION 1: RESTAURANT PROFILE
          ============================================================ */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
          <Building2 size={20} color="var(--primary-orange)" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Restaurant Profile</h2>
        </div>

        {/* Logo Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-lg)', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', overflow: 'hidden', flexShrink: 0 }}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Building2 size={28} color="#cbd5e1" />
            }
          </div>
          <div>
            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
              <Upload size={15} /><span>Choose Logo</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
            </label>
            {logoFile && (
              <button type="button" onClick={handleUploadLogo} disabled={uploadingLogo} className="btn btn-primary" style={{ marginLeft: '0.65rem', background: 'var(--primary-orange)', border: 'none', color: '#fff', fontSize: '0.875rem' }}>
                {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
              </button>
            )}
            <p style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.35rem' }}>PNG, JPG or SVG · Max 2 MB · Appears on printed receipts</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Restaurant Name <span className="required-mark">*</span></label>
              <input type="text" className="form-input" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Owner Name</label>
              <input type="text" className="form-input" value={profileForm.owner_name} onChange={(e) => setProfileForm({ ...profileForm, owner_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-input" placeholder="03xx-xxxxxxx" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Percent size={14} color="var(--primary-orange)" />
                Tax Rate (%)
              </label>
              <input type="number" min="0" max="100" step="0.01" className="form-input" value={profileForm.tax_percent} onChange={(e) => setProfileForm({ ...profileForm, tax_percent: e.target.value })} />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Applied to every POS order automatically.</p>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Coins size={14} color="var(--primary-orange)" />
                Account Currency <span className="required-mark">*</span>
              </label>
              <select
                className="form-input"
                value={profileForm.currency}
                onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })}
                style={{ fontWeight: 700, background: '#fff' }}
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.label}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                Applied across all POS orders, menus, inventory, and receipts.
              </p>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Address</label>
              <input type="text" className="form-input" placeholder="Shop/Building, Street, City" value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} />
            </div>
          </div>

          {/* Kitchen Invoice Toggle */}
          <div style={{ margin: '1.25rem 0', padding: '1rem 1.25rem', background: profileForm.kitchen_invoice_enabled ? '#f0fdf4' : '#f8fafc', border: `1px solid ${profileForm.kitchen_invoice_enabled ? '#a7f3d0' : '#e2e8f0'}`, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', transition: 'all var(--transition-fast)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ChefHat size={22} color={profileForm.kitchen_invoice_enabled ? '#10b981' : '#94a3b8'} />
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>Kitchen Invoice Generator</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  When ON, a kitchen-facing ticket (items only, no prices) is printed alongside the customer receipt at checkout.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setProfileForm({ ...profileForm, kitchen_invoice_enabled: !profileForm.kitchen_invoice_enabled })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              aria-label="Toggle kitchen invoice"
            >
              {profileForm.kitchen_invoice_enabled
                ? <ToggleRight size={42} color="#10b981" />
                : <ToggleLeft size={42} color="#cbd5e1" />
              }
            </button>
          </div>

          <button type="submit" disabled={savingProfile} className="btn btn-primary" style={{ background: 'var(--primary-orange)', color: '#fff', border: 'none' }}>
            <Save size={16} />
            <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>
      </section>

      {/* ============================================================
          SECTION 2: ROLE-WISE PAGE ACCESS MATRIX
          ============================================================ */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Shield size={20} color="var(--primary-orange)" />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Role-Wise Page Access</h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Control which pages each staff role can access. Owners always have full access.</p>
            </div>
          </div>
          <button type="button" onClick={handleSavePermissions} disabled={savingPerms || !permsLoaded} className="btn btn-primary" style={{ background: 'var(--primary-orange)', color: '#fff', border: 'none' }}>
            <Save size={15} /><span>{savingPerms ? 'Saving...' : 'Save Permissions'}</span>
          </button>
        </div>

        {!permsLoaded ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading permissions...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.65rem 0.75rem', background: '#f8fafc', textAlign: 'left', fontWeight: 800, fontSize: '0.775rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid #e2e8f0', minWidth: '100px' }}>Role</th>
                  {PAGE_KEYS.map((p) => (
                    <th key={p.key} style={{ padding: '0.65rem 0.5rem', background: '#f8fafc', textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Owner row — always all access, read-only */}
                <tr>
                  <td style={{ padding: '0.75rem', fontWeight: 800, color: '#c2410c', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Shield size={13} />Owner
                    </span>
                  </td>
                  {PAGE_KEYS.map((p) => (
                    <td key={p.key} style={{ textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                      <Check size={16} color="#10b981" />
                    </td>
                  ))}
                </tr>
                {/* Editable roles */}
                {ROLES.map((role) => (
                  <tr key={role}>
                    <td style={{ padding: '0.75rem', fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>
                      {ROLE_LABELS[role]}
                    </td>
                    {PAGE_KEYS.map((p) => {
                      const isAllowed = permissions[role]?.[p.key] ?? false;
                      return (
                        <td key={p.key} style={{ textAlign: 'center', borderBottom: '1px solid #f1f5f9', padding: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleTogglePermission(role, p.key)}
                            aria-label={`${isAllowed ? 'Revoke' : 'Grant'} ${ROLE_LABELS[role]} access to ${p.label}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', transition: 'all var(--transition-fast)', background: isAllowed ? '#ecfdf5' : '#f8fafc', border: `1px solid ${isAllowed ? '#a7f3d0' : '#e2e8f0'}` }}
                          >
                            {isAllowed
                              ? <Check size={15} color="#10b981" strokeWidth={2.5} />
                              : <X size={15} color="#cbd5e1" strokeWidth={2} />
                            }
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============================================================
          SECTION 3: PASSWORD MANAGEMENT
          ============================================================ */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
          <KeyRound size={20} color="var(--primary-orange)" />
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Password Management</h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Trigger Supabase password reset emails for yourself or your staff.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {/* My Password */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <User size={17} color="var(--primary-orange)" />
              <h3 style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', margin: 0 }}>Reset My Password</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
              Sends a secure password reset link to <strong>{user?.email}</strong>.
            </p>
            {resetSent ? (
              <div className="alert alert-success" style={{ margin: 0, padding: '0.65rem 0.85rem' }}>
                <Check size={15} /><span>Reset email sent! Check your inbox.</span>
              </div>
            ) : (
              <button type="button" onClick={handleResetMyPassword} disabled={resetSending} className="btn btn-secondary" style={{ fontSize: '0.875rem' }}>
                <Mail size={15} /><span>{resetSending ? 'Sending...' : 'Send Reset Email'}</span>
              </button>
            )}
          </div>

          {/* Staff Password */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Users size={17} color="var(--primary-orange)" />
              <h3 style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', margin: 0 }}>Reset Staff Password</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
              Send a password reset email to a staff member who has dashboard access.
            </p>
            {staffWithAccess.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No staff members with dashboard access yet.</p>
            ) : (
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <select className="form-input" value={selectedStaffReset} onChange={(e) => { setSelectedStaffReset(e.target.value); setStaffResetSent(''); }} style={{ flex: 1, minWidth: '160px', background: '#fff' }}>
                  <option value="">Select staff member...</option>
                  {staffWithAccess.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
                {staffResetSent ? (
                  <span className="badge badge-active" style={{ alignSelf: 'center' }}>
                    <Check size={13} /> Sent to {staffResetSent}
                  </span>
                ) : (
                  <button type="button" onClick={handleResetStaffPassword} disabled={!selectedStaffReset || staffResetSending} className="btn btn-secondary" style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    <Mail size={15} /><span>{staffResetSending ? 'Sending...' : 'Send Reset'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
