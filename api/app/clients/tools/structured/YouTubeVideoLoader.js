/**
 * YouTube Video Loader Tool
 * 
 * A keyless YouTube tool that fetches video transcripts and metadata without requiring API keys.
 * Based on AnythingLLM's implementation - uses YouTube's internal APIs directly.
 * 
 * This is a SINGLE unified tool that fetches both transcript AND metadata together,
 * exactly following the pattern of AnythingLLM's YouTubeLoader.
 * 
 * Features:
 * - Fetch video transcripts/captions (no API key required)
 * - Fetch video metadata (title, description, author, view count)
 * - Support for multiple languages with preference scoring
 * - Prefers human-transcribed captions over auto-generated (ASR)
 * 
 * @module YouTubeVideoLoader
 */

const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('ranger-data-provider');

/**
 * Custom error class for YouTube transcript errors
 */
class YouTubeTranscriptError extends Error {
  constructor(message) {
    super(`[YouTubeTranscript] ${message}`);
    this.name = 'YouTubeTranscriptError';
  }
}

/**
 * YouTube URL patterns for validation and video ID extraction
 */
const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
];

/**
 * Validates if a string is a YouTube URL or video ID
 * @param {string} input - URL or video ID
 * @returns {string|null} - Video ID if valid, null otherwise
 */
function extractVideoId(input) {
  if (!input) return null;
  
  // Check if it's already a valid 11-character video ID
  const rawIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  if (rawIdRegex.test(input)) {
    return input;
  }

  // Try each URL pattern
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if a string contains a YouTube URL and extract the video ID
 * @param {string} text - Text to check for YouTube URLs
 * @returns {string|null} - Video ID if found, null otherwise
 */
function findYouTubeUrl(text) {
  if (!text) return null;
  
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Check if text contains any YouTube URL
 * @param {string} text - Text to check
 * @returns {boolean} - True if YouTube URL found
 */
function containsYouTubeUrl(text) {
  return findYouTubeUrl(text) !== null;
}

/**
 * YouTubeTranscript class - Handles fetching transcripts from YouTube
 * Uses YouTube's internal get_transcript API with protobuf encoding
 * (Exact implementation from AnythingLLM's youtube-transcript.js)
 */
class YouTubeTranscript {
  /**
   * Encodes a string as a protobuf field
   */
  static #encodeProtobufString(fieldNumber, str) {
    const utf8Bytes = Buffer.from(str, 'utf8');
    const tag = (fieldNumber << 3) | 2;
    const lengthBytes = this.#encodeVarint(utf8Bytes.length);

    return Buffer.concat([
      Buffer.from([tag]),
      Buffer.from(lengthBytes),
      utf8Bytes,
    ]);
  }

  /**
   * Encodes a number as a protobuf varint
   */
  static #encodeVarint(value) {
    const bytes = [];
    while (value >= 0x80) {
      bytes.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    bytes.push(value);
    return bytes;
  }

  /**
   * Creates a base64 encoded protobuf message
   */
  static #getBase64Protobuf({ param1, param2 }) {
    const field1 = this.#encodeProtobufString(1, param1);
    const field2 = this.#encodeProtobufString(2, param2);
    return Buffer.concat([field1, field2]).toString('base64');
  }

  /**
   * Extracts transcript text from YouTube API response
   */
  static #extractTranscriptFromResponse(responseData) {
    const transcriptRenderer =
      responseData.actions?.[0]?.updateEngagementPanelAction?.content
        ?.transcriptRenderer;
    if (!transcriptRenderer) {
      throw new YouTubeTranscriptError('No transcript data found in response');
    }

    const segments =
      transcriptRenderer.content?.transcriptSearchPanelRenderer?.body
        ?.transcriptSegmentListRenderer?.initialSegments;
    if (!segments) {
      throw new YouTubeTranscriptError('Transcript segments not found in response');
    }

    return segments
      .map((segment) => {
        const runs = segment.transcriptSegmentRenderer?.snippet?.runs;
        return runs ? runs.map((run) => run.text).join('') : '';
      })
      .filter((text) => text)
      .join(' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Calculates a preference score for a caption track (lower is better)
   * Prefers human-transcribed over auto-generated (ASR)
   */
  static #calculatePreferenceScore(track, preferredLanguages) {
    const languagePreference = preferredLanguages.indexOf(track.languageCode);
    const languageScore = languagePreference === -1 ? 9999 : languagePreference;
    const kindBonus = track.kind === 'asr' ? 0.5 : 0;
    return languageScore + kindBonus;
  }

  /**
   * Finds the most suitable caption track based on preferred languages
   */
  static #findPreferredCaptionTrack(videoBody, preferredLanguages) {
    const captionsConfigJson = videoBody.match(
      /"captions":(.*?),"videoDetails":/s
    );

    const captionsConfig = captionsConfigJson?.[1]
      ? JSON.parse(captionsConfigJson[1])
      : null;

    const captionTracks = captionsConfig
      ? captionsConfig.playerCaptionsTracklistRenderer?.captionTracks
      : null;

    if (!captionTracks || captionTracks.length === 0) {
      return null;
    }

    const sortedTracks = [...captionTracks].sort((a, b) => {
      const scoreA = this.#calculatePreferenceScore(a, preferredLanguages);
      const scoreB = this.#calculatePreferenceScore(b, preferredLanguages);
      return scoreA - scoreB;
    });

    return sortedTracks[0];
  }

  /**
   * Fetches video page content and finds the preferred caption track
   */
  static async #getPreferredCaptionTrack(videoId, preferredLanguages) {
    const videoResponse = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      { 
        credentials: 'omit',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );
    const videoBody = await videoResponse.text();

    const preferredCaptionTrack = this.#findPreferredCaptionTrack(
      videoBody,
      preferredLanguages
    );

    if (!preferredCaptionTrack) {
      throw new YouTubeTranscriptError(
        'No suitable caption track found for the video. The video may not have captions available.'
      );
    }

    return preferredCaptionTrack;
  }

  /**
   * Fetch transcript from YouTube video
   * @param {string} videoId - Video identifier
   * @param {Object} config - Configuration options
   * @param {string} [config.lang='en'] - Primary language code
   * @returns {Promise<string>} Video transcript text
   */
  static async fetchTranscript(videoId, config = {}) {
    const preferredLanguages = config?.lang ? [config.lang, 'en'] : ['en'];

    try {
      const preferredCaptionTrack = await this.#getPreferredCaptionTrack(
        videoId,
        preferredLanguages
      );

      const innerProto = this.#getBase64Protobuf({
        param1: preferredCaptionTrack.kind || '',
        param2: preferredCaptionTrack.languageCode,
      });

      const params = this.#getBase64Protobuf({
        param1: videoId,
        param2: innerProto,
      });

      const response = await fetch(
        'https://www.youtube.com/youtubei/v1/get_transcript',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20240826.01.00',
              },
            },
            params,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      return this.#extractTranscriptFromResponse(responseData);
    } catch (e) {
      if (e instanceof YouTubeTranscriptError) {
        throw e;
      }
      throw new YouTubeTranscriptError(e.message || String(e));
    }
  }
}

/**
 * YouTubeLoader class - Unified loader that fetches both transcript and metadata
 * Exact pattern from AnythingLLM's YoutubeLoader
 */
class YouTubeLoader {
  #videoId;
  #language;
  #addVideoInfo;

  constructor({ videoId = null, language = null, addVideoInfo = true } = {}) {
    if (!videoId) throw new Error('Invalid video id!');
    this.#videoId = videoId;
    this.#language = language;
    this.#addVideoInfo = addVideoInfo;
  }

  /**
   * Extracts the videoId from a YouTube video URL
   */
  static getVideoID(url) {
    const videoId = extractVideoId(url);
    if (videoId) return videoId;
    throw new Error('Failed to get youtube video id from the url');
  }

  /**
   * Creates a new instance from a YouTube video URL
   */
  static createFromUrl(url, config = {}) {
    const videoId = YouTubeLoader.getVideoID(url);
    return new YouTubeLoader({ ...config, videoId });
  }

  /**
   * Fetches video metadata from YouTube page
   * (Similar to AnythingLLM's usage of youtubei.js but without the dependency)
   */
  async #fetchVideoInfo(videoId) {
    try {
      const response = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch video page: ${response.status}`);
      }

      const html = await response.text();

      // Extract video details from the page using multiple patterns for robustness
      let videoDetails = {};
      
      // Try pattern 1: videoDetails in ytInitialPlayerResponse
      const pattern1 = html.match(/"videoDetails"\s*:\s*(\{[^}]*"videoId"[^}]*\})/);
      // Try pattern 2: Look for ytInitialPlayerResponse JSON
      const pattern2 = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
      // Try pattern 3: videoDetails with more context
      const pattern3 = html.match(/"videoDetails":\s*(\{"videoId":"[^"]+","title":"[^"]*"[^}]+\})/);
      
      if (pattern2) {
        try {
          const playerResponse = JSON.parse(pattern2[1]);
          if (playerResponse.videoDetails) {
            videoDetails = playerResponse.videoDetails;
          }
        } catch (e) {
          // Fall through to other patterns
        }
      }
      
      if (!videoDetails.title && (pattern1 || pattern3)) {
        try {
          videoDetails = JSON.parse((pattern1 || pattern3)[1]);
        } catch (e) {
          logger.warn('[YouTubeLoader] Failed to parse video details JSON');
        }
      }

      return {
        title: videoDetails.title || 'Unknown Title',
        author: videoDetails.author || 'Unknown Author',
        short_description: videoDetails.shortDescription || '',
        view_count: videoDetails.viewCount || '0',
      };
    } catch (error) {
      logger.error('[YouTubeLoader] Error fetching video info:', error.message);
      return {
        title: 'Unknown Title',
        author: 'Unknown Author',
        short_description: '',
        view_count: '0',
      };
    }
  }

  /**
   * Loads the transcript and video metadata from the specified YouTube video.
   * Exact pattern from AnythingLLM's YoutubeLoader.load()
   * @returns {Promise<Array<{pageContent: string, metadata: Object}>>} LangChain-like document
   */
  async load() {
    let transcript;
    const metadata = {
      source: this.#videoId,
    };

    try {
      // Fetch transcript
      transcript = await YouTubeTranscript.fetchTranscript(this.#videoId, {
        lang: this.#language,
      });

      if (!transcript) {
        throw new Error('Transcription not found');
      }

      // Fetch video info if requested (default: true)
      if (this.#addVideoInfo) {
        const info = await this.#fetchVideoInfo(this.#videoId);
        metadata.description = info.short_description;
        metadata.title = info.title;
        metadata.view_count = info.view_count;
        metadata.author = info.author;
      }
    } catch (e) {
      throw new Error(`Failed to get YouTube video transcription: ${e?.message}`);
    }

    return [
      {
        pageContent: transcript,
        metadata,
      },
    ];
  }
}

/**
 * Builds formatted content string with metadata for LLM context
 * Exact pattern from AnythingLLM's buildTranscriptContentWithMetadata
 */
function buildTranscriptContentWithMetadata(content = '', metadata = {}) {
  const VALID_METADATA_KEYS = ['title', 'author', 'description', 'view_count'];
  if (!content || !metadata || Object.keys(metadata).length === 0) {
    return content;
  }

  let contentWithMetadata = '';
  VALID_METADATA_KEYS.forEach((key) => {
    if (!metadata[key]) return;
    contentWithMetadata += `<${key}>${metadata[key]}</${key}>\n`;
  });
  return `${contentWithMetadata}\nTranscript:\n${content}`;
}

/**
 * Creates the YouTube Video Loader tool
 * This is a SINGLE unified tool that fetches both transcript AND metadata,
 * exactly following the pattern of AnythingLLM's implementation.
 * 
 * Keyless - no API authentication required.
 * 
 * @param {Object} fields - Optional configuration fields
 * @returns {Array} Array containing the single LangChain tool instance
 */
function createYouTubeVideoLoaderTools(fields = {}) {
  const youtubeVideoTool = tool(
    async ({ url, language }) => {
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL or video ID. Please provide a valid YouTube URL or 11-character video ID.');
      }

      try {
        // Use the unified YouTubeLoader (same pattern as AnythingLLM)
        const loader = YouTubeLoader.createFromUrl(url, { 
          addVideoInfo: true,
          language: language || 'en',
        });
        
        const docs = await loader.load();
        
        if (!docs.length || !docs[0].pageContent) {
          throw new Error('No transcript found for this YouTube video.');
        }

        const { pageContent: transcript, metadata } = docs[0];
        
        // Build formatted content with metadata (same as AnythingLLM)
        const formattedContent = buildTranscriptContentWithMetadata(transcript, metadata);
        
        return formattedContent;
      } catch (error) {
        logger.error('[youtube_video] Error:', error.message);
        throw new Error(`Failed to fetch YouTube video content: ${error.message}`);
      }
    },
    {
      name: 'youtube_video',
      description: `Fetch the transcript/captions and metadata of a YouTube video. This tool extracts the full transcript text along with video information (title, author, description, view count).

**When to use:**
- User shares a YouTube link and asks to summarize, analyze, or explain the video
- User wants to know what a YouTube video is about
- User asks for key points, quotes, or specific information from a video
- User provides a YouTube URL and asks any question about its content

**Capabilities:**
- Fetches full video transcript/captions (supports multiple languages)
- Retrieves video metadata (title, author, description, view count)
- Works without any API key (keyless operation)
- Supports various YouTube URL formats (youtube.com, youtu.be, shorts, etc.)

**Returns:** Formatted content with video metadata tags (<title>, <author>, <description>, <view_count>) and full transcript text.

**Example URLs supported:**
- https://www.youtube.com/watch?v=VIDEO_ID
- https://youtu.be/VIDEO_ID  
- https://www.youtube.com/shorts/VIDEO_ID
- Direct video ID (11 characters)`,
      schema: z.object({
        url: z.string().describe('YouTube video URL or video ID (11 characters)'),
        language: z.string().optional().describe('Preferred language code for transcript (e.g., "en", "es", "de"). Defaults to "en"'),
      }),
    }
  );

  // Return as array for consistency with other toolkit patterns (but it's just ONE tool)
  return [youtubeVideoTool];
}

// Export utilities for URL detection (used in intent analysis)
module.exports = createYouTubeVideoLoaderTools;
module.exports.extractVideoId = extractVideoId;
module.exports.findYouTubeUrl = findYouTubeUrl;
module.exports.containsYouTubeUrl = containsYouTubeUrl;
module.exports.YouTubeTranscript = YouTubeTranscript;
module.exports.YouTubeLoader = YouTubeLoader;
module.exports.buildTranscriptContentWithMetadata = buildTranscriptContentWithMetadata;
module.exports.YOUTUBE_URL_PATTERNS = YOUTUBE_URL_PATTERNS;
