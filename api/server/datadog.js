/**
 * Datadog Tracer Initialization
 * 
 * Initializes the Datadog tracer using the @ranger/datadog-llm-observability package.
 * This file must be required before any other modules to ensure proper instrumentation.
 */

const { initializeDatadog } = require('@ranger/datadog-llm-observability');

// Check if Datadog LLM Observability is enabled
const isDatadogEnabled = process.env.DD_LLMOBS_ENABLED === 'true';

if (!isDatadogEnabled) {
  module.exports = null;
} else {
  try {
    // Initialize Datadog with environment configuration
    const tracer = initializeDatadog({
      enabled: true,
      service: process.env.DD_SERVICE || 'ranger',
      env: process.env.DD_ENV || 'development',
      version: process.env.DD_VERSION || 'v1.0.0',
      apiKey: process.env.DD_API_KEY,
      site: process.env.DD_SITE || 'datadoghq.com',
      agentlessEnabled: process.env.DD_LLMOBS_AGENTLESS_ENABLED === 'true',
      mlApp: process.env.DD_LLMOBS_ML_APP || 'ranger',
      debug: process.env.DD_TRACE_DEBUG === 'true',
      profiling: process.env.DD_PROFILING_ENABLED === 'true',
      logInjection: process.env.DD_LOGS_INJECTION === 'true',
      sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0')
    });
    
    module.exports = tracer;
    
  } catch (error) {
    module.exports = null;
  }
}
