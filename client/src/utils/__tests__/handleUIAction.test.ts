import { handleUIAction } from '../index';

describe('handleUIAction', () => {
  let mockAsk;
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    mockAsk = jest.fn().mockResolvedValue(undefined);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('unsupported action types', () => {
    it('should not call ask for unsupported action types', async () => {
      await handleUIAction({ type: 'unsupported', payload: {} }, mockAsk);
      expect(mockAsk).not.toHaveBeenCalled();
    });

    it('should not call ask for empty type', async () => {
      await handleUIAction({ type: '', payload: {} }, mockAsk);
      expect(mockAsk).not.toHaveBeenCalled();
    });
  });

  describe('intent action type', () => {
    it('should call ask with correct metadata for intent type', async () => {
      const result = {
        type: 'intent',
        payload: {
          intent: 'navigate',
          params: { page: 'settings' },
        },
      };

      await handleUIAction(result, mockAsk);

      expect(mockAsk).toHaveBeenCalledTimes(1);
      const callArgs = mockAsk.mock.calls[0][0];
      
      expect(callArgs.metadata).toEqual({
        isUIAction: true,
        uiActionType: 'intent',
        uiActionSummary: 'Intent: navigate',
      });
      expect(callArgs.text).toContain('intent');
      expect(callArgs.text).toContain('navigate');
      expect(callArgs.text).toContain('settings');
    });

    it('should include params in message text', async () => {
      const result = {
        type: 'intent',
        payload: {
          intent: 'test_intent',
          params: { key1: 'value1', key2: 'value2' },
        },
      };

      await handleUIAction(result, mockAsk);

      const callArgs = mockAsk.mock.calls[0][0];
      expect(callArgs.text).toContain('key1');
      expect(callArgs.text).toContain('value1');
      expect(callArgs.text).toContain('key2');
      expect(callArgs.text).toContain('value2');
    });
  });

  describe('tool action type', () => {
    it('should call ask with correct metadata for tool type', async () => {
      const result = {
        type: 'tool',
        payload: {
          toolName: 'send_email',
          params: { to: 'test@example.com' },
        },
      };

      await handleUIAction(result, mockAsk);

      expect(mockAsk).toHaveBeenCalledTimes(1);
      const callArgs = mockAsk.mock.calls[0][0];
      
      expect(callArgs.metadata).toEqual({
        isUIAction: true,
        uiActionType: 'tool',
        uiActionSummary: 'Tool: send_email',
      });
      expect(callArgs.text).toContain('tool');
      expect(callArgs.text).toContain('send_email');
    });

    it('should handle tools requiring approval', async () => {
      const result = {
        type: 'tool',
        payload: {
          toolName: 'dangerous_operation',
          params: { 
            action: 'delete',
            requiresApproval: true,
          },
        },
      };

      await handleUIAction(result, mockAsk);

      const callArgs = mockAsk.mock.calls[0][0];
      expect(callArgs.text).toContain('approved=true');
      expect(callArgs.text).toContain('User reviewed and clicked');
    });

    it('should not add approval for regular tools', async () => {
      const result = {
        type: 'tool',
        payload: {
          toolName: 'simple_tool',
          params: { data: 'value' },
        },
      };

      await handleUIAction(result, mockAsk);

      const callArgs = mockAsk.mock.calls[0][0];
      expect(callArgs.text).not.toContain('approved=true');
      expect(callArgs.text).not.toContain('User reviewed');
    });
  });

  describe('prompt action type', () => {
    it('should call ask with correct metadata for prompt type', async () => {
      const result = {
        type: 'prompt',
        payload: {
          prompt: 'Help me with my task',
        },
      };

      await handleUIAction(result, mockAsk);

      expect(mockAsk).toHaveBeenCalledTimes(1);
      const callArgs = mockAsk.mock.calls[0][0];
      
      expect(callArgs.metadata).toEqual({
        isUIAction: true,
        uiActionType: 'prompt',
        uiActionSummary: 'Prompt: Help me with my task',
      });
      expect(callArgs.text).toContain('prompt');
      expect(callArgs.text).toContain('Help me with my task');
    });

    it('should truncate long prompts in summary', async () => {
      const longPrompt = 'A'.repeat(100);
      const result = {
        type: 'prompt',
        payload: {
          prompt: longPrompt,
        },
      };

      await handleUIAction(result, mockAsk);

      const callArgs = mockAsk.mock.calls[0][0];
      // Summary should be truncated at 50 characters
      expect(callArgs.metadata.uiActionSummary.length).toBeLessThan(longPrompt.length + 10);
      expect(callArgs.metadata.uiActionSummary).toContain('...');
    });
  });

  describe('error handling', () => {
    it('should log error when ask fails', async () => {
      const error = new Error('Ask failed');
      mockAsk.mockRejectedValueOnce(error);

      const result = {
        type: 'tool',
        payload: {
          toolName: 'test_tool',
          params: {},
        },
      };

      await handleUIAction(result, mockAsk);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error submitting UI action:',
        error
      );
    });

    it('should log successful submission', async () => {
      const result = {
        type: 'tool',
        payload: {
          toolName: 'test_tool',
          params: {},
        },
      };

      await handleUIAction(result, mockAsk);

      expect(consoleSpy).toHaveBeenCalledWith(
        'About to submit UI action:',
        expect.any(String)
      );
      expect(consoleSpy).toHaveBeenCalledWith('UI action submitted successfully');
    });
  });

  describe('metadata structure', () => {
    it('should always include isUIAction: true in metadata', async () => {
      const testCases = [
        { type: 'intent', payload: { intent: 'test', params: {} } },
        { type: 'tool', payload: { toolName: 'test', params: {} } },
        { type: 'prompt', payload: { prompt: 'test' } },
      ];

      for (const result of testCases) {
        mockAsk.mockClear();
        await handleUIAction(result, mockAsk);
        
        const callArgs = mockAsk.mock.calls[0][0];
        expect(callArgs.metadata.isUIAction).toBe(true);
        expect(callArgs.metadata.uiActionType).toBe(result.type);
      }
    });
  });
});
