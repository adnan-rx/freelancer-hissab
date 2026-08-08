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
        loginStore(data.accessToken, data.refreshToken, data.user);
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
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-12 flex-col justify-between border-r border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
              Rs
            </div>
            <span className="text-2xl font-bold tracking-tight text-emerald-400">FreelancerHisab</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-slate-100">
            Join Thousands of Pakistani Freelancers
          </h1>
          <p className="text-slate-300 text-lg max-w-md">
            Start tracking your Upwork, Fiverr, and direct client earnings with automated PKR conversion.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 bg-slate-900/60 p-8 rounded-2xl border border-slate-800 backdrop-blur-md">
          <div>
            <h2 className="text-3xl font-bold text-slate-100">Create an account</h2>
            <p className="text-slate-400 mt-2 text-sm">Start managing your freelancing finances today.</p>
          </div>

          {error && (
            <div className="p-3 text-sm rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Full Name</label>
              <Input 
                placeholder="Muhammad Ahmed" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-slate-900 border-slate-800 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Business Name (Optional)</label>
              <Input 
                placeholder="Ahmed Web Solutions" 
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="bg-slate-900 border-slate-800 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <Input 
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-900 border-slate-800 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <Input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-900 border-slate-800 text-slate-100"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold h-11 transition-all mt-4"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-400">
            Already have an account? <Link href="/login" className="text-emerald-400 hover:underline font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
