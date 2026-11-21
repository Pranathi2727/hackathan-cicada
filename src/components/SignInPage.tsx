import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useVeilWatch } from '../context/VeilWatchContext';
import { GoldenBackdrop } from './GoldenBackdrop';
import { VeilWatchLogo } from './VeilWatchLogo';

export const SignInPage: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, registerWithEmail, setViewMode, authLoading } =
    useVeilWatch();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setBusy(true);
    const res = await signInWithGoogle();
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Google Sign-In failed.');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setBusy(true);
    const res =
      mode === 'signin'
        ? await signInWithEmail(trimmedEmail, password)
        : await registerWithEmail(trimmedEmail, password, displayName.trim() || undefined);
    setBusy(false);

    if (!res.ok) {
      setError(res.error || 'Authentication failed.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--vw-bg)] text-[var(--vw-text)] relative overflow-x-hidden flex flex-col">
      <GoldenBackdrop />

      {/* Top Navigation */}
      <header className="relative z-10 border-b border-[var(--vw-border)] bg-[var(--vw-bg)]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMode('landing')}
            className="flex items-center gap-2 text-xs font-semibold text-[var(--vw-text-muted)] hover:text-[var(--vw-text)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </button>
          <VeilWatchLogo />
          <div className="w-24 hidden sm:block" />
        </div>
      </header>

      {/* Sign In Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12 vw-page-enter">
        <div className="w-full max-w-md vw-glass-card vw-gradient-border rounded-2xl p-7 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--vw-gold-soft)] border border-[var(--vw-gold)]/35 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[var(--vw-gold)] vw-shield-glow" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {mode === 'signin' ? 'Sign In to VEILWATCH' : 'Create Operator Account'}
            </h1>
            <p className="text-xs text-[var(--vw-text-muted)] leading-relaxed">
              Access real-time PostgreSQL telemetry, Python agent controls, and worldwide public &
              private company monitoring.
            </p>
          </div>

          {/* Option 1: Sign in with Google */}
          <button
            type="button"
            disabled={busy || authLoading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg)] hover:border-[var(--vw-amber)] hover:shadow-[0_0_20px_-6px_rgba(245,197,66,0.45)] text-sm font-semibold text-[var(--vw-text)] transition-all disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-[var(--vw-border)] w-full" />
            <span className="px-3 text-[11px] font-mono uppercase text-[var(--vw-text-muted)] bg-[var(--vw-surface)] whitespace-nowrap">
              or continue with email
            </span>
            <div className="border-t border-[var(--vw-border)] w-full" />
          </div>

          {/* Option 2 & 3: Blank Email & Blank Password Fields */}
          <form onSubmit={handleEmailSubmit} className="space-y-4" autoComplete="off">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="signin-name"
                  className="block text-xs font-medium text-[var(--vw-text-muted)] mb-1.5"
                >
                  Operator Name (Optional)
                </label>
                <input
                  id="signin-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm text-[var(--vw-text)] focus:outline-none focus:border-[var(--vw-gold)]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="signin-email"
                className="block text-xs font-medium text-[var(--vw-text-muted)] mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--vw-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=""
                  autoComplete="email"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm text-[var(--vw-text)] focus:outline-none focus:border-[var(--vw-gold)]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="signin-password"
                className="block text-xs font-medium text-[var(--vw-text-muted)] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--vw-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[var(--vw-bg)] border border-[var(--vw-border)] text-sm text-[var(--vw-text)] focus:outline-none focus:border-[var(--vw-gold)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--vw-text-muted)] hover:text-[var(--vw-text)] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[var(--vw-crit)] bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || authLoading}
              className="w-full vw-gradient-btn py-3 rounded-xl text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              {busy
                ? 'Authenticating...'
                : mode === 'signin'
                  ? 'Sign In with Email'
                  : 'Create Account & Enter Console'}
            </button>
          </form>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === 'signin' ? 'register' : 'signin'));
                setError('');
              }}
              className="text-xs font-medium text-[var(--vw-gold)] hover:underline cursor-pointer"
            >
              {mode === 'signin'
                ? 'New operator? Create an email & password account'
                : 'Already registered? Sign in with your email & password'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
