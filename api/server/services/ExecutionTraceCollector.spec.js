/**
 * @jest-environment node
 */

const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Mock dependencies before requiring the module
jest.mock('~/db/models', () => ({
  ExecutionTrace: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('illuma-agents', () => ({
  GraphEvents: {
    CHAT_MODEL_START: 'on_chat_model_start',
    CHAT_MODEL_END: 'on_chat_model_end',
    TOOL_START: 'on_tool_start',
    TOOL_END: 'on_tool_end',
    ON_AGENT_UPDATE: 'on_agent_update',
    ON_RUN_STEP_COMPLETED: 'on_run_step_completed',
  },
}));

const { ExecutionTrace } = require('~/db/models');
const { GraphEvents } = require('illuma-agents');
const {
  ExecutionTraceCollector,
  truncateData,
  extractModelName,
  extractToolName,
} = require('./ExecutionTraceCollector');

describe('ExecutionTraceCollector', () => {
  let collector;
  const executionId = new ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    collector = new ExecutionTraceCollector(executionId);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(collector.executionId).toBe(executionId);
      expect(collector.enabled).toBe(true);
      expect(collector.sequence).toBe(0);
      expect(collector.activeSteps.size).toBe(0);
      expect(collector.stepStack.length).toBe(0);
    });

    it('should allow disabling tracing', () => {
      const disabledCollector = new ExecutionTraceCollector(executionId, { enabled: false });
      expect(disabledCollector.enabled).toBe(false);
    });
  });

  describe('nextSequence', () => {
    it('should increment sequence', () => {
      expect(collector.nextSequence()).toBe(1);
      expect(collector.nextSequence()).toBe(2);
      expect(collector.nextSequence()).toBe(3);
    });
  });

  describe('getCurrentParentId', () => {
    it('should return null when stack is empty', () => {
      expect(collector.getCurrentParentId()).toBeNull();
    });

    it('should return the top of the stack', () => {
      const parentId = new ObjectId();
      collector.stepStack.push(parentId);
      expect(collector.getCurrentParentId()).toBe(parentId);
    });
  });

  describe('createStep', () => {
    it('should create a trace step', async () => {
      const traceId = new ObjectId();
      const mockTrace = { _id: traceId };
      ExecutionTrace.create.mockResolvedValue(mockTrace);

      const result = await collector.createStep({
        stepType: 'llm',
        stepName: 'gpt-4o',
        input: { prompt: 'Hello' },
        metadata: { provider: 'openai' },
      });

      expect(ExecutionTrace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: executionId,
          parentId: null,
          sequence: 1,
          stepType: 'llm',
          stepName: 'gpt-4o',
          status: 'running',
          input: { prompt: 'Hello' },
        }),
      );
      expect(result).toBe(mockTrace);
    });

    it('should not create step when disabled', async () => {
      const disabledCollector = new ExecutionTraceCollector(executionId, { enabled: false });
      const result = await disabledCollector.createStep({
        stepType: 'llm',
        stepName: 'gpt-4o',
      });

      expect(ExecutionTrace.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      ExecutionTrace.create.mockRejectedValue(new Error('DB error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await collector.createStep({
        stepType: 'llm',
        stepName: 'gpt-4o',
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('completeStep', () => {
    it('should update trace with completion data', async () => {
      const traceId = new ObjectId();
      const startedAt = new Date(Date.now() - 1000);
      const mockTrace = { _id: traceId, startedAt };
      const updatedTrace = { ...mockTrace, status: 'completed' };

      ExecutionTrace.findById.mockResolvedValue(mockTrace);
      ExecutionTrace.findByIdAndUpdate.mockResolvedValue(updatedTrace);

      const result = await collector.completeStep(traceId, {
        status: 'completed',
        output: { response: 'Hello' },
        tokenUsage: { total: 100 },
      });

      expect(ExecutionTrace.findById).toHaveBeenCalledWith(traceId);
      expect(ExecutionTrace.findByIdAndUpdate).toHaveBeenCalledWith(
        traceId,
        expect.objectContaining({
          status: 'completed',
          output: { response: 'Hello' },
          tokenUsage: { total: 100 },
        }),
        { new: true },
      );
      expect(result).toBe(updatedTrace);
    });

    it('should not update when disabled', async () => {
      const disabledCollector = new ExecutionTraceCollector(executionId, { enabled: false });
      const result = await disabledCollector.completeStep(new ObjectId(), {});

      expect(ExecutionTrace.findById).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when trace not found', async () => {
      ExecutionTrace.findById.mockResolvedValue(null);
      const result = await collector.completeStep(new ObjectId(), {});

      expect(result).toBeNull();
    });
  });

  describe('handleChatModelStart', () => {
    it('should create LLM trace step', async () => {
      const traceId = new ObjectId();
      ExecutionTrace.create.mockResolvedValue({ _id: traceId });

      await collector.handleChatModelStart(
        'on_chat_model_start',
        { name: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
        { provider: 'openai', run_id: 'run-123' },
      );

      expect(ExecutionTrace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stepType: 'llm',
          stepName: 'gpt-4o',
        }),
      );
      expect(collector.activeSteps.has('llm:run-123')).toBe(true);
      expect(collector.stepStack.length).toBe(1);
    });
  });

  describe('handleChatModelEnd', () => {
    it('should complete LLM trace step', async () => {
      const traceId = new ObjectId();
      const startedAt = new Date(Date.now() - 500);
      const mockTrace = { _id: traceId, startedAt, equals: (id) => id === traceId };

      // Setup: first create a step
      ExecutionTrace.create.mockResolvedValue({ _id: traceId });
      await collector.handleChatModelStart(
        'on_chat_model_start',
        { name: 'gpt-4o' },
        { run_id: 'run-123' },
      );

      ExecutionTrace.findById.mockResolvedValue(mockTrace);
      ExecutionTrace.findByIdAndUpdate.mockResolvedValue({ ...mockTrace, status: 'completed' });

      await collector.handleChatModelEnd(
        'on_chat_model_end',
        {
          output: {
            content: 'Hello!',
            response_metadata: { usage: { input_tokens: 10, output_tokens: 20 } },
          },
        },
        { run_id: 'run-123' },
      );

      expect(ExecutionTrace.findByIdAndUpdate).toHaveBeenCalledWith(
        traceId,
        expect.objectContaining({
          status: 'completed',
          output: 'Hello!',
          tokenUsage: expect.objectContaining({ prompt: 10, completion: 20 }),
        }),
        { new: true },
      );
      expect(collector.activeSteps.has('llm:run-123')).toBe(false);
    });
  });

  describe('handleToolStart', () => {
    it('should create tool trace step', async () => {
      const traceId = new ObjectId();
      ExecutionTrace.create.mockResolvedValue({ _id: traceId });

      await collector.handleToolStart(
        'on_tool_start',
        { name: 'web_search', input: { query: 'weather' }, tool_call_id: 'tc-123' },
        { run_id: 'run-123' },
      );

      expect(ExecutionTrace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stepType: 'tool',
          stepName: 'web_search',
          input: { query: 'weather' },
        }),
      );
      expect(collector.activeSteps.has('tool:tc-123')).toBe(true);
    });
  });

  describe('handleToolEnd', () => {
    it('should complete tool trace step', async () => {
      const traceId = new ObjectId();
      const startedAt = new Date(Date.now() - 300);
      const mockTrace = { _id: traceId, startedAt, equals: (id) => id === traceId };

      ExecutionTrace.create.mockResolvedValue({ _id: traceId });
      await collector.handleToolStart(
        'on_tool_start',
        { name: 'web_search', tool_call_id: 'tc-123' },
        {},
      );

      ExecutionTrace.findById.mockResolvedValue(mockTrace);
      ExecutionTrace.findByIdAndUpdate.mockResolvedValue({ ...mockTrace, status: 'completed' });

      await collector.handleToolEnd(
        'on_tool_end',
        { name: 'web_search', tool_call_id: 'tc-123', output: { results: ['result1'] } },
        {},
      );

      expect(ExecutionTrace.findByIdAndUpdate).toHaveBeenCalledWith(
        traceId,
        expect.objectContaining({
          status: 'completed',
          output: { results: ['result1'] },
        }),
        { new: true },
      );
    });

    it('should mark failed tool', async () => {
      const traceId = new ObjectId();
      const startedAt = new Date();
      const mockTrace = { _id: traceId, startedAt, equals: (id) => id === traceId };

      ExecutionTrace.create.mockResolvedValue({ _id: traceId });
      await collector.handleToolStart('on_tool_start', { name: 'web_search', tool_call_id: 'tc-123' }, {});

      ExecutionTrace.findById.mockResolvedValue(mockTrace);
      ExecutionTrace.findByIdAndUpdate.mockResolvedValue({ ...mockTrace, status: 'failed' });

      await collector.handleToolEnd(
        'on_tool_end',
        { name: 'web_search', tool_call_id: 'tc-123', error: 'API timeout' },
        {},
      );

      expect(ExecutionTrace.findByIdAndUpdate).toHaveBeenCalledWith(
        traceId,
        expect.objectContaining({
          status: 'failed',
          error: 'API timeout',
        }),
        { new: true },
      );
    });
  });

  describe('handleAgentUpdate', () => {
    it('should create and complete agent switch step', async () => {
      const traceId = new ObjectId();
      const startedAt = new Date();
      const mockTrace = { _id: traceId, startedAt };

      ExecutionTrace.create.mockResolvedValue(mockTrace);
      ExecutionTrace.findById.mockResolvedValue(mockTrace);
      ExecutionTrace.findByIdAndUpdate.mockResolvedValue({ ...mockTrace, status: 'completed' });

      await collector.handleAgentUpdate(
        'on_agent_update',
        { agent: 'researcher', from: 'coordinator', to: 'researcher' },
        {},
      );

      expect(ExecutionTrace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stepType: 'agent_switch',
          stepName: 'researcher',
        }),
      );
      expect(ExecutionTrace.findByIdAndUpdate).toHaveBeenCalledWith(
        traceId,
        expect.objectContaining({
          status: 'completed',
          output: { switched: true },
        }),
        { new: true },
      );
    });
  });

  describe('markRemainingStepsFailed', () => {
    it('should mark all active steps as failed', async () => {
      const traceId1 = new ObjectId();
      const traceId2 = new ObjectId();
      const startedAt = new Date();

      ExecutionTrace.create
        .mockResolvedValueOnce({ _id: traceId1 })
        .mockResolvedValueOnce({ _id: traceId2 });

      await collector.handleToolStart('on_tool_start', { name: 'tool1', tool_call_id: 'tc-1' }, {});
      await collector.handleToolStart('on_tool_start', { name: 'tool2', tool_call_id: 'tc-2' }, {});

      ExecutionTrace.findById.mockResolvedValue({ _id: traceId1, startedAt });
      ExecutionTrace.findByIdAndUpdate.mockResolvedValue({ status: 'failed' });

      await collector.markRemainingStepsFailed('Execution aborted');

      expect(ExecutionTrace.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(collector.activeSteps.size).toBe(0);
      expect(collector.stepStack.length).toBe(0);
    });
  });

  describe('getHandlers', () => {
    it('should return handler map for GraphEvents', () => {
      const handlers = collector.getHandlers();

      expect(handlers[GraphEvents.CHAT_MODEL_START]).toBeDefined();
      expect(handlers[GraphEvents.CHAT_MODEL_END]).toBeDefined();
      expect(handlers[GraphEvents.TOOL_START]).toBeDefined();
      expect(handlers[GraphEvents.TOOL_END]).toBeDefined();
      expect(handlers[GraphEvents.ON_AGENT_UPDATE]).toBeDefined();
      expect(handlers[GraphEvents.ON_RUN_STEP_COMPLETED]).toBeDefined();
    });

    it('should return empty object when disabled', () => {
      const disabledCollector = new ExecutionTraceCollector(executionId, { enabled: false });
      const handlers = disabledCollector.getHandlers();

      expect(handlers).toEqual({});
    });
  });

  describe('getStepCount', () => {
    it('should return current sequence count', () => {
      expect(collector.getStepCount()).toBe(0);
      collector.nextSequence();
      collector.nextSequence();
      expect(collector.getStepCount()).toBe(2);
    });
  });
});

describe('Helper Functions', () => {
  describe('truncateData', () => {
    it('should return null/undefined as is', () => {
      expect(truncateData(null)).toBeNull();
      expect(truncateData(undefined)).toBeUndefined();
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(6000);
      const result = truncateData(longString, 5000);
      expect(result.length).toBeLessThan(6000);
      expect(result).toContain('...[truncated]');
    });

    it('should not truncate short strings', () => {
      const shortString = 'hello';
      expect(truncateData(shortString)).toBe(shortString);
    });

    it('should truncate large objects', () => {
      const largeObj = { data: 'x'.repeat(6000) };
      const result = truncateData(largeObj, 5000);
      expect(result._truncated).toBe(true);
      expect(result.preview.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('extractModelName', () => {
    it('should extract from data.name', () => {
      expect(extractModelName({ name: 'gpt-4o' }, {})).toBe('gpt-4o');
    });

    it('should extract from data.model', () => {
      expect(extractModelName({ model: 'claude-3' }, {})).toBe('claude-3');
    });

    it('should extract from metadata', () => {
      expect(extractModelName({}, { model: 'gemini-pro' })).toBe('gemini-pro');
    });

    it('should extract from response_metadata', () => {
      expect(
        extractModelName({ output: { response_metadata: { model: 'gpt-4-turbo' } } }, {}),
      ).toBe('gpt-4-turbo');
    });

    it('should return unknown-model as fallback', () => {
      expect(extractModelName({}, {})).toBe('unknown-model');
    });
  });

  describe('extractToolName', () => {
    it('should extract from data.name', () => {
      expect(extractToolName({ name: 'web_search' })).toBe('web_search');
    });

    it('should extract from data.tool', () => {
      expect(extractToolName({ tool: 'calculator' })).toBe('calculator');
    });

    it('should handle string input', () => {
      expect(extractToolName('my_tool')).toBe('my_tool');
    });

    it('should return unknown-tool as fallback', () => {
      expect(extractToolName({})).toBe('unknown-tool');
    });
  });
});
