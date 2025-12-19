import { Info } from 'lucide-react';
import { OptionTypes } from 'ranger-data-provider';
import type { DynamicSettingProps } from 'ranger-data-provider';
import { useLocalize, useDebouncedInput, useParameterEffects, TranslationKeys } from '~/hooks';
import { Label, TextareaAutosize, TooltipAnchor } from '@ranger/client';
import { useChatContext } from '~/Providers';
import { cn } from '~/utils';

function DynamicTextarea({
  label = '',
  settingKey,
  defaultValue,
  description = '',
  columnSpan,
  setOption,
  optionType,
  placeholder = '',
  readonly = false,
  showDefault = false,
  labelCode = false,
  descriptionCode = false,
  placeholderCode = false,
  conversation,
}: DynamicSettingProps) {
  const localize = useLocalize();
  const { preset } = useChatContext();

  const [setInputValue, inputValue, setLocalValue] = useDebouncedInput<string | null>({
    optionKey: settingKey,
    initialValue:
      optionType !== OptionTypes.Custom
        ? (conversation?.[settingKey] as string)
        : (defaultValue as string),
    setter: () => ({}),
    setOption,
  });

  useParameterEffects({
    preset,
    settingKey,
    defaultValue: typeof defaultValue === 'undefined' ? '' : defaultValue,
    conversation,
    inputValue,
    setInputValue: setLocalValue,
  });

  const placeholderText = placeholderCode
    ? localize(placeholder as TranslationKeys) || placeholder
    : placeholder;

  const descriptionText = descriptionCode
    ? localize(description as TranslationKeys) || description
    : description;

  return (
    <div
      className={cn(
        'flex flex-col items-start justify-start gap-1.5',
        columnSpan != null ? `col-span-${columnSpan}` : 'col-span-full',
      )}
    >
      <div className="flex items-center gap-1">
        <Label
          htmlFor={`${settingKey}-dynamic-textarea`}
          className="text-left text-xs font-medium text-text-secondary"
        >
          {labelCode ? (localize(label as TranslationKeys) ?? label) : label || settingKey}
        </Label>
        {description && (
          <TooltipAnchor
            description={descriptionText}
            side="top"
            className="flex h-4 w-4 items-center justify-center text-text-tertiary transition-colors hover:text-text-secondary"
          >
            <Info size={12} />
          </TooltipAnchor>
        )}
      </div>
      <TextareaAutosize
        id={`${settingKey}-dynamic-textarea`}
        disabled={readonly}
        value={inputValue ?? ''}
        onChange={setInputValue}
        aria-label={localize(label as TranslationKeys)}
        placeholder={placeholderText}
        className={cn(
          'flex max-h-[100px] min-h-[60px] w-full resize-none rounded-md border border-border-light bg-surface-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none',
        )}
      />
    </div>
  );
}

export default DynamicTextarea;
