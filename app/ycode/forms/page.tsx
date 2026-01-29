'use client';

/**
 * Forms Page
 *
 * Displays form submissions grouped by form_id.
 * Simple read-only view for managing form data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import Icon from '@/components/ui/icon';
import { cn, formatDate } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { FormSubmission, FormSummary, FormSubmissionStatus } from '@/types';

// API functions
async function fetchFormSummaries(): Promise<FormSummary[]> {
  const response = await fetch('/api/form-submissions?summary=true');
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.data || [];
}

async function fetchFormSubmissions(formId: string): Promise<FormSubmission[]> {
  const response = await fetch(`/api/form-submissions?form_id=${encodeURIComponent(formId)}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.data || [];
}

async function updateSubmissionStatus(id: string, status: FormSubmissionStatus): Promise<void> {
  const response = await fetch(`/api/form-submissions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
}

async function deleteSubmission(id: string): Promise<void> {
  const response = await fetch(`/api/form-submissions/${id}`, {
    method: 'DELETE',
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
}

// Sort configuration type
type SortConfig = {
  column: string;
  direction: 'asc' | 'desc';
} | null;

// API function to delete all submissions for a form
async function deleteForm(formId: string): Promise<void> {
  const response = await fetch(`/api/form-submissions?form_id=${encodeURIComponent(formId)}`, {
    method: 'DELETE',
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
}

export default function FormsPage() {
  const [summaries, setSummaries] = useState<FormSummary[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'created_at', direction: 'desc' });
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showDeleteFormDialog, setShowDeleteFormDialog] = useState(false);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  const [showDeleteSubmissionDialog, setShowDeleteSubmissionDialog] = useState(false);
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Load form summaries on mount
  useEffect(() => {
    const loadSummaries = async () => {
      try {
        setIsLoading(true);
        const data = await fetchFormSummaries();
        setSummaries(data);

        // Auto-select first form if available
        if (data.length > 0 && !selectedFormId) {
          setSelectedFormId(data[0].form_id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load forms');
      } finally {
        setIsLoading(false);
      }
    };

    loadSummaries();
  }, []);

  // Load submissions when form is selected
  useEffect(() => {
    if (!selectedFormId) {
      setSubmissions([]);
      return;
    }

    const loadSubmissions = async () => {
      try {
        setIsLoadingSubmissions(true);
        const data = await fetchFormSubmissions(selectedFormId);
        setSubmissions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load submissions');
      } finally {
        setIsLoadingSubmissions(false);
      }
    };

    loadSubmissions();
  }, [selectedFormId]);

  // Filter and sort submissions
  const filteredSubmissions = useMemo(() => {
    let result = [...submissions];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((sub) => {
        const payloadStr = JSON.stringify(sub.payload).toLowerCase();
        return payloadStr.includes(query);
      });
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (sortConfig.column === 'status') {
          aVal = a.status;
          bVal = b.status;
        } else if (sortConfig.column === 'created_at') {
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
        } else {
          // Payload field
          aVal = a.payload[sortConfig.column] ?? '';
          bVal = b.payload[sortConfig.column] ?? '';
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [submissions, searchQuery, sortConfig]);

  // Handle column click for sorting
  const handleColumnClick = (column: string) => {
    setSortConfig((prev) => {
      if (prev?.column === column) {
        // Toggle direction
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      // New column, default to descending for dates, ascending for others
      return { column, direction: column === 'created_at' ? 'desc' : 'asc' };
    });
  };

  // Get sort icon for a column
  const getSortIcon = (column: string) => {
    if (sortConfig?.column !== column) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Get all unique payload keys across submissions for table columns
  const payloadKeys = useMemo(() => {
    const keys = new Set<string>();
    submissions.forEach((sub) => {
      Object.keys(sub.payload).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [submissions]);

  const handleStatusChange = async (submissionId: string, status: FormSubmissionStatus) => {
    try {
      // Find the current submission to check its old status
      const currentSubmission = submissions.find((sub) => sub.id === submissionId);
      const oldStatus = currentSubmission?.status;

      await updateSubmissionStatus(submissionId, status);
      setSubmissions((prev) =>
        prev.map((sub) => (sub.id === submissionId ? { ...sub, status } : sub))
      );
      if (selectedSubmission?.id === submissionId) {
        setSelectedSubmission((prev) => (prev ? { ...prev, status } : null));
      }

      // Update sidebar new_count when status changes from/to 'new'
      if (oldStatus !== status && (oldStatus === 'new' || status === 'new')) {
        setSummaries((prev) =>
          prev.map((s) => {
            if (s.form_id !== selectedFormId) return s;
            let newCount = s.new_count;
            if (oldStatus === 'new') newCount--;
            if (status === 'new') newCount++;
            return { ...s, new_count: Math.max(0, newCount) };
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = (submissionId: string) => {
    setSubmissionToDelete(submissionId);
    setShowDeleteSubmissionDialog(true);
  };

  const handleConfirmDeleteSubmission = async () => {
    if (!submissionToDelete) return;

    try {
      // Find the submission to check if it was 'new'
      const deletedSubmission = submissions.find((sub) => sub.id === submissionToDelete);
      const wasNew = deletedSubmission?.status === 'new';

      await deleteSubmission(submissionToDelete);
      setSubmissions((prev) => prev.filter((sub) => sub.id !== submissionToDelete));
      if (selectedSubmission?.id === submissionToDelete) {
        setSelectedSubmission(null);
      }
      // Update summaries count
      setSummaries((prev) =>
        prev.map((s) => {
          if (s.form_id !== selectedFormId) return s;
          return {
            ...s,
            submission_count: s.submission_count - 1,
            new_count: wasNew ? Math.max(0, s.new_count - 1) : s.new_count,
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete submission');
    } finally {
      setSubmissionToDelete(null);
      setShowDeleteSubmissionDialog(false);
    }
  };

  // Toggle individual submission selection
  const handleToggleSubmissionSelection = (submissionId: string) => {
    const newSelected = new Set(selectedSubmissionIds);
    if (newSelected.has(submissionId)) {
      newSelected.delete(submissionId);
    } else {
      newSelected.add(submissionId);
    }
    setSelectedSubmissionIds(newSelected);
  };

  // Select/deselect all submissions
  const handleSelectAll = () => {
    if (selectedSubmissionIds.size === filteredSubmissions.length) {
      setSelectedSubmissionIds(new Set());
    } else {
      setSelectedSubmissionIds(new Set(filteredSubmissions.map((s) => s.id)));
    }
  };

  // Bulk delete selected submissions
  const handleDeleteSelected = () => {
    if (selectedSubmissionIds.size === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedSubmissionIds.size === 0) return;

    try {
      const ids = Array.from(selectedSubmissionIds);
      const response = await fetch('/api/form-submissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Count how many were 'new'
      const deletedNewCount = submissions.filter(
        (s) => selectedSubmissionIds.has(s.id) && s.status === 'new'
      ).length;

      // Update local state
      setSubmissions((prev) => prev.filter((sub) => !selectedSubmissionIds.has(sub.id)));
      setSelectedSubmissionIds(new Set());

      // Update summaries count
      setSummaries((prev) =>
        prev.map((s) => {
          if (s.form_id !== selectedFormId) return s;
          return {
            ...s,
            submission_count: s.submission_count - ids.length,
            new_count: Math.max(0, s.new_count - deletedNewCount),
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete submissions');
    } finally {
      setShowBulkDeleteDialog(false);
    }
  };

  // Clear selection when form changes
  useEffect(() => {
    setSelectedSubmissionIds(new Set());
  }, [selectedFormId]);

  const getStatusBadgeVariant = (status: FormSubmissionStatus) => {
    switch (status) {
      case 'new':
        return 'default';
      case 'read':
        return 'secondary';
      case 'archived':
        return 'outline';
      case 'spam':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Delete a form and all its submissions
  const handleDeleteForm = (formId: string) => {
    setFormToDelete(formId);
    setShowDeleteFormDialog(true);
  };

  const handleConfirmDeleteForm = async () => {
    if (!formToDelete) return;

    try {
      await deleteForm(formToDelete);
      // Remove from summaries
      setSummaries((prev) => prev.filter((s) => s.form_id !== formToDelete));
      // Clear submissions if this was the selected form
      if (selectedFormId === formToDelete) {
        setSelectedFormId(null);
        setSubmissions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete form');
    } finally {
      setFormToDelete(null);
      setShowDeleteFormDialog(false);
    }
  };

  // Refresh form summaries
  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      const data = await fetchFormSummaries();
      setSummaries(data);

      // Reload submissions if a form is selected
      if (selectedFormId) {
        const submissionsData = await fetchFormSubmissions(selectedFormId);
        setSubmissions(submissionsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  };

  const formsSidebar = (
    <div className="w-64 shrink-0 bg-background border-r flex flex-col overflow-hidden px-4">
      <header className="py-5 flex items-center justify-between shrink-0">
        <span className="font-medium">Forms</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <Icon name="refresh" className={cn('size-3', isLoading && 'animate-spin')} />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="flex flex-col">
          {summaries.map((summary) => {
            const isSelected = selectedFormId === summary.form_id;
            return (
              <div
                key={summary.form_id}
                className={cn(
                  'group px-3 h-8 rounded-lg flex gap-2 items-center justify-between text-left w-full cursor-pointer',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary/50 text-secondary-foreground/80 dark:text-muted-foreground'
                )}
                onClick={() => setSelectedFormId(summary.form_id)}
              >
                <div className="flex gap-2 items-center truncate">
                  <Icon name="form" className="size-3 shrink-0" />
                  <span className="truncate">{summary.form_id}</span>
                </div>
                <div className="relative flex items-center">
                  <span className="text-xs opacity-50 group-hover:opacity-0">{summary.submission_count}</span>

                  <div className="absolute right-0 opacity-0 group-hover:opacity-100">
                    <DropdownMenu
                      open={openDropdownId === summary.form_id}
                      onOpenChange={(open) => setOpenDropdownId(open ? summary.form_id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="xs"
                          variant={isSelected ? 'default' : 'ghost'}
                          onClick={(e) => e.stopPropagation()}
                          className="-mr-2"
                        >
                          <Icon name="more" className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteForm(summary.form_id);
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}

          {summaries.length === 0 && !isLoading && (
            <Empty>
              <EmptyTitle>No Forms</EmptyTitle>
              <EmptyDescription>
                Form submissions will appear here when visitors submit forms on your website.
              </EmptyDescription>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex-1 bg-background flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // No form selected
  if (!selectedFormId) {
    return (
      <div className="flex-1 bg-background flex">
        {formsSidebar}
        <div className="flex-1 flex items-center justify-center">
          <Empty>
            <EmptyTitle>No Form Selected</EmptyTitle>
            <EmptyDescription>
              Select a form from the sidebar to view its submissions.
            </EmptyDescription>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background flex">
      {formsSidebar}

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b">
          <div className="w-full max-w-72">
            <InputGroup>
              <InputGroupInput
                placeholder="Search submissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Icon name="search" className="size-3" />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="flex gap-2 items-center">
            {selectedSubmissionIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelected}
              >
                Delete
                <Badge variant="secondary" className="text-[10px] px-1.5 ml-1">
                  {selectedSubmissionIds.size}
                </Badge>
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="flex-1 overflow-auto">
          {isLoadingSubmissions ? (
            <div className="flex items-center justify-center p-8">
              <Spinner />
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <Empty>
                <EmptyTitle>No Submissions</EmptyTitle>
                <EmptyDescription>
                  {searchQuery
                    ? `No submissions found matching "${searchQuery}"`
                    : 'This form has no submissions yet.'}
                </EmptyDescription>
              </Empty>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b sticky top-0 bg-background">
                <tr>
                  <th className="pl-5 pr-3 py-5 text-left font-normal w-12">
                    <div className="flex">
                      <Checkbox
                        checked={filteredSubmissions.length > 0 && selectedSubmissionIds.size === filteredSubmissions.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-5 text-left font-normal">
                    <button
                      onClick={() => handleColumnClick('status')}
                      className="flex items-center gap-1 hover:opacity-50 cursor-pointer"
                    >
                      Status
                      {getSortIcon('status') && (
                        <span className="text-xs font-mono">{getSortIcon('status')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-5 text-left font-normal">
                    <button
                      onClick={() => handleColumnClick('created_at')}
                      className="flex items-center gap-1 hover:opacity-50 cursor-pointer"
                    >
                      Date
                      {getSortIcon('created_at') && (
                        <span className="text-xs font-mono">{getSortIcon('created_at')}</span>
                      )}
                    </button>
                  </th>
                  {payloadKeys.slice(0, 4).map((key) => (
                    <th key={key} className="px-4 py-5 text-left font-normal">
                      <button
                        onClick={() => handleColumnClick(key)}
                        className="flex items-center gap-1 hover:opacity-50 cursor-pointer capitalize"
                      >
                        {key.replace(/_/g, ' ')}
                        {getSortIcon(key) && (
                          <span className="text-xs font-mono">{getSortIcon(key)}</span>
                        )}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-5 text-right font-normal w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="border-b hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedSubmission(submission);
                      // Mark as read when opened
                      if (submission.status === 'new') {
                        handleStatusChange(submission.id, 'read');
                      }
                    }}
                  >
                    <td className="pl-5 pr-3 py-3">
                      <div className="flex">
                        <Checkbox
                          checked={selectedSubmissionIds.has(submission.id)}
                          onCheckedChange={() => handleToggleSubmissionSelection(submission.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(submission.status)}>
                        {submission.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(submission.created_at, 'MMM D YYYY, HH:mm')}
                    </td>
                    {payloadKeys.slice(0, 4).map((key) => (
                      <td
                        key={key}
                        className="px-4 py-3 text-muted-foreground max-w-[200px] truncate"
                      >
                        {String(submission.payload[key] || '-')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon name="more" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(submission.id, 'new');
                            }}
                          >
                            Mark as new
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(submission.id, 'read');
                            }}
                          >
                            Mark as read
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(submission.id, 'archived');
                            }}
                          >
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(submission.id, 'spam');
                            }}
                          >
                            Mark as spam
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(submission.id);
                            }}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Submission Detail Sheet */}
      <Sheet open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Submission Details</SheetTitle>
          </SheetHeader>

          {selectedSubmission && (
            <div className="mt-6 space-y-6">
              {/* Status & Date */}
              <div className="flex items-center justify-between">
                <Badge variant={getStatusBadgeVariant(selectedSubmission.status)}>
                  {selectedSubmission.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(selectedSubmission.created_at, 'MMM D YYYY, HH:mm')}
                </span>
              </div>

              {/* Status Actions */}
              <div className="flex gap-2">
                <Select
                  value={selectedSubmission.status}
                  onValueChange={(value) =>
                    handleStatusChange(selectedSubmission.id, value as FormSubmissionStatus)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payload Fields */}
              <div className="space-y-4">
                <h3 className="font-medium text-xs">Form Data</h3>
                {Object.entries(selectedSubmission.payload).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium capitalize text-muted-foreground">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <div className="p-2 bg-secondary/30 rounded-lg text-xs whitespace-pre-wrap break-words">
                      {String(value) || '-'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Metadata */}
              {selectedSubmission.metadata && Object.keys(selectedSubmission.metadata).length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-xs">Metadata</h3>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {selectedSubmission.metadata.page_url && (
                      <div>
                        <span className="font-medium">Page: </span>
                        {selectedSubmission.metadata.page_url}
                      </div>
                    )}
                    {selectedSubmission.metadata.referrer && (
                      <div>
                        <span className="font-medium">Referrer: </span>
                        {selectedSubmission.metadata.referrer}
                      </div>
                    )}
                    {selectedSubmission.metadata.user_agent && (
                      <div>
                        <span className="font-medium">User Agent: </span>
                        <span className="break-all">{selectedSubmission.metadata.user_agent}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Delete Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedSubmission.id)}
                >
                  Delete submission
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Form Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteFormDialog}
        onOpenChange={setShowDeleteFormDialog}
        title="Delete form?"
        description={`Are you sure you want to delete "${formToDelete}"? This will permanently delete all ${summaries.find(s => s.form_id === formToDelete)?.submission_count || 0} submissions. This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleConfirmDeleteForm}
      />

      {/* Delete Submission Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteSubmissionDialog}
        onOpenChange={setShowDeleteSubmissionDialog}
        title="Delete submission?"
        description="Are you sure you want to delete this submission? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleConfirmDeleteSubmission}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        title={`Delete ${selectedSubmissionIds.size} submission${selectedSubmissionIds.size !== 1 ? 's' : ''}?`}
        description={`Are you sure you want to delete ${selectedSubmissionIds.size} submission${selectedSubmissionIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleConfirmBulkDelete}
      />
    </div>
  );
}
