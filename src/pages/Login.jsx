import React, { useState } from 'react';
import { Utensils, Mail, Lock, Eye, EyeOff, AlertCircle, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfigAlert from '../components/ConfigAlert';

export default function Login({ onNavigateToSignUp, onNavigateToRiderPortal }) {
  const { signIn, error: authError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.email.trim()) {
      setFormError('Please enter your email address.');
      return;
    }
    if (!formData.password) {
      setFormError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn({
        email: formData.email.trim(),
        password: formData.password,
      });
    } catch (err) {
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <ConfigAlert />

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-logo-container">
            <img src="/logo.png" alt="AR Softwares - ARS POS 2.0" className="auth-brand-logo" />
          </div>
          <div className="brand-badge">
            <span>ARS POS 2.0</span>
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">
            Log in to manage your restaurant point of sale
          </p>
        </div>

        {(formError || authError) && (
          <div className="alert alert-danger" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{formError || authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Email Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="loginEmail">
              Email Address <span className="required-mark">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon-prefix">
                <Mail size={16} />
              </span>
              <input
                id="loginEmail"
                name="email"
                type="email"
                className="form-input has-prefix"
                placeholder="owner@restaurant.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="loginPassword">
              Password <span className="required-mark">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon-prefix">
                <Lock size={16} />
              </span>
              <input
                id="loginPassword"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input has-prefix has-suffix"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-icon-suffix"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary btn-block btn-lg"
            style={{ marginTop: '1.25rem' }}
          >
            <span>{submitting ? 'Logging in...' : 'Sign In'}</span>
            {!submitting && <LogIn size={16} />}
          </button>
        </form>

        <div className="auth-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'center' }}>
          <div>
            <span>Don't have an account yet? </span>
            <a
              href="#signup"
              onClick={(e) => {
                e.preventDefault();
                onNavigateToSignUp();
              }}
              style={{ fontWeight: 600 }}
            >
              Register your restaurant
            </a>
          </div>

          {onNavigateToRiderPortal && (
            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', width: '100%', textAlign: 'center' }}>
              <button
                type="button"
                onClick={onNavigateToRiderPortal}
                className="btn btn-ghost"
                style={{ fontSize: '0.8rem', color: 'var(--primary-orange)', fontWeight: 700 }}
              >
                🏍️ Delivery Rider? Access Mobile GPS Portal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
