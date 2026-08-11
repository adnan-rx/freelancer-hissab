"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const loginStore = useAuthStore((state) => state.login);

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/auth/register', { name, businessName, email, password });
      const data = response.data?.data;
      if (data?.accessToken && data?.user) {
        loginStore(data.accessToken, data.user);
        router.push('/dashboard');
      } else {
        setError('Failed to process registration response');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error?.message || err?.message || 'Failed to register account';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Create your account</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Free to start. No card needed.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/15 bg-destructive-surface p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" required>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Ayesha Tariq"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field label="Business name" htmlFor="businessName" hint="Optional — appears on the invoices you send.">
          <Input
            id="businessName"
            name="businessName"
            autoComplete="organization"
            placeholder="Tariq Design Studio"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </Field>

        <Field label="Email address" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!error}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password" required hint="At least 8 characters.">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            invalid={!!error}
            required
          />
        </Field>

        <Button type="submit" disabled={loading} size="lg" className="mt-2 w-full">
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Creating account…
            </>
          ) : (
            <>
              Create account <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
