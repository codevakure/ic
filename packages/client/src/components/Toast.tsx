import * as RadixToast from '@radix-ui/react-toast';
import { NotificationSeverity } from '~/common';
import { useToast } from '~/hooks';

export function Toast() {
  const { toast, onOpenChange } = useToast();
  
  // Professional muted colors that work in both light and dark modes
  const severityConfig = {
    [NotificationSeverity.INFO]: {
      container: 'bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700',
      icon: 'text-slate-500 dark:text-slate-400',
      iconPath: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      ),
    },
    [NotificationSeverity.SUCCESS]: {
      container: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50',
      icon: 'text-emerald-600 dark:text-emerald-400',
      iconPath: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
    },
    [NotificationSeverity.WARNING]: {
      container: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50',
      icon: 'text-amber-600 dark:text-amber-400',
      iconPath: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      ),
    },
    [NotificationSeverity.ERROR]: {
      container: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800/50',
      icon: 'text-rose-600 dark:text-rose-400',
      iconPath: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      ),
    },
  };

  const config = severityConfig[toast.severity] || severityConfig[NotificationSeverity.INFO];

  return (
    <RadixToast.Root
      open={toast.open}
      onOpenChange={onOpenChange}
      className="pointer-events-auto animate-in slide-in-from-right-full duration-200"
    >
      <div
        className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${config.container}`}
      >
        {toast.showIcon && (
          <div className={`mt-0.5 flex-shrink-0 ${config.icon}`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-5"
            >
              {config.iconPath}
            </svg>
          </div>
        )}
        <RadixToast.Description className="flex-1 text-sm text-slate-700 dark:text-slate-200">
          <div className="whitespace-pre-wrap text-left">{toast.message}</div>
        </RadixToast.Description>
        <button
          onClick={() => onOpenChange(false)}
          className="flex-shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </RadixToast.Root>
  );
}
