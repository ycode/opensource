'use client';

export default function ApiPage() {
  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <header className="pt-8 pb-3">
          <span className="text-base font-medium">API</span>
        </header>

        <div className="bg-secondary/20 p-8 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Access your website data programmatically using the REST API.
          </p>

          <div className="mt-8 text-center py-16 border border-dashed rounded-lg">
            <p className="text-muted-foreground text-sm">
              API documentation coming soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
