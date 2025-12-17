/**
 * Default Agent Icon Configuration
 * 
 * This file defines the default icon used for agents when they don't have a custom avatar.
 * The icon URL can be configured via librechat.yaml:
 * 
 * endpoints:
 *   agents:
 *     iconURL: "/assets/custom-icon.svg"
 * 
 * If not configured, falls back to '/assets/default-agent-icon.svg'
 */

// Fallback icon URL when not configured in YAML
export const FALLBACK_AGENT_ICON_URL = '/assets/default-agent-icon.svg';

/**
 * Renders the default agent icon as an img element
 * @param iconURL - Custom icon URL from config (optional)
 * @param className - CSS classes for the img element
 * @param style - Inline styles for the img element
 */
export const DefaultAgentIcon = ({ 
  iconURL,
  className = 'object-cover', 
  style = { width: '100%', height: '100%' } 
}: { 
  iconURL?: string;
  className?: string; 
  style?: React.CSSProperties;
}) => (
  <img
    src={iconURL || FALLBACK_AGENT_ICON_URL}
    alt=""
    className={className}
    loading="lazy"
    decoding="async"
    style={style}
  />
);

export default DefaultAgentIcon;
