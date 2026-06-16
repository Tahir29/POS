'use client';

// src/app/(pos)/customers/[customerId]/page.jsx
// Individual customer profile + history — Phase 10 Customer Detail.
//
// Reached by tapping "View Full Profile" in CustomerDetailSheet from
// /customers. Since GetCustomer only supports lookup by mobile (no
// lookup-by-party_id endpoint exists), this page resolves the customer
// record from the cached full directory (useAllCustomers) by matching
// customerId (party_id) against the route param.
//
// Sections:
//   - CustomerProfileCard   — name, mobile, email, address, masked PAN
//   - CustomerOrderHistory  — useCustomerOrders (Order/List, client-filtered)
//   - CustomerSchemeList    — useCustomerEnrollments (SchemeEnrollment/List, client-filtered)

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerProfileCard from '@/components/features/customers/CustomerProfileCard';
import CustomerOrderHistory from '@/components/features/customers/CustomerOrderHistory';
import CustomerSchemeList from '@/components/features/customers/CustomerSchemeList';
import { useAllCustomers } from '@/hooks/customer/useAllCustomers';
import { useCustomerOrders } from '@/hooks/customer/useCustomerOrders';
import { useCustomerEnrollments } from '@/hooks/customer/useCustomerEnrollments';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.customerId;

  const { allCustomers, isLoading: isLoadingCustomers, isFetching } = useAllCustomers();

  const customer = allCustomers.find(
    (c) => String(c.customerId) === String(customerId)
  ) ?? null;

  const {
    orders,
    isLoading: isLoadingOrders,
    isError: isOrdersError,
    refetch: refetchOrders,
  } = useCustomerOrders({
    customerId: customer?.customerId,
    customerMobile: customer?.customerMobile,
    enabled: !!customer,
  });

  const {
    enrollments,
    isLoading: isLoadingEnrollments,
    isError: isEnrollmentsError,
    refetch: refetchEnrollments,
  } = useCustomerEnrollments({
    customerId: customer?.customerId,
    customerMobile: customer?.customerMobile,
    enabled: !!customer,
  });

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="relative -mx-4 -mt-4 flex items-center gap-2 bg-background px-4 pt-4 pb-2 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push('/customers')}
          aria-label="Back to customers"
          className="h-9 w-9 -ml-2"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Button>
        <h1 className="text-base font-bold text-stone-800">Customer Profile</h1>
      </div>

      {isLoadingCustomers && allCustomers.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading customer…
        </div>
      ) : !customer ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-stone-500">Customer not found.</p>
          {isFetching && (
            <p className="text-xs text-stone-400 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              Still loading the customer directory…
            </p>
          )}
          <Button type="button" variant="outline" onClick={() => router.push('/customers')}>
            Back to Customers
          </Button>
        </div>
      ) : (
        <>
          <CustomerProfileCard customer={customer} />

          <CustomerOrderHistory
            orders={orders}
            isLoading={isLoadingOrders}
            isError={isOrdersError}
            refetch={refetchOrders}
          />

          <CustomerSchemeList
            enrollments={enrollments}
            isLoading={isLoadingEnrollments}
            isError={isEnrollmentsError}
            refetch={refetchEnrollments}
          />
        </>
      )}
    </div>
  );
}