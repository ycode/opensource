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

export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState('website');
  const [activeSeoTab, setActiveSeoTab] = useState('no-sitemap');

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

                <div className="col-span-2 flex items-center gap-6">

                  <div className="size-28 bg-secondary/20 rounded-lg flex items-center justify-center shrink-0">
                    <Image
                      src={'/y-filled.svg'}
                      alt="Favicon preview"
                      width={32}
                      height={32}
                      className="size-8"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <FieldLabel>
                      Favicon
                    </FieldLabel>
                    <FieldDescription>
                      32 x 32 pixels. ICO, PNG, GIF, SVG, or JPG.
                    </FieldDescription>
                    <Button
                      size="sm" variant="secondary"
                      className="w-fit"
                    >Upload</Button>
                  </div>

                </div>

                <div className="col-span-2 flex items-center gap-6">

                  <div className="size-28 bg-secondary/20 rounded-lg flex items-center justify-center shrink-0">
                    <Image
                      src={'/ycode-webclip.png'}
                      alt="Web clip preview"
                      width={64}
                      height={64}
                      className="size-16 rounded-[10px]"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <FieldLabel>
                      Web clip
                    </FieldLabel>
                    <FieldDescription>
                      256 x 256 pixels. Shown when web URLs are saved to a phone&apos;s home screen or browser bookmarks.
                    </FieldDescription>
                    <Button
                      size="sm" variant="secondary"
                      className="w-fit"
                    >Upload</Button>
                  </div>

                </div>

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

                <Field orientation="horizontal" className="flex-row-reverse col-span-2">
                  <FieldContent>
                    <FieldLabel htmlFor="badge">Display the &ldquo;Made in Ycode&rdquo; badge</FieldLabel>
                    <FieldDescription>
                      Upgrade to a project plan in order to disable the badge.
                    </FieldDescription>
                  </FieldContent>
                  <Switch id="badge" />
                </Field>

                <FieldSeparator className="col-span-2" />

                <div className="col-span-2 flex justify-end">
                  <Button size="sm">Save changes</Button>
                </div>

              </div>

            </div>

          </TabsContent>

          <TabsContent value="seo" className="mt-2">

            <div className="grid grid-cols-3 gap-10 bg-secondary/20 p-8 rounded-lg">

              <div>
                <FieldLegend>SEO settings</FieldLegend>
                <FieldDescription>These are global project SEO settings. You can individually adjust meta titles, descriptions and open graph info per collection item or via page settings.</FieldDescription>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-8">

                <Field className="col-span-2">
                  <FieldLabel htmlFor="google-analytics-measurement-id">
                    Google Analytics Measurement ID
                  </FieldLabel>
                  <FieldDescription>
                    Seamlessly integrate Google Analytics into your Ycode site. As the site owner, you are responsible for ensuring your site complies with privacy regulations, such as GDPR, and handles data appropiatly.
                  </FieldDescription>
                  <Input
                    id="google-analytics-measurement-id"
                    placeholder="G-XXXXXXXX"
                  />
                </Field>

                <Field className="col-span-2">
                  <FieldLabel htmlFor="google-site-verification">
                    Google Site Verification
                  </FieldLabel>
                  <FieldDescription>
                    Verifying your site with Google will give you access to your website&apos;s private Google Search data. You will also be able to affect how Google Search crawls your site.
                  </FieldDescription>
                  <Input
                    id="google-site-verification"
                    placeholder="e.g. x88atPHmzG1G2FBivU1bk-w398zDtl8Mci2AC2tYd4kw"
                  />
                </Field>

                <Field className="col-span-2">
                  <FieldLabel htmlFor="Global-Canonical-Tag-URL">
                    Global Canonical Tag URL
                  </FieldLabel>
                  <FieldDescription>
                    Set the global URL to use in the canonical tag for this site so search engines know the proper URL to index and don&apos;t serve duplicate content.
                  </FieldDescription>
                  <Input
                    id="Global-Canonical-Tag-URL"
                    placeholder="https://"
                  />
                </Field>

                <Field className="col-span-2">
                  <FieldLabel htmlFor="robots">
                    Contents of &ldquo;robots.txt&rdquo;
                  </FieldLabel>
                  <FieldDescription>
                    If populated, will replace the content of the default /robots.txt file. Learn more about this file at robotstxt.org.
                  </FieldDescription>
                  <Textarea
                    id="robots"
                    placeholder="User-agent: * Allow: /"
                  />
                </Field>

                <Field className="col-span-2">
                  <FieldLabel htmlFor="llms">
                    Contents of &ldquo;llms.txt&rdquo;
                  </FieldLabel>
                  <FieldDescription>
                    If populated, will replace the content of the default /llms.txt file. Learn more about this file at llmstxt.org.
                  </FieldDescription>
                  <Textarea
                    id="llms"
                  />
                </Field>

                <FieldSeparator className="col-span-2" />

                <Field className="col-span-2">
                  <FieldLabel htmlFor="sitemap">
                    Sitemap
                  </FieldLabel>
                  <FieldDescription>
                    The sitemap.xml file improves your site&apos;s SEO by providing search engines with a detailed list of its pages. You can choose whether the file should be included or not and how its content should be configured.
                  </FieldDescription>

                  <Tabs value={activeSeoTab} onValueChange={setActiveSeoTab}>

                    <TabsList className="w-full">
                      <TabsTrigger value="no-sitemap">No sitemap</TabsTrigger>
                      <TabsTrigger value="ycode-sitemap">Ycode generated</TabsTrigger>
                      <TabsTrigger value="custom-sitemap">Custom XML</TabsTrigger>
                    </TabsList>

                  </Tabs>

                </Field>

                <FieldSeparator className="col-span-2" />

                <div className="col-span-2 flex justify-end">
                  <Button size="sm">Save changes</Button>
                </div>

              </div>

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
