import Link from 'next/link';
import { fetchHomepage } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import type { Metadata } from 'next';

// Force dynamic rendering - no caching for preview
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  // Fetch draft homepage data (no caching)
  const data = await fetchHomepage(false);

  // If no homepage, show default landing page
  if (!data || !data.pageLayers.layers || data.pageLayers.layers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center p-8">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            YCode Preview
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            No homepage found. Create an index page in the builder.
          </p>
          <Link
            href="/ycode"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Open Builder →
          </Link>
        </div>
      </div>
    );
  }

  // Render homepage preview
  return (
    <PageRenderer
      page={data.page}
      layers={data.pageLayers.layers || []}
      components={[]}
      generatedCss={data.pageLayers.generated_css}
    />
  );
}

// Generate metadata
export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchHomepage(false);

  if (!data) {
    return {
      title: 'Preview - YCode',
      description: 'Preview - Built with YCode',
    };
  }

  return {
    title: `Preview: ${data.page.name || 'Home'}`,
    description: `Preview of ${data.page.name} - YCode`,
  };
}
