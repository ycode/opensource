'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Field, FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSeparator
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';

export default function GeneralSettingsPage() {

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">

        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Redirects</span>
        </header>

        <div className="flex flex-col gap-6 bg-secondary/20 p-8 rounded-lg">

          <header className="flex justify-between">

            <div>
              <FieldLegend>
                Redirects
              </FieldLegend>
              <FieldDescription>
                Redirect site visitors and search engines from old URL to new URL.
              </FieldDescription>
            </div>

            <div>
              <Button variant="secondary" size="sm">Add redirect</Button>
            </div>

          </header>

          <div className="border-t -mb-4 divide-y">

            <div className="py-4 flex">

              <div className="flex-1 flex items-center gap-4">
                <Label variant="muted" className="flex-1">/example</Label>
                <Icon name="arrowLeft" className="size-2.5 rotate-180 opacity-50" />
                <Label variant="muted" className="flex-1">/example</Label>
              </div>

              <Button variant="secondary" size="xs">
                <Icon name="more" />
              </Button>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
