const createYouTubeVideoLoaderTools = require('../YouTubeVideoLoader');
const {
  extractVideoId,
  findYouTubeUrl,
} = require('../YouTubeVideoLoader');

// Mock the logger
jest.mock('librechat-data-provider', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the fetch for transcript API
global.fetch = jest.fn();

describe('YouTubeVideoLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('extractVideoId', () => {
    it('should extract video ID from standard youtube.com watch URL', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('http://youtube.com/watch?v=abc123XYZ_-')).toBe('abc123XYZ_-');
    });

    it('should extract video ID from youtu.be short URL', () => {
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('http://youtu.be/abc123XYZ_-')).toBe('abc123XYZ_-');
    });

    it('should extract video ID from youtube.com/v/ URL', () => {
      expect(extractVideoId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtube.com/embed/ URL', () => {
      expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtube.com/shorts/ URL', () => {
      expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtube.com/live/ URL', () => {
      expect(extractVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should handle URLs with additional query parameters', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=120')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest')).toBe('dQw4w9WgXcQ');
    });

    it('should handle URLs with timestamps', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')).toBe('dQw4w9WgXcQ');
    });

    it('should return direct video ID if already 11 characters', () => {
      expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URLs', () => {
      expect(extractVideoId('https://www.google.com')).toBeNull();
      expect(extractVideoId('not a url')).toBeNull();
      expect(extractVideoId('')).toBeNull();
      expect(extractVideoId(null)).toBeNull();
      expect(extractVideoId(undefined)).toBeNull();
    });

    it('should return null for YouTube URLs without video ID', () => {
      expect(extractVideoId('https://www.youtube.com')).toBeNull();
      expect(extractVideoId('https://www.youtube.com/channel/UC123')).toBeNull();
      expect(extractVideoId('https://www.youtube.com/playlist?list=PLtest')).toBeNull();
    });
  });

  describe('findYouTubeUrl', () => {
    it('should find video ID from youtube.com watch URL in text', () => {
      const text = 'Check out this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ it is great!';
      expect(findYouTubeUrl(text)).toBe('dQw4w9WgXcQ');
    });

    it('should find video ID from youtu.be URL in text', () => {
      const text = 'Here is the link: https://youtu.be/dQw4w9WgXcQ check it out';
      expect(findYouTubeUrl(text)).toBe('dQw4w9WgXcQ');
    });

    it('should find video ID from youtube.com/shorts URL in text', () => {
      const text = 'This short is funny https://youtube.com/shorts/abc123XYZ_- lol';
      expect(findYouTubeUrl(text)).toBe('abc123XYZ_-');
    });

    it('should find video ID from youtube.com/embed URL in text', () => {
      const text = 'Embedded: https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(findYouTubeUrl(text)).toBe('dQw4w9WgXcQ');
    });

    it('should return first video ID when multiple URLs present', () => {
      const text = 'First: https://youtu.be/first123456 Second: https://youtu.be/second12345';
      expect(findYouTubeUrl(text)).toBe('first123456');
    });

    it('should return null when no YouTube URL found', () => {
      expect(findYouTubeUrl('No YouTube links here')).toBeNull();
      expect(findYouTubeUrl('Check out https://www.google.com')).toBeNull();
      expect(findYouTubeUrl('')).toBeNull();
      expect(findYouTubeUrl(null)).toBeNull();
    });
  });

  describe('createYouTubeVideoLoaderTools', () => {
    it('should return an array with the youtube_video tool', () => {
      const tools = createYouTubeVideoLoaderTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe('youtube_video');
    });

    it('should create tool with correct schema', () => {
      const tools = createYouTubeVideoLoaderTools();
      const tool = tools[0];
      
      expect(tool.name).toBe('youtube_video');
      expect(tool.description).toContain('YouTube');
      expect(tool.schema).toBeDefined();
    });

    describe('youtube_video tool', () => {
      let tool;

      beforeEach(() => {
        const tools = createYouTubeVideoLoaderTools();
        tool = tools[0];
        
        // Mock successful transcript fetch
        global.fetch.mockImplementation((url) => {
          if (url.includes('youtube.com/watch')) {
            // First call - get initial page for config
            return Promise.resolve({
              ok: true,
              text: () => Promise.resolve(`
                "captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{
                  "baseUrl":"https://www.youtube.com/api/timedtext?v=test",
                  "languageCode":"en"
                }]}}
              `),
            });
          } else if (url.includes('api/timedtext')) {
            // Second call - get actual transcript
            return Promise.resolve({
              ok: true,
              text: () => Promise.resolve(`<?xml version="1.0" encoding="utf-8" ?>
                <transcript>
                  <text start="0" dur="5">Hello and welcome</text>
                  <text start="5" dur="5">to this video</text>
                </transcript>
              `),
            });
          }
          return Promise.reject(new Error('Unknown URL'));
        });
      });

      it('should accept valid video URL input', async () => {
        const validInput = { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
        // This validates the input schema accepts valid URLs
        expect(() => tool.schema.parse(validInput)).not.toThrow();
      });

      it('should accept valid video ID input', async () => {
        const validInput = { url: 'dQw4w9WgXcQ' };
        expect(() => tool.schema.parse(validInput)).not.toThrow();
      });

      it('should accept optional language parameter', async () => {
        const validInput = { 
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          language: 'es' 
        };
        expect(() => tool.schema.parse(validInput)).not.toThrow();
      });

      it('should reject empty url at execution time', async () => {
        // Empty URL passes schema validation but fails during extraction
        const invalidInput = { url: '' };
        // Schema allows it (validated at runtime)
        expect(() => tool.schema.parse(invalidInput)).not.toThrow();
        // But tool invoke will throw
        await expect(tool.invoke(invalidInput)).rejects.toThrow('Invalid YouTube URL or video ID');
      });

      it('should reject missing url', () => {
        const invalidInput = {};
        expect(() => tool.schema.parse(invalidInput)).toThrow();
      });
    });
  });

  describe('Tool Integration', () => {
    it('should be usable as a LangChain tool', () => {
      const tools = createYouTubeVideoLoaderTools();
      const tool = tools[0];
      
      // Check LangChain tool interface
      expect(typeof tool.invoke).toBe('function');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
    });

    it('should handle network errors gracefully', async () => {
      const tools = createYouTubeVideoLoaderTools();
      const tool = tools[0];
      
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      // Tool throws errors rather than returning error strings
      await expect(tool.invoke({ url: 'dQw4w9WgXcQ' })).rejects.toThrow('Failed to fetch YouTube video content');
    });

    it('should handle invalid video ID', async () => {
      const tools = createYouTubeVideoLoaderTools();
      const tool = tools[0];
      
      // Invalid video IDs throw at extraction time
      await expect(tool.invoke({ url: 'invalid' })).rejects.toThrow('Invalid YouTube URL or video ID');
    });
  });
});

describe('URL Pattern Coverage', () => {
  // Comprehensive URL pattern tests for regression
  const validUrls = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['http://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['http://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['http://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/v/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=120', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=abc123XYZ_-', 'abc123XYZ_-'],
  ];

  const invalidUrls = [
    'https://www.google.com',
    'https://vimeo.com/123456789',
    'https://www.youtube.com',
    'https://www.youtube.com/channel/UC123',
    'https://www.youtube.com/user/testuser',
    'https://www.youtube.com/playlist?list=PLtest',
    'https://www.youtube.com/results?search_query=test',
    'not a url at all',
    '',
  ];

  test.each(validUrls)('extractVideoId(%s) should return %s', (url, expectedId) => {
    expect(extractVideoId(url)).toBe(expectedId);
  });

  test.each(invalidUrls)('extractVideoId(%s) should return null', (url) => {
    expect(extractVideoId(url)).toBeNull();
  });
});
