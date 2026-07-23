'use client';

// src/components/features/auth/LoginForm/index.jsx
// SEC-004: Login rate limiting added.
// After 5 failed attempts the form locks for 5 minutes, preventing
// brute-force attacks on staff credentials on the shared POS device.
// Attempt counter and lockout expiry are stored in component state only
// (not persisted) — a page refresh resets them, which is acceptable for
// a controlled retail environment where the device is never left unattended.

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';

import { loginSchema }           from '@/validators/loginSchema';
import { useAuth }               from '@/hooks/auth/useAuth';
import TOAST                     from '@/constants/toastMessages';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import Logo                      from '@/components/shared/Logo';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

// Static build tag shown on the dark panel — matches package.json app version.
// Update alongside releases; not wired to a dynamic source by design.

// ── RATE LIMIT CONSTANTS ──────────────────────────────────────
const MAX_ATTEMPTS    = 5;
const LOCKOUT_MS      = 5 * 60 * 1000; // 5 minutes

export default function LoginForm() {
  const { login }       = useAuth();
  const router          = useRouter();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // SEC-004 — rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil,    setLockedUntil]    = useState(null); // timestamp ms
  const [lockCountdown,  setLockCountdown]  = useState(0);   // seconds remaining

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver:      zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  // Redirect already-authenticated users away from the login screen
  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  // Countdown ticker — updates every second while locked out
  useEffect(() => {
    if (!lockedUntil) return;

    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setFailedAttempts(0);
        setLockCountdown(0);
      } else {
        setLockCountdown(remaining);
      }
    };

    tick(); // run immediately so display is correct from the first second
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  if (isAuthenticated) return null;

  const isLockedOut = lockedUntil && Date.now() < lockedUntil;

  const onSubmit = async (data) => {
    if (isLockedOut) return; // belt-and-suspenders; button is also disabled

    setIsSubmitting(true);
    try {
      await login(data.username, data.password);
      // On success, reset the counter
      setFailedAttempts(0);
    } catch (err) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);

      if (nextAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedUntil(until);
        toast.error(`Too many failed attempts. Please wait 5 minutes before trying again.`);
      } else {
        const remaining = MAX_ATTEMPTS - nextAttempts;
        toast.error(
          `${err?.message || TOAST.AUTH.LOGIN_FAILED} (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format mm:ss countdown
  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Left — dark brand panel ─────────────────────────────────── */}
      <div className="relative hidden w-2/5 shrink-0 flex-col overflow-hidden bg-primary sm:flex">
        {/* Watermark "L" — brand atmosphere, not decorative noise */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 right-8 font-heading text-[280px] leading-none opacity-4 select-none"
        >
          <Logo variant="icon" color="white" width={250} height={68} priority />
        </span>

        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-8">
          <Logo variant="full" color="white" width={150} height={48} priority />
          <div className="mt-1 h-px w-10 bg-accent" aria-hidden="true" />
          <p className="font-heading text-xl text-primary-foreground">Point of Sale</p>
        </div>
      </div>

      {/* ── Right — sign-in panel ───────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
        <div className="w-full max-w-sm">

          {/* Logo shown only when the dark panel is hidden (small screens) */}
          <div className="mb-8 flex justify-center sm:hidden">
            <Logo variant="full" width={130} height={42} priority />
          </div>

          <p className="text-xs font-semibold tracking-[0.15em] text-accent">
            WELCOME BACK
          </p>
          <h2 className="mt-2 mb-8 font-heading text-3xl text-foreground">
            Sign in to continue
          </h2>

          {/* SEC-004: Lockout banner */}
          {isLockedOut && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
              <Lock size={16} className="shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-sm text-destructive">
                Too many failed attempts. Try again in{' '}
                <span className="font-semibold tabular-nums">{formatCountdown(lockCountdown)}</span>.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-5">

              {/* Username */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
                >
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="Enter your username"
                  disabled={isSubmitting || isLockedOut}
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  {...register('username')}
                  className={errors.username ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.username && (
                  <p id="username-error" className="text-xs text-destructive" role="alert">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
                >
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={isSubmitting || isLockedOut}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                    className={errors.password ? 'border-destructive pr-10 focus-visible:ring-destructive' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    disabled={isSubmitting || isLockedOut}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  >
                    {showPassword
                      ? <EyeOff size={16} aria-hidden="true" />
                      : <Eye    size={16} aria-hidden="true" />
                    }
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs text-destructive" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="premium"
                disabled={isSubmitting || isLockedOut}
                className="mt-2 w-full min-h-[48px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                    Signing in…
                  </span>
                ) : isLockedOut ? (
                  <span className="flex items-center gap-2">
                    <Lock size={16} aria-hidden="true" />
                    Locked — {formatCountdown(lockCountdown)}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <LogIn size={16} aria-hidden="true" />
                  </span>
                )}
              </Button>

{/* SEC-004: Attempt counter hint (only after first failure) */}
              {failedAttempts > 0 && !isLockedOut && (
                <p className="text-center text-xs text-muted-foreground">
                  {MAX_ATTEMPTS - failedAttempts} attempt{MAX_ATTEMPTS - failedAttempts === 1 ? '' : 's'} remaining before lockout
                </p>
              )}

            </div>
          </form>

        </div>
      </div>
    </div>
  );
}