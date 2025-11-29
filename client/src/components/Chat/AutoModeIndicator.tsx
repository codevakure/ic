import React from 'react';
import { Sparkles } from 'lucide-react';
import { useLocalize } from '~/hooks';

/**
 * AutoModeIndicator - Shows when LLM Router (Auto Mode) is enabled
 * Instead of a model selector dropdown, users see this indicator
 * The router automatically picks the optimal model based on query complexity
 */
export default function AutoModeIndicator() {
  const localize = useLocalize();

  return (
    <div
      className="my-1 flex h-10 items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-600 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-400"
      title={localize('com_ui_auto_mode_tooltip') || 'Auto Mode: AI automatically selects the optimal model for your query'}
    >
      <Sparkles className="h-4 w-4" />
      <span className="font-medium">{localize('com_ui_auto_mode') || 'Auto'}</span>
    </div>
  );
}
