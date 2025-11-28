import { renderHook } from '@testing-library/react';
import { AgentCapabilities, defaultToolsAutoEnabled } from 'librechat-data-provider';
import useAgentCapabilities from '../useAgentCapabilities';

describe('useAgentCapabilities', () => {
  describe('basic capability checks', () => {
    it('should return false for all capabilities when undefined', () => {
      const { result } = renderHook(() => useAgentCapabilities(undefined));

      expect(result.current.toolsEnabled).toBe(false);
      expect(result.current.actionsEnabled).toBe(false);
      expect(result.current.artifactsEnabled).toBe(false);
      expect(result.current.ocrEnabled).toBe(false);
      expect(result.current.contextEnabled).toBe(false);
      expect(result.current.fileSearchEnabled).toBe(false);
      expect(result.current.webSearchEnabled).toBe(false);
      expect(result.current.codeEnabled).toBe(false);
    });

    it('should return false for all capabilities when empty array', () => {
      const { result } = renderHook(() => useAgentCapabilities([]));

      expect(result.current.toolsEnabled).toBe(false);
      expect(result.current.actionsEnabled).toBe(false);
      expect(result.current.artifactsEnabled).toBe(false);
      expect(result.current.ocrEnabled).toBe(false);
      expect(result.current.contextEnabled).toBe(false);
      expect(result.current.fileSearchEnabled).toBe(false);
      expect(result.current.webSearchEnabled).toBe(false);
      expect(result.current.codeEnabled).toBe(false);
    });

    it('should return true for file_search when included', () => {
      const capabilities = [AgentCapabilities.file_search];
      const { result } = renderHook(() => useAgentCapabilities(capabilities));

      expect(result.current.fileSearchEnabled).toBe(true);
      expect(result.current.codeEnabled).toBe(false);
    });

    it('should return true for execute_code when included', () => {
      const capabilities = [AgentCapabilities.execute_code];
      const { result } = renderHook(() => useAgentCapabilities(capabilities));

      expect(result.current.codeEnabled).toBe(true);
      expect(result.current.fileSearchEnabled).toBe(false);
    });

    it('should return true for artifacts when included', () => {
      const capabilities = [AgentCapabilities.artifacts];
      const { result } = renderHook(() => useAgentCapabilities(capabilities));

      expect(result.current.artifactsEnabled).toBe(true);
    });

    it('should return true for multiple capabilities', () => {
      const capabilities = [
        AgentCapabilities.file_search,
        AgentCapabilities.execute_code,
        AgentCapabilities.artifacts,
        AgentCapabilities.tools,
      ];
      const { result } = renderHook(() => useAgentCapabilities(capabilities));

      expect(result.current.fileSearchEnabled).toBe(true);
      expect(result.current.codeEnabled).toBe(true);
      expect(result.current.artifactsEnabled).toBe(true);
      expect(result.current.toolsEnabled).toBe(true);
    });
  });

  describe('isAutoEnabled function', () => {
    it('should use defaultToolsAutoEnabled when no custom list provided', () => {
      const { result } = renderHook(() => useAgentCapabilities([]));

      // Default auto-enabled: file_search, execute_code, artifacts
      expect(result.current.isAutoEnabled(AgentCapabilities.file_search)).toBe(true);
      expect(result.current.isAutoEnabled(AgentCapabilities.execute_code)).toBe(true);
      expect(result.current.isAutoEnabled(AgentCapabilities.artifacts)).toBe(true);
      
      // Not auto-enabled by default
      expect(result.current.isAutoEnabled(AgentCapabilities.tools)).toBe(false);
      expect(result.current.isAutoEnabled(AgentCapabilities.actions)).toBe(false);
      expect(result.current.isAutoEnabled(AgentCapabilities.web_search)).toBe(false);
    });

    it('should use custom toolsAutoEnabled list when provided', () => {
      const customAutoEnabled = [AgentCapabilities.web_search, AgentCapabilities.tools];
      const { result } = renderHook(() => 
        useAgentCapabilities([], customAutoEnabled)
      );

      expect(result.current.isAutoEnabled(AgentCapabilities.web_search)).toBe(true);
      expect(result.current.isAutoEnabled(AgentCapabilities.tools)).toBe(true);
      
      // Not in custom list
      expect(result.current.isAutoEnabled(AgentCapabilities.file_search)).toBe(false);
      expect(result.current.isAutoEnabled(AgentCapabilities.execute_code)).toBe(false);
    });

    it('should return false for empty toolsAutoEnabled list', () => {
      const { result } = renderHook(() => 
        useAgentCapabilities([], [])
      );

      expect(result.current.isAutoEnabled(AgentCapabilities.file_search)).toBe(false);
      expect(result.current.isAutoEnabled(AgentCapabilities.execute_code)).toBe(false);
      expect(result.current.isAutoEnabled(AgentCapabilities.artifacts)).toBe(false);
    });
  });

  describe('defaultToolsAutoEnabled constant', () => {
    it('should include file_search, execute_code, artifacts by default', () => {
      expect(defaultToolsAutoEnabled).toContain(AgentCapabilities.file_search);
      expect(defaultToolsAutoEnabled).toContain(AgentCapabilities.execute_code);
      expect(defaultToolsAutoEnabled).toContain(AgentCapabilities.artifacts);
    });

    it('should not include web_search by default', () => {
      expect(defaultToolsAutoEnabled).not.toContain(AgentCapabilities.web_search);
    });
  });

  describe('capability independence', () => {
    it('should correctly identify only the enabled capabilities', () => {
      const capabilities = [
        AgentCapabilities.file_search,
        AgentCapabilities.ocr,
        AgentCapabilities.context,
      ];
      const { result } = renderHook(() => useAgentCapabilities(capabilities));

      // Should be enabled
      expect(result.current.fileSearchEnabled).toBe(true);
      expect(result.current.ocrEnabled).toBe(true);
      expect(result.current.contextEnabled).toBe(true);

      // Should not be enabled
      expect(result.current.codeEnabled).toBe(false);
      expect(result.current.artifactsEnabled).toBe(false);
      expect(result.current.toolsEnabled).toBe(false);
      expect(result.current.actionsEnabled).toBe(false);
      expect(result.current.webSearchEnabled).toBe(false);
    });
  });
});
