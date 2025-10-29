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
  const [isVercel, setIsVercel] = useState<boolean | null>(null); // null = loading
  const [envVarsConfigured, setEnvVarsConfigured] = useState(false);
  
  // Admin account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if running on Vercel and if env vars are configured
  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const response = await fetch('/api/setup/status');
        const data = await response.json();
        setIsVercel(data.is_vercel || false);
        setEnvVarsConfigured(data.is_configured || false);
      } catch (err) {
        console.error('Failed to check environment:', err);
        setIsVercel(false); // Default to local on error
      }
    };
    checkEnvironment();
  }, [currentStep]);

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
    // Show loading while checking environment
    if (isVercel === null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="bg-zinc-900 p-12 rounded-2xl shadow-2xl max-w-2xl border border-zinc-800">
            <div className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-xl text-zinc-300">Detecting environment...</p>
            </div>
          </div>
        </div>
      );
    }

    // On Vercel: Show environment variable instructions
    if (isVercel === true) {
      const handleCheckConfig = async () => {
        setLoading(true);
        setError(null);

        try {
          const response = await fetch('/api/setup/status');
          const data = await response.json();

          if (data.is_configured) {
            setEnvVarsConfigured(true);
            // Go to migration step
            setStep('migrate');
          } else {
            setError(
              'Environment variables not detected. Please set them in Vercel Dashboard and redeploy.'
            );
          }
        } catch (err) {
          setError('Failed to check configuration');
        } finally {
          setLoading(false);
        }
      };

      return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
          <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl max-w-3xl w-full border border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h2 className="text-3xl font-bold text-white">
                Configure Environment Variables
              </h2>
            </div>
            
            <div className="bg-blue-950 border border-blue-800 text-blue-300 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold mb-1">⚡ Running on Vercel</p>
              <p className="text-sm">
                Vercel has a read-only filesystem, so credentials must be set as environment variables.
              </p>
            </div>

            {error && (
              <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="space-y-6 mb-8">
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  📝 Step 1: Add Environment Variables in Vercel
                </h3>
                <ol className="space-y-3 text-zinc-300">
                  <li className="flex gap-3">
                    <span className="text-white font-semibold">1.</span>
                    <span>Go to <strong className="text-white">Vercel Dashboard</strong> → Your Project → <strong className="text-white">Settings</strong> → <strong className="text-white">Environment Variables</strong></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-semibold">2.</span>
                    <span>Add these three variables (get values from <strong className="text-white">Supabase Dashboard → Settings → API</strong>):</span>
                  </li>
                </ol>
              </div>

              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 space-y-3">
                <div>
                  <code className="text-green-400 font-mono text-sm">SUPABASE_URL</code>
                  <p className="text-xs text-zinc-400 mt-1">Your Supabase project URL (e.g., https://xxxxx.supabase.co)</p>
                </div>
                <div>
                  <code className="text-green-400 font-mono text-sm">SUPABASE_ANON_KEY</code>
                  <p className="text-xs text-zinc-400 mt-1">Your anon/public key (starts with eyJ...)</p>
                </div>
                <div>
                  <code className="text-green-400 font-mono text-sm">SUPABASE_SERVICE_ROLE_KEY</code>
                  <p className="text-xs text-zinc-400 mt-1">Your service role key (starts with eyJ...)</p>
                </div>
              </div>

              <div className="bg-yellow-950 border border-yellow-800 text-yellow-300 px-4 py-3 rounded-lg">
                <p className="font-semibold mb-1">⚠️ Important</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Add to <strong>all environments</strong> (Production, Preview, Development)</li>
                  <li>Click <strong>Save</strong> after each variable</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  🔄 Step 2: Redeploy Your Application
                </h3>
                <ol className="space-y-2 text-zinc-300">
                  <li className="flex gap-3">
                    <span className="text-white font-semibold">1.</span>
                    <span>Go to <strong className="text-white">Deployments</strong> tab</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-semibold">2.</span>
                    <span>Click <strong className="text-white">...</strong> on latest deployment</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-semibold">3.</span>
                    <span>Click <strong className="text-white">Redeploy</strong></span>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  ✅ Step 3: Verify Configuration
                </h3>
                <p className="text-zinc-300">
                  After redeploying, click the button below to check if environment variables are detected:
                </p>
              </div>
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
                type="button"
                onClick={handleCheckConfig}
                disabled={loading}
                className="flex-1 bg-white hover:bg-zinc-200 text-black font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Verify Configuration →'}
              </button>
            </div>

            <p className="text-xs text-zinc-500 text-center mt-4">
              Need help? Check the{' '}
              <a
                href="https://github.com/liamwalder/test/blob/main/VERCEL_DEPLOYMENT.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                deployment guide
              </a>
            </p>
          </div>
        </div>
      );
    }

    // Local development: Show form to enter credentials (only if isVercel === false)
    if (isVercel === false) {
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
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h2 className="text-3xl font-bold text-white">
              Connect Your Supabase
            </h2>
          </div>
          
          <div className="bg-green-950 border border-green-800 text-green-300 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold mb-1">💻 Local Development</p>
            <p className="text-sm">
              Credentials will be saved to <code className="font-mono text-xs">.credentials.json</code> (gitignored)
            </p>
          </div>

          <p className="text-zinc-400 mb-8">
            Enter your Supabase project credentials. You can find these in your
            Supabase dashboard under <strong className="text-white">Settings → API</strong>.
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
                Publishable Key (anon key)
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
                Secret Key (service_role key)
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

    // This should never happen, but just in case
    return null;
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
                autoComplete="new-password"
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
                autoComplete="new-password"
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


