import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bike, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  AlertCircle, 
  Phone, 
  Mail, 
  Key, 
  Radio, 
  Power, 
  Navigation,
  UserCheck,
  UserX,
  Clock,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY } from '../utils/currency';
import LiveTrackerMap from '../components/LiveTrackerMap';

const STATUS_CONFIG = {
  available: {
    label: 'Available',
    badgeClass: 'badge-active',
    bg: '#ecfdf5',
    color: '#059669',
    border: '#a7f3d0'
  },
  busy: {
    label: 'Busy (On Delivery)',
    badgeClass: 'badge-pending',
    bg: '#fff7ed',
    color: '#ea580c',
    border: '#fed7aa'
  },
  absent: {
    label: 'Absent / Off-duty',
    badgeClass: 'badge-danger',
    bg: '#fef2f2',
    color: '#dc2626',
    border: '#fecaca'
  }
};

export default function RiderManagement() {
  const { organization, profile } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;

  const [riders, setRiders] = useState([]);
  const [riderLocations, setRiderLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRider, setEditingRider] = useState(null);
  const [trackingRider, setTrackingRider] = useState(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    salary: '',
    phone: '',
    email: '',
    bike_model: '',
    bike_number: '',
    login_pin: '1234'
  });
  const [saving, setSaving] = useState(false);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Load Riders and Latest Locations
  const loadRiders = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        // Fetch riders
        const { data: ridersData, error: rErr } = await supabase
          .from('riders')
          .select('*')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false });

        if (rErr) throw rErr;
        setRiders(ridersData || []);

        // Fetch latest locations
        const { data: locData } = await supabase
          .from('rider_locations')
          .select('*')
          .eq('organization_id', organization.id)
          .order('updated_at', { ascending: false });

        const locMap = {};
        (locData || []).forEach((loc) => {
          if (!locMap[loc.rider_id]) {
            locMap[loc.rider_id] = loc;
          }
        });
        setRiderLocations(locMap);
      } else {
        // LocalStorage sandbox fallback
        const local = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
        const tenantRiders = local.filter((r) => r.organization_id === organization.id);
        setRiders(tenantRiders);

        const localLocs = JSON.parse(localStorage.getItem('restaurant_pos_rider_locations') || '{}');
        setRiderLocations(localLocs);
      }
    } catch (err) {
      console.error('Error loading riders:', err);
      setError(err.message || 'Failed to load riders.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadRiders();
    // Auto-refresh locations every 15 seconds
    const interval = setInterval(loadRiders, 15000);
    return () => clearInterval(interval);
  }, [loadRiders]);

  // Handle Add Rider
  const handleSaveRider = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Please provide rider name and phone number.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const newRider = {
        organization_id: organization.id,
        name: form.name.trim(),
        salary: form.salary ? parseFloat(form.salary) : null,
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        bike_model: form.bike_model.trim() || 'Motorcycle',
        bike_number: form.bike_number.trim() || 'N/A',
        login_pin: form.login_pin.trim() || '1234',
        status: 'available',
        updated_at: new Date().toISOString()
      };

      if (isSupabaseConfigured() && supabase) {
        const { data, error: insErr } = await supabase
          .from('riders')
          .insert([newRider])
          .select()
          .single();

        if (insErr) throw insErr;
        setRiders((prev) => [data, ...prev]);
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
        const created = { id: `local-rider-${Date.now()}`, ...newRider, created_at: new Date().toISOString() };
        local.unshift(created);
        localStorage.setItem('restaurant_pos_riders', JSON.stringify(local));
        setRiders((prev) => [created, ...prev]);
      }

      showSuccess(`Rider ${form.name} added successfully.`);
      setAddModalOpen(false);
      setForm({
        name: '',
        salary: '',
        phone: '',
        email: '',
        bike_model: '',
        bike_number: '',
        login_pin: '1234'
      });
    } catch (err) {
      console.error('Error saving rider:', err);
      setError(err.message || 'Failed to add rider.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Edit Rider
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingRider) return;

    setSaving(true);
    setError(null);

    try {
      const updateData = {
        name: editingRider.name.trim(),
        salary: editingRider.salary ? parseFloat(editingRider.salary) : null,
        phone: editingRider.phone.trim(),
        email: editingRider.email?.trim() || null,
        bike_model: editingRider.bike_model?.trim() || 'Motorcycle',
        bike_number: editingRider.bike_number?.trim() || 'N/A',
        login_pin: editingRider.login_pin?.trim() || '1234',
        updated_at: new Date().toISOString()
      };

      if (isSupabaseConfigured() && supabase) {
        const { error: upErr } = await supabase
          .from('riders')
          .update(updateData)
          .eq('id', editingRider.id);

        if (upErr) throw upErr;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
        const idx = local.findIndex((r) => r.id === editingRider.id);
        if (idx !== -1) {
          local[idx] = { ...local[idx], ...updateData };
          localStorage.setItem('restaurant_pos_riders', JSON.stringify(local));
        }
      }

      setRiders((prev) =>
        prev.map((r) => (r.id === editingRider.id ? { ...r, ...updateData } : r))
      );
      showSuccess(`Rider ${editingRider.name} updated.`);
      setEditingRider(null);
    } catch (err) {
      console.error('Error updating rider:', err);
      setError(err.message || 'Failed to update rider.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Available <-> Absent
  const handleToggleStatus = async (rider) => {
    if (rider.status === 'busy') {
      alert('This rider is currently on an active delivery. Mark the delivery completed in Pending Deliveries to free the rider.');
      return;
    }

    const nextStatus = rider.status === 'available' ? 'absent' : 'available';

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: err } = await supabase
          .from('riders')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', rider.id);
        if (err) throw err;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
        const idx = local.findIndex((r) => r.id === rider.id);
        if (idx !== -1) {
          local[idx].status = nextStatus;
          localStorage.setItem('restaurant_pos_riders', JSON.stringify(local));
        }
      }

      setRiders((prev) =>
        prev.map((r) => (r.id === rider.id ? { ...r, status: nextStatus } : r))
      );
      showSuccess(`Rider ${rider.name} status updated to ${STATUS_CONFIG[nextStatus].label}.`);
    } catch (err) {
      console.error('Error toggling status:', err);
      setError('Failed to update rider status.');
    }
  };

  // Delete Rider
  const handleDeleteRider = async (rider) => {
    if (!window.confirm(`Are you sure you want to remove rider "${rider.name}"?`)) return;

    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: err } = await supabase
          .from('riders')
          .delete()
          .eq('id', rider.id);
        if (err) throw err;
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
        const updated = local.filter((r) => r.id !== rider.id);
        localStorage.setItem('restaurant_pos_riders', JSON.stringify(updated));
      }

      setRiders((prev) => prev.filter((r) => r.id !== rider.id));
      showSuccess(`Rider ${rider.name} removed.`);
    } catch (err) {
      console.error('Error deleting rider:', err);
      setError(err.message || 'Failed to delete rider.');
    }
  };

  // Filter riders
  const filteredRiders = riders.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.bike_number && r.bike_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.bike_model && r.bike_model.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const availableCount = riders.filter((r) => r.status === 'available').length;
  const busyCount = riders.filter((r) => r.status === 'busy').length;
  const absentCount = riders.filter((r) => r.status === 'absent').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header & Quick Action Buttons */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Bike size={28} color="var(--primary-orange)" />
            <span>Riders Management</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Manage delivery fleet, assign orders, monitor real-time availability, and track live GPS locations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="btn btn-primary"
          style={{ background: 'var(--primary-orange)', border: 'none', color: '#fff' }}
        >
          <Plus size={18} />
          <span>+ Add Rider</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="kpi-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Fleet</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>{riders.length}</div>
        </div>

        <div className="kpi-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            Available Now
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>{availableCount}</div>
        </div>

        <div className="kpi-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#ea580c', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />
            On Delivery (Busy)
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ea580c', marginTop: '0.25rem' }}>{busyCount}</div>
        </div>

        <div className="kpi-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
            Off-Duty / Absent
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>{absentCount}</div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 0 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '2px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 0 }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search riders by name, phone, bike number or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', background: '#fff' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', 'available', 'busy', 'absent'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className="btn"
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                background: statusFilter === st ? '#0f172a' : '#f1f5f9',
                color: statusFilter === st ? '#ffffff' : '#475569',
                border: 'none',
                textTransform: 'capitalize'
              }}
            >
              {st === 'all' ? `All (${riders.length})` : `${st} (${riders.filter((r) => r.status === st).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Riders Table */}
      <div className="data-table-wrapper">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            Loading riders fleet...
          </div>
        ) : filteredRiders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
            <Bike size={42} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '0.35rem' }}>
              {searchTerm ? 'No riders matched your search.' : 'No Riders Registered'}
            </h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Add your delivery riders to assign orders and enable live GPS tracking.
            </p>
            {!searchTerm && (
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="btn btn-primary"
                style={{ background: 'var(--primary-orange)', color: '#fff', border: 'none' }}
              >
                <Plus size={16} />
                <span>Add First Rider</span>
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rider Name</th>
                <th>Contact</th>
                <th>Bike Details</th>
                <th>Salary ({currency})</th>
                <th>Status</th>
                <th>GPS Telemetry</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRiders.map((rider) => {
                const st = STATUS_CONFIG[rider.status] || STATUS_CONFIG.available;
                const loc = riderLocations[rider.id];
                const isRecent = loc?.updated_at && (Date.now() - new Date(loc.updated_at).getTime() < 5 * 60 * 1000);

                return (
                  <tr key={rider.id}>
                    <td>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{rider.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                        <Key size={11} color="#94a3b8" />
                        <span>Portal PIN: <strong>{rider.login_pin || '1234'}</strong></span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Phone size={13} color="#64748b" />
                        <span>{rider.phone}</span>
                      </div>
                      {rider.email && (
                        <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.15rem' }}>{rider.email}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>{rider.bike_model || 'Motorcycle'}</div>
                      <div style={{ fontSize: '0.775rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>{rider.bike_number || 'No plate'}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      {rider.salary ? `${currency} ${parseFloat(rider.salary).toLocaleString()}` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span 
                          style={{ 
                            padding: '0.25rem 0.65rem', 
                            background: st.bg, 
                            color: st.color, 
                            border: `1px solid ${st.border}`, 
                            borderRadius: 'var(--radius-full)', 
                            fontSize: '0.775rem', 
                            fontWeight: 800 
                          }}
                        >
                          {st.label}
                        </span>

                        {rider.status !== 'busy' && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(rider)}
                            className="btn btn-ghost"
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.725rem', color: '#64748b' }}
                            title={`Toggle status to ${rider.status === 'available' ? 'Absent' : 'Available'}`}
                          >
                            <Power size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      {rider.status === 'busy' || isRecent ? (
                        <button
                          type="button"
                          onClick={() => setTrackingRider({ rider, location: loc })}
                          className="btn"
                          style={{
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: '#ffedd5',
                            color: '#c2410c',
                            border: '1px solid #fed7aa',
                            borderRadius: 'var(--radius-full)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Navigation size={13} className="pulse-icon" />
                          <span>Track Rider</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Idle / Offline</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => setEditingRider({ ...rider })}
                          className="btn btn-ghost"
                          style={{ padding: '0.3rem 0.5rem', color: '#475569' }}
                          title="Edit Rider"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRider(rider)}
                          className="btn btn-ghost"
                          style={{ padding: '0.3rem 0.5rem', color: 'var(--danger-red)' }}
                          title="Delete Rider"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ====== MODAL: ADD RIDER ====== */}
      {addModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="var(--primary-orange)" />
                <span>Add Delivery Rider</span>
              </h3>
              <button type="button" onClick={() => setAddModalOpen(false)} className="modal-close-btn">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRider}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Rider Full Name <span className="required-mark">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Tariq Mehmood"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number <span className="required-mark">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="03xx-xxxxxxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Salary ({currency} / Month)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 28000"
                    value={form.salary}
                    onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bike Model</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Honda 125, Yamaha YBR"
                    value={form.bike_model}
                    onChange={(e) => setForm({ ...form, bike_model: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bike Number / Plate</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. LE-9942"
                    value={form.bike_number}
                    onChange={(e) => setForm({ ...form, bike_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="rider@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rider Mobile PIN <span className="required-mark">*</span></label>
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input"
                    placeholder="e.g. 1234"
                    value={form.login_pin}
                    onChange={(e) => setForm({ ...form, login_pin: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setAddModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none' }}>
                  {saving ? 'Saving...' : 'Save Rider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== MODAL: EDIT RIDER ====== */}
      {editingRider && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={20} color="var(--primary-orange)" />
                <span>Edit Rider: {editingRider.name}</span>
              </h3>
              <button type="button" onClick={() => setEditingRider(null)} className="modal-close-btn">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Rider Full Name <span className="required-mark">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingRider.name}
                    onChange={(e) => setEditingRider({ ...editingRider, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number <span className="required-mark">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingRider.phone}
                    onChange={(e) => setEditingRider({ ...editingRider, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Salary ({currency} / Month)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={editingRider.salary || ''}
                    onChange={(e) => setEditingRider({ ...editingRider, salary: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bike Model</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingRider.bike_model || ''}
                    onChange={(e) => setEditingRider({ ...editingRider, bike_model: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bike Number / Plate</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingRider.bike_number || ''}
                    onChange={(e) => setEditingRider({ ...editingRider, bike_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editingRider.email || ''}
                    onChange={(e) => setEditingRider({ ...editingRider, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rider Mobile PIN</label>
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input"
                    value={editingRider.login_pin || ''}
                    onChange={(e) => setEditingRider({ ...editingRider, login_pin: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setEditingRider(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== MODAL: LIVE TRACKER ====== */}
      {trackingRider && (
        <LiveTrackerMap
          rider={trackingRider.rider}
          location={trackingRider.location}
          onClose={() => setTrackingRider(null)}
        />
      )}
    </div>
  );
}
