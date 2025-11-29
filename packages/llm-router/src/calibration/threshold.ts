/**
 * Threshold Calibration Utilities
 * Tools for finding optimal routing thresholds.
 */

import type { CalibrationResult, IntentThresholdConfig } from '../types';
import { Router } from '../routers/base';

/**
 * Sample queries for different intent categories
 * Used for calibration when no user data is available
 */
export const SampleQueriesByIntent: Record<string, string[]> = {
  simple_question: [
    'What time is it?',
    'Hi there!',
    'Thanks!',
    'What is the capital of France?',
    'Hello',
    'Yes',
    'Ok',
    'Got it',
    'How are you?',
    "What's 2+2?",
  ],

  code_generation: [
    'Write a Python function to sort a list of dictionaries by a specific key',
    'Create a React component that displays a paginated table with sorting',
    'Implement a binary search tree in TypeScript with insert, delete, and search operations',
    'Write a SQL query to find the top 10 customers by total purchase amount',
    'Create a REST API endpoint in Node.js that handles file uploads',
    'Write a bash script to backup a PostgreSQL database to S3',
    'Implement a rate limiter using the token bucket algorithm in Go',
    'Create a WebSocket server in Python that broadcasts messages to all connected clients',
  ],

  reasoning: [
    'Explain the trade-offs between microservices and monolithic architecture',
    'Compare and contrast SQL and NoSQL databases for a real-time analytics system',
    'What are the implications of using eventual consistency in a distributed system?',
    'Analyze the pros and cons of different authentication strategies for a mobile app',
    'How would you design a system to handle 1 million concurrent users?',
    'What factors should I consider when choosing between AWS, Azure, and GCP?',
  ],

  creative_writing: [
    'Write a short story about a robot learning to feel emotions',
    'Create a product description for an innovative smart home device',
    'Write a compelling blog post introduction about the future of AI',
    'Compose a professional email requesting a meeting with a potential client',
    'Create a catchy slogan for an eco-friendly water bottle company',
  ],

  data_analysis: [
    'Analyze this sales data and identify trends',
    'What insights can we derive from this customer feedback?',
    'Help me understand the statistical significance of these A/B test results',
    'Create a data visualization strategy for this quarterly report',
    'What machine learning model would be best for predicting customer churn?',
  ],

  general: [
    'What is machine learning?',
    'Explain how blockchain works',
    'What are the benefits of cloud computing?',
    'How does encryption protect my data?',
    'What is the difference between HTTP and HTTPS?',
    'Summarize this article for me',
    'Translate this to Spanish',
    'What are some good practices for code reviews?',
  ],
};

/**
 * Calibrate threshold for a specific target percentage
 */
export async function calibrateThreshold(
  router: Router,
  sampleQueries: string[],
  targetStrongPercentage: number
): Promise<CalibrationResult> {
  if (sampleQueries.length === 0) {
    throw new Error('Sample queries required for calibration');
  }

  const winRates = await Promise.all(
    sampleQueries.map((q) => router.calculateStrongWinRate(q))
  );

  const sortedRates = [...winRates].sort((a, b) => b - a);
  const targetIndex = Math.floor(sampleQueries.length * (targetStrongPercentage / 100));
  const threshold = sortedRates[Math.min(targetIndex, sortedRates.length - 1)] || 0.5;

  const actualStrong = winRates.filter((r) => r >= threshold).length;
  const actualPercentage = (actualStrong / sampleQueries.length) * 100;

  const mean = winRates.reduce((a, b) => a + b, 0) / winRates.length;
  const sorted = [...winRates].sort((a, b) => a - b);

  return {
    threshold,
    targetPercentage: targetStrongPercentage,
    actualPercentage,
    sampleSize: sampleQueries.length,
    winRateDistribution: {
      min: Math.min(...winRates),
      max: Math.max(...winRates),
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
    },
  };
}

/**
 * Calibrate thresholds for each intent category
 */
export async function calibrateIntentThresholds(
  router: Router,
  targetPercentages: Partial<Record<keyof typeof SampleQueriesByIntent, number>>,
  defaultTarget: number = 50
): Promise<IntentThresholdConfig> {
  const thresholds: Partial<IntentThresholdConfig> = {};

  for (const [intent, queries] of Object.entries(SampleQueriesByIntent)) {
    const target = targetPercentages[intent as keyof typeof targetPercentages] ?? defaultTarget;
    const result = await calibrateThreshold(router, queries, target);
    thresholds[intent as keyof IntentThresholdConfig] = result.threshold;
  }

  return {
    code_generation: thresholds.code_generation ?? 0.3,
    code_review: thresholds.code_generation ?? 0.3,
    debugging: thresholds.code_generation ?? 0.3,
    data_analysis: thresholds.data_analysis ?? 0.4,
    document_analysis: thresholds.data_analysis ?? 0.4,
    simple_question: thresholds.simple_question ?? 0.8,
    greeting: thresholds.simple_question ?? 0.9,
    creative_writing: thresholds.creative_writing ?? 0.4,
    general: thresholds.general ?? 0.5,
    default: defaultTarget / 100,
  };
}

/**
 * Generate a full calibration report
 */
export async function generateCalibrationReport(
  router: Router,
  customQueries?: string[]
): Promise<{
  overall: CalibrationResult;
  byIntent: Record<string, CalibrationResult>;
  recommendations: string[];
}> {
  const allQueries = customQueries ?? Object.values(SampleQueriesByIntent).flat();

  const overall = await calibrateThreshold(router, allQueries, 50);

  const byIntent: Record<string, CalibrationResult> = {};
  for (const [intent, queries] of Object.entries(SampleQueriesByIntent)) {
    byIntent[intent] = await calibrateThreshold(router, queries, 50);
  }

  const recommendations: string[] = [];

  // Analyze results and generate recommendations
  if (overall.winRateDistribution.mean > 0.6) {
    recommendations.push(
      'High average win rate suggests queries are complex. Consider lowering threshold for cost savings.'
    );
  } else if (overall.winRateDistribution.mean < 0.4) {
    recommendations.push(
      'Low average win rate suggests queries are simple. Current routing should provide good cost savings.'
    );
  }

  const spread = overall.winRateDistribution.p75 - overall.winRateDistribution.p25;
  if (spread > 0.4) {
    recommendations.push(
      'High variance in query complexity. Consider using intent-based thresholds for better routing.'
    );
  }

  if (byIntent.code_generation?.winRateDistribution.mean > 0.7) {
    recommendations.push(
      'Code queries have high complexity. Recommend threshold of 0.3 or lower for code_generation intent.'
    );
  }

  if (byIntent.simple_question?.winRateDistribution.mean < 0.3) {
    recommendations.push(
      'Simple questions routing well to weak model. Current configuration is effective.'
    );
  }

  return { overall, byIntent, recommendations };
}
