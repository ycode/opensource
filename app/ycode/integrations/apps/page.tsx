'use client';

export default function AppsPage() {
  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Apps</span>
        </header>

        <div className="bg-secondary/20 p-8 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Connect third-party apps and services to extend your website&apos;s functionality.
          </p>

          <div className="mt-8 text-center py-16 border border-dashed rounded-lg">
            <p className="text-muted-foreground text-sm">
              No apps configured yet. This feature is coming soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
