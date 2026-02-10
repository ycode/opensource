'use client';

/**
 * CSVImportDialog Component
 *
 * Multi-step dialog for importing CSV data into CMS collections.
 * Steps:
 *  1. Upload CSV file
 *  2. Map CSV columns to collection fields
 *  3. Confirm and start import
 *  4. Progress view with polling
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import Icon from '@/components/ui/icon';
import { parseCSVFile, suggestColumnMapping, getFieldTypeLabel, SKIP_COLUMN, AUTO_FIELD_KEYS } from '@/lib/csv-utils';
import type { CollectionField } from '@/types';
import { Label } from '@/components/ui/label';

type ImportStep = 'upload' | 'mapping' | 'confirm' | 'progress' | 'complete';

interface ImportStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errors: string[];
}

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  fields: CollectionField[];
  onImportComplete?: () => void;
}

export function CSVImportDialog({
  open,
  onOpenChange,
  collectionId,
  fields,
  onImportComplete,
}: CSVImportDialogProps) {
  // Step state
  const [step, setStep] = useState<ImportStep>('upload');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Mapping state
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Import state
  const [importId, setImportId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // Lock to prevent overlapping process requests
  const processingLockRef = useRef<boolean>(false);

  // Filter out auto-generated fields that shouldn't be mapped
  const mappableFields = fields.filter(
    f => !AUTO_FIELD_KEYS.includes(f.key as typeof AUTO_FIELD_KEYS[number])
  );

  // Reset state when dialog closes
  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setRows([]);
    setParseError(null);
    setColumnMapping({});
    setImportId(null);
    setImportStatus(null);
    setImporting(false);
    setError(null);

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    processingLockRef.current = false;
  }, []);

  // Handle close
  const handleClose = () => {
    if (importing && step === 'progress') {
      // Allow closing during import - it continues in background
    }
    resetState();
    onOpenChange(false);
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);

    try {
      const parsed = await parseCSVFile(selectedFile);

      if (parsed.headers.length === 0) {
        setParseError('CSV file is empty or has no headers');
        return;
      }

      if (parsed.rows.length === 0) {
        setParseError('CSV file has no data rows');
        return;
      }

      setHeaders(parsed.headers);
      setRows(parsed.rows);

      // Auto-suggest column mapping
      const suggested = suggestColumnMapping(parsed.headers, mappableFields);
      setColumnMapping(suggested);

      setStep('mapping');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    }
  }, [mappableFields]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      handleFileSelect(droppedFile);
    } else {
      setParseError('Please upload a CSV file');
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  // Update column mapping
  const updateMapping = (csvColumn: string, fieldId: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvColumn]: fieldId,
    }));
  };

  // Get set of field IDs that are already mapped (for disabling in dropdowns)
  const getMappedFieldIds = (excludeColumn?: string): Set<string> => {
    const mapped = new Set<string>();
    Object.entries(columnMapping).forEach(([col, fieldId]) => {
      if (col !== excludeColumn && fieldId && fieldId !== SKIP_COLUMN) {
        mapped.add(fieldId);
      }
    });
    return mapped;
  };

  // Check if at least one column is mapped (not skipped)
  const hasMappedColumns = Object.values(columnMapping).some(v => v !== '' && v !== SKIP_COLUMN);

  // Start import
  const startImport = async () => {
    setImporting(true);
    setError(null);

    try {
      // Create import job
      const response = await fetch(`/ycode/api/collections/${collectionId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnMapping,
          csvData: rows,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create import job');
      }

      setImportId(data.data.importId);
      setStep('progress');

      // Start processing and polling
      processImport(data.data.importId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start import');
      setImporting(false);
    }
  };

  // Trigger batch processing for an import job (with lock to prevent overlapping)
  const triggerProcessBatch = async (id: string) => {
    // Skip if already processing
    if (processingLockRef.current) {
      return null;
    }

    processingLockRef.current = true;

    try {
      const response = await fetch('/ycode/api/collections/import/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process import');
      }

      return data.data;
    } catch (err) {
      console.error('Process error:', err);
      return null;
    } finally {
      processingLockRef.current = false;
    }
  };

  // Process import (trigger first batch and start polling)
  const processImport = async (id: string) => {
    await triggerProcessBatch(id);
    pollStatus(id);
  };

  // Poll for import status
  const pollStatus = (id: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/ycode/api/collections/import/${id}/status`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to get status');
        }

        setImportStatus(data.data);

        // Check if complete
        if (data.data.status === 'completed' || data.data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setImporting(false);
          setStep('complete');
          return;
        }

        // Continue processing if not complete
        await triggerProcessBatch(id);
      } catch (err) {
        console.error('Poll error:', err);
      }
    };

    // Poll every 2 seconds
    pollingRef.current = setInterval(poll, 2000);

    // Initial poll
    poll();
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Calculate progress percentage
  const progressPercent = importStatus
    ? Math.round((importStatus.processedRows / importStatus.totalRows) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={step !== 'progress' || !importing}
        className="sm:max-w-lg"
      >
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle>Import CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file to import items into this collection.
              </DialogDescription>
            </DialogHeader>

            <div
              className="mt-4 flex min-h-50 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 transition-colors hover:border-muted-foreground/50"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleInputChange}
                className="hidden"
                id="csv-file-input"
              />

              <Empty>
                <EmptyMedia variant="icon">
                  <Icon name="upload" className="size-4" />
                </EmptyMedia>
                <EmptyTitle>Upload CSV file</EmptyTitle>
                <EmptyDescription>
                  Drag and drop a CSV file here, or click to browse.
                </EmptyDescription>
              </Empty>

              <Button
                variant="secondary"
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                Select file
              </Button>
            </div>

            {parseError && (
              <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-destructive">
                {parseError}
              </div>
            )}
          </>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && (
          <>
            <DialogHeader>
              <DialogTitle>Map columns to fields</DialogTitle>
              <DialogDescription>
                Match CSV columns to collection fields. {rows.length} rows found.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto -my-4">
              <div className="divide-y">
                {headers.map(header => {
                  const mappedFieldIds = getMappedFieldIds(header);
                  return (
                    <div key={header} className="flex items-center gap-3 py-4">
                      <div className="w-1/3 truncate">
                        <Label>{header}</Label>
                      </div>
                      <Icon name="chevronRight" className="size-3 text-muted-foreground" />
                      <div className="flex-1">
                        <Select
                          value={columnMapping[header] || SKIP_COLUMN}
                          onValueChange={(value) => updateMapping(header, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Skip this column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP_COLUMN}>
                              <span className="opacity-50">—</span>
                            </SelectItem>
                            {mappableFields.map(field => (
                              <SelectItem
                                key={field.id}
                                value={field.id}
                                disabled={mappedFieldIds.has(field.id)}
                              >
                                {field.name} ({getFieldTypeLabel(field.type)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-destructive">
                {error}
              </div>
            )}

            <DialogFooter className="mt-6 sm:justify-between">
              <Button variant="secondary" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={!hasMappedColumns}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm import</DialogTitle>
              <DialogDescription>
                Review your import settings before starting.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg bg-input/50 p-4">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">File</dt>
                    <dd className="font-medium">{file?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Rows to import</dt>
                    <dd className="font-medium">{rows.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Columns mapped</dt>
                    <dd className="font-medium">
                      {Object.values(columnMapping).filter(v => v !== '' && v !== SKIP_COLUMN).length} of {headers.length}
                    </dd>
                  </div>
                </dl>
              </div>

              <p className="text-xs text-muted-foreground">
                The import will run in the background. You can close this dialog and
                the import will continue processing.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-destructive">
                {error}
              </div>
            )}

            <DialogFooter className="mt-6 sm:justify-between">
              <Button
                variant="secondary"
                onClick={() => setStep('mapping')}
                disabled={importing}
              >
                Back
              </Button>
              <Button onClick={startImport} disabled={importing}>
                {importing && <Spinner />}
                {importing ? 'Starting...' : 'Start import'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Progress */}
        {step === 'progress' && (
          <>
            <DialogHeader>
              <DialogTitle>Importing...</DialogTitle>
              <DialogDescription>
                Import is running in the background.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-input">
                  <div
                    className="h-full bg-secondary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {importStatus && (
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Processed</dt>
                    <dd>
                      {importStatus.processedRows} of {importStatus.totalRows}
                    </dd>
                  </div>
                  {importStatus.failedRows > 0 && (
                    <div className="flex justify-between text-destructive">
                      <dt>Failed</dt>
                      <dd>{importStatus.failedRows}</dd>
                    </div>
                  )}
                </dl>
              )}

              <p className="text-xs text-muted-foreground">
                You can close this dialog. The import will continue in the background.
              </p>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <>
            <div className="py-8 text-center">
              <Empty>
                <EmptyMedia variant="icon">
                  <Icon
                    name={importStatus?.status === 'failed' ? 'x' : 'check'}
                    className="size-4"
                  />
                </EmptyMedia>
                <EmptyTitle>
                  {importStatus?.status === 'failed'
                    ? 'Import failed'
                    : 'Import complete'}
                </EmptyTitle>
                <EmptyDescription>
                  {importStatus?.status === 'failed' ? (
                    <>
                      Failed to import items. {importStatus.failedRows} errors occurred.
                    </>
                  ) : (
                    <>
                      Successfully imported {importStatus?.processedRows || 0} items.
                      {(importStatus?.failedRows || 0) > 0 && (
                        <> {importStatus?.failedRows} rows failed.</>
                      )}
                    </>
                  )}
                </EmptyDescription>
              </Empty>

              {importStatus?.errors && importStatus.errors.length > 0 && (
                <div className="mt-6 max-h-48 overflow-y-auto rounded-lg bg-destructive/10 p-3 text-left text-xs text-destructive">
                  <p className="mb-2 font-medium">Issues ({importStatus.errors.length}):</p>
                  <ul className="space-y-1">
                    {importStatus.errors.slice(0, 20).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importStatus.errors.length > 20 && (
                      <li className="opacity-70">...and {importStatus.errors.length - 20} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  onImportComplete?.();
                  handleClose();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CSVImportDialog;
