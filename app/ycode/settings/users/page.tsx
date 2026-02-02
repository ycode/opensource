'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import {
  FieldDescription,
  FieldLegend,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { getUserInitials, generateUserColor } from '@/lib/collaboration-utils';
import { useAuthStore } from '@/stores/useAuthStore';

interface ActiveUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  invited_at: string;
}

export default function UsersSettingsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string; type: 'user' | 'invite' } | null>(null);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/auth/users');
      const result = await response.json();
      if (result.data) {
        setActiveUsers(result.data.activeUsers || []);
        setPendingInvites(result.data.pendingInvites || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const response = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          redirectTo: window.location.origin + '/accept-invite',
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setInviteError(result.error || 'Failed to send invitation');
        return;
      }

      const invitedEmail = inviteEmail.trim();
      setInviteSuccess(`Invitation sent to ${invitedEmail}`);
      setInviteEmail('');

      // Add to pending invites list immediately
      if (result.data?.user) {
        setPendingInvites((prev) => [
          {
            id: result.data.user.id,
            email: invitedEmail,
            invited_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      // Clear success message after a few seconds
      setTimeout(() => setInviteSuccess(null), 3000);
    } catch (error) {
      console.error('Failed to send invite:', error);
      setInviteError('Failed to send invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  }, [inviteEmail]);

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(`/api/auth/users?id=${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (userToDelete.type === 'user') {
          setActiveUsers(activeUsers.filter(u => u.id !== userToDelete.id));
        } else {
          setPendingInvites(pendingInvites.filter(i => i.id !== userToDelete.id));
        }
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setShowDeleteDialog(false);
      setUserToDelete(null);
    }
  };

  const handleResendInvite = async (email: string) => {
    try {
      const response = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirectTo: window.location.origin + '/accept-invite',
        }),
      });

      const result = await response.json();

      if (response.ok && !result.error) {
        setInviteSuccess(`Invitation resent to ${email}`);
        setTimeout(() => setInviteSuccess(null), 3000);
      }
    } catch (error) {
      console.error('Failed to resend invite:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatLastSeen = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return formatDate(dateString);
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">

        {/* Page Header */}
        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Users</span>
        </header>

        {/* Invite User Section */}
        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">
          <header>
            <FieldLegend>Invite user</FieldLegend>
            <FieldDescription>
              Send an invitation email to add a new user to this project.
            </FieldDescription>
          </header>

          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isInviting) {
                  handleInvite();
                }
              }}
              disabled={isInviting}
              className="flex-1"
            />
            <Button
              onClick={handleInvite}
              disabled={isInviting || !inviteEmail.trim()}
            >
              {isInviting ? <Spinner /> : 'Send invite'}
            </Button>
          </div>

          {inviteError && (
            <p className="text-xs text-destructive">{inviteError}</p>
          )}

          {inviteSuccess && (
            <p className="text-xs text-green-500">{inviteSuccess}</p>
          )}
        </div>

        {/* Active Users Section */}
        <header className="pt-10 pb-3">
          <span className="text-base font-medium">Active users</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">
          <header>
            <FieldLegend>Users</FieldLegend>
            <FieldDescription>
              Users who have access to this project.
            </FieldDescription>
          </header>

          {isLoading ? (
            <div className="border-t pt-8 pb-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : activeUsers.length > 0 ? (
            <div className="border-t -mb-4 divide-y">
              {[...activeUsers]
                .sort((a, b) => {
                  // Current user first
                  if (a.id === currentUser?.id) return -1;
                  if (b.id === currentUser?.id) return 1;
                  return 0;
                })
                .map((user) => (
                <div key={user.id} className="py-4 flex items-center gap-4">
                  {/* Avatar */}
                  <div
                    className="size-8 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-medium text-white shrink-0 overflow-hidden"
                    style={{ backgroundColor: user.avatar_url ? undefined : generateUserColor(user.id) }}
                  >
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.display_name || user.email}
                        width={32}
                        height={32}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      getUserInitials(user.email, user.display_name || undefined)
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Label className="font-medium">{user.display_name || user.email}</Label>
                      {currentUser?.id === user.id && (
                        <span className="text-xs text-muted-foreground">You</span>
                      )}
                      {user.display_name && (
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {formatDate(user.created_at)} · Last seen: {formatLastSeen(user.last_sign_in_at)}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="xs">
                        <Icon name="more" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {currentUser?.id === user.id ? (
                        <DropdownMenuItem
                          onClick={() => router.push('/ycode/profile')}
                        >
                          My profile
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setUserToDelete({ id: user.id, email: user.email, type: 'user' });
                            setShowDeleteDialog(true);
                          }}
                        >
                          Remove user
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                ))}
            </div>
          ) : (
            <div className="border-t pt-8 pb-4 text-center text-muted-foreground text-sm">
              No active users yet.
            </div>
          )}
        </div>

        {/* Pending Invites Section */}
        <header className="pt-10 pb-3">
          <span className="text-base font-medium">Pending invites</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">
          <header>
            <FieldLegend>Invitations</FieldLegend>
            <FieldDescription>
              Users who have been invited but haven&apos;t accepted yet.
            </FieldDescription>
          </header>

          {isLoading ? (
            <div className="border-t pt-8 pb-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : pendingInvites.length > 0 ? (
            <div className="border-t -mb-4 divide-y">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="py-4 flex items-center gap-4">
                  {/* Avatar */}
                  <div
                    className="size-8 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0 opacity-50"
                    style={{ backgroundColor: generateUserColor(invite.id) }}
                  >
                    {getUserInitials(invite.email)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Label className="font-medium">{invite.email}</Label>
                      <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        Pending
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Invited {formatDate(invite.invited_at)}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="xs">
                        <Icon name="more" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleResendInvite(invite.email)}
                      >
                        Resend invite
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setUserToDelete({ id: invite.id, email: invite.email, type: 'invite' });
                          setShowDeleteDialog(true);
                        }}
                      >
                        Cancel invite
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-t pt-8 pb-4 text-center text-muted-foreground text-xs">
              No pending invites.
            </div>
          )}
        </div>

      </div>

      {/* Delete/Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={userToDelete?.type === 'user' ? 'Remove user?' : 'Cancel invite?'}
        description={
          userToDelete?.type === 'user'
            ? `This will remove "${userToDelete?.email}" from this project. They will no longer have access.`
            : `This will cancel the invitation for "${userToDelete?.email}".`
        }
        confirmLabel={userToDelete?.type === 'user' ? 'Remove user' : 'Cancel invite'}
        cancelLabel="Keep"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteDialog(false);
          setUserToDelete(null);
        }}
      />
    </div>
  );
}
