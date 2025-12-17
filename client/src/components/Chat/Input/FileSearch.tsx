import React, { memo } from 'react';
import { CheckboxButton, VectorIcon } from '@librechat/client';
import { PermissionTypes, Permissions, AgentCapabilities } from 'librechat-data-provider';
import { useLocalize, useHasAccess } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';

function FileSearch() {
  const localize = useLocalize();
  const { fileSearch, isAutoEnabled } = useBadgeRowContext();
  const { toggleState: fileSearchEnabled, debouncedChange, isPinned } = fileSearch;

  const canUseFileSearch = useHasAccess({
    permissionType: PermissionTypes.FILE_SEARCH,
    permission: Permissions.USE,
  });

  // Don't show badge if tool is auto-enabled (handled by backend intent analyzer)
  if (!canUseFileSearch || isAutoEnabled(AgentCapabilities.file_search)) {
    return null;
  }

  return (
    <>
      {(fileSearchEnabled || isPinned) && (
        <CheckboxButton
          className="max-w-fit"
          checked={fileSearchEnabled}
          setValue={debouncedChange}
          label={localize('com_assistants_file_search')}
          isCheckedClassName="border-green-600/40 bg-primary/10 hover:bg-primary-hover/10"
          icon={<VectorIcon className="icon-md" />}
        />
      )}
    </>
  );
}

export default memo(FileSearch);
