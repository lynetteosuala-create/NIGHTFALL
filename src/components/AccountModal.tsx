import { useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, LogOut, Mail, ShieldCheck, X } from 'lucide-react';
import type { AccountUser, PlayerSaveData } from '../game/types';
import {
  changeAccountPassword,
  loginAccount,
  logoutAccount,
  registerAccount,
  resendVerificationCode,
  verifyEmailCode,
} from '../services/api';

interface AccountModalProps {
  open: boolean;
  user: AccountUser | null;
  token: string | null;
  save: PlayerSaveData;
  onClose: () => void;
  onAuthenticated: (token: string, user: AccountUser, serverProgress?: PlayerSaveData | null) => void;
  onUserUpdated: (user: AccountUser) => void;
  onLoggedOut: () => void;
}

export function AccountModal({
  open,
  user,
  token,
  save,
  onClose,
  onAuthenticated,
  onUserUpdated,
  onLoggedOut,
}: AccountModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codePreviewHint, setCodePreviewHint] = useState<string | null>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!open) return null;

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (tab === 'register') {
        const res = await registerAccount(email, password, save);
        onAuthenticated(res.token, res.user, save);
        if (res.verificationDispatch.verificationCodePreview) {
          setCodePreviewHint(res.verificationDispatch.verificationCodePreview);
        }
        setNotice('Account created. Enter the 6-digit email verification code below.');
      } else {
        const res = await loginAccount(email, password);
        onAuthenticated(res.token, res.user, res.progress);
        setNotice('Signed in and cloud progress synced.');
      }
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await verifyEmailCode(token, verificationCode);
      onUserUpdated(res.user);
      setCodePreviewHint(null);
      setVerificationCode('');
      setNotice('Email verified successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const res = await resendVerificationCode(token);
      if (res.verificationDispatch.verificationCodePreview) {
        setCodePreviewHint(res.verificationDispatch.verificationCodePreview);
      }
      setNotice('A fresh 6-digit verification code has been issued to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await changeAccountPassword(token, currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setNotice('Password updated securely.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      if (token) await logoutAccount(token);
    } catch {
      // ignore
    } finally {
      setBusy(false);
      onLoggedOut();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0E131D] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-xl font-bold text-white">Hunter Account & Security</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close account modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-3.5 py-2.5 text-xs text-emerald-200">
            {notice}
          </div>
        )}

        {!user ? (
          <div className="mt-5">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900/90 p-1 mb-5">
              <button
                onClick={() => {
                  setTab('login');
                  setError(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  tab === 'login' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setTab('register');
                  setError(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  tab === 'register' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hunter@example.com"
                    className="w-full rounded-lg border border-white/15 bg-slate-900/90 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password (minimum 8 characters)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-white/15 bg-slate-900/90 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Email verification only — no phone number is required. Your character progression and unlocked equipment sync automatically.
              </p>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60 transition-colors"
              >
                {busy ? 'Processing...' : tab === 'register' ? 'Register & Send Email Code' : 'Sign In'}
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{user.email}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {user.emailVerified ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Email Verified
                    </span>
                  ) : (
                    <span className="text-amber-300">Pending Email Verification</span>
                  )}
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">Cloud Save Active</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>

            {!user.emailVerified && (
              <form onSubmit={handleVerifyEmail} className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
                <div className="text-sm font-semibold text-amber-200">Verify Your Email Address</div>
                <p className="text-xs text-slate-300">
                  Enter the 6-digit verification code sent to <span className="text-white font-medium">{user.email}</span>.
                </p>
                {codePreviewHint && (
                  <div className="rounded-lg border border-amber-400/30 bg-black/40 px-3 py-2 text-xs text-amber-300 font-mono-tabular">
                    Verification Email Dispatch Code: <strong className="text-white">{codePreviewHint}</strong>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm font-mono-tabular tracking-widest text-white focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy || verificationCode.length !== 6}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={busy}
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
                  >
                    Resend
                  </button>
                </div>
              </form>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3 border-t border-white/10 pt-5">
              <div className="text-sm font-semibold text-white">Security Password Update</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="password"
                  required
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Current password"
                  className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="New password (8+ chars)"
                  className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Update Password
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
