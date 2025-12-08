import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  Filter,
  Info,
  MessageCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Button, Spinner } from '@ranger/client';
import { tracesApi, usersApi, type LLMTrace, type LLMTracesResponse } from '../services/adminApi';

// Drawer component for trace details
interface TraceDrawerProps {
  trace: LLMTrace | null;
  isOpen: boolean;
  onClose: () => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

// Tree node for trace flow
interface TreeNode {
  id: string;
  label: string;
  type: 'trace' | 'thinking' | 'tool' | 'request' | 'response' | 'guardrails';
  icon: React.ReactNode;
  color: string;
  children?: TreeNode[];
  data?: unknown;
}

function TraceDrawer({ trace, isOpen, onClose }: TraceDrawerProps) {
  const [selectedNode, setSelectedNode] = useState<string>('trace');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['trace']));

  // Reset selection when trace changes
  useEffect(() => {
    if (trace) {
      setSelectedNode('trace');
      setExpandedNodes(new Set(['trace']));
    }
  }, [trace?.id]);

  if (!isOpen || !trace) return null;

  const formatCost = (cost: number) => `$${cost.toFixed(6)}`;
  const formatTokens = (tokens: number) => tokens.toLocaleString();
  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Build hierarchical tree
  const buildTree = (): TreeNode => {
    const traceNode: TreeNode = {
      id: 'trace',
      label: 'LLM Trace',
      type: 'trace',
      icon: <Activity className="h-3.5 w-3.5" />,
      color: 'text-blue-400',
      children: [],
    };

    // Add request as child
    traceNode.children?.push({
      id: 'request',
      label: 'Request',
      type: 'request',
      icon: <ArrowDownRight className="h-3.5 w-3.5" />,
      color: 'text-blue-400',
      data: trace.input,
    });

    // Add thinking if present (as child of trace)
    if (trace.trace.thinking) {
      traceNode.children?.push({
        id: 'thinking',
        label: 'Extended Thinking',
        type: 'thinking',
        icon: <Brain className="h-3.5 w-3.5" />,
        color: 'text-purple-400',
        data: trace.trace.thinking,
      });
    }

    // Add tool calls if present
    if (trace.trace.toolCalls && trace.trace.toolCalls.length > 0) {
      trace.trace.toolCalls.forEach((tool, idx) => {
        traceNode.children?.push({
          id: `tool-${idx}`,
          label: tool.name || `Tool ${idx + 1}`,
          type: 'tool',
          icon: <Wrench className="h-3.5 w-3.5" />,
          color: 'text-orange-400',
          data: tool,
        });
      });
    }

    // Add response as child
    traceNode.children?.push({
      id: 'response',
      label: 'Response',
      type: 'response',
      icon: <ArrowUpRight className="h-3.5 w-3.5" />,
      color: 'text-green-400',
      data: trace.output,
    });

    // Add guardrails if present
    if (trace.guardrails?.invoked) {
      const guardrailIcon = trace.guardrails.input?.outcome === 'blocked' || trace.guardrails.output?.outcome === 'blocked'
        ? <ShieldX className="h-3.5 w-3.5" />
        : trace.guardrails.output?.outcome === 'anonymized'
          ? <ShieldAlert className="h-3.5 w-3.5" />
          : <ShieldCheck className="h-3.5 w-3.5" />;
      
      const guardrailColor = trace.guardrails.input?.outcome === 'blocked' || trace.guardrails.output?.outcome === 'blocked'
        ? 'text-red-400'
        : trace.guardrails.output?.outcome === 'anonymized'
          ? 'text-blue-400'
          : 'text-green-400';

      traceNode.children?.push({
        id: 'guardrails',
        label: 'Guardrails',
        type: 'guardrails' as TreeNode['type'],
        icon: guardrailIcon,
        color: guardrailColor,
        data: trace.guardrails,
      });
    }

    return traceNode;
  };

  const tree = buildTree();

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Recursive tree renderer
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNode === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const indent = depth * 16;

    return (
      <div key={node.id}>
        <button
          onClick={() => {
            setSelectedNode(node.id);
            if (hasChildren) {
              toggleNode(node.id);
            }
          }}
          className={`w-full flex items-center gap-1.5 py-1.5 px-2 text-left text-sm transition-colors rounded ${
            isSelected
              ? 'bg-blue-500/20 text-blue-400'
              : 'hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
          }`}
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {/* Expand/collapse icon */}
          {hasChildren ? (
            <span className="text-[var(--text-tertiary)]">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          ) : (
            <span className="w-3.5" />
          )}
          
          {/* Node icon */}
          <span className={node.color}>{node.icon}</span>
          
          {/* Label */}
          <span className="truncate flex-1">{node.label}</span>
          
          {/* Badge for tool/thinking */}
          {node.type === 'tool' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">Tool</span>
          )}
          {node.type === 'thinking' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">Think</span>
          )}
        </button>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {/* Vertical line */}
            <div 
              className="absolute top-0 bottom-2 w-px bg-[var(--border-light)]" 
              style={{ left: `${16 + indent}px` }}
            />
            {node.children?.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Find selected node data
  const findNode = (node: TreeNode, id: string): TreeNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNodeData = findNode(tree, selectedNode);

  // Render content based on selected node
  const renderContent = () => {
    if (!selectedNodeData) return null;

    switch (selectedNodeData.type) {
      case 'trace':
        // Show both request and response summary
        return (
          <div className="space-y-4 md:space-y-6">
            {/* Request Section */}
            <div>
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-blue-500/20">
                  <ArrowDownRight className="h-3 w-3 md:h-4 md:w-4 text-blue-400" />
                </div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">Request</h3>
              </div>
              <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {trace.input?.text || '_No input text_'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Response Section */}
            <div>
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-green-500/20">
                  <ArrowUpRight className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
                </div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">Response</h3>
              </div>
              <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {trace.output?.text || '_No output text_'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        );

      case 'request':
        return (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-blue-500/20">
                <User className="h-3 w-3 md:h-4 md:w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">User Input</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">
                  {trace.user?.name || 'Unknown'} • {new Date(trace.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {trace.input?.text || '_No input text_'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );

      case 'response':
        return (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-green-500/20">
                <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">AI Response</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">
                  {trace.trace.modelName} • {trace.output?.tokenCount || 0} tokens
                </p>
              </div>
            </div>
            <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {trace.output?.text || '_No output text_'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );

      case 'thinking':
        return (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-purple-500/20">
                <Brain className="h-3 w-3 md:h-4 md:w-4 text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">Extended Thinking</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">Internal reasoning process</p>
              </div>
            </div>
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 md:p-4">
              <pre className="text-xs md:text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-mono overflow-auto">
                {trace.trace.thinking}
              </pre>
            </div>
          </div>
        );

      case 'tool':
        const tool = selectedNodeData.data as { id?: string; name?: string; args?: unknown; output?: string };
        return (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-orange-500/20">
                <Wrench className="h-3 w-3 md:h-4 md:w-4 text-orange-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">{tool.name}</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] font-mono">{tool.id}</p>
              </div>
            </div>
            
            {/* Arguments */}
            <div>
              <h4 className="text-[10px] md:text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 md:mb-2">Arguments</h4>
              <div className="bg-[var(--surface-secondary)] rounded-lg p-2.5 md:p-3 border border-[var(--border-light)] overflow-auto max-h-48">
                <pre className="text-[10px] md:text-xs text-[var(--text-secondary)] font-mono">
                  {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
                </pre>
              </div>
            </div>
            
            {/* Output */}
            {tool.output && (
              <div>
                <h4 className="text-[10px] md:text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 md:mb-2">Output</h4>
                <div className="bg-[var(--surface-secondary)] rounded-lg p-2.5 md:p-3 border border-[var(--border-light)] overflow-auto max-h-64">
                  <pre className="text-[10px] md:text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
                    {tool.output}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );

      case 'guardrails':
        const guardrails = selectedNodeData.data as typeof trace.guardrails;
        if (!guardrails) return null;
        
        const getOutcomeColor = (outcome: string) => {
          switch (outcome) {
            case 'blocked': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20';
            case 'anonymized': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20';
            case 'intervened': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20';
            case 'passed': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20';
            default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/20';
          }
        };

        const getOutcomeIcon = (outcome: string) => {
          switch (outcome) {
            case 'blocked': return <ShieldX className="h-4 w-4" />;
            case 'anonymized': return <ShieldAlert className="h-4 w-4" />;
            case 'intervened': return <Shield className="h-4 w-4" />;
            case 'passed': return <ShieldCheck className="h-4 w-4" />;
            default: return <Shield className="h-4 w-4" />;
          }
        };

        return (
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded bg-blue-500/20">
                <Shield className="h-3 w-3 md:h-4 md:w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)] text-xs md:text-sm">Guardrails Details</h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">Content moderation results</p>
              </div>
            </div>

            {/* Input Guardrails */}
            {guardrails.input && (
              <div>
                <h4 className="text-[10px] md:text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Input Moderation</h4>
                <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getOutcomeColor(guardrails.input.outcome)}`}>
                        {getOutcomeIcon(guardrails.input.outcome)}
                        {guardrails.input.outcome.toUpperCase()}
                      </span>
                      {!guardrails.input.actionApplied && guardrails.input.outcome !== 'passed' && (
                        <span className="text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/10 px-2 py-0.5 rounded">
                          Action Disabled
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{guardrails.input.reason}</span>
                  </div>
                  {guardrails.input.violations && guardrails.input.violations.length > 0 && (
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mb-1">Violations:</p>
                      <div className="flex flex-wrap gap-1">
                        {guardrails.input.violations.map((v: any, i: number) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded">
                            {v.type}: {v.category} {v.action && `(${v.action})`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Original Content */}
                  {guardrails.input.originalContent && (
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mb-1">Original Content:</p>
                      <pre className="text-[10px] md:text-xs bg-[var(--surface-tertiary)] p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap break-words text-[var(--text-primary)]">
                        {guardrails.input.originalContent}
                      </pre>
                    </div>
                  )}
                  {/* Raw AWS Response (Assessments) */}
                  {guardrails.input.assessments && guardrails.input.assessments.length > 0 && (
                    <details className="group">
                      <summary className="text-[10px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)]">
                        Raw AWS Response (click to expand)
                      </summary>
                      <pre className="text-[10px] bg-[var(--surface-tertiary)] p-2 rounded overflow-auto max-h-64 mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">
                        {JSON.stringify(guardrails.input.assessments, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Output Guardrails */}
            {guardrails.output && (
              <div>
                <h4 className="text-[10px] md:text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Output Moderation</h4>
                <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getOutcomeColor(guardrails.output.outcome)}`}>
                        {getOutcomeIcon(guardrails.output.outcome)}
                        {guardrails.output.outcome.toUpperCase()}
                      </span>
                      {!guardrails.output.actionApplied && guardrails.output.outcome !== 'passed' && (
                        <span className="text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/10 px-2 py-0.5 rounded">
                          Action Disabled
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{guardrails.output.reason}</span>
                  </div>
                  {guardrails.output.violations && guardrails.output.violations.length > 0 && (
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mb-1">Violations:</p>
                      <div className="flex flex-wrap gap-1">
                        {guardrails.output.violations.map((v: any, i: number) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded">
                            {v.type}: {v.category} {v.action && `(${v.action})`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Original Content */}
                  {guardrails.output.originalContent && (
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mb-1">Original Content:</p>
                      <pre className="text-[10px] md:text-xs bg-[var(--surface-tertiary)] p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap break-words text-[var(--text-primary)]">
                        {guardrails.output.originalContent}
                      </pre>
                    </div>
                  )}
                  {/* Modified Content (if anonymized) */}
                  {guardrails.output.modifiedContent && guardrails.output.modifiedContent !== guardrails.output.originalContent && (
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mb-1">Modified Content:</p>
                      <pre className="text-[10px] md:text-xs bg-[var(--surface-tertiary)] p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap break-words text-yellow-700 dark:text-yellow-400">
                        {guardrails.output.modifiedContent}
                      </pre>
                    </div>
                  )}
                  {/* Raw AWS Response (Assessments) */}
                  {guardrails.output.assessments && guardrails.output.assessments.length > 0 && (
                    <details className="group">
                      <summary className="text-[10px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)]">
                        Raw AWS Response (click to expand)
                      </summary>
                      <pre className="text-[10px] bg-[var(--surface-tertiary)] p-2 rounded overflow-auto max-h-64 mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">
                        {JSON.stringify(guardrails.output.assessments, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* No guardrails data */}
            {!guardrails.input && !guardrails.output && (
              <div className="text-center text-[var(--text-tertiary)] py-4">
                Guardrails invoked but no detailed data available
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Use portal to render drawer at document body level
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity backdrop-blur-sm"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      
      {/* Drawer - Full screen on mobile, 50% on desktop */}
      <div 
        className="fixed right-0 top-0 h-screen w-full md:w-1/2 md:min-w-[600px] md:max-w-[900px] bg-[var(--surface-primary)] border-l border-[var(--border-light)] flex flex-col shadow-2xl"
        style={{ zIndex: 9999 }}
      >
        {/* Header Row 1 - Conversation Title and Close */}
        <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="flex h-7 w-7 md:h-8 md:w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
              <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm md:text-base font-medium text-[var(--text-primary)] truncate">
                {trace.conversationTitle || 'Untitled Conversation'}
                <span className="text-[var(--text-tertiary)] font-normal ml-2">
                  ({new Date(trace.createdAt).toLocaleString()})
                </span>
              </h2>
            </div>
          </div>
          
          {/* Duration badge */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 text-purple-400" />
              <span className="text-xs md:text-sm font-medium text-purple-400">{formatDuration(trace.trace.duration)}</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1 md:p-1.5 hover:bg-[var(--surface-tertiary)] rounded-lg transition-colors"
            >
              <X className="h-4 w-4 md:h-5 md:w-5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>
        
        {/* Header Row 2 - Stats Badges */}
        <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]/50 flex-wrap overflow-x-auto">
          {/* Model Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <Cpu className="h-3 w-3 md:h-3.5 md:w-3.5 text-blue-400" />
            <span className="text-[10px] md:text-xs font-medium text-blue-400 truncate max-w-[100px] md:max-w-none">{trace.trace.modelName}</span>
          </div>
          
          {/* Input Tokens Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-[var(--surface-tertiary)] rounded-md">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] md:text-xs text-[var(--text-secondary)]">{formatTokens(trace.trace.inputTokens)}</span>
            <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] hidden md:inline">input</span>
          </div>
          
          {/* Output Tokens Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-[var(--surface-tertiary)] rounded-md">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500" />
            <span className="text-[10px] md:text-xs text-[var(--text-secondary)]">{formatTokens(trace.trace.outputTokens)}</span>
            <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] hidden md:inline">output</span>
          </div>
          
          {/* Total Tokens Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <Zap className="h-3 w-3 md:h-3.5 md:w-3.5 text-yellow-500" />
            <span className="text-[10px] md:text-xs font-medium text-yellow-500">{formatTokens(trace.trace.totalTokens)}</span>
          </div>
          
          {/* Cost Badge */}
          <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-green-500/10 border border-green-500/20 rounded-md">
            <DollarSign className="h-3 w-3 md:h-3.5 md:w-3.5 text-green-500" />
            <span className="text-[10px] md:text-xs font-medium text-green-500">{formatCost(trace.trace.totalCost)}</span>
          </div>
          
          {/* Cache Badge - only show if caching is active */}
          {trace.trace.caching?.enabled && (
            <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-purple-500/10 border border-purple-500/20 rounded-md" title={`Cache: ${trace.trace.caching.readTokens?.toLocaleString() || 0} read, ${trace.trace.caching.writeTokens?.toLocaleString() || 0} write | Savings: $${trace.trace.caching.estimatedSavings?.toFixed(4) || '0.0000'}`}>
              <Zap className="h-3 w-3 md:h-3.5 md:w-3.5 text-purple-400" />
              <span className="text-[10px] md:text-xs font-medium text-purple-400">
                {trace.trace.caching.hitRatio > 0 ? `${trace.trace.caching.hitRatio}% cached` : 'Cached'}
              </span>
            </div>
          )}
          
          {/* Token bar - fills remaining space, hidden on mobile */}
          <div className="hidden md:flex flex-1 min-w-[80px] h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden ml-2" title={`Input: ${trace.trace.inputTokens?.toLocaleString() || 0} | Output: ${trace.trace.outputTokens?.toLocaleString() || 0}${trace.trace.caching?.enabled ? ` | Cache Write: ${trace.trace.caching.writeTokens?.toLocaleString() || 0} | Cache Read: ${trace.trace.caching.readTokens?.toLocaleString() || 0}` : ''}`}>
            <div
              className="h-full bg-blue-500"
              style={{ width: `${trace.trace.totalTokens > 0 ? (trace.trace.inputTokens / trace.trace.totalTokens) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-green-500"
              style={{ width: `${trace.trace.totalTokens > 0 ? (trace.trace.outputTokens / trace.trace.totalTokens) * 100 : 0}%` }}
            />
            {/* Cache tokens in purple */}
            {trace.trace.caching?.enabled && (
              <>
                <div
                  className="h-full bg-purple-600"
                  style={{ width: `${trace.trace.totalTokens > 0 ? ((trace.trace.caching.writeTokens || 0) / trace.trace.totalTokens) * 100 : 0}%` }}
                  title={`Cache Write: ${trace.trace.caching.writeTokens?.toLocaleString() || 0}`}
                />
                <div
                  className="h-full bg-purple-400"
                  style={{ width: `${trace.trace.totalTokens > 0 ? ((trace.trace.caching.readTokens || 0) / trace.trace.totalTokens) * 100 : 0}%` }}
                  title={`Cache Read: ${trace.trace.caching.readTokens?.toLocaleString() || 0}`}
                />
              </>
            )}
          </div>
        </div>

        {/* Main Content - Split View on desktop, stacked on mobile */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Navigation Tree - Collapsible on mobile */}
          <div className="md:w-56 lg:w-64 flex flex-col border-b md:border-b-0 md:border-r border-[var(--border-light)] bg-[var(--surface-secondary)]/30">
            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-2 md:p-3 max-h-[200px] md:max-h-none">
              <div className="text-[9px] md:text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 py-1 mb-1">
                Trace Flow
              </div>
              {renderTreeNode(tree)}
            </div>
            
            {/* Token & Cost Breakdown - hidden on mobile */}
            <div className="hidden md:block p-2 border-t border-[var(--border-light)] bg-[var(--surface-secondary)]/70">
              <div className="space-y-2">
                {/* Token Breakdown */}
                <div>
                  <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Token Breakdown</span>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <div className="flex justify-between items-center group">
                      <span className="text-blue-400 flex items-center gap-1">
                        Input
                        <span className="relative">
                          <Info className="h-3 w-3 text-blue-400/60 cursor-help" />
                          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl" style={{ minWidth: '200px' }}>
                            {trace.trace?.tokenBreakdown ? (
                              <span className="flex flex-col gap-0.5">
                                <span className="font-semibold text-white mb-1 text-[11px]">📊 Context Breakdown</span>
                                {trace.trace.tokenBreakdown.instructions != null && trace.trace.tokenBreakdown.instructions > 0 && (
                                  <span className="flex justify-between"><span>📝 Instructions</span><span className="text-white">{trace.trace.tokenBreakdown.instructions.toLocaleString()}</span></span>
                                )}
                                {trace.trace.tokenBreakdown.artifacts != null && trace.trace.tokenBreakdown.artifacts > 0 && (
                                  <span className="flex justify-between"><span>🎨 Artifacts</span><span className="text-white">{trace.trace.tokenBreakdown.artifacts.toLocaleString()}</span></span>
                                )}
                                {/* Per-tool breakdown */}
                                {trace.trace.tokenBreakdown.toolsDetail && trace.trace.tokenBreakdown.toolsDetail.length > 0 && (
                                  <>
                                    {/* Separate core tools from MCP tools */}
                                    {(() => {
                                      const coreTools = trace.trace.tokenBreakdown.toolsDetail.filter((t: { name: string }) => !t.name.includes('_mcp_'));
                                      const mcpTools = trace.trace.tokenBreakdown.toolsDetail.filter((t: { name: string }) => t.name.includes('_mcp_'));
                                      return (
                                        <>
                                          {coreTools.length > 0 && (
                                            <>
                                              <span className="font-medium text-white mt-1.5 mb-0.5 text-[10px]">🔧 Core Tools ({coreTools.length})</span>
                                              {coreTools.map((tool: { name: string; tokens: number }, idx: number) => (
                                                <span key={idx} className="flex justify-between pl-2"><span className="text-gray-300">• {tool.name}</span><span className="text-white">{tool.tokens.toLocaleString()}</span></span>
                                              ))}
                                            </>
                                          )}
                                          {mcpTools.length > 0 && (
                                            <>
                                              <span className="font-medium text-cyan-400 mt-1.5 mb-0.5 text-[10px]">🔌 MCP Tools ({mcpTools.length})</span>
                                              {mcpTools.map((tool: { name: string; tokens: number }, idx: number) => (
                                                <span key={idx} className="flex justify-between pl-2"><span className="text-cyan-300">• {tool.name.replace('_mcp_', ' → ')}</span><span className="text-white">{tool.tokens.toLocaleString()}</span></span>
                                              ))}
                                            </>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </>
                                )}
                                {/* Per-tool context breakdown */}
                                {trace.trace.tokenBreakdown.toolContextDetail && trace.trace.tokenBreakdown.toolContextDetail.length > 0 && (
                                  <>
                                    <span className="font-medium text-white mt-1.5 mb-0.5 text-[10px]">📋 Tool Instructions</span>
                                    {trace.trace.tokenBreakdown.toolContextDetail.map((ctx, idx) => (
                                      <span key={idx} className="flex justify-between pl-2"><span className="text-gray-300">• {ctx.name}</span><span className="text-white">{ctx.tokens.toLocaleString()}</span></span>
                                    ))}
                                  </>
                                )}
                                <span className="border-t border-gray-600 pt-1.5 mt-1.5 flex flex-col gap-0.5">
                                  <span className="flex justify-between font-medium"><span className="text-gray-300">Tracked</span><span className="text-white">{(trace.trace.tokenBreakdown.total || 0).toLocaleString()}</span></span>
                                  <span className="flex justify-between text-gray-400"><span>Other (system, history, formatting)</span><span>{((trace.trace?.inputTokens || 0) - (trace.trace.tokenBreakdown.total || 0)).toLocaleString()}</span></span>
                                  <span className="text-[9px] text-gray-500 pl-2 flex flex-col gap-0">
                                    <span>• System prompt (persona, instructions)</span>
                                    <span>• Conversation history</span>
                                    <span>• User message & formatting</span>
                                  </span>
                                  <span className="flex justify-between font-semibold text-blue-400"><span>Total Input</span><span>{(trace.trace?.inputTokens || 0).toLocaleString()}</span></span>
                                </span>
                              </span>
                            ) : (
                              <span>Tokens sent to the model</span>
                            )}
                          </span>
                        </span>
                      </span>
                      <span className="text-[var(--text-secondary)]">{(trace.trace?.inputTokens || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-400">Output</span>
                      <span className="text-[var(--text-secondary)]">{(trace.trace?.outputTokens || 0).toLocaleString()}</span>
                    </div>
                    {trace.trace?.caching?.enabled && (
                      <>
                        <div className="flex justify-between items-center group">
                          <span className="text-purple-400 flex items-center gap-1">
                            Cache Write
                            <span className="relative">
                              <Info className="h-3 w-3 text-purple-400/60 cursor-help" />
                              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[var(--surface-tertiary)] border border-[var(--border-medium)] rounded-lg px-3 py-2 text-[10px] text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                Tokens written to cache for reuse in future requests
                              </span>
                            </span>
                          </span>
                          <span className="text-[var(--text-secondary)]">{(trace.trace.caching.writeTokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                          <span className="text-purple-400 flex items-center gap-1">
                            Cache Read
                            <span className="relative">
                              <Info className="h-3 w-3 text-purple-400/60 cursor-help" />
                              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[var(--surface-tertiary)] border border-[var(--border-medium)] rounded-lg px-3 py-2 text-[10px] text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                Tokens served from cache (not re-processed)
                              </span>
                            </span>
                          </span>
                          <span className="text-[var(--text-secondary)]">{(trace.trace.caching.readTokens || 0).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-medium pt-1 border-t border-[var(--border-light)]">
                      <span className="text-[var(--text-primary)]">Total</span>
                      <span className="text-[var(--text-primary)]">{(trace.trace?.totalTokens || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                {/* Cost Breakdown */}
                <div className="pt-2 mt-2 border-t border-[var(--border-light)]">
                  <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Cost Breakdown</span>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-blue-400">Input</span>
                      <span className="text-[var(--text-secondary)]">${(trace.trace?.inputCost || 0).toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-400">Output</span>
                      <span className="text-[var(--text-secondary)]">${(trace.trace?.outputCost || 0).toFixed(6)}</span>
                    </div>
                    {trace.trace?.caching?.enabled && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-purple-400">Cache Write</span>
                          <span className="text-[var(--text-secondary)]">${(trace.trace.caching.writeCost || 0).toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-400">Cache Read</span>
                          <span className="text-[var(--text-secondary)]">${(trace.trace.caching.readCost || 0).toFixed(6)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-medium pt-1 border-t border-[var(--border-light)]">
                      <span className="text-green-400">Total Cost</span>
                      <span className="text-green-400">${(trace.trace?.totalCost || 0).toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 md:p-5">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* Full-width Footer */}
        <div className="px-2 py-1 border-t border-[var(--border-light)] bg-[var(--surface-secondary)]/50">
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="text-[var(--text-tertiary)]">Trace ID:</span>
              <code className="text-[9px] text-[var(--text-secondary)] font-mono truncate max-w-[200px]">{trace.messageId}</code>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[var(--text-tertiary)]">User:</span>
              <span className="text-[var(--text-secondary)]">{trace.user?.name || trace.user?.email || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[var(--text-tertiary)]">Model:</span>
              <code className="text-[9px] text-[var(--text-secondary)] font-mono">{trace.trace.model}</code>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// Main TracesPage component
export function TracesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<LLMTracesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<LLMTrace | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // User list for filter
  const [users, setUsers] = useState<UserOption[]>([]);
  
  // Filters - initialize from URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedModel, setSelectedModel] = useState<string>(searchParams.get('model') || '');
  const [selectedUserId, setSelectedUserId] = useState<string>(searchParams.get('userId') || '');
  const [conversationIdFilter, setConversationIdFilter] = useState<string>(searchParams.get('conversationId') || '');
  const [selectedAgent, setSelectedAgent] = useState<string>(searchParams.get('agent') || '');
  const [guardrailsFilter, setGuardrailsFilter] = useState<string>(searchParams.get('guardrails') || '');
  const [toolNameFilter, setToolNameFilter] = useState<string>(searchParams.get('toolName') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedModel) params.set('model', selectedModel);
    if (selectedUserId) params.set('userId', selectedUserId);
    if (conversationIdFilter) params.set('conversationId', conversationIdFilter);
    if (selectedAgent) params.set('agent', selectedAgent);
    if (guardrailsFilter) params.set('guardrails', guardrailsFilter);
    if (toolNameFilter) params.set('toolName', toolNameFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedModel, selectedUserId, conversationIdFilter, selectedAgent, guardrailsFilter, toolNameFilter, page, setSearchParams]);

  // Fetch users for filter dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await usersApi.list({ limit: 500 });
        setUsers(
          response.users.map(u => ({
            id: u._id,
            name: u.name || u.username || 'Unknown',
            email: u.email,
          }))
        );
      } catch (err) {
        console.error('Failed to fetch users for filter:', err);
      }
    };
    fetchUsers();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await tracesApi.getTraces({
        page,
        limit: 50,
        model: selectedModel || undefined,
        userId: selectedUserId || undefined,
        conversationId: conversationIdFilter || undefined,
        agent: selectedAgent || undefined,
        guardrails: guardrailsFilter || undefined,
        toolName: toolNameFilter || undefined,
      });
      setData(response);
      setError(null);
    } catch (err) {
      setError('Failed to load traces');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedModel, selectedUserId, conversationIdFilter, selectedAgent, guardrailsFilter, toolNameFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDrawer = (trace: LLMTrace) => {
    setSelectedTrace(trace);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTrace(null);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const truncateText = (text: string, maxLen: number = 80) => {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  };

  // Filter traces by search query and guardrails (local filter on top of server filters)
  const filteredTraces = (data?.traces || []).filter(trace => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        (trace.input?.text || '').toLowerCase().includes(query) ||
        (trace.output?.text || '').toLowerCase().includes(query) ||
        (trace.conversationTitle || '').toLowerCase().includes(query) ||
        trace.user?.name?.toLowerCase().includes(query) ||
        trace.user?.email?.toLowerCase().includes(query) ||
        trace.conversationId?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }
    
    // Guardrails filter (local since not in API yet)
    if (guardrailsFilter) {
      const hasGuardrails = trace.guardrails?.invoked;
      const wasBlocked = trace.guardrails?.input?.outcome === 'blocked' || trace.guardrails?.output?.outcome === 'blocked';
      const wasAnonymized = trace.guardrails?.output?.outcome === 'anonymized';
      
      switch (guardrailsFilter) {
        case 'invoked':
          if (!hasGuardrails) return false;
          break;
        case 'blocked':
          if (!wasBlocked) return false;
          break;
        case 'anonymized':
          if (!wasAnonymized) return false;
          break;
        case 'passed':
          if (!hasGuardrails || wasBlocked || wasAnonymized) return false;
          break;
      }
    }
    
    return true;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedModel('');
    setSelectedUserId('');
    setConversationIdFilter('');
    setSelectedAgent('');
    setGuardrailsFilter('');
    setToolNameFilter('');
    setPage(1);
  };

  const hasActiveFilters = selectedModel || selectedUserId || conversationIdFilter || searchQuery || selectedAgent || guardrailsFilter || toolNameFilter;

  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-500" />
            LLM Observability
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Monitor all LLM traces with input/output pairs, token usage, and costs
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchData}
          disabled={loading}
          className="border-[var(--border-light)]"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[var(--surface-primary)] rounded-lg border border-[var(--border-light)] p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">{(data.summary?.totalTraces || 0).toLocaleString()}</p>
                <p className="text-xs text-[var(--text-secondary)]">Total Traces</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--surface-primary)] rounded-lg border border-[var(--border-light)] p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
                <Cpu className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">{(data.filters?.models || []).length}</p>
                <p className="text-xs text-[var(--text-secondary)]">Models Used</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--surface-primary)] rounded-lg border border-[var(--border-light)] p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/20">
                <Zap className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  {filteredTraces.reduce((sum, t) => sum + (t.trace?.totalTokens || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Tokens (This Page)</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--surface-primary)] rounded-lg border border-[var(--border-light)] p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20">
                <DollarSign className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  ${filteredTraces.reduce((sum, t) => sum + (t.trace?.totalCost || 0), 0).toFixed(4)}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Cost (This Page)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[var(--surface-primary)] rounded-lg border border-[var(--border-light)] p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search by content, user, or conversation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* User Filter */}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--text-tertiary)]" />
              <select
                value={selectedUserId}
                onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)] min-w-[180px]"
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                ))}
              </select>
            </div>
            
            {/* Model Filter */}
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[var(--text-tertiary)]" />
              <select
                value={selectedModel}
                onChange={(e) => { setSelectedModel(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)] min-w-[150px]"
              >
                <option value="">All Models</option>
                {(data?.filters?.models || []).map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Second row of filters */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Conversation ID Filter */}
            <div className="flex items-center gap-2 flex-1">
              <MessageCircle className="h-4 w-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Filter by Conversation ID..."
                value={conversationIdFilter}
                onChange={(e) => { setConversationIdFilter(e.target.value); setPage(1); }}
                className="flex-1 max-w-xs px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            
            {/* Agent Filter */}
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Agent ID..."
                value={selectedAgent}
                onChange={(e) => { setSelectedAgent(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm min-w-[140px]"
              />
            </div>
            
            {/* Guardrails Filter */}
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--text-tertiary)]" />
              <select
                value={guardrailsFilter}
                onChange={(e) => { setGuardrailsFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)] min-w-[140px]"
              >
                <option value="">All Guardrails</option>
                <option value="invoked">Guardrails Invoked</option>
                <option value="blocked">Blocked</option>
                <option value="anonymized">Anonymized</option>
                <option value="passed">Passed</option>
              </select>
            </div>
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner className="text-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center text-red-400 py-8">{error}</div>
      ) : (
        <>
          {/* Traces Table - Horizontally scrollable on mobile */}
          <div className="bg-[var(--surface-primary)] rounded-lg border border-[var(--border-light)] overflow-hidden">
            <div className="overflow-x-auto">
              {/* Table Header */}
              <div className="px-3 py-2 border-b border-[var(--border-light)] bg-[var(--surface-secondary)] min-w-[900px]">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  <span className="col-span-2">User</span>
                  <span className="col-span-2">Conversation</span>
                  <span className="col-span-3">Input / Output</span>
                  <span className="col-span-1 text-center">Model</span>
                  <span className="col-span-1 text-right">Tokens</span>
                  <span className="col-span-1 text-right">Cost</span>
                  <span className="col-span-1">Flags</span>
                  <span className="col-span-1 text-right">Time</span>
                </div>
              </div>

              {/* Traces */}
              <div className="divide-y divide-[var(--border-light)] min-w-[900px]">
                {filteredTraces.length === 0 ? (
                  <div className="text-center text-[var(--text-tertiary)] py-12">
                    No traces found
                  </div>
                ) : (
                  filteredTraces.map((trace) => (
                    <div
                      key={trace.id}
                      className="px-3 py-2 grid grid-cols-12 gap-3 items-center hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                      onClick={() => openDrawer(trace)}
                    >
                    {/* User */}
                    <div className="col-span-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 flex-shrink-0">
                          <User className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {trace.user?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)] truncate">
                            {trace.user?.email || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Conversation */}
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate" title={trace.conversationTitle}>
                        {trace.conversationTitle}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] font-mono truncate" title={trace.conversationId}>
                        {trace.conversationId?.substring(0, 12)}...
                      </p>
                    </div>

                    {/* Input/Output Preview */}
                    <div className="col-span-3 min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-blue-400 font-medium mt-0.5 flex-shrink-0">IN:</span>
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            {truncateText(trace.input?.text, 50) || <span className="italic text-[var(--text-tertiary)]">Empty</span>}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-green-400 font-medium mt-0.5 flex-shrink-0">OUT:</span>
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            {truncateText(trace.output?.text, 50) || <span className="italic text-[var(--text-tertiary)]">Empty</span>}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Model */}
                    <div className="col-span-1 text-center">
                      <span className="inline-flex px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-medium truncate max-w-full" title={trace.trace.modelName}>
                        {trace.trace.modelName?.split(' ').pop() || trace.trace.model?.split(':')[0]}
                      </span>
                    </div>

                    {/* Tokens */}
                    <div className="col-span-1 text-right">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {(trace.trace?.totalTokens || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        <span className="text-blue-400">{(trace.trace?.inputTokens || 0).toLocaleString()}</span>
                        {' / '}
                        <span className="text-green-400">{(trace.trace?.outputTokens || 0).toLocaleString()}</span>
                        {/* Show cache indicator if caching active */}
                        {trace.trace?.caching?.enabled && (
                          <span className="text-purple-400 ml-1" title={`Cache: ${trace.trace.caching.readTokens?.toLocaleString() || 0} read, ${trace.trace.caching.writeTokens?.toLocaleString() || 0} write`}>
                            ⚡{trace.trace.caching.hitRatio > 0 ? `${trace.trace.caching.hitRatio}%` : ''}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Cost */}
                    <div className="col-span-1 text-right">
                      <p className="text-sm font-semibold text-green-400">
                        ${(trace.trace?.totalCost || 0).toFixed(4)}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        ${(trace.trace?.inputCost || 0).toFixed(4)} / ${(trace.trace?.outputCost || 0).toFixed(4)}
                      </p>
                    </div>

                    {/* Flags */}
                    <div className="col-span-1">
                      <div className="flex flex-wrap gap-1">
                        {/* Guardrails flags */}
                        {trace.guardrails?.invoked && (
                          <>
                            {/* Input blocked */}
                            {trace.guardrails.input?.outcome === 'blocked' && (
                              <span 
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                  trace.guardrails.input.actionApplied 
                                    ? 'bg-red-500/20 text-red-400' 
                                    : 'bg-yellow-500/20 text-yellow-400'
                                }`}
                                title={`Input ${trace.guardrails.input.actionApplied ? 'Blocked' : 'Would Block'}: ${trace.guardrails.input.violations?.map(v => v.category).join(', ') || 'Policy violation'}`}
                              >
                                <ShieldX className="h-3 w-3" />
                                <span>IN</span>
                              </span>
                            )}
                            {/* Output blocked */}
                            {trace.guardrails.output?.outcome === 'blocked' && (
                              <span 
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                  trace.guardrails.output.actionApplied 
                                    ? 'bg-red-500/20 text-red-400' 
                                    : 'bg-yellow-500/20 text-yellow-400'
                                }`}
                                title={`Output ${trace.guardrails.output.actionApplied ? 'Blocked' : 'Would Block'}: ${trace.guardrails.output.violations?.map(v => v.category).join(', ') || 'Policy violation'}`}
                              >
                                <ShieldX className="h-3 w-3" />
                                <span>OUT</span>
                              </span>
                            )}
                            {/* Output anonymized */}
                            {trace.guardrails.output?.outcome === 'anonymized' && (
                              <span 
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                  trace.guardrails.output.actionApplied 
                                    ? 'bg-blue-500/20 text-blue-400' 
                                    : 'bg-yellow-500/20 text-yellow-400'
                                }`}
                                title={`PII ${trace.guardrails.output.actionApplied ? 'Anonymized' : 'Would Anonymize'}: ${trace.guardrails.output.violations?.map(v => v.category).join(', ') || 'Sensitive data'}`}
                              >
                                <ShieldAlert className="h-3 w-3" />
                              </span>
                            )}
                            {/* Intervened */}
                            {(trace.guardrails.input?.outcome === 'intervened' || trace.guardrails.output?.outcome === 'intervened') && (
                              <span 
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs"
                                title="Guardrail Intervened"
                              >
                                <Shield className="h-3 w-3" />
                              </span>
                            )}
                          </>
                        )}
                        {trace.trace?.thinking && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs" title="Extended Thinking">
                            <Brain className="h-3 w-3" />
                          </span>
                        )}
                        {trace.trace?.toolCalls && trace.trace.toolCalls.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs" title={`${trace.trace.toolCalls.length} Tool Calls`}>
                            <Wrench className="h-3 w-3" />
                            <span>{trace.trace.toolCalls.length}</span>
                          </span>
                        )}
                        {!trace.guardrails?.invoked && !trace.trace?.thinking && (!trace.trace?.toolCalls || trace.trace.toolCalls.length === 0) && (
                          <span className="text-xs text-[var(--text-tertiary)]">—</span>
                        )}
                      </div>
                    </div>

                      {/* Time */}
                      <div className="col-span-1 text-right">
                        <p className="text-sm text-[var(--text-primary)]">{formatTime(trace.createdAt)}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{formatDate(trace.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {data && data.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total traces)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!data.pagination.hasPrev}
                  onClick={() => setPage(p => p - 1)}
                  className="border-[var(--border-light)]"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data.pagination.hasNext}
                  onClick={() => setPage(p => p + 1)}
                  className="border-[var(--border-light)]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Trace Drawer */}
      <TraceDrawer trace={selectedTrace} isOpen={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}
