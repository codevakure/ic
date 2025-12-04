import * as RadixToast from '@radix-ui/react-toast';
import { NotificationSeverity } from '~/common';
import { useToast } from '~/hooks';

export function Toast() {
  const { toast, onOpenChange } = useToast();

  // Modern toast with subtle gradients that adapt to light/dark theme
  const severityConfig = {
    [NotificationSeverity.INFO]: {
      container: 'bg-gradient-to-r from-white/95 via-white/90 to-blue-50/80 dark:from-gray-900/95 dark:via-gray-900/90 dark:to-blue-950/50',
      iconBg: 'bg-blue-500',
      icon: (
        <svg className="size-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
    [NotificationSeverity.SUCCESS]: {
      container: 'bg-gradient-to-r from-white/95 via-white/90 to-emerald-50/80 dark:from-gray-900/95 dark:via-gray-900/90 dark:to-emerald-950/50',
      iconBg: 'bg-emerald-500',
      icon: (
        <svg className="size-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    [NotificationSeverity.WARNING]: {
      container: 'bg-gradient-to-r from-white/95 via-white/90 to-amber-50/80 dark:from-gray-900/95 dark:via-gray-900/90 dark:to-amber-950/50',
      iconBg: 'bg-amber-500',
      icon: (
        <svg className="size-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    [NotificationSeverity.ERROR]: {
      container: 'bg-gradient-to-r from-white/95 via-white/90 to-red-50/80 dark:from-gray-900/95 dark:via-gray-900/90 dark:to-red-950/50',
      iconBg: 'bg-red-500',
      icon: (
        <svg className="size-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  const config = severityConfig[toast.severity] || severityConfig[NotificationSeverity.INFO];

  return (
    <RadixToast.Root
      open={toast.open}
      onOpenChange={onOpenChange}
      className="pointer-events-auto"
    >
      <div className={`flex items-center gap-3 rounded-xl backdrop-blur-sm px-4 py-3 shadow-lg shadow-black/10 dark:shadow-black/30 min-w-[280px] max-w-[380px] ${config.container}`}>
        {toast.showIcon && (
          <div className={`flex-shrink-0 flex items-center justify-center size-7 rounded-full ${config.iconBg}`}>
            {config.icon}
          </div>
        )}
        <RadixToast.Description className="flex-1 min-w-0">
          <div className="text-sm text-gray-700 dark:text-gray-200 leading-normal whitespace-pre-wrap">
            {toast.message}
          </div>
        </RadixToast.Description>
        <button
          onClick={() => onOpenChange(false)}
          className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-150"
          aria-label="Close notification"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </RadixToast.Root>
  );
}
