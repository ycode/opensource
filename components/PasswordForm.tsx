'use client';

import { useState, FormEvent } from 'react';

/**
 * Password Form Component
 *
 * A client-side form for entering passwords to access protected pages.
 * Submits to /api/page-auth/verify and handles success/error states.
 */

export interface PasswordFormProps {
  /** The page ID if protection is at page level */
  pageId?: string;
  /** The folder ID if protection is at folder level */
  folderId?: string;
  /** The URL to redirect to after successful authentication */
  redirectUrl: string;
  /** Whether to check published or draft version of the page/folder */
  isPublished?: boolean;
}

export default function PasswordForm({ pageId, folderId, redirectUrl, isPublished = true }: PasswordFormProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsRateLimited(false);
    setIsLoading(true);

    try {
      const requestBody = {
        ...(pageId && { pageId }),
        ...(folderId && { folderId }),
        password,
        redirectUrl,
        isPublished,
      };

      const response = await fetch('/api/page-auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Incorrect password';
        setError(errorMessage);
        setIsRateLimited(response.status === 429);
        setIsLoading(false);
        return;
      }

      // Success - redirect to the protected page
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        window.location.reload();
      }
    } catch {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="ycode-password-form">
      <div className="ycode-password-form-field">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="ycode-password-input"
          disabled={isLoading}
          autoFocus
          required
        />
      </div>

      {error && (
        <div className={`ycode-password-error ${isRateLimited ? 'ycode-password-rate-limited' : ''}`}>
          {isRateLimited && (
            <svg
              width="16" height="16"
              viewBox="0 0 16 16" fill="currentColor"
              style={{ marginRight: '6px', flexShrink: 0 }}
            >
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
            </svg>
          )}
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !password}
        className="ycode-password-submit"
      >
        {isLoading ? 'Verifying...' : 'Submit'}
      </button>

      <style jsx>{`
        .ycode-password-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 300px;
          margin: 0 auto;
          padding: 0 16px 48px;
        }

        .ycode-password-form-field {
          width: 100%;
        }

        .ycode-password-input {
          width: 100%;
          padding: 10px 14px;
          font-size: 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .ycode-password-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .ycode-password-input:disabled {
          background-color: #f3f4f6;
          cursor: not-allowed;
        }

        .ycode-password-error {
          color: #dc2626;
          font-size: 13px;
          text-align: center;
        }

        .ycode-password-rate-limited {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 10px 12px;
          font-weight: 500;
        }

        .ycode-password-submit {
          width: 100%;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          color: white;
          background-color: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .ycode-password-submit:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .ycode-password-submit:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}
