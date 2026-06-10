'use client';

// src/components/features/auth/LoginForm/index.jsx

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';

import { loginSchema }          from '@/validators/loginSchema';
import { useAuth }              from '@/hooks/auth/useAuth';
import TOAST                    from '@/constants/toastMessages';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import Logo                     from '@/components/shared/Logo';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

export default function LoginForm() {
  const { login }          = useAuth();
  const router             = useRouter();
  const isAuthenticated    = useSelector(selectIsAuthenticated);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  if (isAuthenticated) return null;

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await login(data.username, data.password);
    } catch (err) {
      toast.error(err?.message || TOAST.AUTH.LOGIN_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Brand header — full wordmark */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <Logo variant="full" width={140} height={44} priority />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card px-8 py-10 shadow-sm">
          <h2 className="mb-6 text-lg font-medium text-foreground">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-5">

              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium text-foreground">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="Enter your username"
                  disabled={isSubmitting}
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
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                    className={errors.password ? 'border-destructive pr-10 focus-visible:ring-destructive' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    disabled={isSubmitting}
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
                disabled={isSubmitting}
                className="mt-2 w-full min-h-[48px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn size={16} aria-hidden="true" />
                    Sign in
                  </span>
                )}
              </Button>

            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lucira Jewelry &copy; {new Date().getFullYear()}
        </p>

      </div>
    </div>
  );
}
