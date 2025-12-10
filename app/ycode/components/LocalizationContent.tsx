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
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Badge } from '@/components/ui/badge';
import FieldsDropdown from '@/app/ycode/components/FieldsDropdown';
import { getLayerIcon } from '@/lib/layer-utils';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

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
  const [selectedContentType, setSelectedContentType] = useState<string>('pages');
  const [translationValues, setTranslationValues] = useState<Record<string, string>>({});

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
          <div className="">

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
