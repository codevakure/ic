import { useMemo, useCallback } from 'react';
import { Info } from 'lucide-react';
import { OptionTypes } from 'ranger-data-provider';
import type { DynamicSettingProps } from 'ranger-data-provider';
import { Label, Slider, Input, InputNumber, TooltipAnchor } from '@ranger/client';
import { useLocalize, useDebouncedInput, useParameterEffects, TranslationKeys } from '~/hooks';
import { cn, defaultTextProps, optionText } from '~/utils';
import { defaultDebouncedDelay } from '~/common';
import { useChatContext } from '~/Providers';

function DynamicSlider({
  label = '',
  settingKey,
  defaultValue,
  range,
  description = '',
  columnSpan,
  setOption,
  optionType,
  options,
  enumMappings,
  readonly = false,
  showDefault = false,
  includeInput = true,
  labelCode = false,
  descriptionCode = false,
  conversation,
}: DynamicSettingProps) {
  const localize = useLocalize();
  const { preset } = useChatContext();
  const isEnum = useMemo(
    () => (!range && options && options.length > 0) ?? false,
    [options, range],
  );

  const [setInputValue, inputValue, setLocalValue] = useDebouncedInput<string | number>({
    optionKey: settingKey,
    initialValue: optionType !== OptionTypes.Custom ? conversation?.[settingKey] : defaultValue,
    setter: () => ({}),
    setOption,
    delay: isEnum ? 0 : defaultDebouncedDelay,
  });

  useParameterEffects({
    preset,
    settingKey,
    defaultValue,
    conversation,
    inputValue,
    setInputValue: setLocalValue,
  });

  const selectedValue = useMemo(() => {
    if (isEnum) {
      return conversation?.[settingKey] ?? defaultValue;
    }
    // TODO: custom logic, add to payload but not to conversation

    return inputValue;
  }, [conversation, defaultValue, settingKey, inputValue, isEnum]);

  const enumToNumeric = useMemo(() => {
    if (isEnum && options) {
      return options.reduce(
        (acc, mapping, index) => {
          acc[mapping] = index;
          return acc;
        },
        {} as Record<string, number>,
      );
    }
    return {};
  }, [isEnum, options]);

  const valueToEnumOption = useMemo(() => {
    if (isEnum && options) {
      return options.reduce(
        (acc, option, index) => {
          acc[index] = option;
          return acc;
        },
        {} as Record<number, string>,
      );
    }
    return {};
  }, [isEnum, options]);

  const getDisplayValue = useCallback(
    (value: string | number | undefined | null): string => {
      if (isEnum && enumMappings && value != null) {
        const stringValue = String(value);
        // Check if the value exists in enumMappings
        if (stringValue in enumMappings) {
          const mappedValue = String(enumMappings[stringValue]);
          // Check if the mapped value is a localization key
          if (mappedValue.startsWith('com_')) {
            return localize(mappedValue as TranslationKeys) ?? mappedValue;
          }
          return mappedValue;
        }
      }
      // Always return a string for Input component compatibility
      if (value != null) {
        return String(value);
      }
      return String(defaultValue ?? '');
    },
    [isEnum, enumMappings, defaultValue, localize],
  );

  const getDefaultDisplayValue = useCallback((): string => {
    if (defaultValue != null && enumMappings) {
      const stringDefault = String(defaultValue);
      if (stringDefault in enumMappings) {
        const mappedValue = String(enumMappings[stringDefault]);
        // Check if the mapped value is a localization key
        if (mappedValue.startsWith('com_')) {
          return localize(mappedValue as TranslationKeys) ?? mappedValue;
        }
        return mappedValue;
      }
    }
    return String(defaultValue ?? '');
  }, [defaultValue, enumMappings, localize]);

  const handleValueChange = useCallback(
    (value: number) => {
      if (isEnum) {
        setInputValue(valueToEnumOption[value]);
      } else {
        setInputValue(value);
      }
    },
    [isEnum, setInputValue, valueToEnumOption],
  );

  const max = useMemo(() => {
    if (isEnum && options) {
      return options.length - 1;
    } else if (range) {
      return range.max;
    } else {
      return 0;
    }
  }, [isEnum, options, range]);

  if (!range && !isEnum) {
    return null;
  }

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
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-1">
          <Label
            htmlFor={`${settingKey}-dynamic-setting`}
            className="break-words text-left text-xs font-medium text-text-secondary"
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
        {includeInput && !isEnum ? (
          <InputNumber
            id={`${settingKey}-dynamic-setting-input-number`}
            disabled={readonly}
            value={inputValue ?? defaultValue}
            onChange={(value) => setInputValue(Number(value))}
            max={range ? range.max : (options?.length ?? 0) - 1}
            min={range ? range.min : 0}
            step={range ? (range.step ?? 1) : 1}
            controls={false}
            aria-label={localize(label as TranslationKeys)}
            className={cn(
              defaultTextProps,
              cn(
                optionText,
                'reset-rc-number-input reset-rc-number-input-text-right h-auto w-12 rounded-md border border-border-light bg-surface-tertiary px-1.5 py-0.5 text-xs text-text-primary',
              ),
            )}
          />
        ) : (
          <Input
            id={`${settingKey}-dynamic-setting-input`}
            disabled={readonly}
            value={getDisplayValue(selectedValue)}
            aria-label={localize(label as TranslationKeys)}
            onChange={() => ({})}
            className={cn(
              defaultTextProps,
              cn(
                optionText,
                'reset-rc-number-input h-auto w-14 rounded-md border border-border-light bg-surface-tertiary px-1.5 py-0.5 text-center text-xs text-text-primary',
              ),
            )}
          />
        )}
      </div>
      <Slider
        id={`${settingKey}-dynamic-setting-slider`}
        disabled={readonly}
        value={[
          isEnum
            ? enumToNumeric[(selectedValue as number) ?? '']
            : ((inputValue as number) ?? (defaultValue as number)),
        ]}
        onValueChange={(value) => handleValueChange(value[0])}
        onDoubleClick={() => setInputValue(defaultValue as string | number)}
        max={max}
        aria-label={localize(label as TranslationKeys)}
        min={range ? range.min : 0}
        step={range ? (range.step ?? 1) : 1}
        className="flex h-4 w-full"
      />
    </div>
  );
}

export default DynamicSlider;
