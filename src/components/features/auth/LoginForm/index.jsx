'use client';

// SEC-004: Login rate limiting added.
// After 5 failed attempts the form locks for 5 minutes, preventing
// brute-force attacks on staff credentials on the shared POS device.
// Attempt counter and lockout expiry are stored in component state only
// (not persisted) — a page refresh resets them, which is acceptable for
// a controlled retail environment where the device is never left unattended.
//
// LAYOUT (2026-07-26 redesign): split-screen — left is a full-bleed brand
// photo (public/images/login-banner.png) under a burgundy gradient wash,
// right is the sign-in form with larger icon-prefixed inputs. Below `sm`
// the photo panel is hidden entirely (not stacked) — a compact centered
// logo replaces it — since a tall product photo above the fold would push
// the actual form off-screen on a phone, which matters more here than
// showing the photo at all on small devices.

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, User, Lock, ArrowRight, Sparkle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import Image from 'next/image';

import { loginSchema }           from '@/validators/loginSchema';
import { useAuth }               from '@/hooks/auth/useAuth';
import TOAST                     from '@/constants/toastMessages';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import Logo                      from '@/components/shared/Logo';
import { cn }                    from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Label }  from '@/components/ui/label';

const MAX_ATTEMPTS    = 5;
const LOCKOUT_MS      = 5 * 60 * 1000;

// ── Large icon-prefixed input — local to this screen only ──────
// Not folded into the shared <Input>: that component's h-9 size is the
// app-wide density norm for POS forms, and changing it globally would
// ripple into every form in the app. Login is a one-off hero screen.
function AuthField({ icon: Icon, id, error, trailing, ...props }) {
  return (
    <div className="relative">
      <Icon
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id={id}
        data-slot="input"
        className={cn(
          'h-14 w-full rounded-xl border border-input bg-transparent pl-11 pr-4 text-base shadow-xs',
          'transition-[color,box-shadow] duration-standard ease-premium outline-none',
          'placeholder:text-muted-foreground',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          trailing && 'pr-11',
          error && 'border-destructive focus-visible:ring-destructive/20'
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}

export default function LoginForm() {
  const { login }       = useAuth();
  const router          = useRouter();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil,    setLockedUntil]    = useState(null);
  const [lockCountdown,  setLockCountdown]  = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver:      zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

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

  // Derived from lockCountdown (state), not a fresh Date.now() read — the
  // ticking effect above already keeps lockCountdown in sync with
  // lockedUntil every second, including nulling lockedUntil out at exactly
  // 0, so this stays accurate without calling an impure function during
  // render (which React Compiler now flags as an error — reading the
  // clock directly here could disagree with what the last render computed).
  const isLockedOut = lockCountdown > 0;

  const onSubmit = async (data) => {
    if (isLockedOut) return; // belt-and-suspenders; button is also disabled

    setIsSubmitting(true);
    try {
      await login(data.username, data.password);
      setFailedAttempts(0);
    } catch (err) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);

      if (nextAttempts >= MAX_ATTEMPTS) {
        // Not a render-purity violation despite the lint rule's name: this
        // whole block only ever runs inside a real submit event, via
        // handleSubmit(onSubmit) below — never during render. The
        // react-hooks/purity rule's static analysis can't see through
        // react-hook-form's handleSubmit() wrapper to know that (the same
        // documented "incompatible library" limitation this file already
        // hits on react-hook-form's watch(), and the same class of gap
        // useMediaQuery.js's own comment calls out elsewhere).
        // eslint-disable-next-line react-hooks/purity
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

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex w-full overflow-hidden sm:shadow-lg">

        <div className="relative hidden w-[42%] shrink-0 flex-col overflow-hidden bg-primary sm:flex">
          <Image
            src="/images/login-banner.png"
            alt=""
            fill
            priority
            sizes="42vw"
            className="object-cover"
          />
          {/* Burgundy wash — darkest where the wordmark sits, fading out
              toward the bottom so the ring reads clearly through the tint. */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-primary/95 via-primary/70 to-primary/25"
            aria-hidden="true"
          />

          <div className="relative flex flex-1 flex-col items-center gap-4 px-8 pt-[22%]">
            <div className="p-3">
              <Logo variant="icon" color="white" width={44} height={44} priority />
            </div>

            <div className="flex flex-col items-center gap-1">
              <Logo variant="full" color="white" width={190} height={64} priority />
            </div>

            <div className="mt-1 flex items-center gap-3 text-accent">
              <span className="h-px w-8 bg-accent/70" aria-hidden="true" />
              <Sparkle size={12} aria-hidden="true" />
              <span className="h-px w-8 bg-accent/70" aria-hidden="true" />
            </div>

            <p className="font-heading text-lg text-accent">Point of Sale</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center bg-card px-6 py-10 sm:px-14 sm:py-12">
          <div className="w-full max-w-sm">

            <div className="mb-8 flex justify-center sm:hidden">
              <Logo variant="full" width={130} height={42} priority />
            </div>

            <p className="text-xs font-semibold tracking-[0.15em] text-accent">
              WELCOME BACK
            </p>
            <h2 className="mt-2 mb-8 font-heading text-3xl text-foreground">
              Sign in to continue
            </h2>

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

                <div className="space-y-1.5">
                  <Label
                    htmlFor="username"
                    className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
                  >
                    Username
                  </Label>
                  <AuthField
                    icon={User}
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    placeholder="Enter your username"
                    disabled={isSubmitting || isLockedOut}
                    error={errors.username}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? 'username-error' : undefined}
                    {...register('username')}
                  />
                  {errors.username && (
                    <p id="username-error" className="text-xs text-destructive" role="alert">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase"
                  >
                    Password
                  </Label>
                  <AuthField
                    icon={Lock}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={isSubmitting || isLockedOut}
                    error={errors.password}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        disabled={isSubmitting || isLockedOut}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showPassword
                          ? <EyeOff size={18} aria-hidden="true" />
                          : <Eye    size={18} aria-hidden="true" />
                        }
                      </button>
                    }
                  />
                  {errors.password && (
                    <p id="password-error" className="text-xs text-destructive" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || isLockedOut}
                  className="mt-2 w-full min-h-[56px] rounded-xl text-base"
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
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  )}
                </Button>

                {failedAttempts > 0 && !isLockedOut && (
                  <p className="text-center text-xs text-muted-foreground">
                    {MAX_ATTEMPTS - failedAttempts} attempt{MAX_ATTEMPTS - failedAttempts === 1 ? '' : 's'} remaining before lockout
                  </p>
                )}

              </div>
            </form>

            <div className="mt-8 flex items-center gap-3 text-border" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <Sparkle size={12} className="text-accent/70" />
              <span className="h-px flex-1 bg-border" />
            </div>

            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={14} className="shrink-0" aria-hidden="true" />
              Secure and trusted POS system
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
