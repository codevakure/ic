/**
 * Datadog Tracer Initialization
 * 
 * This module initializes the Datadog tracer with LLM Observability support.
 * It should be imported/initialized before any other modules to ensure proper instrumentation.
 */

import type { DatadogInitOptions } from './types';

let tracer: any = null;
let isInitialized = false;

/**
 * Initialize Datadog tracer with LLM Observability
 */
export function initializeDatadog(options: DatadogInitOptions = {}): any {
  // Check if already initialized
  if (isInitialized && tracer) {
    console.warn('Datadog tracer already initialized');
    return tracer;
  }

  // Check if Datadog LLM Observability is enabled
  const isEnabled = options.enabled ?? process.env.DD_LLMOBS_ENABLED === 'true';

  if (!isEnabled) {
    console.info('[Datadog] LLM Observability is disabled');
    return null;
  }

  try {
    // Dynamic import dd-trace
    const ddTrace = require('dd-trace');
    
    // Initialize the Datadog tracer with LLM Observability
    tracer = ddTrace.init({
      // Service configuration
      service: options.service || process.env.DD_SERVICE || 'librechat',
      env: options.env || process.env.DD_ENV || 'development',
      version: options.version || process.env.DD_VERSION || 'v1.0.0',
      
      // Integration settings
      integrations: process.env.DD_INTEGRATIONS_ENABLED !== 'false',
      
      // Sampling configuration
      sampleRate: options.sampleRate || parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0'),
      
      // Logging configuration
      logInjection: options.logInjection ?? process.env.DD_LOGS_INJECTION === 'true',
      debug: options.debug ?? process.env.DD_TRACE_DEBUG === 'true',
      
      // Profiling
      profiling: options.profiling ?? process.env.DD_PROFILING_ENABLED === 'true',
      
      // Plugin configuration for automatic instrumentation
      plugins: {
        'openai': {
          enabled: true,
          service: options.service || process.env.DD_SERVICE || 'librechat',
        },
        'http': {
          enabled: true,
          service: options.service || process.env.DD_SERVICE || 'librechat',
        },
        'express': {
          enabled: true,
          service: options.service || process.env.DD_SERVICE || 'librechat',
        },
        'mongodb': {
          enabled: true,
          service: options.service || process.env.DD_SERVICE || 'librechat',
        },
        'redis': {
          enabled: true,
          service: options.service || process.env.DD_SERVICE || 'librechat',
        }
      }
    });

    // Enable LLM Observability if available
    if (tracer && tracer.llmobs) {
      try {
        tracer.llmobs.enable();
        
        // Register span processor for filtering Snowflake-related spans
        tracer.llmobs.registerProcessor((span: any) => {
          if (!span) return null;
          
          // Check if this is a Snowflake tool-specific span
          const checkForSnowflakeTool = (data: any) => {
            if (!data) return false;
            const dataStr = JSON.stringify(data).toLowerCase();
            return dataStr.includes('"name":"snowflakedatabase"') ||
                   dataStr.includes('"name":"snowflakefinancialanalyst"') ||
                   dataStr.includes('"name":"snowflakecreditriskanalyst"') ||
                   dataStr.includes('snowflakedatabase') ||
                   dataStr.includes('snowflakefinancialanalyst') ||
                   dataStr.includes('snowflakecreditriskanalyst');
          };
          
          const isSnowflakeToolSpan = 
            checkForSnowflakeTool(span.input) || 
            checkForSnowflakeTool(span.output);
          
          if (isSnowflakeToolSpan) {
            return null;
          }
          
          return span;
        });
        
        console.info(`[Datadog] LLM Observability enabled (mlApp: ${options.mlApp || process.env.DD_LLMOBS_ML_APP}, service: ${options.service || process.env.DD_SERVICE})`);
      } catch (enableError: any) {
        console.error(`[Datadog] Failed to enable LLM Observability: ${enableError.message}`);
      }
    } else {
      console.warn('[Datadog] LLM Observability not available - tracer.llmobs not found');
    }

    isInitialized = true;
    
  } catch (error: any) {
    console.error('[Datadog] Failed to initialize tracer:', error.message);
    tracer = null;
  }

  return tracer;
}

/**
 * Get the current tracer instance
 */
export function getTracer(): any {
  return tracer;
}

/**
 * Check if LLM Observability is enabled and available
 */
export function isLLMObservabilityEnabled(): boolean {
  return !!(tracer && tracer.llmobs && process.env.DD_LLMOBS_ENABLED === 'true');
}

/**
 * Helper function to create custom spans for operations
 */
export function traceOperation(operationName: string, options: any = {}, callback: Function): any {
  if (!tracer) {
    return callback();
  }

  const span = tracer.startSpan(operationName, {
    tags: {
      'ranger.operation': operationName,
      'service.name': process.env.DD_SERVICE || 'librechat',
      ...options.tags
    },
    resource: options.resource || operationName,
    ...options
  });

  try {
    const result = callback(span);
    if (result && typeof result.then === 'function') {
      // Handle promises
      return result.then(
        (value: any) => {
          span.setTag('operation.status', 'success');
          span.finish();
          return value;
        },
        (error: any) => {
          span.setTag('operation.status', 'error');
          span.setTag('error.message', error.message);
          span.setTag('error.stack', error.stack);
          span.finish();
          throw error;
        }
      );
    } else {
      // Handle synchronous operations
      span.setTag('operation.status', 'success');
      span.finish();
      return result;
    }
  } catch (error: any) {
    span.setTag('operation.status', 'error');
    span.setTag('error.message', error.message);
    span.setTag('error.stack', error.stack);
    span.finish();
    throw error;
  }
}

/**
 * Get the current trace context for correlation
 */
export function getCurrentTraceContext(): { traceId: string; spanId: string } | null {
  if (!tracer) {
    return null;
  }

  try {
    const span = tracer.scope().active();
    if (span) {
      const context = span.context();
      return {
        traceId: context.toTraceId(),
        spanId: context.toSpanId()
      };
    }
  } catch (error: any) {
    console.debug('Failed to get trace context:', error.message);
  }

  return null;
}
