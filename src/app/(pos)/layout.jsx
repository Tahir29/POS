import AuthGuard from '@/components/shared/AuthGuard';
import StoreGuard from '@/components/shared/StoreGuard';
import AppShell from '@/components/layout/AppShell';
import SessionProvider from '@/components/shared/SessionProvider';

export const metadata = {
  title: 'Lucira POS',
  description: 'Lucira Jewelry Point of Sale',
};

export default function PosLayout({ children }) {
  return (
    <AuthGuard>
      <SessionProvider>
        <StoreGuard>
          <AppShell>
            {children}
          </AppShell>
        </StoreGuard>
      </SessionProvider>
    </AuthGuard>
  );
}