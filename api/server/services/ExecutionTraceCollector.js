/**
 * ExecutionTraceCollector
 *
 * Collects execution trace data during scheduled agent runs.
 * Implements GraphEvent handlers to capture step-by-step execution details
 * for building a Camunda-style tree view visualization.
 */

const { GraphEvents } = require('illuma-agents');
const { ExecutionTrace } = require('~/db/models');

/**
 * Truncates a string or object to a maximum length for storage
 * @param {*} data - Data to truncate
 * @param {number} maxLength - Maximum length
 * @returns {*} Truncated data
 */
function truncateData(data, maxLength = 5000) {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof data === 'string') {
    return data.length > maxLength ? data.substring(0, maxLength) + '...[truncated]' : data;
  }
  if (typeof data === 'object') {
    const str = JSON.stringify(data);
    if (str.length > maxLength) {
      return { _truncated: true, preview: str.substring(0, maxLength) };
    }
    return data;
  }
  return data;
}

/**
 * Extracts model name from various event data structures
 * @param {Object} data - Event data
 * @param {Object} metadata - Event metadata
 * @returns {string} Model name
 */
function extractModelName(data, metadata) {
  // Try different locations where model name might be
  if (data?.name) return data.name;
  if (data?.model) return data.model;
  if (metadata?.model) return metadata.model;
  if (metadata?.modelName) return metadata.modelName;
  if (data?.output?.response_metadata?.model) return data.output.response_metadata.model;
  return 'unknown-model';
}

/**
 * Extracts tool name from event data
 * @param {Object} data - Event data
 * @returns {string} Tool name
 */
function extractToolName(data) {
  if (data?.name) return data.name;
  if (data?.tool) return data.tool;
  if (typeof data === 'string') return data;
  return 'unknown-tool';
}

class ExecutionTraceCollector {
  /**
   * @param {string|ObjectId} executionId - The TriggerExecution ID
   * @param {Object} options - Additional options
   * @param {boolean} options.enabled - Whether tracing is enabled (default: true)
   */
  constructor(executionId, options = {}) {
    this.executionId = executionId;
    this.enabled = options.enabled !== false;
    this.sequence = 0;
    this.activeSteps = new Map(); // Maps step identifiers to trace docs
    this.stepStack = []; // Stack for nested steps
  }

  /**
   * Get the next sequence number
   * @returns {number}
   */
  nextSequence() {
    this.sequence += 1;
    return this.sequence;
  }

  /**
   * Get the current parent ID from the step stack
   * @returns {ObjectId|null}
   */
  getCurrentParentId() {
    if (this.stepStack.length === 0) return null;
    return this.stepStack[this.stepStack.length - 1];
  }

  /**
   * Creates a new trace step in the database
   * @param {Object} params - Step parameters
   * @returns {Promise<Object>} Created trace document
   */
  async createStep({ stepType, stepName, input, metadata }) {
    if (!this.enabled) return null;

    try {
      const trace = await ExecutionTrace.create({
        executionId: this.executionId,
        parentId: this.getCurrentParentId(),
        sequence: this.nextSequence(),
        stepType,
        stepName,
        status: 'running',
        startedAt: new Date(),
        input: truncateData(input),
        metadata: truncateData(metadata),
      });
      return trace;
    } catch (error) {
      console.error('[ExecutionTraceCollector] Failed to create step:', error.message);
      return null;
    }
  }

  /**
   * Updates a trace step with completion data
   * @param {ObjectId} traceId - Trace document ID
   * @param {Object} params - Update parameters
   * @returns {Promise<Object>} Updated trace document
   */
  async completeStep(traceId, { status = 'completed', output, tokenUsage, error }) {
    if (!this.enabled || !traceId) return null;

    try {
      const completedAt = new Date();
      const trace = await ExecutionTrace.findById(traceId);
      if (!trace) return null;

      const durationMs = completedAt - trace.startedAt;

      const update = {
        status,
        completedAt,
        durationMs,
      };

      if (output !== undefined) {
        update.output = truncateData(output);
      }
      if (tokenUsage) {
        update.tokenUsage = tokenUsage;
      }
      if (error) {
        update.error = truncateData(error, 2000);
      }

      return await ExecutionTrace.findByIdAndUpdate(traceId, update, { new: true });
    } catch (err) {
      console.error('[ExecutionTraceCollector] Failed to complete step:', err.message);
      return null;
    }
  }

  /**
   * Handler for CHAT_MODEL_START event
   */
  async handleChatModelStart(event, data, metadata) {
    const modelName = extractModelName(data, metadata);
    const trace = await this.createStep({
      stepType: 'llm',
      stepName: modelName,
      input: truncateData(data?.messages || data?.input),
      metadata: {
        provider: metadata?.provider,
        runId: metadata?.run_id,
      },
    });

    if (trace) {
      // Use run_id or generate a key for tracking
      const stepKey = `llm:${metadata?.run_id || Date.now()}`;
      this.activeSteps.set(stepKey, trace._id);
      this.stepStack.push(trace._id);
    }
  }

  /**
   * Handler for CHAT_MODEL_END event
   */
  async handleChatModelEnd(event, data, metadata) {
    const stepKey = `llm:${metadata?.run_id || ''}`;
    let traceId = this.activeSteps.get(stepKey);

    // If not found by run_id, try to find the most recent LLM step
    if (!traceId && this.stepStack.length > 0) {
      traceId = this.stepStack[this.stepStack.length - 1];
    }

    if (traceId) {
      // Extract token usage
      let tokenUsage;
      const usage = data?.output?.response_metadata?.usage || data?.output?.usage_metadata;
      if (usage) {
        tokenUsage = {
          prompt: usage.input_tokens || usage.prompt_tokens || usage.promptTokenCount,
          completion: usage.output_tokens || usage.completion_tokens || usage.candidatesTokenCount,
          total: usage.total_tokens || usage.totalTokenCount,
        };
      }

      // Extract output content
      const output = data?.output?.content || data?.output?.text;

      await this.completeStep(traceId, {
        status: 'completed',
        output,
        tokenUsage,
      });

      this.activeSteps.delete(stepKey);
      // Pop from stack if this was the top
      if (this.stepStack[this.stepStack.length - 1]?.equals?.(traceId)) {
        this.stepStack.pop();
      } else {
        // Remove from stack by value
        const idx = this.stepStack.findIndex((id) => id?.equals?.(traceId));
        if (idx !== -1) this.stepStack.splice(idx, 1);
      }
    }
  }

  /**
   * Handler for TOOL_START event
   */
  async handleToolStart(event, data, metadata) {
    const toolName = extractToolName(data);
    const trace = await this.createStep({
      stepType: 'tool',
      stepName: toolName,
      input: truncateData(data?.input || data?.args),
      metadata: {
        toolCallId: data?.tool_call_id,
        runId: metadata?.run_id,
      },
    });

    if (trace) {
      const stepKey = `tool:${data?.tool_call_id || data?.name || Date.now()}`;
      this.activeSteps.set(stepKey, trace._id);
      this.stepStack.push(trace._id);
    }
  }

  /**
   * Handler for TOOL_END event
   */
  async handleToolEnd(event, data, metadata) {
    const stepKey = `tool:${data?.tool_call_id || data?.name || ''}`;
    let traceId = this.activeSteps.get(stepKey);

    // If not found, try to match by tool name
    if (!traceId) {
      for (const [key, id] of this.activeSteps.entries()) {
        if (key.startsWith('tool:') && key.includes(data?.name)) {
          traceId = id;
          this.activeSteps.delete(key);
          break;
        }
      }
    }

    if (traceId) {
      const hasError = data?.error || data?.output?.error;
      await this.completeStep(traceId, {
        status: hasError ? 'failed' : 'completed',
        output: truncateData(data?.output),
        error: hasError ? String(data?.error || data?.output?.error) : undefined,
      });

      this.activeSteps.delete(stepKey);
      // Pop from stack
      const idx = this.stepStack.findIndex((id) => id?.equals?.(traceId));
      if (idx !== -1) this.stepStack.splice(idx, 1);
    }
  }

  /**
   * Handler for ON_AGENT_UPDATE event (multi-agent switch)
   */
  async handleAgentUpdate(event, data, metadata) {
    const agentName = data?.agent || data?.name || 'unknown-agent';
    const trace = await this.createStep({
      stepType: 'agent_switch',
      stepName: agentName,
      input: { reason: data?.reason },
      metadata: {
        fromAgent: data?.from,
        toAgent: data?.to,
      },
    });

    if (trace) {
      // Agent switches complete immediately
      await this.completeStep(trace._id, {
        status: 'completed',
        output: { switched: true },
      });
    }
  }

  /**
   * Handler for ON_RUN_STEP_COMPLETED event
   */
  async handleRunStepCompleted(event, data, metadata) {
    // This event indicates a run step (message or tool call) completed
    // We can use this to add a final message step if needed
    if (data?.type === 'message_creation' && data?.step_details?.message_creation) {
      const messageContent = data.step_details.message_creation.content;
      if (messageContent) {
        const trace = await this.createStep({
          stepType: 'message',
          stepName: 'Response',
          input: null,
        });
        if (trace) {
          await this.completeStep(trace._id, {
            status: 'completed',
            output: truncateData(messageContent),
          });
        }
      }
    }
  }

  /**
   * Mark any remaining active steps as failed (for error scenarios)
   * @param {string} errorMessage - The error that caused the failure
   */
  async markRemainingStepsFailed(errorMessage) {
    if (!this.enabled) return;

    const traceIds = Array.from(this.activeSteps.values());
    for (const traceId of traceIds) {
      try {
        await this.completeStep(traceId, {
          status: 'failed',
          error: errorMessage,
        });
      } catch (err) {
        console.error('[ExecutionTraceCollector] Failed to mark step as failed:', err.message);
      }
    }
    this.activeSteps.clear();
    this.stepStack = [];
  }

  /**
   * Get event handlers compatible with createRun customHandlers
   * @returns {Object} Handler map for GraphEvents
   */
  getHandlers() {
    if (!this.enabled) {
      return {};
    }

    return {
      [GraphEvents.CHAT_MODEL_START]: {
        handle: (event, data, metadata) => this.handleChatModelStart(event, data, metadata),
      },
      [GraphEvents.CHAT_MODEL_END]: {
        handle: (event, data, metadata) => this.handleChatModelEnd(event, data, metadata),
      },
      [GraphEvents.TOOL_START]: {
        handle: (event, data, metadata) => this.handleToolStart(event, data, metadata),
      },
      [GraphEvents.TOOL_END]: {
        handle: (event, data, metadata) => this.handleToolEnd(event, data, metadata),
      },
      [GraphEvents.ON_AGENT_UPDATE]: {
        handle: (event, data, metadata) => this.handleAgentUpdate(event, data, metadata),
      },
      [GraphEvents.ON_RUN_STEP_COMPLETED]: {
        handle: (event, data, metadata) => this.handleRunStepCompleted(event, data, metadata),
      },
    };
  }

  /**
   * Get the total number of steps recorded
   * @returns {number}
   */
  getStepCount() {
    return this.sequence;
  }
}

module.exports = { ExecutionTraceCollector, truncateData, extractModelName, extractToolName };
