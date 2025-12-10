'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { InputAutocomplete } from '@/components/ui/input-autocomplete';
import { LOCALES, type Locale as LocaleOption } from '@/lib/localisation-utils';
import { useLocalisationStore } from '@/stores/useLocalisationStore';
import type { Locale } from '@/types';

interface LocalizationContentProps {
  children: React.ReactNode;
}

export default function LocalizationContent({ children }: LocalizationContentProps) {
  // Store (locales are already sorted)
  const locales = useLocalisationStore((state) => state.locales);
  const selectedLocaleId = useLocalisationStore((state) => state.selectedLocaleId);
  const setSelectedLocaleId = useLocalisationStore((state) => state.setSelectedLocaleId);
  const createLocale = useLocalisationStore((state) => state.createLocale);
  const isLoading = useLocalisationStore((state) => state.isLoading);
  const error = useLocalisationStore((state) => state.error);
  const clearError = useLocalisationStore((state) => state.clearError);

  // Local state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LocaleOption | null>(null);
  const [customLocaleName, setCustomLocaleName] = useState<string>('');
  const [selectedContentType, setSelectedContentType] = useState<string>('pages');
  const [translationValues, setTranslationValues] = useState<Record<string, string>>({});
  const [localeSearch, setLocaleSearch] = useState('');

  const selectedLocale = locales.find(l => l.id === selectedLocaleId);

  // Filter out locales that already exist
  const existingLocaleCodes = new Set(locales.map(l => l.code));
  const availableLocales = LOCALES.filter(l => !existingLocaleCodes.has(l.code));

  const handleAddLocale = async () => {
    if (!selectedLanguage || !customLocaleName.trim()) {
      return;
    }

    try {
      const newLocale = await createLocale({
        code: selectedLanguage.code,
        label: customLocaleName.trim(),
      });

      if (newLocale) {
        setSelectedLanguage(null);
        setCustomLocaleName('');
        setLocaleSearch('');
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to create locale:', error);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedLanguage(null);
    setCustomLocaleName('');
    setLocaleSearch('');
    clearError();
  };

  const handleSelectLanguage = (locale: LocaleOption | null) => {
    clearError();

    if (!locale) {
      setSelectedLanguage(null);
      setLocaleSearch('');
      setCustomLocaleName('');
      return;
    }

    setLocaleSearch(locale.label);
    setSelectedLanguage(locale);
    setCustomLocaleName(locale.label);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-60 border-r flex flex-col px-4">
        <header className="py-5 flex justify-between items-center">
          <span className="font-medium">Localization</span>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              clearError();
              setIsDialogOpen(true);
            }}
          >
            <Icon name="plus" className="size-3" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0">
            {locales.map((locale) => {
              const isActive = selectedLocaleId === locale.id;

              return (
                <button
                  key={locale.id}
                  onClick={() => setSelectedLocaleId(locale.id)}
                  className={cn(
                    'group relative flex items-center h-8 outline-none focus:outline-none rounded-lg cursor-pointer select-none w-full text-left px-2 text-xs gap-1.5',
                    'hover:bg-secondary/50',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary',
                    !isActive && 'text-secondary-foreground/80 dark:text-muted-foreground'
                  )}
                >
                  <span className="bg-secondary text-[10px] font-semibold py-0.5 px-1.5 rounded-[6px] uppercase">{locale.code}</span>
                  <Label>{locale.label}</Label>
                  {locale.is_default && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      Default
                    </Badge>
                  )}
                </button>
              );
            })}
            {locales.length === 0 && (
              <div className="px-2 py-4 text-xs text-muted-foreground">
                {isLoading ? 'Loading locales...' : 'No locales added yet'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedLocale ? (
          <div>
            <div className="p-4 flex items-center gap-2 border-b">
              <div>
                <Select value={selectedContentType} onValueChange={setSelectedContentType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pages">Pages</SelectItem>
                    <SelectItem value="cms">CMS</SelectItem>
                    <SelectItem value="components">Components</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full max-w-72">
                <InputGroup>
                  <InputGroupInput
                    placeholder="Search..."
                  />
                  <InputGroupAddon>
                    <Icon name="search" className="size-3" />
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </div>

            <div>
              <header className="p-4 flex items-center gap-1.5 border-b">
                <div className="size-5 flex items-center justify-center rounded-[6px] bg-secondary/50 hover:bg-secondary/100">
                  <Icon name="page" className="size-2.5 opacity-60" />
                </div>
                <Label variant="muted">Homepage</Label>
                <div className="-my-1 ml-auto">
                  <Button size="sm" variant="secondary">Auto-translate</Button>
                </div>
              </header>

              <ul className="divide-y pl-4">
                <li className="flex items-start gap-2 pr-4">
                  <div className="flex-1 grid grid-cols-2 items-center gap-4">
                    <div className="py-5">
                      <span className="opacity-50">Create stunning websites with ease</span>
                    </div>

                    <div className="flex flex-col py-3 h-full *:flex-1">
                      <TiptapEditor
                        value={translationValues['text-1'] || ''}
                        onChange={(value) => setTranslationValues(prev => ({ ...prev, 'text-1': value }))}
                        placeholder="Enter translation..."
                        className="min-h-[28px] [&>*:first-child]:mb-0 py-1 px-2.5 !bg-transparent"
                        hideControls
                      />
                    </div>
                  </div>

                  <div className="py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <Icon name="more" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Done</DropdownMenuItem>
                        <DropdownMenuItem>Reset</DropdownMenuItem>
                        <DropdownMenuItem>Auto-translate</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Add Locale Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add locale</DialogTitle>
            <DialogDescription>Select a locale to add to your project</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {error && (
              <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="language">Locale</Label>

              <InputAutocomplete
                id="language"
                search={localeSearch}
                onSearchChange={setLocaleSearch}
                options={availableLocales}
                selected={selectedLanguage}
                onSelect={handleSelectLanguage}
                placeholder="Search for a locale"
                searchableKeys={['label', 'native_label', 'code']}
                renderItem={(locale) => (
                  <div className="flex items-center justify-between px-1.5 py-1.25 text-xs">
                    <div className="flex items-center gap-2">
                      <span>{locale.label}</span>
                      <span className="text-muted-foreground">{locale.native_label}</span>
                    </div>
                    <Badge variant="secondary" className="uppercase text-[10px]">
                      {locale.code}
                    </Badge>
                  </div>
                )}
                renderEmpty={() => (
                  <div className="px-3 py-6 text-center text-muted-foreground text-xs">
                    No locales found
                  </div>
                )}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="name">Custom name</Label>
                <Input
                  id="name"
                  value={customLocaleName}
                  onChange={(e) => setCustomLocaleName(e.target.value)}
                  placeholder="Custom name"
                />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="code">Locale code</Label>
                <Input
                  id="code"
                  value={selectedLanguage?.code || ''}
                  disabled
                  placeholder="Code"
                  className={selectedLanguage?.code ? 'uppercase' : ''}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseDialog}
              size="sm"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddLocale}
              disabled={!selectedLanguage || !customLocaleName.trim() || isLoading}
              size="sm"
            >
              {isLoading ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
