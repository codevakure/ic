import dedent from 'dedent';
import { shadcnComponents } from 'librechat-data-provider';
import type {
  SandpackProviderProps,
  SandpackPredefinedTemplate,
} from '@codesandbox/sandpack-react';

const artifactFilename = {
  'application/vnd.react': '/App.tsx',
  'text/html': '/index.html',
  'application/vnd.code-html': '/index.html',
  // mermaid type is handled separately in useArtifactProps.ts
  default: '/index.html',
};

const artifactTemplate: Record<
  keyof typeof artifactFilename | 'application/vnd.mermaid',
  SandpackPredefinedTemplate | undefined
> = {
  'text/html': 'static',
  'application/vnd.react': 'react-ts',
  'application/vnd.mermaid': 'react-ts',
  'application/vnd.code-html': 'static',
  default: 'static',
};

export function getKey(type: string, language?: string): string {
  return `${type}${(language?.length ?? 0) > 0 ? `-${language}` : ''}`;
}

export function getArtifactFilename(type: string, language?: string): string {
  const key = getKey(type, language);
  return artifactFilename[key] ?? artifactFilename.default;
}

export function getTemplate(type: string, language?: string): SandpackPredefinedTemplate {
  const key = getKey(type, language);
  return artifactTemplate[key] ?? (artifactTemplate.default as SandpackPredefinedTemplate);
}

const standardDependencies = {
  // three: '^0.167.1', // Removed - has Node.js dependencies that break in browser sandboxes
  'lucide-react': '^0.394.0',
  'react-router-dom': '^6.11.2',
  'class-variance-authority': '^0.6.0',
  clsx: '^1.2.1',
  'tailwind-merge': '^1.9.1',
  // 'tailwindcss-animate': '^1.0.5', // Removed - requires tailwindcss as peer dependency
  // recharts: Disabled - lodash dependency breaks Sandpack bundler (No transformer for /node_modules/lodash/toString)
  'chart.js': '^4.4.0',
  'react-chartjs-2': '^5.2.0', // Use this instead of recharts - works with Sandpack
  // Radix UI peer dependencies
  '@radix-ui/react-visually-hidden': '^1.0.3',
  '@radix-ui/react-collection': '^1.0.3',
  '@radix-ui/react-context': '^1.0.3',
  '@swc/helpers': '0.4.14', // Pinned - newer versions break Sandpack bundler (classPrivateFieldLooseKey error)
  '@radix-ui/react-accordion': '^1.1.2',
  '@radix-ui/react-alert-dialog': '^1.0.2',
  '@radix-ui/react-aspect-ratio': '^1.1.0',
  '@radix-ui/react-avatar': '^1.1.0',
  '@radix-ui/react-checkbox': '^1.0.3',
  '@radix-ui/react-collapsible': '^1.0.3',
  '@radix-ui/react-dialog': '^1.0.2',
  '@radix-ui/react-dropdown-menu': '^2.1.1',
  '@radix-ui/react-hover-card': '^1.0.5',
  '@radix-ui/react-label': '^2.0.0',
  '@radix-ui/react-menubar': '^1.1.1',
  '@radix-ui/react-navigation-menu': '^1.2.0',
  '@radix-ui/react-popover': '^1.0.7',
  '@radix-ui/react-progress': '^1.1.0',
  '@radix-ui/react-radio-group': '^1.1.3',
  '@radix-ui/react-select': '^2.0.0',
  '@radix-ui/react-separator': '^1.0.3',
  '@radix-ui/react-slider': '^1.1.1',
  '@radix-ui/react-switch': '^1.0.3',
  '@radix-ui/react-tabs': '^1.0.3',
  '@radix-ui/react-toast': '^1.1.5',
  '@radix-ui/react-slot': '^1.1.0',
  '@radix-ui/react-toggle': '^1.1.0',
  '@radix-ui/react-toggle-group': '^1.1.0',
  '@radix-ui/react-tooltip': '^1.2.8',
  '@radix-ui/react-portal': '^1.0.2',
  'embla-carousel-react': '^8.2.0',
  'dat.gui': '^0.7.9',
  vaul: '^0.9.1',
  'resize-observer-polyfill': '^1.5.1',
};

const mermaidDependencies = {
  'react-zoom-pan-pinch': '^3.6.1',
  'class-variance-authority': '^0.6.0',
  clsx: '^1.2.1',
  'tailwind-merge': '^1.9.1',
  '@radix-ui/react-slot': '^1.1.0',
};

const dependenciesMap: Record<
  keyof typeof artifactFilename | 'application/vnd.mermaid',
  Record<string, string>
> = {
  'application/vnd.mermaid': mermaidDependencies,
  'application/vnd.react': standardDependencies,
  'text/html': {}, // Static HTML needs no dependencies
  'application/vnd.code-html': {}, // Static HTML needs no dependencies
  default: standardDependencies,
};

export function getDependencies(type: string): Record<string, string> {
  return dependenciesMap[type] ?? standardDependencies;
}

export function getProps(type: string): Partial<SandpackProviderProps> {
  // For static HTML, don't pass any customSetup to avoid creating custom bundler instances
  if (type === 'text/html' || type === 'application/vnd.code-html') {
    return {};
  }
  return {
    customSetup: {
      dependencies: getDependencies(type),
    },
  };
}

/** Tailwind CSS CDN - Play CDN script for on-the-fly compilation */
export const TAILWIND_CDN = 'https://cdn.tailwindcss.com/3.4.16?plugins=forms,typography';

/** Default Sandpack bundler URL */
export const DEFAULT_BUNDLER_URL = 'https://sandpack-bundler.codesandbox.io';

export const sharedFiles = {
  '/lib/utils.ts': shadcnComponents.utils,
  // Tailwind CSS loader - loads Tailwind CDN and waits for it to be ready
  '/lib/tailwind.ts': {
    code: dedent`
      // Tailwind CDN URL
      const TAILWIND_CDN = '${TAILWIND_CDN}';
      
      // Promise that resolves when Tailwind is loaded
      export const tailwindReady = new Promise<void>((resolve) => {
        // Check if Tailwind is already loaded
        if (typeof (window as any).tailwind !== 'undefined') {
          resolve();
          return;
        }
        
        const script = document.createElement('script');
        script.src = TAILWIND_CDN;
        script.onload = () => resolve();
        script.onerror = () => resolve(); // Resolve anyway to not block rendering
        document.head.insertBefore(script, document.head.firstChild);
      });
    `,
    hidden: true,
  },
  // Custom entry point that waits for Tailwind before rendering
  '/index.tsx': {
    code: dedent`
      import { StrictMode } from "react";
      import { createRoot } from "react-dom/client";
      import "./styles.css";
      import App from "./App";
      import { tailwindReady } from "./lib/tailwind";

      // Wait for Tailwind to load, then render React
      tailwindReady.then(() => {
        const root = createRoot(document.getElementById("root")!);
        root.render(
          <StrictMode>
            <App />
          </StrictMode>
        );
      });
    `,
    hidden: true,
  },
  '/App.css': {
    code: dedent`
      /* Base styles */
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        -webkit-font-smoothing: antialiased;
      }
    `,
    hidden: true,
  },
  '/components/ui/accordion.tsx': shadcnComponents.accordian,
  '/components/ui/alert-dialog.tsx': shadcnComponents.alertDialog,
  '/components/ui/alert.tsx': shadcnComponents.alert,
  '/components/ui/avatar.tsx': shadcnComponents.avatar,
  '/components/ui/badge.tsx': shadcnComponents.badge,
  '/components/ui/breadcrumb.tsx': shadcnComponents.breadcrumb,
  '/components/ui/button.tsx': shadcnComponents.button,
  '/components/ui/calendar.tsx': shadcnComponents.calendar,
  '/components/ui/card.tsx': shadcnComponents.card,
  '/components/ui/carousel.tsx': shadcnComponents.carousel,
  '/components/ui/checkbox.tsx': shadcnComponents.checkbox,
  '/components/ui/collapsible.tsx': shadcnComponents.collapsible,
  '/components/ui/dialog.tsx': shadcnComponents.dialog,
  '/components/ui/drawer.tsx': shadcnComponents.drawer,
  '/components/ui/dropdown-menu.tsx': shadcnComponents.dropdownMenu,
  '/components/ui/input.tsx': shadcnComponents.input,
  '/components/ui/label.tsx': shadcnComponents.label,
  '/components/ui/menubar.tsx': shadcnComponents.menuBar,
  '/components/ui/navigation-menu.tsx': shadcnComponents.navigationMenu,
  '/components/ui/pagination.tsx': shadcnComponents.pagination,
  '/components/ui/popover.tsx': shadcnComponents.popover,
  '/components/ui/progress.tsx': shadcnComponents.progress,
  '/components/ui/radio-group.tsx': shadcnComponents.radioGroup,
  '/components/ui/select.tsx': shadcnComponents.select,
  '/components/ui/separator.tsx': shadcnComponents.separator,
  '/components/ui/skeleton.tsx': shadcnComponents.skeleton,
  '/components/ui/slider.tsx': shadcnComponents.slider,
  '/components/ui/switch.tsx': shadcnComponents.switchComponent,
  '/components/ui/table.tsx': shadcnComponents.table,
  '/components/ui/tabs.tsx': shadcnComponents.tabs,
  '/components/ui/textarea.tsx': shadcnComponents.textarea,
  '/components/ui/toast.tsx': shadcnComponents.toast,
  '/components/ui/toaster.tsx': shadcnComponents.toaster,
  '/components/ui/toggle-group.tsx': shadcnComponents.toggleGroup,
  '/components/ui/toggle.tsx': shadcnComponents.toggle,
  '/components/ui/tooltip.tsx': shadcnComponents.tooltip,
  '/components/ui/use-toast.tsx': shadcnComponents.useToast,
};