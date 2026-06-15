'use client';

// src/components/features/customer/NewCustomerForm/index.jsx
// React Hook Form + Zod form for new customer creation.
// On success, attaches the new customer to the session (silent — useCreateCustomer
// already shows TOAST.CUSTOMER.CREATED).

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { customerSchema } from '@/validators/customerSchema';
import { useCreateCustomer } from '@/hooks/customer/useCreateCustomer';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';

/**
 * @param {{
 *   defaultMobile?: string,
 *   onCreated?: (customer: { customerId: number, customerName: string, customerMobile: string }) => void,
 * }} props
 */
export default function NewCustomerForm({ defaultMobile = '', onCreated }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: defaultMobile,
      email: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zip: '',
      pan: '',
    },
  });

  const createCustomer = useCreateCustomer();
  const session = useCustomerSession();

  const onSubmit = async (values) => {
    try {
      const response = await createCustomer.mutateAsync({
        id: 0,
        first_name: values.first_name,
        last_name: values.last_name,
        address: values.address || '',
        address1: '',
        email: values.email || '',
        phone: values.phone,
        city: values.city || '',
        state: values.state || '',
        country: values.country || '',
        zip: values.zip || '',
        pan: values.pan || '',
        pan_document: '',
        other_document: '',
      });

      const customerId = response?.data?.EntityId;
      const customerName = `${values.first_name} ${values.last_name}`.trim();

      onCreated?.({ customerId, customerName, customerMobile: values.phone });
    } catch {
      // Error toast handled by useCreateCustomer
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" {...register('first_name')} className="h-11" />
          {errors.first_name && (
            <p className="text-sm text-destructive">{errors.first_name.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" {...register('last_name')} className="h-11" />
          {errors.last_name && (
            <p className="text-sm text-destructive">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Mobile number</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          {...register('phone')}
          className="h-11"
        />
        {errors.phone && (
          <p className="text-sm text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email (optional)</Label>
        <Input id="email" type="email" {...register('email')} className="h-11" />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Address (optional)</Label>
        <Input id="address" {...register('address')} className="h-11" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" {...register('city')} className="h-11" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="state">State</Label>
          <Input id="state" {...register('state')} className="h-11" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" {...register('country')} className="h-11" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="zip">ZIP / Postal code</Label>
          <Input id="zip" {...register('zip')} className="h-11" />
        </div>
      </div>

      <Button
        type="submit"
        disabled={createCustomer.isPending}
        className="h-11 mt-2"
      >
        {createCustomer.isPending ? 'Creating…' : 'Create Customer'}
      </Button>
    </form>
  );
}