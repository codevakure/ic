import { ranger } from 'ranger-data-provider';
import type { DynamicSettingProps } from 'ranger-data-provider';

type RangerKeys = keyof typeof ranger;

type RangerParams = {
  modelOptions: Omit<NonNullable<DynamicSettingProps['conversation']>, RangerKeys>;
  resendFiles: boolean;
  promptPrefix?: string | null;
  maxContextTokens?: number;
  fileTokenLimit?: number;
  modelLabel?: string | null;
};

/**
 * Separates Ranger-specific parameters from model options
 * @param options - The combined options object
 */
export function extractRangerParams(
  options?: DynamicSettingProps['conversation'],
): RangerParams {
  if (!options) {
    return {
      modelOptions: {} as Omit<NonNullable<DynamicSettingProps['conversation']>, RangerKeys>,
      resendFiles: ranger.resendFiles.default as boolean,
    };
  }

  const modelOptions = { ...options };

  const resendFiles =
    (delete modelOptions.resendFiles, options.resendFiles) ??
    (ranger.resendFiles.default as boolean);
  const promptPrefix = (delete modelOptions.promptPrefix, options.promptPrefix);
  const maxContextTokens = (delete modelOptions.maxContextTokens, options.maxContextTokens);
  const fileTokenLimit = (delete modelOptions.fileTokenLimit, options.fileTokenLimit);
  const modelLabel = (delete modelOptions.modelLabel, options.modelLabel);

  return {
    modelOptions: modelOptions as Omit<
      NonNullable<DynamicSettingProps['conversation']>,
      RangerKeys
    >,
    maxContextTokens,
    fileTokenLimit,
    promptPrefix,
    resendFiles,
    modelLabel,
  };
}
