import { EModelEndpoint, alternateName } from 'ranger-data-provider';
import {
  AzureMinimalIcon,
  OpenAIMinimalIcon,
  LightningIcon,
  MinimalPlugin,
  GoogleMinimalIcon,
  CustomMinimalIcon,
  AnthropicIcon,
  BedrockIcon,
  Sparkles,
} from '@ranger/client';
import { FALLBACK_AGENT_ICON_URL } from '~/components/Endpoints/DefaultAgentIcon';
import UnknownIcon from '~/hooks/Endpoint/UnknownIcon';
import { IconProps } from '~/common';
import { cn } from '~/utils';

// Helper to render custom icon from URL
const CustomIconFromURL = ({ iconURL, alt, className }: { iconURL: string; alt: string; className?: string }) => (
  <img 
    src={iconURL} 
    alt={alt} 
    className={cn('object-contain', className ?? 'icon-sm')}
  />
);

const MinimalIcon: React.FC<IconProps> = (props) => {
  const { size = 30, iconURL = '', iconClassName, error } = props;

  let endpoint = 'default'; // Default value for endpoint

  if (typeof props.endpoint === 'string') {
    endpoint = props.endpoint;
  }

  // Get the display name from modelLabel or fallback to default
  const getDisplayName = (defaultName: string) => props.modelLabel || defaultName;

  // Default icons for each endpoint (used when no custom iconURL is provided)
  const defaultIcons: Record<string, { icon: React.ReactNode; name: string }> = {
    [EModelEndpoint.azureOpenAI]: {
      icon: <AzureMinimalIcon className={iconClassName} />,
      name: props.chatGptLabel ?? 'ChatGPT',
    },
    [EModelEndpoint.openAI]: {
      icon: <OpenAIMinimalIcon className={iconClassName} />,
      name: props.chatGptLabel ?? getDisplayName('ChatGPT'),
    },
    [EModelEndpoint.gptPlugins]: { 
      icon: <MinimalPlugin />, 
      name: getDisplayName('Plugins'),
    },
    [EModelEndpoint.google]: { 
      icon: <GoogleMinimalIcon />, 
      name: getDisplayName('Google'),
    },
    [EModelEndpoint.anthropic]: {
      icon: <AnthropicIcon className="icon-md shrink-0 dark:text-white" />,
      name: getDisplayName('Claude'),
    },
    [EModelEndpoint.custom]: {
      icon: <CustomMinimalIcon />,
      name: getDisplayName('Custom'),
    },
    [EModelEndpoint.chatGPTBrowser]: { 
      icon: <LightningIcon />, 
      name: getDisplayName('ChatGPT'),
    },
    [EModelEndpoint.assistants]: { 
      icon: <Sparkles className="icon-sm" />, 
      name: getDisplayName('Assistant'),
    },
    [EModelEndpoint.azureAssistants]: { 
      icon: <Sparkles className="icon-sm" />, 
      name: getDisplayName('Assistant'),
    },
    [EModelEndpoint.agents]: {
      icon: <img src={iconURL || FALLBACK_AGENT_ICON_URL} alt="" className="icon-sm object-contain" width="20" height="20" />,
      name: getDisplayName(alternateName[EModelEndpoint.agents] as string),
    },
    [EModelEndpoint.bedrock]: {
      icon: iconURL && iconURL.startsWith('/') 
        ? <CustomIconFromURL iconURL={iconURL} alt="Bedrock" />
        : <BedrockIcon className="icon-xl text-text-primary" />,
      name: getDisplayName(alternateName[EModelEndpoint.bedrock] as string),
    },
    default: {
      icon: <UnknownIcon iconURL={iconURL} endpoint={endpoint} className="icon-sm" context="nav" />,
      name: endpoint,
    },
  };

  // Get default icon for endpoint
  let { icon, name } = defaultIcons[endpoint] ?? defaultIcons.default;

  // If a custom iconURL is provided for the endpoint config, use it instead of default
  if (iconURL && !iconURL.includes('http') && iconURL.startsWith('/')) {
    // Local asset URL from endpoint config
    icon = <CustomIconFromURL iconURL={iconURL} alt={name} />;
  } else if (iconURL && defaultIcons[iconURL] != null) {
    // iconURL matches another endpoint (e.g., using openai icon for custom endpoint)
    ({ icon, name } = defaultIcons[iconURL]);
  }

  return (
    <div
      data-testid="convo-icon"
      title={name}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
      }}
      className={cn(
        'relative flex items-center justify-center rounded-sm text-text-secondary',
        props.className ?? '',
      )}
    >
      {icon}
      {error === true && (
        <span className="absolute right-0 top-[20px] -mr-2 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-red-500 text-[10px] text-text-secondary">
          !
        </span>
      )}
    </div>
  );
};

export default MinimalIcon;
