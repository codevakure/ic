import React, { memo, useMemo } from 'react';
import {
  SandpackPreview,
  SandpackProvider,
  SandpackProviderProps,
} from '@codesandbox/sandpack-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react';
import type { TStartupConfig } from 'ranger-data-provider';
import type { ArtifactFiles } from '~/common';
import { sharedFiles, TAILWIND_CDN, DEFAULT_BUNDLER_URL } from '~/utils/artifacts';

export const ArtifactPreview = memo(function ({
  files,
  fileKey,
  template,
  sharedProps,
  previewRef,
  currentCode,
  startupConfig,
}: {
  files: ArtifactFiles;
  fileKey: string;
  template: SandpackProviderProps['template'];
  sharedProps: Partial<SandpackProviderProps>;
  previewRef: React.MutableRefObject<SandpackPreviewRef>;
  currentCode?: string;
  startupConfig?: TStartupConfig;
}) {
  const artifactFiles = useMemo(() => {
    if (Object.keys(files).length === 0) {
      return files;
    }
    const code = currentCode ?? '';
    if (!code) {
      return files;
    }
    return {
      ...files,
      [fileKey]: {
        code,
      },
    };
  }, [currentCode, files, fileKey]);

  if (Object.keys(artifactFiles).length === 0) {
    return null;
  }

  // For static HTML templates - minimal config, no dependencies, no external resources
  if (template === 'static') {
    return (
      <SandpackProvider
        files={artifactFiles as any}
        template="static"
      >
        <div className="h-full w-full">
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
            tabIndex={0}
            ref={previewRef}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '0',
            }}
          />
        </div>
      </SandpackProvider>
    );
  }

  // For React/Mermaid templates - full config with Tailwind CSS via externalResources
  const sandpackFiles = { ...artifactFiles, ...sharedFiles };
  const bundlerURL = startupConfig?.bundlerURL || DEFAULT_BUNDLER_URL;


  return (
    <SandpackProvider
      files={sandpackFiles as any}
      template={template}
      options={{
        externalResources: [TAILWIND_CDN],
        bundlerURL,
      }}
      customSetup={sharedProps.customSetup}
    >
      <div className="h-full w-full">
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          tabIndex={0}
          ref={previewRef}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '0',
          }}
        />
      </div>
    </SandpackProvider>
  );
});