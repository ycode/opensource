'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { SitemapSettings, SitemapMode, SitemapChangeFrequency } from '@/types';
import { getDefaultSitemapSettings } from '@/lib/sitemap-utils';

export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState('website');
  const { getSettingByKey, updateSetting } = useSettingsStore();

  // Initialize sitemap settings from store
  const storedSitemapSettings = getSettingByKey('sitemap') as SitemapSettings | null;
  const [sitemapSettings, setSitemapSettings] = useState<SitemapSettings>(
    storedSitemapSettings || getDefaultSitemapSettings()
  );
  const [isSaving, setIsSaving] = useState(false);

  // Initialize robots.txt and llms.txt from store
  const storedRobotsTxt = getSettingByKey('robots_txt') as string | null;
  const storedLlmsTxt = getSettingByKey('llms_txt') as string | null;
  const [robotsTxt, setRobotsTxt] = useState(storedRobotsTxt || '');
  const [llmsTxt, setLlmsTxt] = useState(storedLlmsTxt || '');

  // Initialize Google Analytics, Site Verification, and Canonical URL from store
  const storedGaMeasurementId = getSettingByKey('ga_measurement_id') as string | null;
  const storedGoogleSiteVerification = getSettingByKey('google_site_verification') as string | null;
  const storedGlobalCanonicalUrl = getSettingByKey('global_canonical_url') as string | null;
  const [gaMeasurementId, setGaMeasurementId] = useState(storedGaMeasurementId || '');
  const [googleSiteVerification, setGoogleSiteVerification] = useState(storedGoogleSiteVerification || '');
  const [globalCanonicalUrl, setGlobalCanonicalUrl] = useState(storedGlobalCanonicalUrl || '');

  // Initialize global custom code from store
  const storedCustomCodeHead = getSettingByKey('custom_code_head') as string | null;
  const storedCustomCodeBody = getSettingByKey('custom_code_body') as string | null;
  const [customCodeHead, setCustomCodeHead] = useState(storedCustomCodeHead || '');
  const [customCodeBody, setCustomCodeBody] = useState(storedCustomCodeBody || '');
  const [isSavingCustomCode, setIsSavingCustomCode] = useState(false);

  // Derive activeSeoTab from sitemap mode
  const activeSeoTab = sitemapSettings.mode === 'auto'
    ? 'ycode-sitemap'
    : sitemapSettings.mode === 'custom'
      ? 'custom-sitemap'
      : 'no-sitemap';

  // Update sitemap settings locally
  const updateSitemapSetting = useCallback(<K extends keyof SitemapSettings>(
    key: K,
    value: SitemapSettings[K]
  ) => {
    setSitemapSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Handle tab change for sitemap mode
  const handleSitemapTabChange = useCallback((tab: string) => {
    const mode: SitemapMode = tab === 'ycode-sitemap'
      ? 'auto'
      : tab === 'custom-sitemap'
        ? 'custom'
        : 'none';
    updateSitemapSetting('mode', mode);
  }, [updateSitemapSetting]);

  // Save SEO settings to server in a single batch request
  const saveSeoSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/ycode/api/settings/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            sitemap: sitemapSettings,
            robots_txt: robotsTxt,
            llms_txt: llmsTxt,
            ga_measurement_id: gaMeasurementId,
            google_site_verification: googleSiteVerification,
            global_canonical_url: globalCanonicalUrl,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save SEO settings');
      }

      // Update local store
      updateSetting('sitemap', sitemapSettings);
      updateSetting('robots_txt', robotsTxt);
      updateSetting('llms_txt', llmsTxt);
      updateSetting('ga_measurement_id', gaMeasurementId);
      updateSetting('google_site_verification', googleSiteVerification);
      updateSetting('global_canonical_url', globalCanonicalUrl);
    } catch (error) {
      console.error('Error saving SEO settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [sitemapSettings, robotsTxt, llmsTxt, gaMeasurementId, googleSiteVerification, globalCanonicalUrl, updateSetting]);

  // Save custom code settings to server
  const saveCustomCodeSettings = useCallback(async () => {
    setIsSavingCustomCode(true);
    try {
      const response = await fetch('/ycode/api/settings/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            custom_code_head: customCodeHead,
            custom_code_body: customCodeBody,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save custom code settings');
      }

      // Update local store
      updateSetting('custom_code_head', customCodeHead);
      updateSetting('custom_code_body', customCodeBody);
    } catch (error) {
      console.error('Error saving custom code settings:', error);
    } finally {
      setIsSavingCustomCode(false);
    }
  }, [customCodeHead, customCodeBody, updateSetting]);

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
                    Seamlessly integrate Google Analytics into your Ycode site. As the site owner, you are responsible for ensuring your site complies with privacy regulations, such as GDPR, and handles data appropriately.
                  </FieldDescription>
                  <Input
                    id="google-analytics-measurement-id"
                    value={gaMeasurementId}
                    onChange={(e) => setGaMeasurementId(e.target.value)}
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
                    value={googleSiteVerification}
                    onChange={(e) => setGoogleSiteVerification(e.target.value)}
                    placeholder="e.g. x88atPHmzG1G2FBivU1bk-w398zDtl8Mci2AC2tYd4kw"
                  />
                </Field>

                <Field className="col-span-2">
                  <FieldLabel htmlFor="global-canonical-url">
                    Global Canonical Tag URL
                  </FieldLabel>
                  <FieldDescription>
                    Set the global URL to use in the canonical tag for this site so search engines know the proper URL to index and don&apos;t serve duplicate content.
                  </FieldDescription>
                  <Input
                    id="global-canonical-url"
                    value={globalCanonicalUrl}
                    onChange={(e) => setGlobalCanonicalUrl(e.target.value)}
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
                    value={robotsTxt}
                    onChange={(e) => setRobotsTxt(e.target.value)}
                    placeholder={'User-agent: *\nAllow: /\nDisallow: /ycode/'}
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
                    value={llmsTxt}
                    onChange={(e) => setLlmsTxt(e.target.value)}
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

                  <Tabs value={activeSeoTab} onValueChange={handleSitemapTabChange}>
                    <TabsList className="w-full">
                      <TabsTrigger value="no-sitemap">No sitemap</TabsTrigger>
                      <TabsTrigger value="ycode-sitemap">Ycode generated</TabsTrigger>
                      <TabsTrigger value="custom-sitemap">Custom XML</TabsTrigger>
                    </TabsList>

                    <TabsContent value="no-sitemap" className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        No sitemap.xml file will be generated for your website.
                      </p>
                    </TabsContent>

                    <TabsContent value="ycode-sitemap" className="mt-4 space-y-6">
                      <p className="text-sm text-muted-foreground">
                        The sitemap automatically includes localized URLs with hreflang alternates and excludes pages marked with noindex.
                      </p>

                      <Field>
                        <FieldLabel htmlFor="sitemap-changefreq">
                          Change frequency
                        </FieldLabel>
                        <FieldDescription>
                          How frequently pages are likely to change (hint to search engines).
                        </FieldDescription>
                        <Select
                          value={sitemapSettings.defaultChangeFrequency || 'weekly'}
                          onValueChange={(value) => updateSitemapSetting('defaultChangeFrequency', value as SitemapChangeFrequency)}
                        >
                          <SelectTrigger id="sitemap-changefreq">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="always">Always</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                            <SelectItem value="never">Never</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </TabsContent>

                    <TabsContent value="custom-sitemap" className="mt-4">
                      <Field>
                        <FieldLabel htmlFor="custom-sitemap-xml">
                          Custom sitemap XML
                        </FieldLabel>
                        <FieldDescription>
                          Paste your custom sitemap XML content below. This will completely replace the auto-generated sitemap.
                        </FieldDescription>
                        <Textarea
                          id="custom-sitemap-xml"
                          value={sitemapSettings.customXml || ''}
                          onChange={(e) => updateSitemapSetting('customXml', e.target.value)}
                          placeholder={`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`}
                          className="font-mono text-sm min-h-50"
                        />
                      </Field>
                    </TabsContent>
                  </Tabs>
                </Field>

                <FieldSeparator className="col-span-2" />

                <div className="col-span-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveSeoSettings}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="custom-code" className="mt-2">
            <div className="grid grid-cols-3 gap-10 bg-secondary/20 p-8 rounded-lg">
              <div>
                <FieldLegend>Custom code</FieldLegend>
                <FieldDescription>Set up custom codes that should be added on your website.</FieldDescription>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-8">

                <Field className="col-span-2">
                  <FieldLabel htmlFor="global-code-head">
                    Header
                  </FieldLabel>
                  <FieldDescription>
                    Enter code that will be injected into the &lt;head&gt; tag on every page of your site.
                  </FieldDescription>
                  <Textarea
                    id="global-code-head"
                    value={customCodeHead}
                    onChange={(e) => setCustomCodeHead(e.target.value)}
                    placeholder={'<script src="..."></script>\n<link rel="stylesheet" href="...">'}
                    className="min-h-30"
                  />
                </Field>

                <Field className="col-span-2">
                  <FieldLabel htmlFor="global-code-body">
                    Body
                  </FieldLabel>
                  <FieldDescription>
                    Enter code that will be injected before the &lt;/body&gt; tag on every page of your site.
                  </FieldDescription>
                  <Textarea
                    id="global-code-body"
                    value={customCodeBody}
                    onChange={(e) => setCustomCodeBody(e.target.value)}
                    placeholder={'<script>...</script>'}
                    className="min-h-30"
                  />
                </Field>

                <FieldSeparator className="col-span-2" />

                <div className="col-span-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveCustomCodeSettings}
                    disabled={isSavingCustomCode}
                  >
                    {isSavingCustomCode ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
