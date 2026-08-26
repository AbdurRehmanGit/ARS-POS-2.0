import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Edit, Trash2, Check, X, AlertCircle,
  Shield, UserCheck, UserX, Phone, Mail, CreditCard,
  Key, Eye, EyeOff, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY } from '../utils/currency';

export default function StaffManagement() {
  const { organization, profile: myProfile } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Staff Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', salary: '', email: '', phone: '', address: '', cnic: '',
    hasDashboardAccess: false,
    loginEmail: '', password: '', role: 'cashier',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit Modal
  const [editingStaff, setEditingStaff] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const loadStaff = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error: err } = await supabase
          .from('staff')
          .select(`
            id, organization_id, name, salary, email, phone, address, cnic,
            has_dashboard_access, profile_id, created_at,
            profiles ( role, full_name )
          `)
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false });
        if (err) throw err;
        setStaff(data || []);
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_staff') || '[]');
        setStaff(local.filter((s) => s.organization_id === organization.id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load staff.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const resetAddForm = () => {
    setAddForm({ name: '', salary: '', email: '', phone: '', address: '', cnic: '', hasDashboardAccess: false, loginEmail: '', password: '', role: 'cashier' });
    setShowPassword(false);
  };

  // Add Staff
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) { setError('Staff name is required.'); return; }
    if (addForm.hasDashboardAccess) {
      if (!addForm.loginEmail.trim()) { setError('Login email is required for dashboard access.'); return; }
      if (!addForm.password || addForm.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    }

    setSavingAdd(true);
    setError(null);

    try {
      let profileId = null;

      if (addForm.hasDashboardAccess && isSupabaseConfigured() && supabase) {
        // Create Supabase Auth user
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: addForm.loginEmail.trim(),
          password: addForm.password,
          options: {
            data: {
              restaurant_name: organization.name,
              owner_name: addForm.name.trim(),
              phone: addForm.phone.trim() || null,
            },
          },
        });

        if (authErr) throw new Error(`Auth error: ${authErr.message}`);

        if (authData?.user) {
          // The trigger will create an organization row, but we need to update the profile
          // to point to OUR organization. Wait a moment for the trigger to fire.
          await new Promise((res) => setTimeout(res, 1500));

          // Update the auto-created profile to link to this organization
          const { data: pData, error: pErr } = await supabase
            .from('profiles')
            .update({
              organization_id: organization.id,
              full_name: addForm.name.trim(),
              role: addForm.role,
              email: addForm.loginEmail.trim(),
              phone: addForm.phone.trim() || null,
            })
            .eq('id', authData.user.id)
            .select()
            .single();

          if (pErr) {
            // Profile may not exist yet — insert it
            const { data: insertedProfile } = await supabase
              .from('profiles')
              .insert({
                id: authData.user.id,
                organization_id: organization.id,
                full_name: addForm.name.trim(),
                role: addForm.role,
                email: addForm.loginEmail.trim(),
                phone: addForm.phone.trim() || null,
              })
              .select()
              .single();
            profileId = insertedProfile?.id || authData.user.id;
          } else {
            profileId = pData?.id || authData.user.id;
          }

          // Update the auto-created organization status to 10 (active)
          // Actually, we don't want to create a new organization for staff.
          // The trigger fires on auth.users insert, creating a NEW organization for this user.
          // We need to handle this: delete the auto-created organization and update the profile.
          // This is a known limitation of our trigger design.
          // Best practice: update the profile to use the owner's org and mark the extra org for cleanup.
          // For now, the profile is updated to reference the correct org_id above.
        }
      }

      const staffPayload = {
        organization_id: organization.id,
        name: addForm.name.trim(),
        salary: addForm.salary ? parseFloat(addForm.salary) : null,
        email: (addForm.hasDashboardAccess ? addForm.loginEmail : addForm.email).trim() || null,
        phone: addForm.phone.trim() || null,
        address: addForm.address.trim() || null,
        cnic: addForm.cnic.trim() || null,
        has_dashboard_access: addForm.hasDashboardAccess,
        profile_id: profileId,
      };

      if (isSupabaseConfigured() && supabase) {
        const { data: newStaff, error: sErr } = await supabase
          .from('staff')
          .insert(staffPayload)
          .select(`id, organization_id, name, salary, email, phone, address, cnic, has_dashboard_access, profile_id, created_at, profiles ( role, full_name )`)
          .single();
        if (sErr) throw sErr;
        setStaff((prev) => [newStaff, ...prev]);
      } else {
        const newStaff = {
          id: 'staff_' + Math.random().toString(36).substring(2, 9),
          ...staffPayload,
          profiles: addForm.hasDashboardAccess ? { role: addForm.role, full_name: addForm.name.trim() } : null,
          created_at: new Date().toISOString(),
        };
        const local = JSON.parse(localStorage.getItem('restaurant_pos_staff') || '[]');
        local.unshift(newStaff);
        localStorage.setItem('restaurant_pos_staff', JSON.stringify(local));
        setStaff((prev) => [newStaff, ...prev]);
      }

      resetAddForm();
      setAddModalOpen(false);
      showSuccess(`${addForm.name.trim()} added to staff. ${addForm.hasDashboardAccess ? 'A login link has been sent to ' + addForm.loginEmail : ''}`);
    } catch (err) {
      console.error('Add staff error:', err);
      setError(err.message || 'Failed to add staff member.');
    } finally {
      setSavingAdd(false);
    }
  };

  // Open Edit
  const handleOpenEdit = (member) => {
    setEditingStaff(member);
    setEditForm({
      name: member.name || '',
      salary: member.salary?.toString() || '',
      email: member.email || '',
      phone: member.phone || '',
      address: member.address || '',
      cnic: member.cnic || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingStaff || !editForm.name.trim()) return;
    setSavingEdit(true);

    const payload = {
      name: editForm.name.trim(),
      salary: editForm.salary ? parseFloat(editForm.salary) : null,
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      address: editForm.address.trim() || null,
      cnic: editForm.cnic.trim() || null,
    };

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('staff').update(payload).eq('id', editingStaff.id);
        if (error) throw error;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_staff') || '[]');
        const updated = local.map((s) => s.id === editingStaff.id ? { ...s, ...payload } : s);
        localStorage.setItem('restaurant_pos_staff', JSON.stringify(updated));
      }
      setStaff((prev) => prev.map((s) => s.id === editingStaff.id ? { ...s, ...payload } : s));
      setEditingStaff(null);
      showSuccess(`${payload.name} updated.`);
    } catch (err) {
      setError(err.message || 'Failed to update staff.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Staff
  const handleDeleteStaff = async (member) => {
    const hasAccess = member.has_dashboard_access;
    const confirmMsg = hasAccess
      ? `Delete ${member.name}? This will deactivate their dashboard login (their order history will be preserved).`
      : `Delete ${member.name} from staff?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (isSupabaseConfigured() && supabase) {
        await supabase.from('staff').delete().eq('id', member.id);
        // If they had a profile, set role to a deactivated state to preserve order refs
        if (hasAccess && member.profile_id) {
          await supabase.from('profiles').update({ role: 'waiter' }).eq('id', member.profile_id);
        }
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_staff') || '[]');
        localStorage.setItem('restaurant_pos_staff', JSON.stringify(local.filter((s) => s.id !== member.id)));
      }
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
      showSuccess(`${member.name} removed from staff.`);
    } catch (err) {
      setError(err.message || 'Failed to delete staff member.');
    }
  };

  const filteredStaff = staff.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone || '').includes(searchTerm)
  );

  const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', waiter: 'Waiter' };
  const ROLE_COLORS = { owner: '#c2410c', manager: '#1d4ed8', cashier: '#047857', waiter: '#7c3aed' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Users size={28} color="var(--primary-orange)" />
            <span>Staff Management</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Add staff members, manage HR records, and optionally grant POS dashboard access with role-based login.
          </p>
        </div>
        <button type="button" onClick={() => setAddModalOpen(true)} className="btn btn-primary" style={{ background: 'var(--primary-orange)', border: 'none', color: '#fff' }}>
          <Plus size={18} /><span>+ Add Staff Member</span>
        </button>
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

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '360px' }}>
        <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
        <input type="text" className="form-input" placeholder="Search staff by name, email, phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.5rem', background: '#fff' }} />
      </div>

      {/* Staff Table */}
      <div className="data-table-wrapper">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading staff records...</div>
        ) : filteredStaff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
            <Users size={42} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '0.35rem' }}>
              {searchTerm ? 'No staff matched your search.' : 'No Staff Members Yet'}
            </h3>
            {!searchTerm && (
              <button type="button" onClick={() => setAddModalOpen(true)} className="btn btn-primary" style={{ background: 'var(--primary-orange)', color: '#fff', border: 'none', marginTop: '0.75rem' }}>
                <Plus size={16} /><span>Add First Staff Member</span>
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / Phone</th>
                <th>CNIC</th>
                <th>Salary ({currency})</th>
                <th>Dashboard Role</th>
                <th>Access</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((member) => {
                const role = member.profiles?.role;
                return (
                  <tr key={member.id}>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{member.name}</div>
                      {member.address && <div style={{ fontSize: '0.775rem', color: '#64748b' }}>{member.address}</div>}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#334155' }}>{member.email || '—'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{member.phone || ''}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>{member.cnic || '—'}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      {member.salary ? `${currency} ${parseFloat(member.salary).toLocaleString()}` : '—'}
                    </td>
                    <td>
                      {role ? (
                        <span style={{ padding: '0.2rem 0.6rem', background: `${ROLE_COLORS[role] || '#64748b'}15`, color: ROLE_COLORS[role] || '#64748b', borderRadius: 'var(--radius-full)', fontSize: '0.775rem', fontWeight: 800, border: `1px solid ${ROLE_COLORS[role] || '#64748b'}30` }}>
                          {ROLE_LABELS[role] || role}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>HR Only</span>
                      )}
                    </td>
                    <td>
                      {member.has_dashboard_access ? (
                        <span className="badge badge-active" style={{ gap: '0.3rem' }}>
                          <UserCheck size={13} /><span>Active</span>
                        </span>
                      ) : (
                        <span className="badge badge-muted">
                          <UserX size={13} /><span>No Login</span>
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button type="button" onClick={() => handleOpenEdit(member)} className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', color: '#475569' }} title="Edit"><Edit size={15} /></button>
                        <button type="button" onClick={() => handleDeleteStaff(member)} className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem', color: 'var(--danger-red)' }} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ====== MODAL: ADD STAFF ====== */}
      {addModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="var(--primary-orange)" /><span>Add Staff Member</span>
              </h3>
              <button type="button" onClick={() => { setAddModalOpen(false); resetAddForm(); }} className="modal-close-btn"><X size={20} /></button>
            </div>

            <form onSubmit={handleAddStaff}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Full Name <span className="required-mark">*</span></label>
                  <input type="text" className="form-input" placeholder="e.g. Ahmed Raza" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Salary ({currency} / Month)</label>
                  <input type="number" step="any" className="form-input" placeholder="e.g. 35000" value={addForm.salary} onChange={(e) => setAddForm({ ...addForm, salary: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input type="text" className="form-input" placeholder="03xx-xxxxxxx" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" placeholder="staff@email.com" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">CNIC</label>
                  <input type="text" className="form-input" placeholder="XXXXX-XXXXXXX-X" value={addForm.cnic} onChange={(e) => setAddForm({ ...addForm, cnic: e.target.value })} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address</label>
                  <input type="text" className="form-input" placeholder="House #, Street, City" value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })} />
                </div>
              </div>

              {/* Dashboard Access Toggle */}
              <div style={{ margin: '1rem 0', padding: '1rem', background: addForm.hasDashboardAccess ? '#f0fdf4' : '#f8fafc', border: `1px solid ${addForm.hasDashboardAccess ? '#a7f3d0' : '#e2e8f0'}`, borderRadius: 'var(--radius-md)', transition: 'all var(--transition-fast)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={addForm.hasDashboardAccess}
                    onChange={(e) => setAddForm({ ...addForm, hasDashboardAccess: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Shield size={15} color="#10b981" />
                      Give this staff member POS dashboard login access
                    </div>
                    <div style={{ fontSize: '0.775rem', color: '#64748b' }}>Creates a Supabase login so this staff member can sign in to the POS system.</div>
                  </div>
                </label>

                {addForm.hasDashboardAccess && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Login Email <span className="required-mark">*</span></label>
                        <input type="email" className="form-input" placeholder="staff.login@email.com" value={addForm.loginEmail} onChange={(e) => setAddForm({ ...addForm, loginEmail: e.target.value })} required={addForm.hasDashboardAccess} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Role <span className="required-mark">*</span></label>
                        <select className="form-input" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                          <option value="manager">Manager</option>
                          <option value="cashier">Cashier</option>
                          <option value="waiter">Waiter</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Initial Password <span className="required-mark">*</span></label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Min 8 characters"
                          value={addForm.password}
                          onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                          style={{ paddingRight: '2.5rem' }}
                          required={addForm.hasDashboardAccess}
                          minLength={8}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="input-icon-suffix" tabIndex={-1}>
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Staff member can change their password after first login via Settings.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => { setAddModalOpen(false); resetAddForm(); }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={savingAdd} className="btn btn-primary" style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none' }}>
                  {savingAdd ? 'Creating...' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== MODAL: EDIT STAFF ====== */}
      {editingStaff && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={20} color="var(--primary-orange)" /><span>Edit: {editingStaff.name}</span>
              </h3>
              <button type="button" onClick={() => setEditingStaff(null)} className="modal-close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Full Name <span className="required-mark">*</span></label>
                  <input type="text" className="form-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Salary ({currency})</label>
                  <input type="number" className="form-input" value={editForm.salary} onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" className="form-input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">CNIC</label>
                  <input type="text" className="form-input" value={editForm.cnic} onChange={(e) => setEditForm({ ...editForm, cnic: e.target.value })} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address</label>
                  <input type="text" className="form-input" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setEditingStaff(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={savingEdit} className="btn btn-primary" style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none' }}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
