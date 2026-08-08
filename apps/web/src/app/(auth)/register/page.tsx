"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
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
    <div className="min-h-screen flex items-center justify-center bg-secondary/50 text-foreground p-4 py-12">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center font-bold text-primary-foreground text-xl shadow-sm mb-4">
            Rs
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Create an account</h2>
          <p className="text-muted-foreground mt-2 text-sm">Start managing your freelancing finances today.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 text-sm rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Full Name</label>
            <Input 
              placeholder="Muhammad Ahmed" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Business Name (Optional)</label>
            <Input 
              placeholder="Ahmed Web Solutions" 
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email Address</label>
            <Input 
              type="email" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-11 mt-6"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
