import crypto from 'node:crypto';
import { Tools } from 'librechat-data-provider';
import type { UIResource } from 'librechat-data-provider';
import type * as t from './types';

function generateResourceId(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 10);
}

const RECOGNIZED_PROVIDERS = new Set([
  'google',
  'anthropic',
  'openai',
  'azureopenai',
  'openrouter',
  'xai',
  'deepseek',
  'ollama',
  'bedrock',
]);
const CONTENT_ARRAY_PROVIDERS = new Set(['google', 'anthropic', 'azureopenai', 'openai']);

const imageFormatters: Record<string, undefined | t.ImageFormatter> = {
  // google: (item) => ({
  //   type: 'image',
  //   inlineData: {
  //     mimeType: item.mimeType,
  //     data: item.data,
  //   },
  // }),
  // anthropic: (item) => ({
  //   type: 'image',
  //   source: {
  //     type: 'base64',
  //     media_type: item.mimeType,
  //     data: item.data,
  //   },
  // }),
  default: (item) => ({
    type: 'image_url',
    image_url: {
      url: item.data.startsWith('http') ? item.data : `data:${item.mimeType};base64,${item.data}`,
    },
  }),
};

function isImageContent(item: t.ToolContentPart): item is t.ImageContent {
  return item.type === 'image';
}

function parseAsString(result: t.MCPToolCallResponse): string {
  const content = result?.content ?? [];
  if (!content.length) {
    return '(No response)';
  }

  const text = content
    .map((item) => {
      if (item.type === 'text') {
        return item.text;
      }
      if (item.type === 'resource') {
        const resourceText = [];
        // Cast to extended type to access all possible properties
        const resource = item.resource as t.ExtendedResourceContents;
        if (resource.text != null && resource.text) {
          resourceText.push(resource.text);
        }
        if (resource.uri) {
          resourceText.push(`Resource URI: ${resource.uri}`);
        }
        if (resource.name) {
          resourceText.push(`Resource: ${resource.name}`);
        }
        if (resource.description) {
          resourceText.push(`Description: ${resource.description}`);
        }
        if (item.resource.mimeType != null && item.resource.mimeType) {
          resourceText.push(`Type: ${item.resource.mimeType}`);
        }
        return resourceText.join('\n');
      }
      return JSON.stringify(item, null, 2);
    })
    .filter(Boolean)
    .join('\n\n');

  return text;
}

/**
 * Converts MCPToolCallResponse content into recognized content block types
 * First element: string or formatted content (excluding image_url)
 * Second element: Recognized types - "image", "image_url", "text", "json"
 *
 * @param  result - The MCPToolCallResponse object
 * @param provider - The provider name (google, anthropic, openai)
 * @returns Tuple of content and image_urls
 */
export function formatToolContent(
  result: t.MCPToolCallResponse,
  provider: t.Provider,
): t.FormattedContentResult {
  if (!RECOGNIZED_PROVIDERS.has(provider)) {
    return [parseAsString(result), undefined];
  }

  const content = result?.content ?? [];
  if (!content.length) {
    return [[{ type: 'text', text: '(No response)' }], undefined];
  }

  const formattedContent: t.FormattedContent[] = [];
  const imageUrls: t.FormattedContent[] = [];
  let currentTextBlock = '';
  const uiResources: UIResource[] = [];

  type ContentHandler = undefined | ((item: t.ToolContentPart) => void);

  const contentHandlers: {
    text: (item: Extract<t.ToolContentPart, { type: 'text' }>) => void;
    image: (item: t.ToolContentPart) => void;
    resource: (item: Extract<t.ToolContentPart, { type: 'resource' }>) => void;
  } = {
    text: (item) => {
      currentTextBlock += (currentTextBlock ? '\n\n' : '') + item.text;
    },

    image: (item) => {
      if (!isImageContent(item)) {
        return;
      }
      if (CONTENT_ARRAY_PROVIDERS.has(provider) && currentTextBlock) {
        formattedContent.push({ type: 'text', text: currentTextBlock });
        currentTextBlock = '';
      }
      const formatter = imageFormatters.default as t.ImageFormatter;
      const formattedImage = formatter(item);

      if (formattedImage.type === 'image_url') {
        imageUrls.push(formattedImage);
      } else {
        formattedContent.push(formattedImage);
      }
    },

    resource: (item) => {
      // Cast to extended type to access all possible properties
      const resource = item.resource as t.ExtendedResourceContents;
      const isUiResource = resource.uri.startsWith('ui://');
      const resourceText: string[] = [];

      if (isUiResource) {
        // Ensure we have a string for hashing - text could be object or string
        const textContent = typeof resource.text === 'string' 
          ? resource.text 
          : JSON.stringify(resource.text || '');
        const contentToHash = textContent || resource.uri || '';
        const resourceId = generateResourceId(contentToHash);
        const resourceName = resource.name || 'UI Resource';
        const uiResource: UIResource = {
          uri: resource.uri,
          text: resource.text,
          mimeType: resource.mimeType,
          resourceId,
          name: resourceName,
        };

        uiResources.push(uiResource);
        // Provide clear marker with resource name for easy identification
        resourceText.push(`📊 "${resourceName}" → UI Marker: \\ui{${resourceId}}`);
      } else if (resource.text != null && resource.text) {
        resourceText.push(`Resource Text: ${resource.text}`);
      }

      if (resource.uri.length) {
        resourceText.push(`Resource URI: ${resource.uri}`);
      }
      if (resource.name) {
        resourceText.push(`Resource: ${resource.name}`);
      }
      if (resource.description) {
        resourceText.push(`Resource Description: ${resource.description}`);
      }
      if (item.resource.mimeType != null && item.resource.mimeType) {
        resourceText.push(`Resource MIME Type: ${item.resource.mimeType}`);
      }

      if (resourceText.length) {
        currentTextBlock += (currentTextBlock ? '\n\n' : '') + resourceText.join('\n');
      }
    },
  };

  for (const item of content) {
    const handler = contentHandlers[item.type as keyof typeof contentHandlers] as ContentHandler;
    if (handler) {
      handler(item as never);
    } else {
      const stringified = JSON.stringify(item, null, 2);
      currentTextBlock += (currentTextBlock ? '\n\n' : '') + stringified;
    }
  }

  if (uiResources.length > 0) {
    // Generate list of all markers for easy reference
    const markerList = uiResources.map(r => `  - "${r.name || 'UI Resource'}": \\ui{${r.resourceId}}`).join('\n');
    
    const uiInstructions = `

⚠️ MANDATORY: UI RESOURCE MARKERS - YOU MUST USE THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each resource above has a UI Resource ID. You MUST include the marker in your response.

REQUIRED: Include \\ui{resource-id} in your response text where you want the panel to appear.

Available Resources:
${markerList}

Examples:
- Single resource: \\ui{abc123}
- Multiple separate: \\ui{abc123} \\ui{def456}  
- Carousel: \\ui{abc123,def456,ghi789}

⛔ WITHOUT THE MARKER, USERS CANNOT SEE THE DATA.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    currentTextBlock += uiInstructions;
  }

  if (CONTENT_ARRAY_PROVIDERS.has(provider) && currentTextBlock) {
    formattedContent.push({ type: 'text', text: currentTextBlock });
  }

  let artifacts: t.Artifacts = undefined;
  if (imageUrls.length) {
    artifacts = { content: imageUrls };
  }

  if (uiResources.length) {
    artifacts = {
      ...artifacts,
      [Tools.ui_resources]: { data: uiResources },
    };
  }

  if (CONTENT_ARRAY_PROVIDERS.has(provider)) {
    return [formattedContent, artifacts];
  }

  return [currentTextBlock, artifacts];
}
