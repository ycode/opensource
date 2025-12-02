'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';

const AVAILABLE_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'lt', label: 'Lithuanian' },
];

interface Locale {
  id: string;
  language: string;
  name: string;
}

interface LocalizationContentProps {
  children: React.ReactNode;
}

export default function LocalizationContent({ children }: LocalizationContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const defaultLocale: Locale = {
    id: 'en-default',
    language: 'en',
    name: 'English',
  };

  const [locales, setLocales] = useState<Locale[]>([defaultLocale]);
  const [selectedLocaleId, setSelectedLocaleId] = useState<string | null>(defaultLocale.id);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [localeName, setLocaleName] = useState<string>('');

  // Auto-select first locale if none selected
  useEffect(() => {
    if (!selectedLocaleId && locales.length > 0) {
      setSelectedLocaleId(locales[0].id);
    }
  }, [selectedLocaleId, locales]);

  const selectedLocale = locales.find(l => l.id === selectedLocaleId);

  const handleAddLocale = () => {
    if (!selectedLanguage || !localeName.trim()) {
      return;
    }

    const languageLabel = AVAILABLE_LANGUAGES.find(l => l.value === selectedLanguage)?.label || selectedLanguage;
    const newLocale: Locale = {
      id: `${selectedLanguage}-${Date.now()}`,
      language: selectedLanguage,
      name: localeName.trim(),
    };

    setLocales([...locales, newLocale]);
    setSelectedLanguage('');
    setLocaleName('');
    setIsDialogOpen(false);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedLanguage('');
    setLocaleName('');
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
            onClick={() => setIsDialogOpen(true)}
          >
            <Icon name="plus" className="size-3" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0">
            {locales.map((locale) => {
              const languageLabel = AVAILABLE_LANGUAGES.find(l => l.value === locale.language)?.label || locale.language;
              const isActive = selectedLocaleId === locale.id;

              return (
                <button
                  key={locale.id}
                  onClick={() => setSelectedLocaleId(locale.id)}
                  className={cn(
                    'group relative flex items-center h-8 outline-none focus:outline-none rounded-lg cursor-pointer select-none w-full text-left px-2 text-xs gap-1',
                    'hover:bg-secondary/50',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary',
                    !isActive && 'text-secondary-foreground/80 dark:text-muted-foreground'
                  )}
                >
                  <span className="bg-secondary text-[10px] font-semibold py-0.5 px-1 rounded-[6px]">EN</span>
                  <Label>{locale.name} ({languageLabel})</Label>
                </button>
              );
            })}
            {locales.length === 0 && (
              <div className="px-2 py-4 text-xs text-muted-foreground">
                No locales added yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedLocale ? (
          <div className="p-8">
            <div className="max-w-3xl mx-auto">
              <header className="pt-8 pb-3">
                <span className="text-base font-medium">
                  {selectedLocale.name} ({AVAILABLE_LANGUAGES.find(l => l.value === selectedLocale.language)?.label || selectedLocale.language})
                </span>
              </header>

              <div className="bg-secondary/20 p-8 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Localization content for {selectedLocale.name} will be available here.
                </p>
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      {/* Add Locale Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Locale</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="language">Language</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={localeName}
                onChange={(e) => setLocaleName(e.target.value)}
                placeholder="Enter locale name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseDialog}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddLocale}
              disabled={!selectedLanguage || !localeName.trim()}
              size="sm"
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
