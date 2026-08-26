import React, { useState } from 'react';
import { AlertTriangle, Key, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export default function ConfigAlert({ onUseDemoMode }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isConfigured = isSupabaseConfigured();

  if (isConfigured) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(`VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-actual-anon-key`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      margin: '1rem auto 1.5rem auto',
      maxWidth: '540px',
      width: '100%'
    }}>
      <div className="alert alert-warning" style={{ flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Key size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <strong style={{ color: 'var(--text-primary)' }}>Supabase Keys Needed for Live Backend</strong>
          </div>
          <button 
            type="button" 
            onClick={() => setExpanded(!expanded)} 
            className="btn btn-ghost" 
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#fde68a', margin: 0 }}>
          To connect your live Supabase project, set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code> and run the SQL migration in <code>supabase/schema.sql</code>.
        </p>

        {onUseDemoMode && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={onUseDemoMode}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
            >
              🧪 Launch In-Memory Sandbox / Simulation Mode
            </button>
          </div>
        )}

        {expanded && (
          <div style={{
            marginTop: '0.5rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)'
          }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Quick Steps:</strong><br />
              1. Create a project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a><br />
              2. Open the <strong>SQL Editor</strong> and paste the contents of <code>supabase/schema.sql</code><br />
              3. Copy your Project URL & Anon Key from <strong>Project Settings &gt; API</strong> into <code>.env</code>
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', gap: '0.35rem' }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied template!' : 'Copy .env variables template'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
