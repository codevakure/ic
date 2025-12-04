import React, { useState, useMemo } from 'react';
import { Calculator, Info, DollarSign, Zap, TrendingUp } from 'lucide-react';
import { Input, Label, HoverCard, HoverCardTrigger, HoverCardContent } from '@ranger/client';

// Intent Analyzer model costs (per MILLION tokens - AWS Bedrock pricing as of Dec 2024)
// https://aws.amazon.com/bedrock/pricing/
const INTENT_ANALYZER_MODELS = [
  {
    id: 'nova-micro',
    name: 'Amazon Nova Micro',
    tier: 'Simple',
    description: 'Fast, lightweight model for simple queries',
    inputCostPerMillion: 0.035, // $0.035 per million input tokens
    outputCostPerMillion: 0.14, // $0.14 per million output tokens
    color: 'bg-green-500',
  },
  {
    id: 'haiku-3.5',
    name: 'Claude 3.5 Haiku',
    tier: 'Moderate',
    description: 'Balanced model for moderate complexity',
    inputCostPerMillion: 0.80, // $0.80 per million input tokens
    outputCostPerMillion: 4.0, // $4 per million output tokens
    color: 'bg-blue-500',
  },
  {
    id: 'sonnet-3.5',
    name: 'Claude 3.5 Sonnet',
    tier: 'Complex',
    description: 'Advanced model for complex tasks',
    inputCostPerMillion: 3.0, // $3 per million input tokens
    outputCostPerMillion: 15.0, // $15 per million output tokens
    color: 'bg-purple-500',
  },
  {
    id: 'opus-3',
    name: 'Claude 3 Opus',
    tier: 'Expert',
    description: 'Most capable model for expert-level tasks',
    inputCostPerMillion: 15.0, // $15 per million input tokens
    outputCostPerMillion: 75.0, // $75 per million output tokens
    color: 'bg-orange-500',
  },
];

interface CostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export function CostCalculator() {
  const [inputTokens, setInputTokens] = useState<number>(1000);
  const [outputTokens, setOutputTokens] = useState<number>(500);
  const [messagesPerDay, setMessagesPerDay] = useState<number>(100);

  const costBreakdown = useMemo<CostBreakdown[]>(() => {
    return INTENT_ANALYZER_MODELS.map((model) => {
      // Convert per million to actual cost: tokens / 1,000,000 * cost_per_million
      const inputCost = (inputTokens / 1000000) * model.inputCostPerMillion;
      const outputCost = (outputTokens / 1000000) * model.outputCostPerMillion;
      return {
        model: model.name,
        inputTokens,
        outputTokens,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
      };
    });
  }, [inputTokens, outputTokens]);

  const dailyProjections = useMemo(() => {
    return costBreakdown.map((cost) => ({
      ...cost,
      dailyCost: cost.totalCost * messagesPerDay,
      monthlyCost: cost.totalCost * messagesPerDay * 30,
    }));
  }, [costBreakdown, messagesPerDay]);

  const formatCost = (cost: number): string => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  return (
    <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Intent Analyzer Cost Calculator
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Estimate costs for Intent Analyzer models based on token usage
            </p>
          </div>
        </div>
      </div>

      {/* Input Controls */}
      <div className="p-6 border-b border-[var(--border-light)] bg-[var(--surface-primary-alt)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[var(--text-primary)]">Input Tokens (per message)</Label>
              <HoverCard>
                <HoverCardTrigger>
                  <Info className="h-4 w-4 text-[var(--text-secondary)] cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="bg-[var(--surface-primary)] border-[var(--border-light)] text-sm">
                  Average number of input tokens per message. Includes system prompt and conversation context.
                </HoverCardContent>
              </HoverCard>
            </div>
            <Input
              type="number"
              value={inputTokens}
              onChange={(e) => setInputTokens(Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-[var(--surface-primary)] border-[var(--border-light)]"
              min={0}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[var(--text-primary)]">Output Tokens (per message)</Label>
              <HoverCard>
                <HoverCardTrigger>
                  <Info className="h-4 w-4 text-[var(--text-secondary)] cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="bg-[var(--surface-primary)] border-[var(--border-light)] text-sm">
                  Average number of output tokens per message. The model's response length.
                </HoverCardContent>
              </HoverCard>
            </div>
            <Input
              type="number"
              value={outputTokens}
              onChange={(e) => setOutputTokens(Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-[var(--surface-primary)] border-[var(--border-light)]"
              min={0}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[var(--text-primary)]">Messages per Day</Label>
              <HoverCard>
                <HoverCardTrigger>
                  <Info className="h-4 w-4 text-[var(--text-secondary)] cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="bg-[var(--surface-primary)] border-[var(--border-light)] text-sm">
                  Estimated number of messages processed per day for cost projections.
                </HoverCardContent>
              </HoverCard>
            </div>
            <Input
              type="number"
              value={messagesPerDay}
              onChange={(e) => setMessagesPerDay(Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-[var(--surface-primary)] border-[var(--border-light)]"
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Model Pricing Table */}
      <div className="p-6">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-400" />
          Model Pricing
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-light)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--text-secondary)]">Model</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--text-secondary)]">Tier</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-secondary)]">Input $/1M</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-secondary)]">Output $/1M</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-secondary)]">Cost/Message</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-secondary)]">Daily Cost</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--text-secondary)]">Monthly Cost</th>
              </tr>
            </thead>
            <tbody>
              {INTENT_ANALYZER_MODELS.map((model, index) => {
                const projection = dailyProjections[index];
                return (
                  <tr
                    key={model.id}
                    className="border-b border-[var(--border-light)] hover:bg-[var(--surface-primary-alt)] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${model.color}`} />
                        <span className="font-medium text-[var(--text-primary)]">{model.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        model.tier === 'Simple' ? 'bg-green-500/20 text-green-400' :
                        model.tier === 'Moderate' ? 'bg-blue-500/20 text-blue-400' :
                        model.tier === 'Complex' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {model.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                      ${model.inputCostPerMillion.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-secondary)]">
                      ${model.outputCostPerMillion.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-[var(--text-primary)]">
                      {formatCost(projection.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-blue-400">
                      {formatCost(projection.dailyCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-green-400">
                      {formatCost(projection.monthlyCost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {INTENT_ANALYZER_MODELS.map((model, index) => {
            const projection = dailyProjections[index];
            return (
              <div
                key={model.id}
                className={`p-4 rounded-lg border ${
                  model.tier === 'Simple' ? 'border-green-500/30 bg-green-500/5' :
                  model.tier === 'Moderate' ? 'border-blue-500/30 bg-blue-500/5' :
                  model.tier === 'Complex' ? 'border-purple-500/30 bg-purple-500/5' :
                  'border-orange-500/30 bg-orange-500/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${model.color}`} />
                  <span className="font-medium text-[var(--text-primary)] text-sm">{model.name}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-3">{model.description}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Per Message</span>
                    <span className="text-[var(--text-primary)]">{formatCost(projection.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Monthly</span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatCost(projection.monthlyCost)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cost Comparison Visualization */}
        <div className="mt-6 p-4 bg-[var(--surface-primary-alt)] rounded-lg">
          <h4 className="font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            Cost Comparison (Monthly)
          </h4>
          <div className="space-y-3">
            {dailyProjections.map((projection, index) => {
              const model = INTENT_ANALYZER_MODELS[index];
              const maxCost = Math.max(...dailyProjections.map(p => p.monthlyCost));
              const percentage = maxCost > 0 ? (projection.monthlyCost / maxCost) * 100 : 0;
              
              return (
                <div key={model.id}>
                  <div className="flex justify-between mb-1 text-sm">
                    <span className="text-[var(--text-secondary)]">{model.name}</span>
                    <span className="text-[var(--text-primary)] font-medium">
                      {formatCost(projection.monthlyCost)}
                    </span>
                  </div>
                  <div className="h-3 bg-[var(--surface-primary)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${model.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-300 flex items-start gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
            Pricing is per million tokens (AWS Bedrock on-demand pricing). 
            Nova Micro: $0.04/$0.14 | Haiku: $1/$5 | Sonnet: $3/$15 | Opus: $15/$75 per 1M tokens (input/output).
            The Intent Analyzer automatically routes queries to the appropriate model tier based on complexity.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
