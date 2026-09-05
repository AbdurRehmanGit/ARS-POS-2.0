import React, { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  Bike, 
  Check, 
  X, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  Radio, 
  ArrowRight, 
  CheckCircle2, 
  Navigation,
  RefreshCw,
  Search,
  Receipt
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY } from '../utils/currency';
import LiveTrackerMap from '../components/LiveTrackerMap';

const DELIVERY_STATUS_CONFIG = {
  pending: {
    label: 'Pending Assignment',
    bg: '#fef3c7',
    color: '#d97706',
    border: '#fde68a'
  },
  assigned: {
    label: 'Rider Assigned',
    bg: '#eff6ff',
    color: '#2563eb',
    border: '#bfdbfe'
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    bg: '#fff7ed',
    color: '#ea580c',
    border: '#fed7aa'
  },
  delivered: {
    label: 'Delivered',
    bg: '#ecfdf5',
    color: '#059669',
    border: '#a7f3d0'
  }
};

export default function PendingDeliveries() {
  const { organization } = useAuth();
  const currency = organization?.currency || DEFAULT_CURRENCY;

  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [riderLocations, setRiderLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [trackingRider, setTrackingRider] = useState(null);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Load Pending Delivery Orders and Available Riders
  const loadDeliveries = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        // Fetch pending delivery orders
        const { data: ordersData, error: oErr } = await supabase
          .from('orders')
          .select(`
            id, organization_id, receipt_number, customer_name, customer_phone,
            delivery_address, order_type, delivery_status, subtotal, tax, total,
            payment_method, created_at, rider_id,
            riders ( id, name, phone, bike_model, bike_number, status ),
            order_items ( id, item_name, size_label, quantity, unit_price, line_total )
          `)
          .eq('organization_id', organization.id)
          .eq('order_type', 'delivery')
          .neq('delivery_status', 'delivered')
          .order('created_at', { ascending: true });

        if (oErr) throw oErr;
        setOrders(ordersData || []);

        // Fetch all riders
        const { data: ridersData } = await supabase
          .from('riders')
          .select('*')
          .eq('organization_id', organization.id);
        setRiders(ridersData || []);

        // Fetch latest rider locations
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
        const localOrders = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const pending = localOrders.filter(
          (o) =>
            o.organization_id === organization.id &&
            o.order_type === 'delivery' &&
            o.delivery_status !== 'delivered'
        );
        setOrders(pending);

        const localRiders = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
        setRiders(localRiders.filter((r) => r.organization_id === organization.id));

        const localLocs = JSON.parse(localStorage.getItem('restaurant_pos_rider_locations') || '{}');
        setRiderLocations(localLocs);
      }
    } catch (err) {
      console.error('Error loading pending deliveries:', err);
      setError(err.message || 'Failed to load pending deliveries.');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 10000);
    return () => clearInterval(interval);
  }, [loadDeliveries]);

  // Assign Rider to Delivery
  const handleAssignRider = async () => {
    if (!assigningOrder || !selectedRiderId) return;

    setAssigning(true);
    setError(null);

    const rider = riders.find((r) => r.id === selectedRiderId);
    if (!rider) {
      setError('Selected rider not found.');
      setAssigning(false);
      return;
    }

    try {
      if (isSupabaseConfigured() && supabase) {
        // 1. Update order
        const { error: ordErr } = await supabase
          .from('orders')
          .update({
            rider_id: rider.id,
            delivery_status: 'assigned'
          })
          .eq('id', assigningOrder.id);
        if (ordErr) throw ordErr;

        // 2. Flip rider to busy
        const { error: ridErr } = await supabase
          .from('riders')
          .update({
            status: 'busy',
            updated_at: new Date().toISOString()
          })
          .eq('id', rider.id);
        if (ridErr) throw ridErr;
      } else {
        // LocalStorage fallback
        const localOrders = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const oIdx = localOrders.findIndex((o) => o.id === assigningOrder.id);
        if (oIdx !== -1) {
          localOrders[oIdx].rider_id = rider.id;
          localOrders[oIdx].delivery_status = 'assigned';
          localOrders[oIdx].riders = rider;
          localStorage.setItem('restaurant_pos_orders', JSON.stringify(localOrders));
        }

        const localRiders = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
        const rIdx = localRiders.findIndex((r) => r.id === rider.id);
        if (rIdx !== -1) {
          localRiders[rIdx].status = 'busy';
          localStorage.setItem('restaurant_pos_riders', JSON.stringify(localRiders));
        }
      }

      showSuccess(`Rider ${rider.name} assigned to Order #${assigningOrder.receipt_number}.`);
      setAssigningOrder(null);
      setSelectedRiderId('');
      loadDeliveries();
    } catch (err) {
      console.error('Error assigning rider:', err);
      setError(err.message || 'Failed to assign rider.');
    } finally {
      setAssigning(false);
    }
  };

  // Mark Out for Delivery
  const handleMarkOutForDelivery = async (order) => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error: err } = await supabase
          .from('orders')
          .update({ delivery_status: 'out_for_delivery' })
          .eq('id', order.id);
        if (err) throw err;
      } else {
        const localOrders = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const idx = localOrders.findIndex((o) => o.id === order.id);
        if (idx !== -1) {
          localOrders[idx].delivery_status = 'out_for_delivery';
          localStorage.setItem('restaurant_pos_orders', JSON.stringify(localOrders));
        }
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, delivery_status: 'out_for_delivery' } : o))
      );
      showSuccess(`Order #${order.receipt_number} is now Out for Delivery.`);
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status.');
    }
  };

  // Mark Delivered
  const handleMarkDelivered = async (order) => {
    if (!window.confirm(`Confirm delivery completed for Order #${order.receipt_number}?`)) return;

    try {
      const deliveredAt = new Date().toISOString();

      if (isSupabaseConfigured() && supabase) {
        // 1. Mark order delivered
        const { error: ordErr } = await supabase
          .from('orders')
          .update({
            delivery_status: 'delivered',
            delivered_at: deliveredAt
          })
          .eq('id', order.id);
        if (ordErr) throw ordErr;

        // 2. Free up rider back to available
        if (order.rider_id) {
          const { error: ridErr } = await supabase
            .from('riders')
            .update({
              status: 'available',
              updated_at: deliveredAt
            })
            .eq('id', order.rider_id);
          if (ridErr) throw ridErr;
        }
      } else {
        // LocalStorage fallback
        const localOrders = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const oIdx = localOrders.findIndex((o) => o.id === order.id);
        if (oIdx !== -1) {
          localOrders[oIdx].delivery_status = 'delivered';
          localOrders[oIdx].delivered_at = deliveredAt;
          localStorage.setItem('restaurant_pos_orders', JSON.stringify(localOrders));
        }

        if (order.rider_id) {
          const localRiders = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
          const rIdx = localRiders.findIndex((r) => r.id === order.rider_id);
          if (rIdx !== -1) {
            localRiders[rIdx].status = 'available';
            localStorage.setItem('restaurant_pos_riders', JSON.stringify(localRiders));
          }
        }
      }

      // Remove from pending list
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      showSuccess(`Order #${order.receipt_number} delivered successfully! Rider is now Available.`);
      loadDeliveries();
    } catch (err) {
      console.error('Error marking delivered:', err);
      setError('Failed to mark order delivered.');
    }
  };

  // Filter pending deliveries
  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      (o.receipt_number && o.receipt_number.toString().includes(term)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
      (o.customer_phone && o.customer_phone.toLowerCase().includes(term)) ||
      (o.delivery_address && o.delivery_address.toLowerCase().includes(term)) ||
      (o.riders?.name && o.riders.name.toLowerCase().includes(term))
    );
  });

  const availableRiders = riders.filter((r) => r.status === 'available');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div className="menu-header-actions">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Truck size={28} color="var(--primary-orange)" />
            <span>Pending Delivery Orders</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Dispatch live customer deliveries, assign available riders, and track order fulfillment.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDeliveries}
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem' }}
          title="Refresh active deliveries"
        >
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
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

      {/* Search & Info Bar */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by order #, customer name, phone, address, or rider..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', background: '#fff' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
          <span style={{ color: '#64748b' }}>
            Active Deliveries: <strong style={{ color: '#0f172a' }}>{orders.length}</strong>
          </span>
          <span>•</span>
          <span style={{ color: '#059669', fontWeight: 700 }}>
            Available Riders: <strong>{availableRiders.length}</strong>
          </span>
        </div>
      </div>

      {/* Deliveries List */}
      {loading && orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Loading pending deliveries...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem', color: '#64748b' }}>
          <Truck size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: '0.35rem' }}>
            {searchTerm ? 'No matching deliveries found.' : 'No Pending Deliveries'}
          </h3>
          <p style={{ fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
            When delivery orders are punched at the POS terminal, they will immediately appear here for rider assignment and live dispatch.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredOrders.map((order) => {
            const st = DELIVERY_STATUS_CONFIG[order.delivery_status] || DELIVERY_STATUS_CONFIG.pending;
            const assignedRider = order.riders;
            const loc = assignedRider ? riderLocations[assignedRider.id] : null;

            return (
              <div 
                key={order.id} 
                className="card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${st.color}`,
                  padding: '1.25rem'
                }}
              >
                <div>
                  {/* Order Top Line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                          Order #{order.receipt_number}
                        </span>
                        <span 
                          style={{ 
                            padding: '0.15rem 0.55rem', 
                            background: st.bg, 
                            color: st.color, 
                            border: `1px solid ${st.border}`, 
                            borderRadius: 'var(--radius-full)', 
                            fontSize: '0.725rem', 
                            fontWeight: 800 
                          }}
                        >
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                        <Clock size={12} />
                        <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>{new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary-orange)' }}>
                        {currency} {parseFloat(order.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase' }}>
                        {order.payment_method}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Address Details */}
                  <div style={{ background: '#f8fafc', borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '1rem', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                      <User size={14} color="#64748b" />
                      <span>{order.customer_name || 'Walk-in / Customer'}</span>
                    </div>

                    {order.customer_phone && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.825rem' }}>
                        <a 
                          href={`tel:${order.customer_phone}`} 
                          style={{ color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                        >
                          <Phone size={13} />
                          <span>{order.customer_phone}</span>
                        </a>
                      </div>
                    )}

                    {order.delivery_address && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.825rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '0.35rem', lineHeight: 1.4 }}>
                        <MapPin size={14} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{order.delivery_address}</span>
                      </div>
                    )}
                  </div>

                  {/* Ordered Items Summary */}
                  {order.order_items && order.order_items.length > 0 && (
                    <div style={{ marginBottom: '1rem', fontSize: '0.825rem' }}>
                      <div style={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        Items ({order.order_items.reduce((acc, it) => acc + it.quantity, 0)})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {order.order_items.map((it, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                            <span>
                              <strong>{it.quantity}×</strong> {it.item_name} {it.size_label && `(${it.size_label})`}
                            </span>
                            <span style={{ fontWeight: 600 }}>{currency} {parseFloat(it.line_total).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned Rider Info */}
                  <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: assignedRider ? '#fff7ed' : '#f1f5f9', border: `1px solid ${assignedRider ? '#fed7aa' : '#e2e8f0'}`, marginBottom: '1rem' }}>
                    {assignedRider ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.725rem', color: '#ea580c', fontWeight: 800, textTransform: 'uppercase' }}>Assigned Rider</div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{assignedRider.name}</div>
                          <div style={{ fontSize: '0.775rem', color: '#64748b' }}>{assignedRider.phone} • {assignedRider.bike_number}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setTrackingRider({ rider: assignedRider, location: loc })}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: '#fff' }}
                        >
                          <Navigation size={13} color="#ea580c" className="pulse-icon" />
                          <span>Track</span>
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Bike size={16} color="#94a3b8" />
                        <span>No rider assigned yet.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dispatch Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
                  {!assignedRider ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigningOrder(order);
                        setSelectedRiderId('');
                      }}
                      className="btn btn-primary"
                      style={{ flex: 1, background: 'var(--primary-orange)', border: 'none', color: '#fff', fontSize: '0.85rem' }}
                    >
                      <Bike size={16} />
                      <span>Assign Rider</span>
                    </button>
                  ) : order.delivery_status === 'assigned' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMarkOutForDelivery(order)}
                        className="btn btn-primary"
                        style={{ flex: 1, background: '#ea580c', border: 'none', color: '#fff', fontSize: '0.825rem' }}
                      >
                        <ArrowRight size={15} />
                        <span>Out for Delivery</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkDelivered(order)}
                        className="btn btn-secondary"
                        style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '0.825rem' }}
                        title="Directly mark delivered"
                      >
                        <Check size={15} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMarkDelivered(order)}
                      className="btn btn-primary"
                      style={{ flex: 1, background: '#10b981', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 800 }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Mark Delivered</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====== MODAL: ASSIGN RIDER ====== */}
      {assigningOrder && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bike size={20} color="var(--primary-orange)" />
                <span>Assign Rider: Order #{assigningOrder.receipt_number}</span>
              </h3>
              <button type="button" onClick={() => setAssigningOrder(null)} className="modal-close-btn">
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <div><strong>Customer:</strong> {assigningOrder.customer_name} ({assigningOrder.customer_phone || 'No phone'})</div>
              <div style={{ marginTop: '0.25rem', color: '#475569' }}><strong>Address:</strong> {assigningOrder.delivery_address}</div>
              <div style={{ marginTop: '0.25rem', fontWeight: 800, color: 'var(--primary-orange)' }}><strong>Total:</strong> {currency} {parseFloat(assigningOrder.total).toFixed(2)}</div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 800 }}>
                Select Available Rider <span className="required-mark">*</span>
              </label>
              {availableRiders.length === 0 ? (
                <div className="alert alert-danger" style={{ marginTop: '0.5rem' }}>
                  <AlertCircle size={16} />
                  <span>No riders are currently Available. Check Riders Management to toggle off-duty riders or wait for active deliveries to complete.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {availableRiders.map((rider) => (
                    <label
                      key={rider.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: selectedRiderId === rider.id ? '#fff7ed' : '#ffffff',
                        border: `2px solid ${selectedRiderId === rider.id ? 'var(--primary-orange)' : '#e2e8f0'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                          type="radio"
                          name="riderSelection"
                          value={rider.id}
                          checked={selectedRiderId === rider.id}
                          onChange={(e) => setSelectedRiderId(e.target.value)}
                          style={{ accentColor: 'var(--primary-orange)' }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{rider.name}</div>
                          <div style={{ fontSize: '0.775rem', color: '#64748b' }}>{rider.phone} • {rider.bike_model} ({rider.bike_number})</div>
                        </div>
                      </div>

                      <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>Available</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => setAssigningOrder(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignRider}
                disabled={!selectedRiderId || assigning}
                className="btn btn-primary"
                style={{ flex: 1, background: 'var(--primary-orange)', color: '#fff', border: 'none', fontWeight: 800 }}
              >
                {assigning ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
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
