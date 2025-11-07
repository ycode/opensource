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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

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
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 overflow-y-auto py-8">

          <div className="flex-1 flex items-center text-center flex-col gap-1 text-balance">

            <svg
              className="size-10 fill-current absolute animate-out fade-out slide-in-from-bottom-1 duration-700"
              style={{ animationDelay: '2000ms', animationFillMode: 'both' }}
              viewBox="0 0 24 24"
              version="1.1" xmlns="http://www.w3.org/2000/svg"
            >
              <g
                id="Symbols" stroke="none"
                strokeWidth="1" fill="none"
                fillRule="evenodd"
              >
                <g id="Sidebar" transform="translate(-30.000000, -30.000000)">
                  <g id="Ycode">
                    <g transform="translate(30.000000, 30.000000)">
                      <rect
                        id="Rectangle" x="0"
                        y="0" width="24"
                        height="24"
                      />
                      <path
                        id="CurrentFill" d="M11.4241533,0 L11.4241533,5.85877951 L6.024,8.978 L12.6155735,12.7868008 L10.951,13.749 L23.0465401,6.75101349 L23.0465401,12.6152717 L3.39516096,23.9856666 L3.3703726,24 L3.34318129,23.9827156 L0.96,22.4713365 L0.96,16.7616508 L3.36417551,18.1393242 L7.476,15.76 L0.96,11.9090099 L0.96,6.05375516 L11.4241533,0 Z"
                        className="fill-current"
                      />
                    </g>
                  </g>
                </g>
              </g>
            </svg>

            <Label
              className="animate-in fade-in slide-in-from-bottom-1 duration-700"
              size="sm"
              style={{ animationDelay: '2500ms', animationFillMode: 'both' }}
            >
              Welcome to Ycode
            </Label>
            <Label
              variant="muted"
              size="sm"
              className="animate-in fade-in slide-in-from-bottom-1 duration-700"
              style={{ animationDelay: '2700ms', animationFillMode: 'both' }}
            >
              Let&apos;s get you set up in just a few steps.
            </Label>

            <div
              className="mt-4 animate-in fade-in slide-in-from-bottom-1 duration-700"
              style={{ animationDelay: '3700ms', animationFillMode: 'both' }}
            >
              <Button onClick={() => setStep('supabase')}>
                Get started
              </Button>
            </div>

          </div>

      </div>
    );
  }

  // Step 2: Connect Supabase
  if (currentStep === 'supabase') {
    // Show loading while checking environment
    if (isVercel === null) {
      return (
        <div className="min-h-screen flex flex-col gap-2 text-center items-center justify-center bg-neutral-950 py-10">

            <Label size="sm">
              Please wait
            </Label>
            <Label
              variant="muted" size="sm"
              className="bg-gradient-to-r from-muted-foreground via-muted-foreground/40 to-muted-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent !font-normal"
            >
              Detecting environment...
            </Label>

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
            // Show specific error from API if available, otherwise generic message
            if (data.error) {
              setError(data.error);
            } else {
              setError(
                'Environment variables not detected. Please set them in Vercel Dashboard and redeploy.'
              );
            }
          }
        } catch (err) {
          setError('Failed to check configuration');
        } finally {
          setLoading(false);
        }
      };

      return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4 overflow-y-auto py-8">
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 py-10">

        <div className="grid grid-cols-3 gap-4 w-full max-w-xl">

          <div className="border-t-2 border-white/100 py-4 flex flex-col gap-0.5">
            <Label variant="muted">Step 1</Label>
            <Label size="sm">Connect Supabase</Label>
          </div>

          <div className="border-t-2 border-white/50 py-4 flex flex-col gap-0.5 opacity-50">
            <Label variant="muted">Step 2</Label>
            <Label size="sm">Run migrations</Label>
          </div>

          <div className="border-t-2 border-white/50 py-4 flex flex-col gap-0.5 opacity-50">
            <Label variant="muted">Step 3</Label>
            <Label size="sm">Create account</Label>
          </div>

        </div>

        <div className="w-full max-w-xl py-10">

          <form onSubmit={handleSubmit} className="">

            <FieldGroup className="animate-in fade-in slide-in-from-bottom-1 duration-700" style={{ animationFillMode: 'both' }}>
              <FieldSet>
                <FieldGroup className="gap-8">

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Field>
                    <FieldLabel htmlFor="anon_key" size="sm">Publishable key</FieldLabel>
                    <Input
                      id="anon_key"
                      name="anon_key"
                      required
                      placeholder="sb_publishable_ABCABCABCABCABC"
                      size="sm"
                    />
                    <FieldDescription>
                      Find it in <span className="text-white/85">Supabase → Project settings → API keys</span>.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="service_role_key" size="sm">Secret key</FieldLabel>
                    <Input
                      id="service_role_key"
                      name="service_role_key"
                      required
                      placeholder="sb_secret_ABCABCABCABCABC"
                      size="sm"
                    />
                    <FieldDescription>
                      Find it in <span className="text-white/85">Supabase → Project settings → API keys</span>.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="connection_url" size="sm">Pooler connection URL</FieldLabel>
                    <Input
                      type="text"
                      id="connection_url"
                      name="connection_url"
                      required
                      placeholder="postgresql://postgres.zxzgetrkwbpvakuzpytt:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:6543/postgres"
                      size="sm"
                    />
                    <FieldDescription>
                      Find it in <span className="text-white/85">Supabase → Connect → Connection String → Method: Transaction pooler</span>.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="connection_url" size="sm">Database Password</FieldLabel>
                    <Input
                      type="password"
                      id="db_password"
                      name="db_password"
                      required
                      placeholder="••••••••••••••••"
                      size="sm"
                    />
                    <FieldDescription>
                      The database password was created with the project. It can be reset in <span className="text-white/85">Database → Settings</span>.
                    </FieldDescription>
                  </Field>


                  <div className="flex flex-col gap-2 mt-4">
                    <Button
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? <Spinner /> : 'Continue'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep('welcome')}
                      disabled={loading}
                    >
                      Return back
                    </Button>
                  </div>

                </FieldGroup>
              </FieldSet>
            </FieldGroup>

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 py-10">

        <div className="grid grid-cols-3 gap-4 w-full max-w-xl">

          <div className="border-t-2 border-white/100 py-4 flex flex-col gap-0.5">
            <Label variant="muted">Step 1</Label>
            <Label size="sm">Connect Supabase</Label>
          </div>

          <div className="border-t-2 border-white/100 py-4 flex flex-col gap-0.5">
            <Label variant="muted">Step 2</Label>
            <Label size="sm">Run migrations</Label>
          </div>

          <div className="border-t-2 border-white/50 py-4 flex flex-col gap-0.5 opacity-50">
            <Label variant="muted">Step 3</Label>
            <Label size="sm">Create account</Label>
          </div>

        </div>

        <div className="w-full max-w-xl py-10">

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-1 duration-700" style={{ animationFillMode: 'both' }}>

            <div className="flex-1 flex items-center text-center flex-col gap-2 bg-white/5 py-10 rounded-2xl">
              <Icon name="database" className="size-4 mb-2" />
              <Label size="sm">Setup database</Label>
              <Label
                variant="muted" size="sm"
                className="leading-relaxed max-w-96"
              >We&apos;ll automatically create the necessary database tables and storage buckets in your Supabase project.</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleMigrate}
                disabled={loading}
              >
                {loading ? <Spinner /> : 'Run migrations'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('supabase')}
                disabled={loading}
              >
                Return back
              </Button>
            </div>

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 py-10">

        <div className="grid grid-cols-3 gap-4 w-full max-w-xl">

          <div className="border-t-2 border-white/100 py-4 flex flex-col gap-0.5">
            <Label variant="muted">Step 1</Label>
            <Label size="sm">Connect Supabase</Label>
          </div>

          <div className="border-t-2 border-white/100 py-4 flex flex-col gap-0.5">
            <Label variant="muted">Step 2</Label>
            <Label size="sm">Run migrations</Label>
          </div>

          <div className="border-t-2 border-white/100 py-4 flex flex-col gap-0.5">
            <Label variant="muted">Step 3</Label>
            <Label size="sm">Create account</Label>
          </div>

        </div>

        <div className="w-full max-w-xl py-10 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-1 duration-700" style={{ animationFillMode: 'both' }}>

          <FieldGroup>
            <FieldSet>
              <FieldGroup className="gap-8">


                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}

                <Field>
                  <FieldLabel htmlFor="email" size="sm">Email</FieldLabel>
                  <Input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourdomain.com"
                    disabled={loading}
                    size="sm"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password" size="sm">Password</FieldLabel>
                  <Input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    size="sm"
                  />
                  <FieldDescription>At least 6 characters</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="confirmPassword" size="sm">Confirm password</FieldLabel>
                  <Input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    size="sm"
                  />
                </Field>

                <div className="flex flex-col gap-4 mt-2">
                  <Button
                    type="submit"
                    onClick={handleComplete}
                    disabled={loading}
                  >
                    {loading ? <Spinner /> : 'Create account'}
                  </Button>
                  <FieldDescription className="text-center text-[10px] opacity-60">Your user will be stored securely in Supabase Auth.</FieldDescription>
                </div>

              </FieldGroup>
            </FieldSet>
          </FieldGroup>

        </div>
      </div>
    );
  }

  return null;
}


