/**
 * @librechat/triggers - Webhook Trigger Types
 *
 * Types for HTTP webhook-based triggers.
 * Allows external systems to trigger agent executions via HTTP calls.
 *
 * ## Future Implementation Notes:
 * - Integrate with Express/Fastify middleware
 * - Support signature verification (HMAC, JWT)
 * - Rate limiting per webhook
 * - Request/response logging
 *
 * ## Security Considerations:
 * - Always validate webhook signatures
 * - Use HTTPS in production
 * - Implement rate limiting
 * - Log all webhook calls for audit
 *
 * @packageDocumentation
 */

import type { TriggerConfig, TriggerContext } from './base';

/**
 * HTTP methods supported for webhooks.
 */
export type WebhookMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

/**
 * Authentication types for webhook validation.
 */
export type WebhookAuthType = 'none' | 'secret' | 'hmac' | 'jwt' | 'api-key';

/**
 * Webhook authentication configuration.
 */
export interface WebhookAuth {
  type: WebhookAuthType;

  /** Secret key for validation */
  secret?: string;

  /** Header name for API key auth */
  headerName?: string;

  /** HMAC algorithm (sha256, sha512) */
  algorithm?: string;
}

/**
 * Configuration for webhook triggers.
 * NOT YET IMPLEMENTED - Interface defined for future use.
 */
export interface WebhookTriggerConfig extends TriggerConfig {
  type: 'webhook';

  /**
   * URL path for the webhook endpoint.
   * Will be mounted at: /api/triggers/webhook/{path}
   */
  path: string;

  /**
   * Allowed HTTP methods.
   * Default: ['POST']
   */
  methods?: WebhookMethod[];

  /**
   * Authentication configuration.
   */
  auth?: WebhookAuth;

  /**
   * Expected request body schema (JSON Schema).
   * Used for validation.
   */
  bodySchema?: Record<string, unknown>;

  /**
   * Response configuration.
   */
  response?: WebhookResponse;

  /**
   * Rate limiting configuration.
   */
  rateLimit?: WebhookRateLimit;

  /**
   * IP whitelist for additional security.
   */
  allowedIps?: string[];
}

/**
 * Webhook response configuration.
 */
export interface WebhookResponse {
  /** Whether to wait for execution to complete before responding */
  waitForCompletion: boolean;

  /** Timeout for waiting (if waitForCompletion is true) */
  timeout?: number;

  /** Custom success response body */
  successBody?: Record<string, unknown>;

  /** Custom headers to include in response */
  headers?: Record<string, string>;
}

/**
 * Rate limiting for webhooks.
 */
export interface WebhookRateLimit {
  /** Maximum requests per window */
  maxRequests: number;

  /** Window size in seconds */
  windowSeconds: number;

  /** Whether to use sliding window */
  sliding?: boolean;
}

/**
 * Context for webhook trigger execution.
 * Extends base context with HTTP-specific data.
 */
export interface WebhookTriggerContext extends TriggerContext {
  triggerType: 'webhook';

  /** HTTP request details */
  request: {
    method: WebhookMethod;
    path: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body: unknown;
    ip: string;
  };
}

/**
 * Webhook event for logging/monitoring.
 */
export interface WebhookEvent {
  triggerId: string;
  timestamp: Date;
  method: WebhookMethod;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  error?: string;
}
