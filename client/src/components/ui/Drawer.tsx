import * as RadixDialog from '@radix-ui/react-dialog';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Drawer = RadixDialog.Root;
export const DrawerTrigger = RadixDialog.Trigger;

interface DrawerContentProps {
  children: ReactNode;
  className?: string;
  title: string;
}

export function DrawerContent({ children, className, title }: DrawerContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-full max-w-md',
          'bg-[var(--ink-raised)] border-l border-[var(--line)] shadow-2xl',
          'overflow-y-auto',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          'duration-200',
          className
        )}
      >
        <div className="sticky top-0 z-10 bg-[var(--ink-raised)] border-b border-[var(--line)] px-5 py-4 flex items-center justify-between">
          <RadixDialog.Title className="font-display text-lg text-[var(--parchment)] font-medium">
            {title}
          </RadixDialog.Title>
          <RadixDialog.Close className="text-[var(--muted)] hover:text-[var(--parchment)] transition-colors">
            <span className="text-lg leading-none">✕</span>
          </RadixDialog.Close>
        </div>
        <div className="p-5">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
