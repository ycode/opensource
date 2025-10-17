'use client';

/**
 * Welcome Wizard Page
 * 
 * First-run setup experience for YCode
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetupStore } from '@/stores/useSetupStore';
import type { SupabaseConfig } from '@/types';
import {
  connectSupabase,
  getMigrationSQL,
  runMigrations,
  completeSetup,
} from '@/lib/api/setup';

export default function WelcomePage() {
  const router = useRouter();
  const { currentStep, setStep, setSupabaseConfig, markComplete } =
    useSetupStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationSQL, setMigrationSQL] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  // Admin account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load migration SQL when on migrate step (if not already loaded)
  useEffect(() => {
    if (currentStep === 'migrate' && !migrationSQL) {
      const loadSQL = async () => {
        try {
          const result = await getMigrationSQL();
          if (result.data?.sql) {
            setMigrationSQL(result.data.sql);
          }
        } catch (err) {
          setError('Failed to load migration SQL');
        }
      };
      loadSQL();
    }
  }, [currentStep, migrationSQL]);

  // Step 1: Welcome
  if (currentStep === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="bg-zinc-900 p-12 rounded-2xl shadow-2xl max-w-2xl border border-zinc-800">
          <h1 className="text-5xl font-bold text-white mb-4">
            Welcome to YCode
          </h1>
          <p className="text-xl text-zinc-400 mb-8">
            Build your website on your website. Let&apos;s get you set up in just a
            few steps.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center text-black font-semibold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  Connect Supabase
                </h3>
                <p className="text-zinc-400 text-sm">
                  Link your Supabase instance for data storage
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-white font-semibold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-white">Run Migrations</h3>
                <p className="text-zinc-400 text-sm">
                  Set up database tables automatically
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-white font-semibold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  Create Admin Account
                </h3>
                <p className="text-zinc-400 text-sm">
                  Your first user to access the builder
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep('supabase')}
            className="w-full bg-white hover:bg-zinc-200 text-black font-semibold py-4 px-6 rounded-lg transition-colors"
          >
            Get Started →
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Connect Supabase
  if (currentStep === 'supabase') {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      const formData = new FormData(e.currentTarget);
      const config: SupabaseConfig = {
        url: formData.get('url') as string,
        publishable_key: formData.get('publishable_key') as string,
        secret_key: formData.get('secret_key') as string,
      };

      try {
        const result = await connectSupabase(config);

        if (result.error) {
          setError(result.error);
          return;
        }

        // Store migration SQL from response (if available in data)
        if (result.data && typeof result.data === 'object' && 'migration_sql' in result.data) {
          setMigrationSQL((result.data as any).migration_sql);
        }

        setSupabaseConfig(config);
        
        // Go to migration step to show SQL
        setStep('migrate');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl max-w-2xl w-full border border-zinc-800">
          <h2 className="text-3xl font-bold text-white mb-2">
            Connect Your Supabase
          </h2>
          <p className="text-zinc-400 mb-8">
            Enter your Supabase project credentials. You can find these in your
            Supabase dashboard under Settings → API.
          </p>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-zinc-300 mb-2"
              >
                Project URL
              </label>
              <input
                type="url"
                id="url"
                name="url"
                required
                placeholder="https://your-project.supabase.co"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent placeholder-zinc-500"
              />
            </div>

            <div>
              <label
                htmlFor="publishable_key"
                className="block text-sm font-medium text-zinc-300 mb-2"
              >
                Publishable Key
              </label>
              <textarea
                id="publishable_key"
                name="publishable_key"
                required
                rows={3}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent font-mono text-sm placeholder-zinc-500"
              />
              <p className="text-xs text-zinc-500 mt-1">
                This is safe to use in your frontend code.
              </p>
            </div>

            <div>
              <label
                htmlFor="secret_key"
                className="block text-sm font-medium text-zinc-300 mb-2"
              >
                Secret Key
              </label>
              <textarea
                id="secret_key"
                name="secret_key"
                required
                rows={3}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent font-mono text-sm placeholder-zinc-500"
              />
              <p className="text-xs text-zinc-500 mt-1">
                ⚠️ Keep this secret! It has admin access to your database.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-zinc-700"
                disabled={loading}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-white hover:bg-zinc-200 text-black font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Connecting...' : 'Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 3: Run Migrations
  if (currentStep === 'migrate') {
    const handleCopy = () => {
      navigator.clipboard.writeText(migrationSQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleMigrate = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await runMigrations();

        if (result.error) {
          setError(result.error);
          return;
        }

        setStep('admin');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Migration failed');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl max-w-4xl w-full border border-zinc-800">
          <h2 className="text-3xl font-bold text-white mb-2">
            Run Database Migrations
          </h2>
          <p className="text-zinc-400 mb-6">
            Copy the SQL below and run it in your Supabase SQL Editor to create the necessary tables.
          </p>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="bg-zinc-800 border border-zinc-700 px-4 py-3 rounded-lg mb-6">
            <p className="text-zinc-300 text-sm">
              <strong>📋 Quick Setup (30 seconds):</strong>
              <br />1. Click &quot;Open Supabase SQL Editor&quot; below (opens in new tab)
              <br />2. Click &quot;Copy SQL&quot; and paste into the editor
              <br />3. Click &quot;Run&quot; in Supabase
              <br />4. Come back here and click &quot;Verify & Continue&quot; ✓
            </p>
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                const url = new URL(useSetupStore.getState().supabaseConfig?.url || '');
                const projectRef = url.hostname.split('.')[0];
                window.open(`https://supabase.com/dashboard/project/${projectRef}/sql/new`, '_blank');
              }}
              className="flex-1 bg-white hover:bg-zinc-200 text-black font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              🚀 Open Supabase SQL Editor
            </button>
            <button
              onClick={handleCopy}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-zinc-700"
            >
              {copied ? '✓ Copied!' : '📋 Copy SQL'}
            </button>
          </div>

          <div className="mb-6">
            <label className="text-sm font-medium text-zinc-300 mb-2 block">
              Migration SQL (Copy and paste this into Supabase)
            </label>
            <textarea
              readOnly
              value={migrationSQL}
              className="w-full h-64 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg font-mono text-xs placeholder-zinc-500"
              placeholder="Loading migration SQL..."
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setStep('supabase')}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-zinc-700"
              disabled={loading}
            >
              ← Back
            </button>
            <button
              onClick={handleMigrate}
              disabled={loading}
              className="flex-1 bg-white hover:bg-zinc-200 text-black font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying tables...' : 'Verify & Continue →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Create Admin Account
  if (currentStep === 'admin') {
    const handleComplete = async () => {
      setLoading(true);
      setError(null);

      // Validate inputs
      if (!email || !password || !confirmPassword) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      try {
        // Dynamically import auth store to avoid SSR issues
        const { useAuthStore } = await import('@/stores/useAuthStore');
        const { signUp } = useAuthStore.getState();

        // Sign up admin user
        const result = await signUp(email, password);

        if (result.error) {
          setError(result.error);
          return;
        }

        // Complete setup
        const setupResult = await completeSetup();

        if (setupResult.error) {
          setError(setupResult.error);
          return;
        }

        markComplete();
        // Redirect to builder (will auto-login since signUp sets session)
        router.push('/ycode');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Setup failed');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl max-w-2xl w-full border border-zinc-800">
          <h2 className="text-3xl font-bold text-white mb-2">
            Create Admin Account 👤
          </h2>
          <p className="text-zinc-400 mb-8">
            Create your admin account to access the YCode builder. This will be
            stored securely in Supabase Auth.
          </p>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="bg-zinc-800 border border-zinc-700 px-4 py-3 rounded-lg mb-6">
            <p className="text-zinc-300">
              ✓ Supabase connected
              <br />✓ Database migrated
              <br />✓ Ready for admin account
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@yourdomain.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                disabled={loading}
              />
              <p className="text-xs text-zinc-500 mt-1">
                At least 6 characters
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full bg-white hover:bg-zinc-200 text-black font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account & Go to Builder →'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}


