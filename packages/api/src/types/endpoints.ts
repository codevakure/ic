import type { TConfig } from 'ranger-data-provider';

export type TCustomEndpointsConfig = Partial<{ [key: string]: Omit<TConfig, 'order'> }>;
