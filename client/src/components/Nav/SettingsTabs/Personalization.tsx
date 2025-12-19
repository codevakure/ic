import { useLocalize } from '~/hooks';

interface PersonalizationProps {
  hasMemoryOptOut: boolean;
  hasAnyPersonalizationFeature: boolean;
}

/**
 * Personalization settings tab.
 * Note: Memory toggle has been moved to the Profile page for better UX.
 * This component is kept for future personalization features.
 */
export default function Personalization({
  hasMemoryOptOut: _hasMemoryOptOut,
  hasAnyPersonalizationFeature,
}: PersonalizationProps) {
  const localize = useLocalize();

  if (!hasAnyPersonalizationFeature) {
    return (
      <div className="flex flex-col gap-3 text-sm text-text-primary">
        <div className="text-text-secondary">{localize('com_ui_no_personalization_available')}</div>
      </div>
    );
  }

  // Memory toggle moved to Profile page - no content needed here anymore
  return (
    <div className="flex flex-col gap-3 text-sm text-text-primary">
      <div className="text-text-secondary">
        Memory settings have been moved to the Profile page for easier access.
      </div>
    </div>
  );
}
