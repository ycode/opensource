'use client';

/**
 * Page Settings Panel
 * 
 * Slide-out panel for creating and editing pages
 */

import { useState, useEffect } from 'react';
import type { Page } from '../../../types';

interface PageSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  page?: Page | null;
  onSave: (pageData: PageFormData) => Promise<void>;
}

export interface PageFormData {
  title: string;
  slug: string;
  status: 'draft' | 'published';
}

export default function PageSettingsPanel({
  isOpen,
  onClose,
  page,
  onSave,
}: PageSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'seo' | 'social' | 'code'>('general');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when page changes
  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setSlug(page.slug);
    } else {
      setTitle('');
      setSlug('');
    }
    setError(null);
  }, [page]);

  // Auto-generate slug from title for new pages
  useEffect(() => {
    if (!page && title) {
      const autoSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(autoSlug);
    }
  }, [title, page]);

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      setError('Page name is required');
      return;
    }

    if (!slug.trim()) {
      setError('Slug is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        title: title.trim(),
        slug: slug.trim(),
        status: 'draft',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save page');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[500px] bg-zinc-900 border-l border-zinc-800 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">
            {page ? page.title : 'New Page'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm rounded font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('seo')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'seo'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            SEO settings
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'social'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Social share
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'code'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Custom code
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Page Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Page name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Homepage"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm flex items-center gap-1">
                    <svg
                      className="w-4 h-4" fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                        clipRule="evenodd"
                      />
                    </svg>
                    /
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="index"
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  The URL path for this page
                </p>
              </div>

              {/* Parent Folder - Coming Soon */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Parent folder
                </label>
                <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-500 text-sm flex items-center gap-2 cursor-not-allowed">
                  <svg
                    className="w-4 h-4" fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  None
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Folder support coming soon
                </p>
              </div>

              {/* Password Protected - Coming Soon */}
              <div>
                <label className="flex items-start gap-3 cursor-not-allowed opacity-50">
                  <input
                    type="checkbox"
                    disabled
                    className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500 cursor-not-allowed"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-300">
                      Password protected
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Restrict access to this page. Setting a password will override any password set on a parent folder. Passwords are case-sensitive.
                    </div>
                  </div>
                </label>
              </div>

              {/* Make Homepage - Coming Soon */}
              <div>
                <label className="flex items-start gap-3 cursor-not-allowed opacity-50">
                  <input
                    type="checkbox"
                    disabled
                    className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500 cursor-not-allowed"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-300">
                      Make this page the homepage
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'seo' && (
            <div className="text-center py-12 text-zinc-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-zinc-600" fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm">SEO settings coming soon</p>
              <p className="text-xs mt-1">Configure meta tags, descriptions, and more</p>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="text-center py-12 text-zinc-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-zinc-600" fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              <p className="text-sm">Social share settings coming soon</p>
              <p className="text-xs mt-1">Customize Open Graph and Twitter Card metadata</p>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="text-center py-12 text-zinc-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-zinc-600" fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm">Custom code coming soon</p>
              <p className="text-xs mt-1">Add custom HTML, CSS, and JavaScript</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


