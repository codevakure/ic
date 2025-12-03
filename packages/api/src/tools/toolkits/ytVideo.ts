import { z } from 'zod';

/**
 * YouTube Video Loader Toolkit
 * 
 * Keyless YouTube tool that fetches video transcripts and metadata without requiring API keys.
 * Uses YouTube's internal APIs directly, based on AnythingLLM's implementation.
 * 
 * This is a SINGLE unified tool (like AnythingLLM's YouTubeLoader).
 */
export const ytVideoToolkit = {
  youtube_video: {
    name: 'youtube_video' as const,
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
- Direct video ID (11 characters)` as const,
    schema: z.object({
      url: z.string().describe('YouTube video URL or video ID (11 characters)'),
      language: z.string().optional().describe('Preferred language code for transcript (e.g., "en", "es", "de"). Defaults to "en"'),
    }),
  },
} as const;

/**
 * Tool name constant for easy reference
 */
export const YTVideoTools = {
  YOUTUBE_VIDEO: 'youtube_video',
} as const;
