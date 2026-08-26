import React from 'react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      backgroundColor: 'var(--bg-app)',
      color: 'var(--text-primary)'
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        border: '3px solid rgba(245, 158, 11, 0.15)',
        borderTopColor: 'var(--primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', fontWeight: 500 }}>
        {message}
      </p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
