/**
 * Tests for Tools Selection Module
 */

import {
  selectTools,
  shouldEnableTool,
  ToolType,
  ToolDefinition,
  ToolSelectionContext,
} from '../tools';

import { AttachmentFile } from '../attachments/types';

describe('selectTools', () => {
  const mockTools: ToolDefinition[] = [
    {
      type: ToolType.CODE_INTERPRETER,
      name: 'Code Interpreter',
      enabled: true,
    },
    {
      type: ToolType.FILE_SEARCH,
      name: 'File Search',
      enabled: true,
    },
    {
      type: ToolType.IMAGE_GENERATION,
      name: 'DALL-E',
      enabled: true,
    },
    {
      type: ToolType.WEB_SEARCH,
      name: 'Web Search',
      enabled: true,
    },
  ];

  it('should select CODE_INTERPRETER for code-related queries', () => {
    const context: ToolSelectionContext = {
      query: 'Can you run this Python code and calculate the result?',
      availableTools: mockTools,
    };
    
    const result = selectTools(context);
    
    expect(result.selectedTools.map(t => t.type)).toContain(ToolType.CODE_INTERPRETER);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should select FILE_SEARCH for document queries', () => {
    const context: ToolSelectionContext = {
      query: 'What does the document say about the budget?',
      availableTools: mockTools,
    };
    
    const result = selectTools(context);
    
    expect(result.selectedTools.map(t => t.type)).toContain(ToolType.FILE_SEARCH);
  });

  it('should select IMAGE_GENERATION for image creation queries', () => {
    const context: ToolSelectionContext = {
      query: 'Generate an image of a sunset over mountains',
      availableTools: mockTools,
    };
    
    const result = selectTools(context);
    
    expect(result.selectedTools.map(t => t.type)).toContain(ToolType.IMAGE_GENERATION);
  });

  it('should select WEB_SEARCH for web queries', () => {
    const context: ToolSelectionContext = {
      query: 'Search the web for the latest news about AI',
      availableTools: mockTools,
    };
    
    const result = selectTools(context);
    
    expect(result.selectedTools.map(t => t.type)).toContain(ToolType.WEB_SEARCH);
  });

  it('should auto-enable CODE_INTERPRETER for spreadsheet attachments', () => {
    const attachments: AttachmentFile[] = [
      {
        file_id: '1',
        filename: 'data.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 5000,
      },
    ];
    
    const context: ToolSelectionContext = {
      query: 'Analyze this data',
      availableTools: mockTools,
      attachments,
    };
    
    const result = selectTools(context);
    
    expect(result.autoEnabledTools).toContain(ToolType.CODE_INTERPRETER);
    expect(result.selectedTools.map(t => t.type)).toContain(ToolType.CODE_INTERPRETER);
  });

  it('should auto-enable FILE_SEARCH for document attachments', () => {
    const attachments: AttachmentFile[] = [
      {
        file_id: '1',
        filename: 'report.pdf',
        mimetype: 'application/pdf',
        size: 10000,
      },
    ];
    
    const context: ToolSelectionContext = {
      query: 'Hello there', // Neutral query that doesn't trigger FILE_SEARCH intent
      availableTools: mockTools,
      attachments,
    };
    
    const result = selectTools(context);
    
    expect(result.autoEnabledTools).toContain(ToolType.FILE_SEARCH);
    expect(result.selectedTools.map(t => t.type)).toContain(ToolType.FILE_SEARCH);
  });

  it('should respect user preferred tools', () => {
    const context: ToolSelectionContext = {
      query: 'Hello',
      availableTools: mockTools,
      preferredTools: [ToolType.WEB_SEARCH],
    };
    
    const result = selectTools(context);
    
    expect(result.selectedTools.map(t => t.type)).toContain(ToolType.WEB_SEARCH);
  });

  it('should not select disabled tools', () => {
    const disabledTools: ToolDefinition[] = [
      {
        type: ToolType.CODE_INTERPRETER,
        name: 'Code Interpreter',
        enabled: false, // Disabled
      },
    ];
    
    const context: ToolSelectionContext = {
      query: 'Run this Python code',
      availableTools: disabledTools,
    };
    
    const result = selectTools(context);
    
    expect(result.selectedTools).toHaveLength(0);
  });

  it('should return empty selection for generic queries', () => {
    const context: ToolSelectionContext = {
      query: 'Hello, how are you?',
      availableTools: mockTools,
    };
    
    const result = selectTools(context);
    
    expect(result.selectedTools).toHaveLength(0);
    expect(result.reasoning).toContain('No specific tools detected');
  });
});

describe('shouldEnableTool', () => {
  it('should return true for code tool with code query', () => {
    expect(shouldEnableTool(ToolType.CODE_INTERPRETER, {
      query: 'Execute this Python script',
    })).toBe(true);
  });

  it('should return true for file search with document attachment', () => {
    const attachments: AttachmentFile[] = [
      {
        file_id: '1',
        filename: 'doc.pdf',
        mimetype: 'application/pdf',
        size: 5000,
      },
    ];
    
    expect(shouldEnableTool(ToolType.FILE_SEARCH, {
      query: 'What is this?',
      attachments,
    })).toBe(true);
  });

  it('should return false for unrelated tool', () => {
    expect(shouldEnableTool(ToolType.IMAGE_GENERATION, {
      query: 'What is 2 + 2?',
    })).toBe(false);
  });
});
