/**
 * Tests for Core Intent Analyzer - Query Intent
 */

import {
  analyzeQueryIntent,
  shouldUseTool,
  Tool,
  UploadIntent,
  QueryContext,
} from '../core';

describe('Query Intent Analyzer', () => {
  const allTools = [Tool.FILE_SEARCH, Tool.CODE_INTERPRETER, Tool.ARTIFACTS, Tool.WEB_SEARCH];

  describe('analyzeQueryIntent - with attachments', () => {
    it('should select CODE_INTERPRETER for spreadsheet attachments', () => {
      const context: QueryContext = {
        query: 'What is in this file?',
        attachedFiles: {
          files: [{ filename: 'data.xlsx', mimetype: 'application/vnd.ms-excel' }],
          uploadIntents: [UploadIntent.CODE_INTERPRETER],
        },
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.contextPrompts.length).toBeGreaterThan(0);
    });

    it('should select FILE_SEARCH for document attachments', () => {
      const context: QueryContext = {
        query: 'Summarize this document',
        attachedFiles: {
          files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
          uploadIntents: [UploadIntent.FILE_SEARCH],
        },
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.FILE_SEARCH);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should not add tools for image attachments (uses vision)', () => {
      const context: QueryContext = {
        query: 'What is in this image?',
        attachedFiles: {
          files: [{ filename: 'photo.png', mimetype: 'image/png' }],
          uploadIntents: [UploadIntent.IMAGE],
        },
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      // Images don't map to a tool - they use built-in vision
      expect(result.tools).not.toContain(Tool.CODE_INTERPRETER);
      expect(result.tools).not.toContain(Tool.FILE_SEARCH);
    });

    it('should handle mixed attachments', () => {
      const context: QueryContext = {
        query: 'Compare the data with the report',
        attachedFiles: {
          files: [
            { filename: 'data.xlsx', mimetype: 'application/vnd.ms-excel' },
            { filename: 'report.pdf', mimetype: 'application/pdf' },
          ],
          uploadIntents: [UploadIntent.CODE_INTERPRETER, UploadIntent.FILE_SEARCH],
        },
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      expect(result.tools).toContain(Tool.FILE_SEARCH);
    });
  });

  describe('analyzeQueryIntent - without attachments (query patterns)', () => {
    it('should select FILE_SEARCH for document search queries when auto-enabled', () => {
      const queries = [
        'Search the documents for pricing information',
        'What does the contract say about termination?',
        'Find all mentions of "deadline" in the files',
        'Summarize the uploaded PDF',
      ];

      for (const query of queries) {
        const context: QueryContext = {
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.FILE_SEARCH], // Auto-enabled for lower threshold
        };

        const result = analyzeQueryIntent(context);
        expect(result.tools).toContain(Tool.FILE_SEARCH);
      }
    });

    it('should select CODE_INTERPRETER for data analysis queries when auto-enabled', () => {
      const queries = [
        'Analyze the sales data from this CSV file',
        'Create a chart showing monthly trends',
        'Run a Python script to analyze this',
        'Use pandas to process this dataset',
        'Generate a plot of the results using matplotlib',
      ];

      for (const query of queries) {
        const context: QueryContext = {
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER], // Auto-enabled for lower threshold
        };

        const result = analyzeQueryIntent(context);
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      }
    });

    it('should select FILE_SEARCH for high confidence queries even without auto-enabled', () => {
      // High confidence pattern: "search ... in the documents"
      const context: QueryContext = {
        query: 'Search in the documents for pricing information',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.FILE_SEARCH);
    });

    it('should select CODE_INTERPRETER for high confidence queries even without auto-enabled', () => {
      // High confidence pattern: "analyze data spreadsheet"
      const context: QueryContext = {
        query: 'Analyze data from this spreadsheet',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
    });

    it('should select ARTIFACTS for UI/component creation queries', () => {
      const queries = [
        'Create a React component for a login form',
        'Build an interactive dashboard',
        'Design a simple HTML page',
      ];

      for (const query of queries) {
        const context: QueryContext = {
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.ARTIFACTS], // Auto-enabled for lower threshold
        };

        const result = analyzeQueryIntent(context);
        expect(result.tools).toContain(Tool.ARTIFACTS);
      }
    });

    it('should select WEB_SEARCH for current events/news queries when auto-enabled', () => {
      const queries = [
        'What are the latest news about AI?',
        'Search the web for information about climate change',
        'What is the current weather in New York?',
        'Find information online about stock prices today',
        'What is happening currently in technology?',
      ];

      for (const query of queries) {
        const context: QueryContext = {
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH], // Auto-enabled for lower threshold
        };

        const result = analyzeQueryIntent(context);
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should select WEB_SEARCH for high confidence queries even without auto-enabled', () => {
      // High confidence pattern: "search on the web"
      const context: QueryContext = {
        query: 'Search on the web for information about climate change',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.WEB_SEARCH);
    });

    it('should return empty tools for generic queries', () => {
      const context: QueryContext = {
        query: 'Hello, how are you?',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools.length).toBe(0);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('analyzeQueryIntent - tool availability filtering', () => {
    it('should only return available tools', () => {
      const context: QueryContext = {
        query: 'Calculate the average and search the document',
        availableTools: [Tool.FILE_SEARCH], // CODE_INTERPRETER not available
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.FILE_SEARCH);
      expect(result.tools).not.toContain(Tool.CODE_INTERPRETER);
    });

    it('should handle no available tools', () => {
      const context: QueryContext = {
        query: 'Calculate something',
        availableTools: [],
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools.length).toBe(0);
    });
  });

  describe('analyzeQueryIntent - context prompts', () => {
    it('should include tool-specific context prompts', () => {
      const context: QueryContext = {
        query: 'Analyze this spreadsheet',
        attachedFiles: {
          files: [{ filename: 'data.xlsx', mimetype: 'application/vnd.ms-excel' }],
          uploadIntents: [UploadIntent.CODE_INTERPRETER],
        },
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.contextPrompts.length).toBeGreaterThan(0);
      expect(result.contextPrompts.some(p => p.includes('code interpreter'))).toBe(true);
    });

    it('should include file-specific context prompts', () => {
      const context: QueryContext = {
        query: 'What is in this file?',
        attachedFiles: {
          files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
          uploadIntents: [UploadIntent.FILE_SEARCH],
        },
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.contextPrompts.some(p => p.includes('document'))).toBe(true);
    });
  });

  describe('shouldUseTool', () => {
    it('should return true when tool is in selected tools', () => {
      const context: QueryContext = {
        query: 'Analyze this CSV data and calculate the average using Python',
        availableTools: allTools,
      };

      expect(shouldUseTool(Tool.CODE_INTERPRETER, context)).toBe(true);
    });

    it('should return false when tool is not selected', () => {
      const context: QueryContext = {
        query: 'Hello there',
        availableTools: allTools,
      };

      expect(shouldUseTool(Tool.CODE_INTERPRETER, context)).toBe(false);
    });
  });

  describe('analyzeQueryIntent - auto-enabled tools', () => {
    it('should add auto-enabled tools only with meaningful signal (score >= 0.25)', () => {
      const context: QueryContext = {
        query: 'What is the current Bitcoin price today?',  // Higher signal query
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH],
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.WEB_SEARCH);
      expect(result.reasoning).toContain('auto-enabled');
    });

    it('should NOT add auto-enabled tools with weak signal (score < 0.25)', () => {
      const context: QueryContext = {
        query: 'Show me something current',  // Weak signal - only "current" matches
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH],
      };

      const result = analyzeQueryIntent(context);
      // Should NOT include WEB_SEARCH - weak signal, LLM should respond from memory
      expect(result.tools).not.toContain(Tool.WEB_SEARCH);
    });

    it('should prioritize auto-enabled tools over non-auto-enabled', () => {
      const context: QueryContext = {
        query: 'Create a chart to visualize the trends', // Clear visualization request
        availableTools: allTools,
        autoEnabledTools: [Tool.CODE_INTERPRETER],
      };

      const result = analyzeQueryIntent(context);
      // Auto-enabled CODE_INTERPRETER should be included
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
    });

    it('should not add auto-enabled tools with no query match', () => {
      const context: QueryContext = {
        query: 'Hello, how are you?',
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH],
      };

      const result = analyzeQueryIntent(context);
      // Even auto-enabled tools need some query match
      expect(result.tools).not.toContain(Tool.WEB_SEARCH);
    });
  });

  describe('analyzeQueryIntent - user selected tools', () => {
    it('should always include user selected tools', () => {
      const context: QueryContext = {
        query: 'Hello there',
        availableTools: allTools,
        userSelectedTools: [Tool.CODE_INTERPRETER, Tool.FILE_SEARCH],
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      expect(result.tools).toContain(Tool.FILE_SEARCH);
      expect(result.confidence).toBe(1.0); // User selected = max confidence
    });

    it('should give highest priority to user selected over auto-enabled', () => {
      const context: QueryContext = {
        query: 'Search for something',
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH, Tool.FILE_SEARCH],
        userSelectedTools: [Tool.FILE_SEARCH],
      };

      const result = analyzeQueryIntent(context);
      // User selected FILE_SEARCH should be first
      expect(result.tools[0]).toBe(Tool.FILE_SEARCH);
      expect(result.reasoning).toContain('explicitly selected by user');
    });

    it('should not add user selected tools that are not available', () => {
      const context: QueryContext = {
        query: 'Do something',
        availableTools: [Tool.FILE_SEARCH], // Only FILE_SEARCH available
        userSelectedTools: [Tool.CODE_INTERPRETER, Tool.FILE_SEARCH],
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.FILE_SEARCH);
      expect(result.tools).not.toContain(Tool.CODE_INTERPRETER);
    });
  });

  describe('analyzeQueryIntent - combined scenarios', () => {
    it('should handle attachments + auto-enabled + query intent', () => {
      const context: QueryContext = {
        query: 'Analyze this data and search online for related trends',
        attachedFiles: {
          files: [{ filename: 'data.xlsx', mimetype: 'application/vnd.ms-excel' }],
          uploadIntents: [UploadIntent.CODE_INTERPRETER],
        },
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH],
      };

      const result = analyzeQueryIntent(context);
      // Should have CODE_INTERPRETER from attachment
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      // Should have WEB_SEARCH from auto-enabled + query
      expect(result.tools).toContain(Tool.WEB_SEARCH);
      expect(result.contextPrompts.length).toBeGreaterThan(0);
    });

    it('should handle user selected + attachments', () => {
      const context: QueryContext = {
        query: 'Process this file',
        attachedFiles: {
          files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
          uploadIntents: [UploadIntent.FILE_SEARCH],
        },
        availableTools: allTools,
        userSelectedTools: [Tool.CODE_INTERPRETER],
      };

      const result = analyzeQueryIntent(context);
      // User selected should be included
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      // Attachment should also add FILE_SEARCH
      expect(result.tools).toContain(Tool.FILE_SEARCH);
    });

    it('should not duplicate tools', () => {
      const context: QueryContext = {
        query: 'Search documents',
        attachedFiles: {
          files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
          uploadIntents: [UploadIntent.FILE_SEARCH],
        },
        availableTools: allTools,
        autoEnabledTools: [Tool.FILE_SEARCH],
        userSelectedTools: [Tool.FILE_SEARCH],
      };

      const result = analyzeQueryIntent(context);
      // FILE_SEARCH should only appear once
      const fileSearchCount = result.tools.filter(t => t === Tool.FILE_SEARCH).length;
      expect(fileSearchCount).toBe(1);
    });
  });

  describe('analyzeQueryIntent - explicit tool requests', () => {
    it('should detect explicit request for code interpreter', () => {
      const context: QueryContext = {
        query: 'Use code interpreter to analyze the data',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      expect(result.reasoning).toContain('explicitly requested');
    });

    it('should detect explicit request for web search', () => {
      const context: QueryContext = {
        query: 'Search the web for current stock prices',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.WEB_SEARCH);
    });

    it('should detect explicit request for file search', () => {
      const context: QueryContext = {
        query: 'Use file search to find information about the contract',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.FILE_SEARCH);
    });

    it('should detect "run python" requests', () => {
      const context: QueryContext = {
        query: 'Run some python code to process this data',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
    });

    it('should detect "create artifact" requests', () => {
      const context: QueryContext = {
        query: 'Create an interactive component to display this',
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.ARTIFACTS);
    });
  });

  describe('analyzeQueryIntent - comprehensive keyword patterns', () => {
    describe('FILE_SEARCH patterns', () => {
      it('should match "according to the document" patterns', () => {
        const queries = [
          'According to the document, what is the deadline?',
          'As stated in the contract, what are the terms?',
          'Based on the PDF, summarize the findings',
          'What does the agreement mention about termination?',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
          });
          expect(result.tools).toContain(Tool.FILE_SEARCH);
        }
      });

      it('should score business document patterns above threshold when auto-enabled', () => {
        const queries = [
          'What are the terms in the SLA?',
          'Find the liability clause in the NDA',
          'Review the proposal for pricing details',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
            autoEnabledTools: [Tool.FILE_SEARCH],  // With auto-enabled, lower threshold applies
          });
          // Should include file_search when auto-enabled (threshold is 0.1)
          expect(result.tools).toContain(Tool.FILE_SEARCH);
        }
      });
    });

    describe('CODE_INTERPRETER patterns', () => {
      it('should match data analysis patterns with strong signals', () => {
        const queries = [
          'Create a chart showing sales vs time',
          'Build a visualization of the distribution',
          'Train a regression model on the data',
          'Analyze the data from this CSV file',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
          });
          expect(result.tools).toContain(Tool.CODE_INTERPRETER);
        }
      });

      it('should match file format patterns with auto-enabled', () => {
        const queries = [
          'Parse this JSON data',
          'Load the CSV file and analyze it',
          'Convert the XML to JSON',
          'Read the parquet file',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
            autoEnabledTools: [Tool.CODE_INTERPRETER],  // With auto-enabled
          });
          expect(result.tools).toContain(Tool.CODE_INTERPRETER);
        }
      });

      it('should match Python library patterns', () => {
        const queries = [
          'Use pandas to clean the data',
          'Plot using matplotlib',
          'Use scikit-learn for classification',
          'Create a bokeh visualization',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
          });
          expect(result.tools).toContain(Tool.CODE_INTERPRETER);
        }
      });
    });

    describe('WEB_SEARCH patterns', () => {
      it('should match current information patterns', () => {
        const queries = [
          'What is the latest news on AI?',
          'Get the current Bitcoin price',
          'Find the live stock market data',
          'Search the web for trending AI topics',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
          });
          expect(result.tools).toContain(Tool.WEB_SEARCH);
        }
      });

      it('should match social media patterns with auto-enabled', () => {
        const queries = [
          'Search twitter for mentions of this topic',
          'What are people saying on reddit about this?',
          'Find LinkedIn posts about remote work',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
            autoEnabledTools: [Tool.WEB_SEARCH],  // With auto-enabled
          });
          expect(result.tools).toContain(Tool.WEB_SEARCH);
        }
      });
    });

    describe('ARTIFACTS patterns', () => {
      it('should match component creation patterns', () => {
        const queries = [
          'Create a React component for a login form',
          'Build an interactive dashboard',
          'Render this as an HTML page',
          'Design a UI for the settings page',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
          });
          expect(result.tools).toContain(Tool.ARTIFACTS);
        }
      });

      it('should match styling patterns with auto-enabled', () => {
        const queries = [
          'Create a styled component with Tailwind',
          'Build an animated card component',
          'Design a responsive navigation menu',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
            autoEnabledTools: [Tool.ARTIFACTS],  // With auto-enabled
          });
          expect(result.tools).toContain(Tool.ARTIFACTS);
        }
      });
    });
  });

  describe('Document Creation Patterns', () => {
    it('should select CODE_INTERPRETER for PowerPoint creation', () => {
      const queries = [
        'Create a powerpoint presentation',
        'Create a sample powerpoint presentation',
        'Generate a pptx file',
        'Make slides for my project',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      }
    });

    it('should select CODE_INTERPRETER for Word document creation', () => {
      const queries = [
        'Create a word document',
        'Generate a docx file',
        'Make a document with the summary',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      }
    });

    it('should select CODE_INTERPRETER for PDF generation', () => {
      const queries = [
        'Generate a PDF report',
        'Create a PDF from this data',
        'Export to PDF',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      }
    });

    it('should select CODE_INTERPRETER for Excel/spreadsheet creation', () => {
      const queries = [
        'Create an excel spreadsheet',
        'Export the results to xlsx',
        'Generate a spreadsheet',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      }
    });

    it('should select CODE_INTERPRETER for file conversion', () => {
      const queries = [
        'Convert this to PDF',
        'Export as docx',
        'Transform to xlsx format',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      }
    });
  });

  describe('Follow-up Modification Patterns', () => {
    it('should select CODE_INTERPRETER for presentation modifications', () => {
      const queries = [
        'Update the slides with more statistics',
        'Modify the presentation with better visuals',
        'Improve the slides',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      }
    });

    it('should select CODE_INTERPRETER for enhancement requests', () => {
      const queries = [
        'Make it more modern and presentable',
        'Make the document better',
        'Make this more professional',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
      }
    });
  });
});
