'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'group toast !rounded-xl !border-transparent !px-5 !py-2 dark:!bg-white dark:!text-neutral-900 !bg-neutral-900 !text-white !backdrop-blur-3xl !min-h-12',
          title: '!text-white dark:!text-neutral-900',
          description: '!text-white/90 dark:!text-neutral-700 !text-xs',
          actionButton: '!bg-white/10 dark:!bg-neutral-900/10 dark:!text-neutral-900 !text-white !rounded-lg !text-xs !h-7 !-my-2 !-mr-2',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
