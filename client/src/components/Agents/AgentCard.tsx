import React, { useMemo } from 'react';
import { Label } from '@librechat/client';
import type t from 'librechat-data-provider';
import { useLocalize, useAgentCategories, TranslationKeys } from '~/hooks';
import { cn, renderAgentAvatar } from '~/utils';

interface AgentCardProps {
  agent: t.Agent; // The agent data to display
  onClick: () => void; // Callback when card is clicked
  className?: string; // Additional CSS classes
}

/**
 * Card component to display agent information
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
      {/* Card layout */}
      <div className="flex flex-col gap-2">
        {/* Top row: Avatar + Name */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">{renderAgentAvatar(agent, { size: 'sm' })}</div>
          <Label className="line-clamp-1 text-base font-semibold text-text-primary">
            {agent.name}
          </Label>
        </div>

        {/* Description */}
        <p
          id={`agent-${agent.id}-description`}
          className="line-clamp-2 text-sm leading-relaxed text-text-secondary"
          {...(agent.description ? { 'aria-label': `Description: ${agent.description}` } : {})}
        >
          {agent.description ?? ''}
        </p>

        {/* Category badge */}
        {agent.category && categoryLabel && (
          <div className="mt-1">
            <span className="inline-flex items-center rounded-md bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-500">
              {categoryLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentCard;
