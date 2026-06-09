import LoginForm from '@/components/features/auth/LoginForm';

/**
 * Login page — composition root only.
 * All logic and markup live in LoginForm.
 *
 * Note: metadata is intentionally omitted here because LoginForm
 * is a client component that uses useRouter — keeping this file
 * as a clean server component passthrough avoids the
 * next-router-not-mounted error in the App Router.
 */
export default function LoginPage() {
  return <LoginForm />;
}