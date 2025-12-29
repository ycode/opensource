'use client';

export default function LocalesPage() {
  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <header className="pt-8 pb-3">
          <span className="text-base font-medium">Locales</span>
        </header>

        <div className="bg-secondary/20 p-8 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Locale settings will be available here.
          </p>
        </div>
      </div>
    </div>
  );
}
