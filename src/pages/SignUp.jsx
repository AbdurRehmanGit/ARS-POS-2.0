import React, { useState } from 'react';
import { Utensils, Building2, User, Mail, Phone, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfigAlert from '../components/ConfigAlert';

export default function SignUp({ onNavigateToLogin }) {
  const { signUp, error: authError } = useAuth();

  const [formData, setFormData] = useState({
    restaurantName: '',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
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

    // Validation
    if (!formData.restaurantName.trim()) {
      setFormError('Please enter your restaurant name.');
      return;
    }
    if (!formData.ownerName.trim()) {
      setFormError('Please enter the owner full name.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('Please provide a valid email address.');
      return;
    }
    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        restaurantName: formData.restaurantName.trim(),
        ownerName: formData.ownerName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        password: formData.password,
      });
    } catch (err) {
      setFormError(err.message || 'Registration failed. Please try again.');
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
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">
            Register your restaurant and setup your tenant account
          </p>
        </div>

        {(formError || authError) && (
          <div className="alert alert-danger" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{formError || authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Restaurant Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="restaurantName">
              Restaurant Name <span className="required-mark">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon-prefix">
                <Building2 size={16} />
              </span>
              <input
                id="restaurantName"
                name="restaurantName"
                type="text"
                className="form-input has-prefix"
                placeholder="e.g. Bella Napoli Trattoria"
                value={formData.restaurantName}
                onChange={handleChange}
                required
                autoComplete="organization"
              />
            </div>
          </div>

          {/* Owner Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="ownerName">
              Owner Full Name <span className="required-mark">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon-prefix">
                <User size={16} />
              </span>
              <input
                id="ownerName"
                name="ownerName"
                type="text"
                className="form-input has-prefix"
                placeholder="e.g. Mario Rossi"
                value={formData.ownerName}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address <span className="required-mark">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon-prefix">
                <Mail size={16} />
              </span>
              <input
                id="email"
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

          {/* Phone Number */}
          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              Phone Number
            </label>
            <div className="input-wrapper">
              <span className="input-icon-prefix">
                <Phone size={16} />
              </span>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="form-input has-prefix"
                placeholder="+1 (555) 019-2834"
                value={formData.phone}
                onChange={handleChange}
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password <span className="required-mark">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon-prefix">
                <Lock size={16} />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input has-prefix has-suffix"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
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

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirm Password <span className="required-mark">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon-prefix">
                <Lock size={16} />
              </span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                className="form-input has-prefix"
                placeholder="Repeat password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary btn-block btn-lg"
            style={{ marginTop: '1.25rem' }}
          >
            <span>{submitting ? 'Creating Restaurant Account...' : 'Sign Up Restaurant'}</span>
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="auth-footer">
          <span>Already have an account? </span>
          <a
            href="#login"
            onClick={(e) => {
              e.preventDefault();
              onNavigateToLogin();
            }}
            style={{ fontWeight: 600 }}
          >
            Log in here
          </a>
        </div>
      </div>
    </div>
  );
}
