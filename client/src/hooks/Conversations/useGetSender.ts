import { useCallback } from 'react';
import { getResponseSender } from 'ranger-data-provider';
import type { TEndpointOption, TEndpointsConfig } from 'ranger-data-provider';
import { useGetEndpointsQuery } from '~/data-provider';

export default function useGetSender() {
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();
  return useCallback(
    (endpointOption: TEndpointOption) => {
      // Prefer modelDisplayLabel from endpointOption (passed from useChatFunctions)
      // as it's read from query cache synchronously, over async hook fetch
      const configLabel = endpointsConfig?.[endpointOption.endpoint ?? '']?.modelDisplayLabel;
      const modelDisplayLabel = endpointOption.modelDisplayLabel ?? configLabel;
      return getResponseSender({ ...endpointOption, modelDisplayLabel });
    },
    [endpointsConfig],
  );
}
