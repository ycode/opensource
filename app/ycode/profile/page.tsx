'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  FieldDescription,
  FieldLegend,
  FieldSeparator,
} from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/useAuthStore';
import { createClient } from '@/lib/supabase/client';

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const checkSession = useAuthStore((state) => state.checkSession);
  const signOut = useAuthStore((state) => state.signOut);

  // Loading states
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  // Dialog states
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form states
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailPasswordInput, setEmailPasswordInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Error states
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Photo upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get user display name and initials
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || '';
  const email = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  // Get initials for avatar fallback
  const getInitials = (name: string, userEmail: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (userEmail) {
      return userEmail.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const initials = getInitials(displayName, email);

  // Initialize form values when dialogs open
  useEffect(() => {
    if (isNameDialogOpen) {
      setNameInput(displayName);
      setNameError(null);
    }
  }, [isNameDialogOpen, displayName]);

  useEffect(() => {
    if (isEmailDialogOpen) {
      setEmailInput(email);
      setEmailPasswordInput('');
      setEmailError(null);
    }
  }, [isEmailDialogOpen, email]);

  useEffect(() => {
    if (isPasswordDialogOpen) {
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordError(null);
    }
  }, [isPasswordDialogOpen]);

  useEffect(() => {
    if (isDeleteDialogOpen) {
      setDeleteConfirmInput('');
      setDeleteError(null);
    }
  }, [isDeleteDialogOpen]);

  // Handle photo upload
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be less than 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload photo');
      }

      // Refresh user data to get new avatar
      await checkSession();
    } catch (error) {
      console.error('Failed to upload photo:', error);
      setPhotoError(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle name update
  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      setNameError('Name is required');
      return;
    }

    setIsSavingName(true);
    setNameError(null);

    try {
      const response = await fetch('/api/profile/name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update name');
      }

      // Refresh user data
      await checkSession();
      setIsNameDialogOpen(false);
    } catch (error) {
      console.error('Failed to update name:', error);
      setNameError(error instanceof Error ? error.message : 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle email update
  const handleSaveEmail = async () => {
    if (!emailInput.trim()) {
      setEmailError('Email is required');
      return;
    }

    if (!emailPasswordInput) {
      setEmailError('Password is required to change email');
      return;
    }

    setIsSavingEmail(true);
    setEmailError(null);

    try {
      const response = await fetch('/api/profile/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: emailPasswordInput,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update email');
      }

      // Refresh user data
      await checkSession();
      setIsEmailDialogOpen(false);
    } catch (error) {
      console.error('Failed to update email:', error);
      setEmailError(error instanceof Error ? error.message : 'Failed to update email');
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Handle password update
  const handleSavePassword = async () => {
    if (!currentPasswordInput) {
      setPasswordError('Current password is required');
      return;
    }

    if (!newPasswordInput) {
      setPasswordError('New password is required');
      return;
    }

    if (newPasswordInput.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsSavingPassword(true);
    setPasswordError(null);

    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update password');
      }

      // Clear inputs and close dialog with success
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordError(null);
      setIsPasswordDialogOpen(false);
      
      // Refresh session to ensure it's still valid after password change
      await checkSession();
    } catch (error) {
      console.error('Failed to update password:', error);
      setPasswordError(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Handle profile deletion
  const handleDeleteProfile = async () => {
    if (deleteConfirmInput !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }

    setIsDeletingProfile(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete profile');
      }

      // Sign out and redirect
      const supabase = await createClient();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to delete profile:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete profile');
    } finally {
      setIsDeletingProfile(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">

        <header className="pt-8 pb-3">
          <span className="text-base font-medium">My profile</span>
        </header>

        {/* Profile Details Section */}
        <div className="grid grid-cols-3 gap-10 bg-secondary/20 p-8 rounded-lg">

          <div>
            <FieldLegend>Profile details</FieldLegend>
            <FieldDescription>Manage your personal information and account settings.</FieldDescription>
          </div>

          <div className="col-span-2 space-y-0">

            {/* Profile Photo */}
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">Profile photo</div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-800 font-medium text-sm">
                      {initials}
                    </div>
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <Spinner className="size-3 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                  >
                    Upload
                  </Button>
                  {photoError && (
                    <p className="text-xs text-destructive mt-1">{photoError}</p>
                  )}
                </div>
              </div>
            </div>

            <FieldSeparator className="col-span-2" />

            {/* Full Name */}
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">Full name</div>
              <div className="flex items-center gap-4">
                <span className="text-sm">{displayName || 'Not set'}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsNameDialogOpen(true)}
                >
                  Edit
                </Button>
              </div>
            </div>

            <FieldSeparator className="col-span-2" />

            {/* Email Address */}
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">Email address</div>
              <div className="flex items-center gap-4">
                <span className="text-sm">{email}</span>
                {/* Email edit temporarily disabled - requires Supabase email verification */}
              </div>
            </div>

            <FieldSeparator className="col-span-2" />

            {/* Password */}
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">Password</div>
              <div className="flex items-center gap-4">
                <span className="text-sm">••••••••••••••••••••</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsPasswordDialogOpen(true)}
                >
                  Change password
                </Button>
              </div>
            </div>

          </div>

        </div>

        {/* Delete Profile Section */}
        <div className="bg-secondary/20 p-8 rounded-lg mt-6">
          <div className="flex items-center justify-center gap-10">
            <div className="flex-1">
              <FieldLegend>Delete profile</FieldLegend>
              <FieldDescription>Deleting your profile removes your email, name and other profile related data from database. You will no longer be able to log in into this profile after deleting it.</FieldDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              Delete profile
            </Button>
          </div>
        </div>

      </div>

      {/* Edit Name Dialog */}
      <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Full name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
            <Button onClick={handleSaveName} disabled={isSavingName}>
              {isSavingName ? <Spinner className="size-4" /> : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="email"
              placeholder="New email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Current password"
              value={emailPasswordInput}
              onChange={(e) => setEmailPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail()}
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
            <Button onClick={handleSaveEmail} disabled={isSavingEmail}>
              {isSavingEmail ? <Spinner className="size-4" /> : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="password"
              placeholder="Current password"
              value={currentPasswordInput}
              onChange={(e) => setCurrentPasswordInput(e.target.value)}
            />
            <Input
              type="password"
              placeholder="New password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPasswordInput}
              onChange={(e) => setConfirmPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePassword()}
            />
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
            <Button onClick={handleSavePassword} disabled={isSavingPassword}>
              {isSavingPassword ? <Spinner className="size-4" /> : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Profile Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
            <p className="text-sm">
              Type <strong>DELETE</strong> to confirm:
            </p>
            <Input
              placeholder="DELETE"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDeleteProfile()}
            />
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteProfile}
              disabled={isDeletingProfile || deleteConfirmInput !== 'DELETE'}
            >
              {isDeletingProfile ? <Spinner className="size-4" /> : 'Delete profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
