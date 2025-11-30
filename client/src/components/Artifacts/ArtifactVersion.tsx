import React, { useState } from 'react';
import { MenuButton } from '@ariakit/react';
import { History, Check } from 'lucide-react';
import { DropdownPopup, TooltipAnchor, useMediaQuery } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface ArtifactVersionProps {
  currentIndex: number;
  totalVersions: number;
  onVersionChange: (index: number) => void;
}

export default function ArtifactVersion({
  currentIndex,
  totalVersions,
  onVersionChange,
}: ArtifactVersionProps) {
  const localize = useLocalize();
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const menuId = 'version-dropdown-menu';

  const handleValueChange = (value: string) => {
    const index = parseInt(value, 10);
    onVersionChange(index);
    setIsPopoverActive(false);
  };

  if (totalVersions <= 1) {
    return null;
  }

  const options = Array.from({ length: totalVersions }, (_, index) => ({
    value: index.toString(),
    label: localize('com_ui_version_var', { 0: String(index + 1) }),
  }));

  const dropdownItems = options.map((option) => {
    const isSelected = option.value === String(currentIndex);
    return {
      label: option.label,
      onClick: () => handleValueChange(option.value),
      value: option.value,
      icon: isSelected ? (
        <Check className="h-4 w-4 text-text-primary" aria-hidden="true" />
      ) : undefined,
    };
  });

  return (
    <DropdownPopup
      menuId={menuId}
      portal
      focusLoop
      unmountOnHide
      isOpen={isPopoverActive}
      setIsOpen={setIsPopoverActive}
      trigger={
        <TooltipAnchor
          description={localize('com_ui_change_version')}
          render={
            <MenuButton className="text-text-secondary hover:text-text-primary">
              <History
                className="h-4 w-4"
                aria-hidden="true"
                focusable="false"
              />
            </MenuButton>
          }
        />
      }
      items={dropdownItems}
      className={isSmallScreen ? '' : 'absolute right-0 top-0 mt-2'}
    />
  );
}
