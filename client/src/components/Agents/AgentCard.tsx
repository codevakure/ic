import React, { useMemo } from 'react';
import { Label } from '@ranger/client';
import type t from 'ranger-data-provider';
import { useLocalize, useAgentCategories, TranslationKeys } from '~/hooks';
import { cn, renderAgentAvatar } from '~/utils';

interface AgentCardProps {
  agent: t.Agent; // The agent data to display
  onClick: () => void; // Callback when card is clicked
  className?: string; // Additional CSS classes
}

/**
 * Card component to display agent information
 * Fixed height card with text ellipsis for consistent grid layout
 */
const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, className = '' }) => {
  const localize = useLocalize();
  const { categories } = useAgentCategories();

  const categoryLabel = useMemo(() => {
    if (!agent.category) return '';
    const category = categories.find((cat) => cat.value === agent.category);
    if (category?.label) {
      return category.label.startsWith('com_')
        ? localize(category.label as TranslationKeys)
        : category.label;
    }
    return agent.category.charAt(0).toUpperCase() + agent.category.slice(1);
  }, [agent.category, categories, localize]);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border-light',
        'cursor-pointer transition-all duration-200 hover:border-border-medium hover:shadow-md',
        'bg-surface-tertiary hover:bg-surface-hover',
        'p-4',
        // Minimum height to accommodate 2 lines of description text
        // Use min-h instead of fixed h to allow natural growth when support contact is present
        'min-h-[140px]',
        className,
      )}
      onClick={onClick}
      aria-label={localize('com_agents_agent_card_label', {
        name: agent.name,
        description: agent.description ?? '',
      })}
      aria-describedby={`agent-${agent.id}-description`}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Card layout - flex column with fixed spacing */}
      <div className="flex h-full flex-col">
        {/* Top row: Avatar + Name */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">{renderAgentAvatar(agent, { size: 'sm' })}</div>
          <Label className="line-clamp-1 flex-1 overflow-hidden text-ellipsis text-base font-semibold text-text-primary">
            {agent.name}
          </Label>
        </div>

        {/* Description - fixed height with ellipsis, supports single or multi-line */}
        <div className="mt-2 flex-1 overflow-hidden">
          <p
            id={`agent-${agent.id}-description`}
            className="line-clamp-2 overflow-hidden text-ellipsis text-sm leading-relaxed text-text-secondary"
            title={agent.description ?? ''}
            {...(agent.description ? { 'aria-label': `Description: ${agent.description}` } : {})}
          >
            {agent.description ?? ''}
          </p>
        </div>

        {/* Support Contact / Author - display between description and category */}
        {(agent.support_contact?.name || agent.support_contact?.email || agent.authorName) && (
          <div className="mt-1 overflow-hidden text-ellipsis text-xs text-text-tertiary">
            <span className="line-clamp-1">
              {agent.support_contact?.name || agent.support_contact?.email || agent.authorName}
            </span>
          </div>
        )}

        {/* Category badge - always at bottom */}
        <div className="mt-auto flex-shrink-0 pt-2">
          {agent.category && categoryLabel ? (
            <span className="inline-flex items-center rounded-md bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-500">
              {categoryLabel}
            </span>
          ) : (
            // Invisible placeholder to maintain consistent height
            <span className="inline-flex h-5" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
