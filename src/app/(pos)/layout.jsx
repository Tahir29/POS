import AuthGuard from '@/components/shared/AuthGuard';
import StoreGuard from '@/components/shared/StoreGuard';
import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'Lucira POS',
  description: 'Lucira Jewelry Point of Sale',
};

export default function PosLayout({ children }) {
  return (
    <AuthGuard>
      <StoreGuard>
        <AppShell>
          {children}
        </AppShell>
      </StoreGuard>
    </AuthGuard>
  );
}