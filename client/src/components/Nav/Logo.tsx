import React, { useEffect, useState } from 'react';
import { useTheme, isDark } from '@ranger/client';
import { dataService } from 'ranger-data-provider';
import type { TCustomLogo } from 'ranger-data-provider';
import { cn } from '~/utils';

interface LogoProps {
  /** Height of the logo in pixels */
  height?: number;
  className?: string;
  alt?: string;
}

// Default fallback logo paths
const DEFAULT_LOGO_DARK = '/assets/branding-logo-dark.svg';
const DEFAULT_LOGO_LITE = '/assets/branding-logo-lite.svg';

// Cache the custom logo config to avoid flashing during auth state changes
let cachedCustomLogo: TCustomLogo | undefined;

export default function Logo({ height = 40, className = '', alt = 'Logo' }: LogoProps) {
  const { theme } = useTheme();
  const [customLogo, setCustomLogo] = useState<TCustomLogo | undefined>(cachedCustomLogo);
  const isCurrentlyDark = isDark(theme);

  // Fetch config directly on mount (bypass react-query's queriesEnabled)
  // This prevents logo flash during logout/login transitions
  useEffect(() => {
    if (cachedCustomLogo) {
      setCustomLogo(cachedCustomLogo);
      return;
    }

    let mounted = true;
    dataService.getStartupConfig()
      .then((config) => {
        if (mounted && config?.interface?.customLogo) {
          cachedCustomLogo = config.interface.customLogo;
          setCustomLogo(config.interface.customLogo);
        }
      })
      .catch((err) => {
        console.error('[Logo] Failed to fetch config:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Get custom logo from config or use defaults
  const darkLogo = customLogo?.darkTheme || DEFAULT_LOGO_DARK;
  const liteLogo = customLogo?.lightTheme || DEFAULT_LOGO_LITE;

  const logoSrc = isCurrentlyDark ? darkLogo : liteLogo;

  return (
    <div className={cn('flex items-center', className)}>
      <img
        src={logoSrc}
        alt={alt}
        className="object-contain"
        style={{
          height: `${height}px`,
          width: 'auto',
          maxWidth: '100%',
        }}
      />
    </div>
  );
}
