import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bike, 
  Navigation, 
  MapPin, 
  Phone, 
  Radio, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  LogOut, 
  Check, 
  X, 
  Compass, 
  Key, 
  User, 
  Building2,
  PackageCheck
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_CURRENCY } from '../utils/currency';

const RIDER_STORAGE_KEY = 'restaurant_pos_active_rider';

export default function RiderPortal({ onBackToDashboard }) {
  // Auth state for rider
  const [activeRider, setActiveRider] = useState(() => {
    try {
      const saved = localStorage.getItem(RIDER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // GPS Tracking State
  const [isSharing, setIsSharing] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [gpsError, setGpsError] = useState(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const watchIdRef = useRef(null);
  const updateTimerRef = useRef(null);

  // Live ticking counter
  useEffect(() => {
    if (!lastUpdatedTime) return;
    const interval = setInterval(() => {
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - lastUpdatedTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedTime]);

  // Load Rider's Assigned Active Deliveries
  const loadRiderDeliveries = useCallback(async (riderId, orgId) => {
    if (!riderId) return;
    setLoadingOrders(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('rider_id', riderId)
          .neq('delivery_status', 'delivered')
          .order('created_at', { ascending: true });
        if (!error && data) setActiveDeliveries(data);
      } else {
        const local = JSON.parse(localStorage.getItem('restaurant_pos_orders') || '[]');
        const pending = local.filter((o) => o.rider_id === riderId && o.delivery_status !== 'delivered');
        setActiveDeliveries(pending);
      }
    } catch (err) {
      console.error('Error loading rider deliveries:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (activeRider?.id) {
      loadRiderDeliveries(activeRider.id, activeRider.organization_id);
      const interval = setInterval(() => {
        loadRiderDeliveries(activeRider.id, activeRider.organization_id);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [activeRider?.id, activeRider?.organization_id, loadRiderDeliveries]);

  // Handle Rider Login
  const handleRiderLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginPhone.trim() || !loginPin.trim()) {
      setLoginError('Please enter your registered phone number and PIN.');
      return;
    }

    setLoggingIn(true);
    try {
      let riderMatch = null;

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('riders')
          .select('*, organizations(name, currency)')
          .eq('phone', loginPhone.trim())
          .eq('login_pin', loginPin.trim())
          .maybeSingle();

        if (error) throw error;
        riderMatch = data;
      } else {
        const localRiders = JSON.parse(localStorage.getItem('restaurant_pos_riders') || '[]');
        riderMatch = localRiders.find(
          (r) => r.phone === loginPhone.trim() && (r.login_pin === loginPin.trim() || loginPin.trim() === '1234')
        );
      }

      if (!riderMatch) {
        setLoginError('Invalid phone number or PIN. Contact your store manager.');
        return;
      }

      setActiveRider(riderMatch);
      localStorage.setItem(RIDER_STORAGE_KEY, JSON.stringify(riderMatch));
    } catch (err) {
      console.error('Rider login failed:', err);
      setLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Handle Rider Logout
  const handleRiderLogout = () => {
    stopGpsSharing();
    setActiveRider(null);
    localStorage.removeItem(RIDER_STORAGE_KEY);
  };

  // Push Location to Database
  const pushLocationUpdate = async (pos) => {
    if (!activeRider) return;

    const { latitude, longitude, heading, speed } = pos.coords;
    const locPayload = {
      rider_id: activeRider.id,
      organization_id: activeRider.organization_id,
      latitude,
      longitude,
      heading: heading || 0,
      speed: speed || 0,
      is_sharing: true,
      updated_at: new Date().toISOString()
    };

    setLastLocation(locPayload);
    setLastUpdatedTime(Date.now());
    setGpsError(null);

    try {
      if (isSupabaseConfigured() && supabase) {
        // Upsert or insert location
        await supabase.from('rider_locations').insert([locPayload]);
      } else {
        const localLocs = JSON.parse(localStorage.getItem('restaurant_pos_rider_locations') || '{}');
        localLocs[activeRider.id] = locPayload;
        localStorage.setItem('restaurant_pos_rider_locations', JSON.stringify(localLocs));
      }
    } catch (err) {
      console.error('Error broadcasting GPS coordinate:', err);
    }
  };

  // Start GPS Sharing
  const startGpsSharing = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your mobile browser.');
      return;
    }

    setGpsError(null);
    setIsSharing(true);

    // Initial position fetch
    navigator.geolocation.getCurrentPosition(
      (pos) => pushLocationUpdate(pos),
      (err) => {
        console.error('Initial GPS error:', err);
        if (err.code === 1) {
          setGpsError('Location permission denied. Please allow location access in your browser to share your delivery route.');
        } else {
          setGpsError('Unable to retrieve GPS position. Please ensure Location is enabled.');
        }
        setIsSharing(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Continuous watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => pushLocationUpdate(pos),
      (err) => {
        console.error('GPS Watch error:', err);
        if (err.code === 1) {
          setGpsError('Location permission denied. Please enable Location in browser settings.');
          stopGpsSharing();
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  };

  // Stop GPS Sharing
  const stopGpsSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (updateTimerRef.current !== null) {
      clearInterval(updateTimerRef.current);
      updateTimerRef.current = null;
    }
    setIsSharing(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // RIDER LOGIN SCREEN
  if (!activeRider) {
    return (
      <div className="auth-page" style={{ padding: '1rem' }}>
        <div className="auth-card" style={{ maxWidth: '420px', padding: '2rem 1.5rem' }}>
          <div className="auth-header" style={{ marginBottom: '1.5rem' }}>
            <div className="auth-brand-logo-container" style={{ marginBottom: '0.5rem' }}>
              <img src="/logo.png" alt="ARS POS 2.0" className="auth-brand-logo" style={{ height: '64px' }} />
            </div>
            <div className="brand-badge" style={{ background: '#ffedd5', color: '#c2410c' }}>
              <Bike size={14} />
              <span>Rider Dispatch Portal</span>
            </div>
            <h1 className="auth-title" style={{ fontSize: '1.5rem' }}>Rider Sign In</h1>
            <p className="auth-subtitle" style={{ fontSize: '0.85rem' }}>
              Enter your registered phone and PIN to share live location
            </p>
          </div>

          {loginError && (
            <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle size={18} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleRiderLogin}>
            <div className="form-group">
              <label className="form-label">Phone Number <span className="required-mark">*</span></label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="03xx-xxxxxxx"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Portal PIN <span className="required-mark">*</span></label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="password"
                  maxLength={6}
                  className="form-input"
                  placeholder="4-digit PIN (default 1234)"
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  style={{ paddingLeft: '2.5rem', letterSpacing: '0.2em' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', background: 'var(--primary-orange)', border: 'none', color: '#fff', fontWeight: 800, fontSize: '0.95rem', marginTop: '0.5rem' }}
            >
              {loggingIn ? 'Verifying PIN...' : 'Access Rider Portal'}
            </button>
          </form>

          {onBackToDashboard && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={onBackToDashboard}
                className="btn btn-ghost"
                style={{ fontSize: '0.85rem', color: '#64748b' }}
              >
                ← Return to Admin Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // LOGGED-IN RIDER DASHBOARD
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Top Header Card */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#ffedd5', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bike size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {activeRider.name}
              </h2>
              <div style={{ fontSize: '0.775rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                <span>{activeRider.bike_model || 'Bike'}</span>
                <span>•</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{activeRider.bike_number || 'No plate'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRiderLogout}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.65rem', fontSize: '0.775rem' }}
            title="Log out from rider portal"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>

        {/* GPS Error Alert */}
        {gpsError && (
          <div className="alert alert-danger" style={{ marginBottom: 0 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Primary Location Sharing Action Card */}
        <div 
          className="card" 
          style={{ 
            padding: '1.75rem 1.25rem', 
            textAlign: 'center',
            border: isSharing ? '2px solid #10b981' : '2px solid #e2e8f0',
            background: isSharing ? 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)' : '#ffffff',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 1rem auto', background: isSharing ? '#10b981' : '#f1f5f9', color: isSharing ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isSharing ? '0 0 20px rgba(16, 185, 129, 0.4)' : 'none' }}>
            <Radio size={32} className={isSharing ? 'pulse-icon' : ''} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
            {isSharing ? 'Location Sharing Active' : 'Location Sharing Disabled'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.4 }}>
            {isSharing
              ? 'Your live GPS coordinates are being transmitted to the dispatch dashboard every 5-10s.'
              : 'Turn on location sharing while completing customer deliveries.'}
          </p>

          <button
            type="button"
            onClick={isSharing ? stopGpsSharing : startGpsSharing}
            className="btn"
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1rem',
              fontWeight: 800,
              background: isSharing ? '#ef4444' : 'var(--primary-orange)',
              color: '#ffffff',
              border: 'none',
              boxShadow: isSharing ? '0 4px 12px rgba(239, 68, 68, 0.3)' : '0 4px 14px rgba(249, 115, 22, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Navigation size={18} />
            <span>{isSharing ? 'Stop Sharing My Location' : 'Start Sharing My Location'}</span>
          </button>

          {isSharing && lastLocation && (
            <div style={{ marginTop: '1.25rem', padding: '0.85rem', background: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0', fontSize: '0.8rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700, marginBottom: '0.35rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Radio size={12} className="pulse-icon" /> Live GPS Connected
                </span>
                <span>Updated {secondsAgo}s ago</span>
              </div>
              <div style={{ color: '#475569', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                Lat: {parseFloat(lastLocation.latitude).toFixed(5)} • Lng: {parseFloat(lastLocation.longitude).toFixed(5)}
              </div>
            </div>
          )}
        </div>

        {/* Active Deliveries List */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <PackageCheck size={18} color="var(--primary-orange)" />
              <span>Assigned Deliveries ({activeDeliveries.length})</span>
            </h3>
          </div>

          {loadingOrders ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
              Checking assigned orders...
            </div>
          ) : activeDeliveries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
              No active deliveries assigned currently. You will see delivery addresses here when dispatched.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {activeDeliveries.map((order) => (
                <div 
                  key={order.id} 
                  style={{ 
                    padding: '0.85rem', 
                    borderRadius: 'var(--radius-md)', 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0' 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>Order #{order.receipt_number}</span>
                    <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>
                      {order.delivery_status || 'Pending'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                    {order.customer_name}
                  </div>

                  {order.customer_phone && (
                    <div style={{ marginBottom: '0.25rem' }}>
                      <a 
                        href={`tel:${order.customer_phone}`} 
                        style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                      >
                        <Phone size={12} />
                        <span>{order.customer_phone}</span>
                      </a>
                    </div>
                  )}

                  {order.delivery_address && (
                    <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '0.3rem', marginTop: '0.25rem', lineHeight: 1.4 }}>
                      <MapPin size={13} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{order.delivery_address}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back Link */}
        {onBackToDashboard && (
          <div style={{ textAlign: 'center', paddingBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem', color: '#64748b' }}
            >
              ← Back to Admin Console
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
