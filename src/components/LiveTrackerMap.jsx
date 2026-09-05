import React, { useState, useEffect, useRef } from 'react';
import { 
  Navigation, 
  MapPin, 
  Radio, 
  Clock, 
  Gauge, 
  Compass, 
  Phone, 
  Bike, 
  ExternalLink, 
  AlertCircle, 
  X,
  Maximize2
} from 'lucide-react';

export default function LiveTrackerMap({ rider, location, onClose }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const mapRef = useRef(null);
  const googleMapInstance = useRef(null);
  const markerInstance = useRef(null);
  
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Live seconds elapsed counter
  useEffect(() => {
    if (!location?.updated_at) return;
    
    const updateElapsed = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(location.updated_at).getTime()) / 1000));
      setSecondsAgo(diff);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [location?.updated_at]);

  // Load Google Maps script if API key is provided
  useEffect(() => {
    if (!apiKey) return;

    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    if (document.getElementById(scriptId)) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setMapError('Failed to load Google Maps API. Please check your API key.');
    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize or update Google Map when location or mapLoaded changes
  useEffect(() => {
    if (!mapLoaded || !apiKey || !mapRef.current || !location?.latitude || !location?.longitude) return;

    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    const pos = { lat, lng };

    if (!googleMapInstance.current) {
      googleMapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: pos,
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'simplified' }] }
        ]
      });

      markerInstance.current = new window.google.maps.Marker({
        position: pos,
        map: googleMapInstance.current,
        title: rider?.name || 'Rider',
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#f97316',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        }
      });
    } else {
      markerInstance.current.setPosition(pos);
      googleMapInstance.current.panTo(pos);
    }
  }, [mapLoaded, apiKey, location?.latitude, location?.longitude, rider?.name]);

  const lat = location?.latitude ? parseFloat(location.latitude).toFixed(5) : null;
  const lng = location?.longitude ? parseFloat(location.longitude).toFixed(5) : null;
  const speed = location?.speed ? `${Math.round(location.speed * 3.6)} km/h` : 'Moving';
  const heading = location?.heading ? `${Math.round(location.heading)}°` : 'Active';

  const externalMapUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: '640px', padding: '1.5rem', overflow: 'hidden' }}>
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: '1rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <Bike size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>
                Live Tracking: {rider?.name || 'Rider'}
              </h3>
              <div style={{ fontSize: '0.775rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                <span className="badge badge-active" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', gap: '0.25rem' }}>
                  <Radio size={10} className="pulse-icon" /> Live GPS
                </span>
                <span>•</span>
                <span>{rider?.bike_model || 'Bike'} ({rider?.bike_number || 'No plate'})</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn">
            <X size={20} />
          </button>
        </div>

        {/* Map or Telemetry Display */}
        {apiKey && mapLoaded && !mapError ? (
          <div 
            ref={mapRef} 
            style={{ 
              width: '100%', 
              height: '340px', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid #e2e8f0', 
              marginBottom: '1rem' 
            }} 
          />
        ) : (
          /* Placeholder High-Precision Telemetry Box */
          <div 
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem 1.5rem',
              color: '#ffffff',
              marginBottom: '1.25rem',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)'
            }}
          >
            {/* Background Grid Accent */}
            <div 
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(249, 115, 22, 0.15) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                opacity: 0.6,
                pointerEvents: 'none'
              }}
            />

            {/* Telemetry Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94a3b8' }}>
                  GPS Telemetry Active
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)' }}>
                <Clock size={12} color="#f97316" />
                <span>Updated {secondsAgo}s ago</span>
              </div>
            </div>

            {/* Coordinates Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', position: 'relative', zIndex: 1, marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Latitude</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                  {lat || '34.01513'}° N
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Longitude</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                  {lng || '71.52491'}° E
                </div>
              </div>
            </div>

            {/* Speed & Heading Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <Gauge size={16} color="#f97316" />
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>Speed: <strong style={{ color: '#fff' }}>{speed}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <Compass size={16} color="#f97316" />
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>Heading: <strong style={{ color: '#fff' }}>{heading}</strong></span>
              </div>
            </div>

            {/* Note about API Key */}
            <p style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.85rem', marginBottom: 0, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              💡 Real-time coordinates update every 5-10s. Drop Google Maps API key into environment to enable interactive street map.
            </p>
          </div>
        )}

        {/* Telemetry Data Details Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Rider Contact</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={13} color="#ea580c" />
              <span>{rider?.phone || 'No phone'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {externalMapUrl && (
              <a 
                href={externalMapUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              >
                <ExternalLink size={14} />
                <span>Open Google Maps</span>
              </a>
            )}
            <button 
              type="button" 
              onClick={onClose} 
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', background: 'var(--primary-orange)', border: 'none', color: '#fff' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
