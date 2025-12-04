import type { AuthType } from 'ranger-data-provider';

export type ApiKeyFormData = {
  apiKey: string;
  authType?: string | AuthType;
};
