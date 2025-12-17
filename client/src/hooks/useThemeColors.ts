import { useEffect, useState } from 'react';
import { dataService } from 'librechat-data-provider';
import type { TStartupConfig } from 'librechat-data-provider';

/**
 * Hook that applies custom theme colors from the startup config to CSS variables.
 * This allows the primary color to be configured via librechat.yaml themeColors setting.
 * 
 * This hook fetches the config directly (not via react-query) to ensure it runs
 * immediately on app load, before authentication/queriesEnabled.
 * 
 * Usage in librechat.yaml:
 * interface:
 *   themeColors:
 *     primary: "rgb(25, 25, 71)"
 *     primaryHover: "rgb(20, 20, 60)"
 */
export function useThemeColors() {
  const [themeColors, setThemeColors] = useState<TStartupConfig['interface']>();

  // Fetch config directly on mount (bypass react-query's queriesEnabled)
  useEffect(() => {
    let mounted = true;
    
    dataService.getStartupConfig()
      .then((config) => {
        if (mounted && config?.interface?.themeColors) {
          setThemeColors(config.interface);
        }
      })
      .catch((err) => {
        console.error('[useThemeColors] Failed to fetch config:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Apply theme colors when they change
  useEffect(() => {
    const colors = themeColors?.themeColors;
    
    if (!colors) {
      return;
    }

    const root = document.documentElement;

    // Apply primary color if configured
    // We set all the color variants to ensure consistency across light/dark themes
    if (colors.primary) {
      root.style.setProperty('--color-primary', colors.primary);
      root.style.setProperty('--color-primary-dark', colors.primary);
      root.style.setProperty('--blue-primary', colors.primary);
      root.style.setProperty('--blue-primary-light', colors.primary);
      // Also update surface-submit which uses blue-primary
      root.style.setProperty('--surface-submit', colors.primary);
    }

    // Apply hover color if configured
    if (colors.primaryHover) {
      root.style.setProperty('--color-primary-hover', colors.primaryHover);
      root.style.setProperty('--color-primary-dark-hover', colors.primaryHover);
      root.style.setProperty('--blue-primary-hover', colors.primaryHover);
      root.style.setProperty('--blue-primary-light-hover', colors.primaryHover);
      root.style.setProperty('--surface-submit-hover', colors.primaryHover);
    }

    // Cleanup on unmount
    return () => {
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-primary-hover');
      root.style.removeProperty('--color-primary-dark');
      root.style.removeProperty('--color-primary-dark-hover');
      root.style.removeProperty('--blue-primary');
      root.style.removeProperty('--blue-primary-hover');
      root.style.removeProperty('--blue-primary-light');
      root.style.removeProperty('--blue-primary-light-hover');
      root.style.removeProperty('--surface-submit');
      root.style.removeProperty('--surface-submit-hover');
    };
  }, [themeColors]);
}

export default useThemeColors;
