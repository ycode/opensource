'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Field,
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

export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState('website');

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">

        <header className="pt-8 pb-3">
          <span className="text-base font-medium">General settings</span>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="website">Website</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="custom-code">Custom code</TabsTrigger>
          </TabsList>

          <TabsContent value="website" className="mt-2">

            <div className="grid grid-cols-3 gap-10 bg-secondary/20 p-8 rounded-lg">

              <div>
                <FieldLegend>Main details</FieldLegend>
                <FieldDescription>This information might be displayed publicly so be careful what you share.</FieldDescription>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-5">

                <Field>
                  <FieldLabel htmlFor="project-name">
                    Project name
                  </FieldLabel>
                  <Input
                    id="project-name"
                    placeholder="My website"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="subdomain">
                    Subdomain
                  </FieldLabel>
                  <Input
                    id="subdomain"
                    placeholder="website"
                    required
                  />
                </Field>

                <FieldSeparator className="col-span-2" />

                <Field className="col-span-2">
                  <FieldLabel htmlFor="timezone">
                    Timezone
                  </FieldLabel>
                  <Select defaultValue="">
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="[GMT+3:00] Europe/Vilnius" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">[GMT+3:00] Europe/Vilnius</SelectItem>
                      <SelectItem value="2">[GMT+3:00] Europe/Vilnius</SelectItem>
                      <SelectItem value="3">[GMT+3:00] Europe/Vilnius</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <FieldSeparator className="col-span-2" />

                <div className="col-span-2 flex justify-end">
                  <Button size="sm">Save changes</Button>
                </div>

              </div>

            </div>

          </TabsContent>

          <TabsContent value="seo" className="mt-6">
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              SEO settings content goes here
            </div>
          </TabsContent>

          <TabsContent value="custom-code" className="mt-6">
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              Custom code content goes here
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
