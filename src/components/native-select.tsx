import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** <select> nativo con el estilo de los inputs de shadcn. Funciona sin JavaScript. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'dark:bg-input/30',
        className,
      )}
      {...props}
    />
  );
}
