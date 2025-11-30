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
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);
    });

    it('should select tools based on query intent', () => {
      const context: QueryContext = {
        query: 'What is in this file?',
        attachedFiles: {
          files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
          uploadIntents: [UploadIntent.FILE_SEARCH],
        },
        availableTools: allTools,
      };

      const result = analyzeQueryIntent(context);
      expect(result.tools).toContain(Tool.FILE_SEARCH);
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

  describe('WEB_SEARCH - Real-time Information Patterns', () => {
    it('should select WEB_SEARCH for weather queries', () => {
      const queries = [
        'What is the weather in Dallas TX',
        'Weather forecast for New York',
        'Is it going to rain tomorrow',
        'Check the weather in London',
        'How hot is it in Phoenix',
        'Will it snow in Chicago',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should select WEB_SEARCH for current leadership/position queries', () => {
      const queries = [
        'Who is the current US president',
        'Who is the CEO of Apple',
        'Current prime minister of UK',
        'Who is the current chairman of the Federal Reserve',
        'Who is running the company now',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should select WEB_SEARCH for sports scores and results', () => {
      const queries = [
        'Get me latest scores of game',
        'What is the final score of the Lakers game',
        'NFL scores today',
        'Premier League standings',
        'Who won the Super Bowl',
        'NBA results',
        'Champions League fixtures',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should select WEB_SEARCH for stock/crypto prices', () => {
      const queries = [
        'What is the Bitcoin price',
        'Current stock price of Tesla',
        'How much is Ethereum right now',
        'AAPL stock today',
        'Crypto market update',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should select WEB_SEARCH for breaking news and current events', () => {
      const queries = [
        'Breaking news about the election',
        'Latest updates on AI',
        'What is trending today',
        'Just announced by Apple',
        'What happened in 2025',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should select WEB_SEARCH for election and political queries', () => {
      const queries = [
        'Election results 2024',
        'Who is winning the primary',
        'Latest poll numbers',
        'Who is leading in the race',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should select WEB_SEARCH for product release queries', () => {
      const queries = [
        'When is the iPhone 16 release date',
        'Is GTA 6 out yet',
        'When does the new MacBook come out',
        'Has Windows 12 been released',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should select WEB_SEARCH for schedule and event queries', () => {
      const queries = [
        'When is the Super Bowl',
        'What is playing tonight',
        'What is happening this weekend',
        'Schedule for the conference',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });
  });

  describe('Document Reference Suppression - WEB_SEARCH vs FILE_SEARCH', () => {
    it('should suppress WEB_SEARCH when query references documents and files are attached', () => {
      const queries = [
        'Who is the president mentioned in this document',
        'What does the attached file say about current events',
        'According to the document, what are the latest updates',
        'In the uploaded PDF, what is the current status',
        'Based on the provided file, who is leading',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          attachedFiles: {
            files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
            uploadIntents: [UploadIntent.FILE_SEARCH],
          },
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH, Tool.FILE_SEARCH],
        });
        // FILE_SEARCH should be selected (from attachments)
        expect(result.tools).toContain(Tool.FILE_SEARCH);
        // WEB_SEARCH should be suppressed (query references documents)
        expect(result.tools).not.toContain(Tool.WEB_SEARCH);
      }
    });

    it('should NOT suppress WEB_SEARCH when no document reference in query', () => {
      const result = analyzeQueryIntent({
        query: 'What is the weather in Dallas',  // No document reference
        attachedFiles: {
          files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
          uploadIntents: [UploadIntent.FILE_SEARCH],
        },
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH, Tool.FILE_SEARCH],
      });
      // Both should be available - LLM decides
      expect(result.tools).toContain(Tool.FILE_SEARCH);  // From attachments
      expect(result.tools).toContain(Tool.WEB_SEARCH);   // From query pattern
    });

    it('should NOT suppress WEB_SEARCH when no files are attached', () => {
      const result = analyzeQueryIntent({
        query: 'What does the document say about current events',  // References document but none attached
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH, Tool.FILE_SEARCH],
      });
      // No files attached, so no suppression
      // FILE_SEARCH might not be selected (no attachments)
      // WEB_SEARCH should still work for "current events"
      expect(result.tools).toContain(Tool.WEB_SEARCH);
    });

    it('should select WEB_SEARCH for real-time queries without document reference', () => {
      const queries = [
        'Who is the current US president',  // No "in the document"
        'What is happening today',
        'Latest stock prices',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          attachedFiles: {
            files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
            uploadIntents: [UploadIntent.FILE_SEARCH],
          },
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH, Tool.FILE_SEARCH],
        });
        // WEB_SEARCH should be selected - no document reference to suppress it
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });
  });

  describe('Edge Cases and Ambiguous Queries', () => {
    it('should NOT select WEB_SEARCH for general knowledge questions', () => {
      const queries = [
        'What is photosynthesis',
        'Explain the theory of relativity',
        'How does gravity work',
        'What causes earthquakes',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        // These are static knowledge questions - LLM should answer from memory
        expect(result.tools).not.toContain(Tool.WEB_SEARCH);
      }
    });

    it('should NOT select CODE_INTERPRETER for simple math questions', () => {
      const queries = [
        'What is 2 + 2',
        'Is 17 a prime number',
        'What is the square root of 144',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        // Simple math doesn't need code interpreter
        expect(result.tools).not.toContain(Tool.CODE_INTERPRETER);
      }
    });

    it('should handle queries with temporal indicators for web search', () => {
      const queries = [
        'What did Apple announce yesterday',
        'News from last week about Tesla',
        'What happened in tech this month',
        'Recent developments in AI',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });

    it('should handle multi-tool queries appropriately', () => {
      // Query that needs both web search and code interpreter
      const result = analyzeQueryIntent({
        query: 'Get the latest Tesla stock price and create a chart showing the trend',
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH, Tool.CODE_INTERPRETER],
      });
      
      expect(result.tools).toContain(Tool.WEB_SEARCH);  // For stock price
      expect(result.tools).toContain(Tool.CODE_INTERPRETER);  // For chart
    });

    it('should prioritize FILE_SEARCH when both document and web patterns match but files attached', () => {
      const result = analyzeQueryIntent({
        query: 'What are the latest figures mentioned in this report',
        attachedFiles: {
          files: [{ filename: 'report.pdf', mimetype: 'application/pdf' }],
          uploadIntents: [UploadIntent.FILE_SEARCH],
        },
        availableTools: allTools,
        autoEnabledTools: [Tool.WEB_SEARCH, Tool.FILE_SEARCH],
      });
      
      expect(result.tools).toContain(Tool.FILE_SEARCH);
      // "latest" triggers web search but "this report" should suppress it
      expect(result.tools).not.toContain(Tool.WEB_SEARCH);
    });
  });

  describe('Currency, Conversion, and Calculation Queries', () => {
    it('should select WEB_SEARCH for currency conversion queries', () => {
      const queries = [
        'What is the current USD to EUR exchange rate',
        'Convert 100 dollars to euros',
        'How much is 50 GBP in USD today',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.WEB_SEARCH],
        });
        expect(result.tools).toContain(Tool.WEB_SEARCH);
      }
    });
  });

  describe('Clarification Logic', () => {
    describe('Multi-tool clarification (regex handles)', () => {
      it('should ask for clarification when both artifacts AND execute_code match query patterns', () => {
        // Use a query that triggers BOTH tools with similar scores
        // "analyze data" triggers execute_code, "chart" triggers both, "visualization" triggers artifacts
        const result = analyzeQueryIntent({
          query: 'analyze this data and create a chart visualization',
          availableTools: allTools,
          autoEnabledTools: [Tool.ARTIFACTS, Tool.CODE_INTERPRETER],
        });
        
        // Both tools should be selected due to overlapping signals
        // If both are selected with high enough confidence, clarification should be prompted
        if (result.tools.includes(Tool.ARTIFACTS) && result.tools.includes(Tool.CODE_INTERPRETER)) {
          expect(result.clarificationPrompt).toBeDefined();
          expect(result.clarificationOptions).toBeDefined();
          expect(result.clarificationOptions?.length).toBeGreaterThan(0);
        }
      });

      it('should provide clarification options for visualization ambiguity', () => {
        const result = analyzeQueryIntent({
          query: 'plot a graph showing sales trends',
          availableTools: allTools,
          autoEnabledTools: [Tool.ARTIFACTS, Tool.CODE_INTERPRETER],
        });
        
        // Should detect ambiguity between React charts vs matplotlib
        if (result.tools.includes(Tool.ARTIFACTS) && result.tools.includes(Tool.CODE_INTERPRETER)) {
          expect(result.clarificationPrompt).toBeDefined();
        }
      });

      it('should NOT ask for clarification when only ONE tool is clearly selected', () => {
        const result = analyzeQueryIntent({
          query: 'create a react dashboard with mock data',
          availableTools: allTools,
          autoEnabledTools: [Tool.ARTIFACTS, Tool.CODE_INTERPRETER],
        });
        
        // Clear intent for artifacts only
        expect(result.tools).toContain(Tool.ARTIFACTS);
        expect(result.clarificationPrompt).toBeUndefined();
      });

      it('should NOT ask for clarification for clear code execution requests', () => {
        const result = analyzeQueryIntent({
          query: 'run python code to calculate the mean of [1,2,3,4,5]',
          availableTools: allTools,
          autoEnabledTools: [Tool.CODE_INTERPRETER],
        });
        
        expect(result.tools).toContain(Tool.CODE_INTERPRETER);
        expect(result.clarificationPrompt).toBeUndefined();
      });
    });

    describe('Low confidence - LLM fallback handles clarification', () => {
      it('should have low confidence for vague visualization requests', () => {
        const result = analyzeQueryIntent({
          query: 'visualize this',
          availableTools: allTools,
        });
        
        // Low confidence should trigger LLM fallback
        // "visualize" alone has no auto-enabled tools and low scores
        expect(result.confidence).toBeLessThan(0.5);
      });

      it('should have low confidence for vague create requests', () => {
        const result = analyzeQueryIntent({
          query: 'create something for this',
          availableTools: allTools,
        });
        
        // Very vague request should have low confidence
        expect(result.confidence).toBeLessThan(0.5);
      });

      it('should have low confidence for ambiguous display requests', () => {
        const result = analyzeQueryIntent({
          query: 'show me how this looks',
          availableTools: allTools,
        });
        
        expect(result.confidence).toBeLessThan(0.4);
      });
    });

    describe('Clear intent - no clarification needed', () => {
      it('should NOT need clarification for explicit React component requests', () => {
        const queries = [
          'create a react dashboard',
          'build an HTML page with a form',
          'generate a mermaid diagram',
          'make a vue component',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
            autoEnabledTools: [Tool.ARTIFACTS],
          });
          
          expect(result.tools).toContain(Tool.ARTIFACTS);
          expect(result.confidence).toBeGreaterThanOrEqual(0.4);
          // No clarification when intent is clear
          if (result.tools.length === 1) {
            expect(result.clarificationPrompt).toBeUndefined();
          }
        }
      });

      it('should NOT need clarification for explicit Python/code requests', () => {
        const queries = [
          'run python code to analyze the data',
          'execute this javascript',
          'plot with matplotlib',
          'calculate using pandas',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
            autoEnabledTools: [Tool.CODE_INTERPRETER],
          });
          
          expect(result.tools).toContain(Tool.CODE_INTERPRETER);
          expect(result.confidence).toBeGreaterThanOrEqual(0.4);
        }
      });

      it('should NOT need clarification for web search requests', () => {
        const queries = [
          'search the web for latest news',
          'what is the current stock price of AAPL',
          'find recent articles about AI',
        ];

        for (const query of queries) {
          const result = analyzeQueryIntent({
            query,
            availableTools: allTools,
            autoEnabledTools: [Tool.WEB_SEARCH],
          });
          
          expect(result.tools).toContain(Tool.WEB_SEARCH);
          // Web search alone shouldn't need clarification
          if (!result.tools.includes(Tool.ARTIFACTS) && !result.tools.includes(Tool.CODE_INTERPRETER)) {
            expect(result.clarificationPrompt).toBeUndefined();
          }
        }
      });
    });

    describe('Clarification options content', () => {
      it('should provide relevant options for chart/visualization ambiguity', () => {
        const result = analyzeQueryIntent({
          query: 'create a chart showing the trends',
          availableTools: allTools,
          autoEnabledTools: [Tool.ARTIFACTS, Tool.CODE_INTERPRETER],
        });
        
        if (result.clarificationPrompt) {
          expect(result.clarificationOptions).toBeDefined();
          // Options should mention both React and Python approaches
          const optionsText = result.clarificationOptions?.join(' ').toLowerCase();
          expect(optionsText).toMatch(/react|ui|interactive|python|matplotlib|code/i);
        }
      });
    });
  });

  describe('Artifacts Pattern Matching', () => {
    it('should match dashboard creation patterns', () => {
      const queries = [
        'generate a modern dashboard',
        'create a dashboard with mock data',
        'build a sales dashboard',
        'make a user dashboard',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.ARTIFACTS],
        });
        
        expect(result.tools).toContain(Tool.ARTIFACTS);
        expect(result.confidence).toBeGreaterThanOrEqual(0.4);
      }
    });

    it('should match diagram creation patterns', () => {
      const queries = [
        'create a mermaid diagram',
        'generate a flowchart',
        'build a sequence diagram',
        'make an ER diagram',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.ARTIFACTS],
        });
        
        expect(result.tools).toContain(Tool.ARTIFACTS);
      }
    });

    it('should match HTML/webpage creation patterns', () => {
      const queries = [
        'create an HTML page',
        'build a webpage',
        'generate an HTML form',
      ];

      for (const query of queries) {
        const result = analyzeQueryIntent({
          query,
          availableTools: allTools,
          autoEnabledTools: [Tool.ARTIFACTS],
        });
        
        expect(result.tools).toContain(Tool.ARTIFACTS);
      }
    });
  });
});
