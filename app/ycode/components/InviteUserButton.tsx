'use client';

/**
 * Invite User Button Component
 *
 * A button with popover dropdown to invite users by email
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

interface InviteUserButtonProps {
  className?: string;
}

export const InviteUserButton: React.FC<InviteUserButtonProps> = ({
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Close popover when clicking on canvas (iframe clicks don't bubble to parent)
  useEffect(() => {
    const handleCanvasClick = () => {
      setIsOpen(false);
    };

    window.addEventListener('canvasClick', handleCanvasClick);
    return () => {
      window.removeEventListener('canvasClick', handleCanvasClick);
    };
  }, []);

  const handleInvite = useCallback(async () => {
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/ycode/api/auth/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: window.location.origin + '/ycode/accept-invite',
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error || 'Failed to send invitation');
        return;
      }

      setSuccess(`Invitation sent to ${email}`);
      setEmail('');

      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to send invite:', err);
      setError('Failed to send invitation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleInvite();
    }
  }, [handleInvite, isLoading]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when closing
      setEmail('');
      setError(null);
      setSuccess(null);
    }
  }, []);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className={className}
        >
          Invite
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Invite a user
            </Label>
            <p className="text-xs text-muted-foreground">
              Send an invitation email to collaborate on this project.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              autoFocus
            />

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            {success && (
              <p className="text-xs text-green-500">{success}</p>
            )}
          </div>

          <Button
            onClick={handleInvite}
            disabled={isLoading || !email.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Spinner />
                Sending...
              </>
            ) : (
              'Send Invitation'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default InviteUserButton;
