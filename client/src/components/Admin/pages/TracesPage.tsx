import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  Filter,
  Info,
  MessageCircle,
  MessageSquare,
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
import { Button } from '@ranger/client';
import { tracesApi, usersApi, conversationsApi, type LLMTrace, type LLMTracesResponse, type Conversation, type ConversationMessage } from '../services/adminApi';
import { 
  TracesPageSkeleton, 
  StatsGridSkeleton, 
  TracesTableSkeleton 
} from '../components/Skeletons';

// Drawer component for trace details
interface TraceDrawerProps {
  trace: LLMTrace | null;
  isOpen: boolean;
  onClose: () => void;
}

// Tab types for drawer
type DrawerTab = 'trace' | 'conversation';

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
  const [activeTab, setActiveTab] = useState<DrawerTab>('trace');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);

  // Reset selection when trace changes
  useEffect(() => {
    if (trace) {
      setSelectedNode('trace');
      setExpandedNodes(new Set(['trace']));
      setActiveTab('trace');
      setConversation(null);
    }
  }, [trace?.id]);

  // Load conversation when conversation tab is selected
  useEffect(() => {
    const loadConversation = async () => {
      if (activeTab === 'conversation' && trace?.conversationId && !conversation) {
        try {
          setConversationLoading(true);
          const conv = await conversationsApi.getById(trace.conversationId, true);
          setConversation(conv);
        } catch (err) {
          console.error('Failed to load conversation:', err);
        } finally {
          setConversationLoading(false);
        }
      }
    };
    loadConversation();
  }, [activeTab, trace?.conversationId, conversation]);

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
                <div className={`flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded ${trace.error?.isError ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                  {trace.error?.isError ? (
                    <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-red-400" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
                  )}
                </div>
                <h3 className={`font-medium text-xs md:text-sm ${trace.error?.isError ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                  {trace.error?.isError ? 'Error' : 'Response'}
                </h3>
              </div>
              {trace.error?.isError ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 md:p-4">
                  <div className="text-red-400 text-xs md:text-sm">
                    <p className="font-medium mb-1">Error occurred during processing:</p>
                    <p className="text-red-300">{trace.error.message}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {trace.output?.text || '_No output text_'}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
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
              <div className={`flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded ${trace.error?.isError ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                {trace.error?.isError ? (
                  <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-red-400" />
                ) : (
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-green-400" />
                )}
              </div>
              <div>
                <h3 className={`font-medium text-xs md:text-sm ${trace.error?.isError ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                  {trace.error?.isError ? 'Error Response' : 'AI Response'}
                </h3>
                <p className="text-[10px] md:text-xs text-[var(--text-tertiary)]">
                  {trace.trace.modelName} • {trace.output?.tokenCount || 0} tokens
                </p>
              </div>
            </div>
            {trace.error?.isError ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 md:p-4">
                <div className="text-red-400 text-xs md:text-sm">
                  <p className="font-medium mb-1">Error occurred during processing:</p>
                  <p className="text-red-300">{trace.error.message}</p>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--surface-secondary)] rounded-lg p-3 md:p-4 border border-[var(--border-light)]">
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs md:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {trace.output?.text || '_No output text_'}
                  </ReactMarkdown>
                </div>
              </div>
            )}
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
      
      {/* Drawer Container with Vertical Tabs */}
      <div 
        className="fixed right-0 top-0 h-screen flex"
        style={{ zIndex: 9999 }}
      >
        {/* Vertical Folder Tabs - Physical folder style */}
        <div className="flex flex-col pt-14 -mr-px" style={{ zIndex: 10000 }}>
          {/* Traces Tab */}
          <button
            onClick={() => setActiveTab('trace')}
            className="relative flex items-center justify-center transition-all"
            style={{ 
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              width: '24px',
              height: '72px',
              clipPath: 'polygon(100% 0, 100% 100%, 0 100%, 0 12px, 12px 0)',
              background: activeTab === 'trace' 
                ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' 
                : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
              color: activeTab === 'trace' ? '#e0e7ff' : '#9ca3af',
              boxShadow: activeTab === 'trace' 
                ? '-4px 0 12px rgba(79,70,229,0.25)' 
                : '-1px 0 4px rgba(0,0,0,0.15)',
              marginBottom: '-1px',
              zIndex: activeTab === 'trace' ? 10 : 1,
              transform: activeTab === 'trace' ? 'translateX(-1px)' : 'translateX(0)',
            }}
          >
            <span className="text-[10px] font-medium tracking-wide" style={{ transform: 'rotate(180deg)' }}>TRACES</span>
          </button>
          
          {/* Conversation Tab */}
          <button
            onClick={() => setActiveTab('conversation')}
            className="relative flex items-center justify-center transition-all"
            style={{ 
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              width: '24px',
              height: '95px',
              clipPath: 'polygon(100% 0, 100% 100%, 0 100%, 0 12px, 12px 0)',
              background: activeTab === 'conversation' 
                ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' 
                : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
              color: activeTab === 'conversation' ? '#e0e7ff' : '#9ca3af',
              boxShadow: activeTab === 'conversation' 
                ? '-4px 0 12px rgba(79,70,229,0.25)' 
                : '-1px 0 4px rgba(0,0,0,0.15)',
              zIndex: activeTab === 'conversation' ? 10 : 1,
              transform: activeTab === 'conversation' ? 'translateX(-1px)' : 'translateX(0)',
            }}
          >
            <span className="text-[10px] font-medium tracking-wide" style={{ transform: 'rotate(180deg)' }}>CONVERSATION</span>
          </button>
        </div>
        
        {/* Main Drawer Panel */}
        <div 
          className="h-screen w-[calc(100vw-2rem)] md:w-[60vw] md:min-w-[800px] md:max-w-[1200px] bg-[var(--surface-primary)] border-l border-[var(--border-light)] flex flex-col shadow-2xl"
        >
          {/* Compact Header - Single Row */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-light)] bg-[var(--surface-secondary)]">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {activeTab === 'trace' ? (
                <Activity className="h-4 w-4 text-blue-400 flex-shrink-0" />
              ) : (
                <MessageSquare className="h-4 w-4 text-blue-400 flex-shrink-0" />
              )}
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">{trace.conversationTitle || 'Untitled'}</span>
              <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">({new Date(trace.createdAt).toLocaleString()})</span>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-xs">
                <Clock className="h-3 w-3 text-purple-400" />
                <span className="text-purple-400">{formatDuration(trace.trace.duration)}</span>
              </span>
              <button onClick={onClose} className="p-1 hover:bg-[var(--surface-tertiary)] rounded transition-colors">
                <X className="h-4 w-4 text-[var(--text-secondary)]" />
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'trace' ? (
            <>
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
                {(trace.trace.caching.hitRatio ?? 0) > 0 ? `${trace.trace.caching.hitRatio ?? 0}% cached` : 'Cached'}
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

        {/* Main Content - 3-Column Layout on desktop */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Column: Trace Flow Tree */}
          <div className="md:w-48 lg:w-56 flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[var(--border-light)] bg-[var(--surface-secondary)]/30">
            <div className="flex-1 overflow-y-auto p-2 md:p-3 max-h-[150px] md:max-h-none">
              <div className="text-[9px] md:text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 py-1 mb-1">
                Trace Flow
              </div>
              {renderTreeNode(tree)}
            </div>
          </div>

          {/* Middle Column: Content (Request/Response) */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-3 md:p-5">
              {renderContent()}
            </div>
          </div>

          {/* Right Column: Token, Cost, Context Analytics - matches left column width */}
          <div className="hidden lg:flex md:w-44 lg:w-52 flex-shrink-0 flex-col border-l border-[var(--border-light)] bg-[var(--surface-secondary)]/30 overflow-y-auto">
            <div className="p-3 space-y-3">
              {/* Token Breakdown */}
              <div>
                <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Token Breakdown</span>
                <div className="mt-1 space-y-0.5 text-xs">
                  <div className="flex justify-between items-center group">
                    <span className="text-blue-400 flex items-center gap-1">
                      Input
                      <span className="relative">
                        <Info className="h-3 w-3 text-blue-400/60 cursor-help" />
                        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl" style={{ minWidth: '280px', maxHeight: '500px', overflowY: 'auto' }}>
                          {trace.trace?.tokenBreakdown ? (
                            <span className="flex flex-col gap-0.5">
                              <span className="font-semibold text-white mb-1 text-[11px]">📊 Input Token Breakdown</span>
                              
                              {/* Prompts breakdown - if available */}
                              {trace.trace.tokenBreakdown.prompts && (
                                <>
                                  <span className="font-medium text-yellow-400 mt-1 mb-0.5 text-[10px] flex items-center gap-1">
                                    📜 System Prompts
                                    {trace.trace.caching?.enabled && <span className="text-purple-400 text-[8px]">(🔒 cached)</span>}
                                  </span>
                                  {trace.trace.tokenBreakdown.prompts.branding > 0 && (
                                    <span className="flex justify-between pl-2"><span className="text-gray-300">• Branding</span><span className="text-white">{trace.trace.tokenBreakdown.prompts.branding.toLocaleString()}</span></span>
                                  )}
                                  {trace.trace.tokenBreakdown.prompts.toolRouting > 0 && (
                                    <span className="flex justify-between pl-2"><span className="text-gray-300">• Tool Routing</span><span className="text-white">{trace.trace.tokenBreakdown.prompts.toolRouting.toLocaleString()}</span></span>
                                  )}
                                  {trace.trace.tokenBreakdown.prompts.agentInstructions > 0 && (
                                    <span className="flex justify-between pl-2"><span className="text-gray-300">• Agent Instructions</span><span className="text-white">{trace.trace.tokenBreakdown.prompts.agentInstructions.toLocaleString()}</span></span>
                                  )}
                                  {trace.trace.tokenBreakdown.prompts.mcpInstructions > 0 && (
                                    <span className="flex justify-between pl-2"><span className="text-cyan-300">• MCP Instructions</span><span className="text-white">{trace.trace.tokenBreakdown.prompts.mcpInstructions.toLocaleString()}</span></span>
                                  )}
                                  {trace.trace.tokenBreakdown.prompts.artifacts > 0 && (
                                    <span className="flex justify-between pl-2"><span className="text-gray-300">• Artifacts</span><span className="text-white">{trace.trace.tokenBreakdown.prompts.artifacts.toLocaleString()}</span></span>
                                  )}
                                  {trace.trace.tokenBreakdown.prompts.memory > 0 && (
                                    <span className="flex justify-between pl-2"><span className="text-purple-300">• Memory</span><span className="text-white">{trace.trace.tokenBreakdown.prompts.memory.toLocaleString()}</span></span>
                                  )}
                                </>
                              )}
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
                      <div className="flex justify-between">
                        <span className="text-purple-400">Cache Write</span>
                        <span className="text-[var(--text-secondary)]">{(trace.trace.caching.writeTokens || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-400">Cache Read</span>
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
              <div className="pt-2 border-t border-[var(--border-light)]">
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
              
              {/* Context Analytics */}
              {trace.trace?.contextAnalytics && (
                <div className="pt-3 border-t border-[var(--border-light)]">
                  <span className="text-[9px] md:text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1">
                    📊 Context Analytics
                  </span>
                  <div className="mt-2 space-y-3 text-xs">
                    
                    {/* Context Utilization */}
                    <div className="bg-[var(--surface-tertiary)]/50 rounded-lg p-2">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">Context Utilization</span>
                        <span className={`text-sm font-bold ${
                          trace.trace.contextAnalytics.utilizationPercent > 90 ? 'text-red-400' :
                          trace.trace.contextAnalytics.utilizationPercent > 75 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {trace.trace.contextAnalytics.utilizationPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            trace.trace.contextAnalytics.utilizationPercent > 90 ? 'bg-gradient-to-r from-red-600 to-red-400' :
                            trace.trace.contextAnalytics.utilizationPercent > 75 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
                            'bg-gradient-to-r from-green-600 to-green-400'
                          }`}
                          style={{ width: `${Math.min(trace.trace.contextAnalytics.utilizationPercent, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] mt-1">
                        <span className="text-[var(--text-secondary)] font-medium">{trace.trace.contextAnalytics.totalTokens.toLocaleString()}</span>
                        <span className="text-[var(--text-tertiary)]">max: {trace.trace.contextAnalytics.maxContextTokens.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[var(--surface-tertiary)]/30 rounded p-1.5">
                        <span className="text-[9px] text-[var(--text-tertiary)]">Messages</span>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{trace.trace.contextAnalytics.messageCount || 0}</div>
                      </div>
                      <div className="bg-[var(--surface-tertiary)]/30 rounded p-1.5">
                        <span className="text-[9px] text-[var(--text-tertiary)]">Instructions</span>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{(trace.trace.contextAnalytics.instructionTokens || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    
                    {/* Message Breakdown */}
                    {trace.trace.contextAnalytics.breakdown && Object.keys(trace.trace.contextAnalytics.breakdown).length > 0 && (
                      <div>
                        <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">Message Breakdown</span>
                        <div className="mt-1.5 space-y-1">
                          {Object.entries(trace.trace.contextAnalytics.breakdown)
                            .sort((a, b) => b[1].tokens - a[1].tokens)
                            .map(([type, data]) => (
                            <div key={type} className="flex items-center gap-2">
                              <span className={`text-[10px] w-12 font-medium ${
                                type === 'human' ? 'text-blue-400' :
                                type === 'ai' ? 'text-green-400' :
                                type === 'tool' ? 'text-orange-400' :
                                type === 'system' ? 'text-yellow-400' :
                                'text-gray-400'
                              }`}>{type}</span>
                              <div className="flex-1 h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    type === 'human' ? 'bg-blue-500' :
                                    type === 'ai' ? 'bg-green-500' :
                                    type === 'tool' ? 'bg-orange-500' :
                                    type === 'system' ? 'bg-yellow-500' : 'bg-gray-500'
                                  }`}
                                  style={{ width: `${data.percent}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-[var(--text-secondary)] w-20 text-right font-mono">
                                {data.tokens.toLocaleString()} ({data.percent.toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* TOON Compression */}
                    {trace.trace.contextAnalytics.toonStats && (
                      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-cyan-400">📦</span>
                          <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">TOON Compression</span>
                        </div>
                        {trace.trace.contextAnalytics.toonStats.compressedCount > 0 ? (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">Compressed</span>
                              <span className="text-cyan-400 font-medium">{trace.trace.contextAnalytics.toonStats.compressedCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">Reduction</span>
                              <span className="text-green-400 font-medium">{trace.trace.contextAnalytics.toonStats.avgReductionPercent?.toFixed(1) || 0}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">Chars Saved</span>
                              <span className="text-[var(--text-secondary)]">{(trace.trace.contextAnalytics.toonStats.charactersSaved || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-tertiary)]">Tokens Saved</span>
                              <span className="text-green-400 font-medium">~{(trace.trace.contextAnalytics.toonStats.tokensSaved || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--text-tertiary)]">No compression this turn</span>
                        )}
                      </div>
                    )}
                    
                    {/* Pruning Status */}
                    <div className={`rounded-lg p-2 ${
                      trace.trace.contextAnalytics.pruningApplied 
                        ? 'bg-amber-500/10 border border-amber-500/30' 
                        : 'bg-[var(--surface-tertiary)]/30'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span>{trace.trace.contextAnalytics.pruningApplied ? '✂️' : '📋'}</span>
                        <span className={`text-[10px] font-medium uppercase tracking-wider ${
                          trace.trace.contextAnalytics.pruningApplied ? 'text-amber-400' : 'text-[var(--text-tertiary)]'
                        }`}>Pruning</span>
                      </div>
                      {trace.trace.contextAnalytics.pruningApplied ? (
                        <span className="text-[10px] text-amber-400">{trace.trace.contextAnalytics.messagesPruned || 0} messages pruned</span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-tertiary)]">No pruning needed</span>
                      )}
                    </div>
                    
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

              {/* Trace Footer */}
              <div className="px-2 py-1 border-t border-[var(--border-light)] bg-[var(--surface-secondary)]/50">
                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--text-tertiary)]">Trace ID:</span>
                    <code className="text-[9px] text-[var(--text-secondary)] font-mono truncate max-w-[200px]">{trace.messageId}</code>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--text-tertiary)]">User:</span>
                    {trace.user?._id ? (
                      <Link 
                        to={`/admin/users/${trace.user._id}`}
                        className="text-[var(--text-secondary)] hover:text-blue-400 hover:underline transition-colors cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {trace.user?.name || trace.user?.email || 'Unknown'}
                      </Link>
                    ) : (
                      <span className="text-[var(--text-secondary)]">{trace.user?.name || trace.user?.email || 'Unknown'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--text-tertiary)]">Model:</span>
                    <code className="text-[9px] text-[var(--text-secondary)] font-mono">{trace.trace.model}</code>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Conversation Tab Content */
            <div className="flex-1 flex flex-col overflow-hidden">
              {conversationLoading ? (
                /* Skeleton Loading */
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
                  {/* User message skeleton */}
                  <div className="flex justify-end">
                    <div className="max-w-[75%] rounded-xl p-4 bg-blue-600/30 animate-pulse">
                      <div className="h-3 w-16 bg-blue-400/30 rounded mb-2" />
                      <div className="h-4 w-48 bg-blue-400/30 rounded mb-1" />
                      <div className="h-4 w-32 bg-blue-400/30 rounded" />
                    </div>
                  </div>
                  {/* AI message skeleton */}
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-xl p-4 bg-[var(--surface-tertiary)] animate-pulse">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-16 bg-[var(--surface-secondary)] rounded" />
                        <div className="h-3 w-20 bg-[var(--surface-secondary)] rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-[var(--surface-secondary)] rounded" />
                        <div className="h-4 w-full bg-[var(--surface-secondary)] rounded" />
                        <div className="h-4 w-3/4 bg-[var(--surface-secondary)] rounded" />
                        <div className="h-4 w-full bg-[var(--surface-secondary)] rounded" />
                        <div className="h-4 w-2/3 bg-[var(--surface-secondary)] rounded" />
                      </div>
                      <div className="h-3 w-32 bg-[var(--surface-secondary)] rounded mt-3" />
                    </div>
                  </div>
                  {/* User message skeleton */}
                  <div className="flex justify-end">
                    <div className="max-w-[75%] rounded-xl p-4 bg-blue-600/30 animate-pulse">
                      <div className="h-3 w-16 bg-blue-400/30 rounded mb-2" />
                      <div className="h-4 w-64 bg-blue-400/30 rounded" />
                    </div>
                  </div>
                  {/* AI message skeleton */}
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-xl p-4 bg-[var(--surface-tertiary)] animate-pulse">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-16 bg-[var(--surface-secondary)] rounded" />
                        <div className="h-3 w-24 bg-[var(--surface-secondary)] rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-[var(--surface-secondary)] rounded" />
                        <div className="h-4 w-full bg-[var(--surface-secondary)] rounded" />
                        <div className="h-4 w-1/2 bg-[var(--surface-secondary)] rounded" />
                      </div>
                      <div className="h-3 w-32 bg-[var(--surface-secondary)] rounded mt-3" />
                    </div>
                  </div>
                </div>
              ) : conversation ? (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
                    {/* Info bar */}
                    <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--surface-secondary)]/50 rounded-lg text-[10px] text-[var(--text-tertiary)]">
                      <div className="flex items-center gap-2">
                        {conversation.hasErrors && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
                            <AlertTriangle className="h-3 w-3" />
                            {conversation.errorCount} error{conversation.errorCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span>{conversation.messages?.length || 0} messages</span>
                        <span>•</span>
                        <span>{conversation.model?.split('/').pop() || conversation.endpoint}</span>
                      </div>
                      <span>{new Date(conversation.createdAt).toLocaleDateString()}</span>
                    </div>

                    {conversation.messages?.map((msg, idx) => (
                      <div
                        key={msg.messageId || idx}
                        className={`flex ${msg.isCreatedByUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-[75%] rounded-xl p-3 md:p-4 ${
                            msg.isCreatedByUser
                              ? 'bg-blue-600 text-white'
                              : msg.isError || msg.error
                              ? 'bg-red-500/10 border border-red-500/30 text-[var(--text-primary)]'
                              : 'bg-[var(--surface-tertiary)] text-[var(--text-primary)]'
                          }`}
                        >
                          {/* Message Header */}
                          <div className="flex items-center gap-2 mb-2">
                            {(msg.isError || msg.error) && !msg.isCreatedByUser && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                            )}
                            <span className={`text-[10px] md:text-xs font-medium ${
                              msg.isCreatedByUser ? 'text-blue-200' : msg.isError || msg.error ? 'text-red-400' : 'text-[var(--text-tertiary)]'
                            }`}>
                              {msg.sender}
                              {(msg.isError || msg.error) && !msg.isCreatedByUser && ' - Error'}
                            </span>
                            {msg.tokenCount && (
                              <span className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded ${
                                msg.isCreatedByUser ? 'bg-blue-500/30 text-blue-200' : 'bg-[var(--surface-secondary)] text-[var(--text-tertiary)]'
                              }`}>
                                {msg.tokenCount} tokens
                              </span>
                            )}
                          </div>
                          
                          {/* Message Text */}
                          <p className={`text-xs md:text-sm whitespace-pre-wrap leading-relaxed ${
                            (msg.isError || msg.error) && !msg.isCreatedByUser ? 'text-red-300' : ''
                          }`}>{msg.text || (msg.errorMessage ? msg.errorMessage : '_No message text_')}</p>
                          
                          {/* Timestamp */}
                          <p className={`text-[10px] md:text-xs mt-2 ${
                            msg.isCreatedByUser ? 'text-blue-200' : 'text-[var(--text-tertiary)]'
                          }`}>
                            {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Conversation Footer */}
                  <div className="px-3 md:px-4 py-2 border-t border-[var(--border-light)] bg-[var(--surface-secondary)]/50">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-[10px] md:text-xs text-[var(--text-tertiary)]">
                      <span>Conversation ID: <code className="font-mono bg-[var(--surface-tertiary)] px-1.5 py-0.5 rounded text-[var(--text-secondary)]">{conversation.conversationId?.slice(0, 12) || ''}...</code></span>
                      <span>Created: {new Date(conversation.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-[var(--text-tertiary)]">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No conversation loaded</p>
                  </div>
                </div>
              )}
            </div>
          )}
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
  const [errorFilter, setErrorFilter] = useState<string>(searchParams.get('errors') || '');
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
    if (errorFilter) params.set('errors', errorFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedModel, selectedUserId, conversationIdFilter, selectedAgent, guardrailsFilter, toolNameFilter, errorFilter, page, setSearchParams]);

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
        limit: 25,
        model: selectedModel || undefined,
        userId: selectedUserId || undefined,
        conversationId: conversationIdFilter || undefined,
        agent: selectedAgent || undefined,
        guardrails: guardrailsFilter || undefined,
        toolName: toolNameFilter || undefined,
        errorOnly: errorFilter === 'errors' ? true : undefined,
      });
      setData(response);
      setError(null);
    } catch (err) {
      setError('Failed to load traces');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedModel, selectedUserId, conversationIdFilter, selectedAgent, guardrailsFilter, toolNameFilter, errorFilter]);

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
    setErrorFilter('');
    setPage(1);
  };

  const hasActiveFilters = selectedModel || selectedUserId || conversationIdFilter || searchQuery || selectedAgent || guardrailsFilter || toolNameFilter || errorFilter;

  // Show full page skeleton on initial load
  if (loading && !data) {
    return <TracesPageSkeleton />;
  }

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
      {loading ? (
        <StatsGridSkeleton count={4} />
      ) : data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface-secondary rounded-lg border border-border-light p-3">
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
          <div className="bg-surface-secondary rounded-lg border border-border-light p-3">
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
          <div className="bg-surface-secondary rounded-lg border border-border-light p-3">
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
          <div className="bg-surface-secondary rounded-lg border border-border-light p-3">
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
            
            {/* Errors Filter */}
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--text-tertiary)]" />
              <select
                value={errorFilter}
                onChange={(e) => { setErrorFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-[var(--surface-primary)] [&>option]:text-[var(--text-primary)] min-w-[120px]"
              >
                <option value="">All Traces</option>
                <option value="errors">Errors Only</option>
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
      {loading && !data ? (
        <TracesTableSkeleton rows={10} />
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
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="px-3 py-3 grid grid-cols-12 gap-3 items-center animate-pulse">
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-surface-tertiary" />
                        <div className="flex-1">
                          <div className="h-4 w-20 rounded bg-surface-tertiary mb-1" />
                          <div className="h-3 w-24 rounded bg-surface-tertiary" />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="h-4 w-24 rounded bg-surface-tertiary mb-1" />
                        <div className="h-3 w-20 rounded bg-surface-tertiary" />
                      </div>
                      <div className="col-span-3">
                        <div className="h-3 w-full rounded bg-surface-tertiary mb-2" />
                        <div className="h-3 w-3/4 rounded bg-surface-tertiary" />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <div className="h-5 w-16 rounded bg-surface-tertiary" />
                      </div>
                      <div className="col-span-1 flex flex-col items-end">
                        <div className="h-4 w-12 rounded bg-surface-tertiary mb-1" />
                        <div className="h-3 w-16 rounded bg-surface-tertiary" />
                      </div>
                      <div className="col-span-1 flex flex-col items-end">
                        <div className="h-4 w-14 rounded bg-surface-tertiary mb-1" />
                        <div className="h-3 w-16 rounded bg-surface-tertiary" />
                      </div>
                      <div className="col-span-1">
                        <div className="h-5 w-8 rounded bg-surface-tertiary" />
                      </div>
                      <div className="col-span-1 flex flex-col items-end">
                        <div className="h-4 w-16 rounded bg-surface-tertiary mb-1" />
                        <div className="h-3 w-14 rounded bg-surface-tertiary" />
                      </div>
                    </div>
                  ))
                ) : filteredTraces.length === 0 ? (
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
                            ⚡{(trace.trace.caching.hitRatio ?? 0) > 0 ? `${trace.trace.caching.hitRatio ?? 0}%` : ''}
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
                        {/* Error flag */}
                        {trace.error?.isError && (
                          <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs"
                            title={`Error: ${trace.error.message}`}
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                        {trace.trace?.toolCalls && trace.trace.toolCalls.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs" title={`${trace.trace.toolCalls.length} Tool Calls`}>
                            <Wrench className="h-3 w-3" />
                            <span>{trace.trace.toolCalls.length}</span>
                          </span>
                        )}
                        {!trace.guardrails?.invoked && !trace.trace?.thinking && !trace.error?.isError && (!trace.trace?.toolCalls || trace.trace.toolCalls.length === 0) && (
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

      {/* Trace Drawer (from right) with integrated conversation tab */}
      <TraceDrawer 
        trace={selectedTrace} 
        isOpen={drawerOpen} 
        onClose={closeDrawer} 
      />
    </div>
  );
}
