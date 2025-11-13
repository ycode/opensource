'use client';

/**
 * Custom hook for managing unsaved changes in forms
 *
 * Provides a complete solution for tracking unsaved changes, showing confirmation dialogs,
 * and handling external navigation attempts. Used in settings panels to prevent accidental
 * data loss.
 *
 * @example
 * const {
 *   hasUnsavedChanges,
 *   showConfirmDialog,
 *   handleConfirmDiscard,
 *   handleCancelDiscard,
 *   initializeForm,
 *   markAsSaved,
 *   checkUnsavedChanges,
 * } = useUnsavedChanges(currentValues, isSaving);
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export type PendingActionType = 'close' | 'navigate' | 'external' | null;

export interface UseUnsavedChangesOptions<T> {
  /** Current form values to track */
  currentValues: T;
  /** Whether the form is currently saving */
  isSaving: boolean;
  /** Callback when discard is confirmed and action should proceed */
  onConfirmDiscard?: () => void;
  /** Callback when discard is canceled */
  onCancelDiscard?: () => void;
}

export interface UseUnsavedChangesReturn<T> {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether to show the confirmation dialog */
  showConfirmDialog: boolean;
  /** The type of pending action */
  pendingAction: PendingActionType;
  /** Set the pending action type */
  setPendingAction: (action: PendingActionType) => void;
  /** Show the confirmation dialog with a specific action */
  showConfirmationDialog: (action: PendingActionType) => void;
  /** Handle confirming discard of changes */
  handleConfirmDiscard: () => void;
  /** Handle canceling discard of changes */
  handleCancelDiscard: () => void;
  /** Initialize form with new values */
  initializeForm: (values: T) => void;
  /** Mark form as saved (updates initial values to current values) */
  markAsSaved: (values: T) => void;
  /** Check for unsaved changes programmatically (for external checks) */
  checkUnsavedChanges: () => Promise<boolean>;
  /** Reset form to initial values */
  resetToInitialValues: () => T | null;
}

/**
 * Custom hook for managing unsaved changes
 *
 * This hook provides a complete solution for tracking form changes and preventing
 * accidental data loss. It manages:
 * - Initial values tracking
 * - Change detection
 * - Confirmation dialog state
 * - Promise-based external checks
 *
 * @param options - Configuration options
 * @returns Object with state and handlers for managing unsaved changes
 */
export function useUnsavedChanges<T extends Record<string, any>>({
  currentValues,
  isSaving,
  onConfirmDiscard,
  onCancelDiscard,
}: UseUnsavedChangesOptions<T>): UseUnsavedChangesReturn<T> {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingActionType>(null);
  const [saveCounter, setSaveCounter] = useState(0);

  const initialValuesRef = useRef<T | null>(null);
  const confirmationResolverRef = useRef<((value: boolean) => void) | null>(null);

  // Detect if there are unsaved changes by comparing current values to initial values
  const hasUnsavedChanges = useMemo(() => {
    if (!initialValuesRef.current) return false;

    const initial = initialValuesRef.current;
    const current = currentValues;

    // Deep comparison of all values
    const hasChanges = Object.keys(current).some(key => {
      const initialValue = initial[key];
      const currentValue = current[key];

      // Handle null/undefined equivalence
      if (initialValue === null && currentValue === undefined) return false;
      if (initialValue === undefined && currentValue === null) return false;

      return initialValue !== currentValue;
    });

    return hasChanges;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValues, saveCounter]);

  /**
   * Initialize form with values (typically when loading data)
   */
  const initializeForm = useCallback((values: T) => {
    initialValuesRef.current = { ...values };
    setSaveCounter(prev => prev + 1);
  }, []);

  /**
   * Mark form as saved (updates initial values to match current values)
   */
  const markAsSaved = useCallback((values: T) => {
    initialValuesRef.current = { ...values };
    setSaveCounter(prev => prev + 1);
  }, []);

  /**
   * Reset form to initial values
   */
  const resetToInitialValues = useCallback((): T | null => {
    return initialValuesRef.current ? { ...initialValuesRef.current } : null;
  }, []);

  /**
   * Show confirmation dialog with a specific action
   */
  const showConfirmationDialog = useCallback((action: PendingActionType) => {
    setPendingAction(action);
    setShowConfirmDialog(true);
  }, []);

  /**
   * Handle confirming discard of changes
   */
  const handleConfirmDiscard = useCallback(() => {
    setShowConfirmDialog(false);

    if (pendingAction === 'external' && confirmationResolverRef.current) {
      // External check - user confirmed to discard
      confirmationResolverRef.current(true);
      confirmationResolverRef.current = null;
    } else {
      // Internal action - call callback if provided
      onConfirmDiscard?.();
    }

    setPendingAction(null);
  }, [pendingAction, onConfirmDiscard]);

  /**
   * Handle canceling discard of changes
   */
  const handleCancelDiscard = useCallback(() => {
    setShowConfirmDialog(false);

    if (pendingAction === 'external' && confirmationResolverRef.current) {
      // External check - user canceled
      confirmationResolverRef.current(false);
      confirmationResolverRef.current = null;
    } else {
      // Internal action - call callback if provided
      onCancelDiscard?.();
    }

    setPendingAction(null);
  }, [pendingAction, onCancelDiscard]);

  /**
   * Check for unsaved changes programmatically (for external checks)
   * Returns a promise that resolves to true if the action can proceed
   */
  const checkUnsavedChanges = useCallback((): Promise<boolean> => {
    // If currently saving, allow the change (save is in progress)
    if (isSaving) {
      return Promise.resolve(true);
    }

    // If no unsaved changes, allow immediately
    if (!hasUnsavedChanges) {
      return Promise.resolve(true);
    }

    // Show dialog and wait for user decision
    return new Promise<boolean>((resolve) => {
      confirmationResolverRef.current = resolve;
      setPendingAction('external');
      setShowConfirmDialog(true);
    });
  }, [hasUnsavedChanges, isSaving]);

  return {
    hasUnsavedChanges,
    showConfirmDialog,
    pendingAction,
    setPendingAction,
    showConfirmationDialog,
    handleConfirmDiscard,
    handleCancelDiscard,
    initializeForm,
    markAsSaved,
    checkUnsavedChanges,
    resetToInitialValues,
  };
}

