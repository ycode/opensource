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
  runMigrations,
  completeSetup,
} from '@/lib/api/setup';

export default function WelcomePage() {
  const router = useRouter();
  const { currentStep, setStep, setSupabaseConfig, markComplete } = useSetupStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
              <svg
                className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg"
                fill="none" viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25" cx="12"
                  cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
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
              <svg
                className="w-8 h-8 text-purple-400" fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
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
                    <span>Add these 4 variables (get values from <strong className="text-white">Supabase Dashboard → Settings</strong>):</span>
                  </li>
                </ol>
              </div>

              <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 space-y-3">
                <div>
                  <code className="text-green-400 font-mono text-sm">SUPABASE_ANON_KEY</code>
                  <p className="text-xs text-zinc-400 mt-1">Your anon/public key (starts with eyJ...)</p>
                </div>
                <div>
                  <code className="text-green-400 font-mono text-sm">SUPABASE_SERVICE_ROLE_KEY</code>
                  <p className="text-xs text-zinc-400 mt-1">Your service role key (starts with eyJ...)</p>
                </div>
                <div>
                  <code className="text-green-400 font-mono text-sm">SUPABASE_CONNECTION_URL</code>
                  <p className="text-xs text-zinc-400 mt-1">PostgreSQL connection string with [YOUR-PASSWORD] placeholder (e.g., postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-x-xx-xxxx-x.pooler.supabase.com:6543/postgres)</p>
                </div>
                <div>
                  <code className="text-green-400 font-mono text-sm">SUPABASE_DB_PASSWORD</code>
                  <p className="text-xs text-zinc-400 mt-1">Your actual database password</p>
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
          anonKey: formData.get('anon_key') as string,
          serviceRoleKey: formData.get('service_role_key') as string,
          connectionUrl: formData.get('connection_url') as string,
          dbPassword: formData.get('db_password') as string,
        };

        try {
          const result = await connectSupabase(config);

          if (result.error) {
            setError(result.error);
            return;
          }

          setSupabaseConfig(config);

          // Go to migration step
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
            <svg
              className="w-8 h-8 text-green-400" fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="text-3xl font-bold text-white">
              Connect Your Supabase
            </h2>
          </div>

          <div className="bg-green-950 border border-green-800 text-green-300 px-4 py-3 rounded-lg mb-3">
            <p className="font-semibold mb-1">💻 Local Development</p>
            <p className="text-sm">
              Credentials will be saved to <code className="font-mono text-xs">.credentials.json</code> (gitignored)
            </p>
          </div>

          <p className="text-zinc-400 mb-3 leading-5">
            Enter your Supabase project credentials (you can find them in your Supabase project settings).
          </p>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg my-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="anon_key"
                className="block text-sm font-medium text-zinc-300"
              >
                Anon key (Publishable key)
              </label>
              <p className="text-xs text-zinc-500 mt-1 mb-1.5">
                Find it in <span className="text-white/85">Supabase → Project settings → API keys</span>.
              </p>
              <input
                id="anon_key"
                name="anon_key"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent font-mono text-sm placeholder-zinc-500"
              />
            </div>

            <div>
              <label
                htmlFor="service_role_key"
                className="block text-sm font-medium text-zinc-300"
              >
                Service role key (Secret key)
              </label>
              <p className="text-xs text-zinc-500 mt-1 mb-1.5">
                Find it in <span className="text-white/85">Supabase → Project settings → API keys</span>.
              </p>
              <input
                id="service_role_key"
                name="service_role_key"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent font-mono text-sm placeholder-zinc-500"
              />
            </div>

            <div>
              <label
                htmlFor="connection_url"
                className="block text-sm font-medium text-zinc-300"
              >
                Pooler connection URL
              </label>
              <p className="text-xs text-zinc-500 mt-1 mb-1.5">
                Find it in <span className="text-white/85">Supabase → Connect → Connection String → Method: Transaction pooler</span>. Copy/Paste as-is.
              </p>
              <input
                type="text"
                id="connection_url"
                name="connection_url"
                required
                placeholder="postgresql://postgres.zxzgetrkwbpvakuzpytt:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:6543/postgres"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent font-mono text-xs placeholder-zinc-500"
              />
            </div>

            <div>
              <label
                htmlFor="db_password"
                className="block text-sm font-medium text-zinc-300"
              >
                Database Password
              </label>
              <p className="text-xs text-zinc-500 mt-1 mb-1.5">
                The database password was created with the project. It can be reset in Supabase Settings.
              </p>
              <input
                type="password"
                id="db_password"
                name="db_password"
                required
                placeholder="••••••••••••••••"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent placeholder-zinc-500"
              />
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

  // Step 3: Run Migrations (Automatic)
  if (currentStep === 'migrate') {
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
        <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl max-w-2xl w-full border border-zinc-800">
          <h2 className="text-3xl font-bold text-white mb-2">
            Setup Database 🗄️
          </h2>
          <p className="text-zinc-400 mb-8">
            We&apos;ll automatically create the necessary database tables and storage buckets in your Supabase project.
          </p>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="bg-zinc-800 border border-zinc-700 px-4 py-3 rounded-lg mb-8">
            <p className="text-zinc-300 text-sm font-medium mb-2">
              ✨ What will be created:
            </p>
            <ul className="text-zinc-400 text-sm space-y-1 ml-4 list-disc">
              <li>Pages table (for your website pages)</li>
              <li>Page versions table (draft and published versions)</li>
              <li>Assets table (for uploaded images)</li>
              <li>Settings table (site configuration)</li>
              <li>Storage bucket (for file uploads)</li>
            </ul>
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
              {loading ? 'Setting up database...' : 'Run Setup →'}
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


