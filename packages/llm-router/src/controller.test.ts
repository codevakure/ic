/**
 * Tests for LLM Router Controller
 * Updated for 5-tier routing system
 */

import {
  LLMRouterController,
  createBedrockRouter,
  createOpenAIRouter,
  createCustomRouter,
} from './controller';
import { BedrockRoutingPairs } from './models/bedrock';
import { OpenAIRoutingPairs } from './models/openai';

describe('LLMRouterController', () => {
  describe('createBedrockRouter', () => {
    it('should create router with costOptimized preset by default', () => {
      const router = createBedrockRouter();
      const config = router.getConfig();
      const pair = router.getModelPair();

      expect(config.endpoint).toBe('bedrock');
      expect(pair.expert).toBe(BedrockRoutingPairs.costOptimized.expert);
      expect(pair.trivial).toBe(BedrockRoutingPairs.costOptimized.trivial);
    });

    it('should create router with premium preset', () => {
      const router = createBedrockRouter('premium');
      const pair = router.getModelPair();

      expect(pair.expert).toBe(BedrockRoutingPairs.premium.expert);
      expect(pair.trivial).toBe(BedrockRoutingPairs.premium.trivial);
    });

    it('should create router with ultraCheap preset', () => {
      const router = createBedrockRouter('ultraCheap');
      const pair = router.getModelPair();

      expect(pair.expert).toBe(BedrockRoutingPairs.ultraCheap.expert);
      expect(pair.trivial).toBe(BedrockRoutingPairs.ultraCheap.trivial);
    });

    it('should accept custom threshold', () => {
      const router = createBedrockRouter('costOptimized', 0.7);
      const config = router.getConfig();

      expect(config.threshold).toBe(0.7);
    });

    it('should have all 5 tiers configured', () => {
      const router = createBedrockRouter('costOptimized');
      const pair = router.getModelPair();

      expect(pair.expert).toBeDefined();
      expect(pair.complex).toBeDefined();
      expect(pair.moderate).toBeDefined();
      expect(pair.simple).toBeDefined();
      expect(pair.trivial).toBeDefined();
    });
  });

  describe('createOpenAIRouter', () => {
    it('should create router with standard preset by default', () => {
      const router = createOpenAIRouter();
      const config = router.getConfig();
      const pair = router.getModelPair();

      expect(config.endpoint).toBe('openai');
      expect(pair.expert).toBe(OpenAIRoutingPairs.standard.expert);
      expect(pair.trivial).toBe(OpenAIRoutingPairs.standard.trivial);
    });

    it('should create router with premium preset', () => {
      const router = createOpenAIRouter('premium');
      const pair = router.getModelPair();

      expect(pair.expert).toBe(OpenAIRoutingPairs.premium.expert);
    });
  });

  describe('createCustomRouter', () => {
    it('should create router with custom models', () => {
      const router = createCustomRouter('custom-endpoint', {
        expert: 'expert-model',
        complex: 'complex-model',
        moderate: 'moderate-model',
        simple: 'simple-model',
        trivial: 'trivial-model',
      }, {
        threshold: 0.6,
      });
      const config = router.getConfig();
      const pair = router.getModelPair();

      expect(config.endpoint).toBe('custom-endpoint');
      expect(pair.expert).toBe('expert-model');
      expect(pair.trivial).toBe('trivial-model');
      expect(config.threshold).toBe(0.6);
    });
  });

  describe('route', () => {
    let router: LLMRouterController;

    beforeEach(() => {
      router = createBedrockRouter('costOptimized', 0.5);
    });

    it('should route simple queries to trivial tier', async () => {
      const result = await router.route('Hello!');

      // Should route to lowest tier for trivial queries
      expect(result.model).toBe(BedrockRoutingPairs.costOptimized.trivial);
      expect(['trivial', 'simple']).toContain(result.tier);
    });

    it('should route complex queries to expert tier', async () => {
      const result = await router.route(
        `Implement a distributed consensus algorithm with Raft protocol.
        
        Requirements:
        1. Leader election with randomized timeouts
        2. Log replication with consistency guarantees
        3. Safety guarantees to prevent split-brain scenarios
        4. Membership changes support
        5. Snapshotting for log compaction
        
        Please provide a step-by-step explanation with detailed code examples and unit tests.`
      );

      // Should route to highest tier for complex queries
      expect(['expert', 'complex']).toContain(result.tier);
    });

    it('should include all result fields', async () => {
      const result = await router.route('Test query');

      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('tier');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('reasonCategory');
      expect(result).toHaveProperty('strongWinRate');
      expect(result).toHaveProperty('threshold');
      expect(result).toHaveProperty('routingDurationMs');
    });

    it('should track routing duration', async () => {
      const result = await router.route('Test query');

      expect(result.routingDurationMs).toBeDefined();
      expect(result.routingDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('routeBatch', () => {
    it('should route multiple queries', async () => {
      const router = createBedrockRouter();
      const results = await router.routeBatch([
        'Hello',
        'Write complex code',
        'What is 2+2?',
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('tier');
      });
    });
  });

  describe('statistics', () => {
    let router: LLMRouterController;

    beforeEach(() => {
      router = createBedrockRouter('costOptimized', 0.5);
    });

    it('should track routing statistics', async () => {
      await router.route('Hello');
      await router.route('Write complex algorithm');
      await router.route('Hi there');

      const stats = router.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.modelCounts).toBeDefined();
      expect(stats.expertPercentage).toBeGreaterThanOrEqual(0);
      expect(stats.expertPercentage).toBeLessThanOrEqual(100);
    });

    it('should calculate average confidence', async () => {
      await router.route('Hello');
      await router.route('Complex query here');

      const stats = router.getStats();
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
    });

    it('should reset statistics', async () => {
      await router.route('Hello');
      await router.route('World');

      router.resetStats();
      const stats = router.getStats();

      expect(stats.totalRequests).toBe(0);
    });

    it('should track reason breakdown', async () => {
      await router.route('Write Python code');
      await router.route('Hello');

      const stats = router.getStats();
      expect(stats.reasonBreakdown).toBeDefined();
    });
  });

  describe('threshold management', () => {
    it('should allow updating threshold', () => {
      const router = createBedrockRouter('costOptimized', 0.5);
      router.setThreshold(0.7);

      const config = router.getConfig();
      expect(config.threshold).toBe(0.7);
    });

    it('should reject invalid thresholds', () => {
      const router = createBedrockRouter();

      expect(() => router.setThreshold(-0.1)).toThrow();
      expect(() => router.setThreshold(1.5)).toThrow();
    });
  });

  describe('calculateWinRate', () => {
    it('should calculate win rate without routing', async () => {
      const router = createBedrockRouter();
      const winRate = await router.calculateWinRate('Test query');

      expect(winRate).toBeGreaterThanOrEqual(0);
      expect(winRate).toBeLessThanOrEqual(1);
    });

    it('should calculate batch win rates', async () => {
      const router = createBedrockRouter();
      const winRates = await router.calculateWinRateBatch([
        'Simple',
        'Complex algorithm implementation',
      ]);

      expect(winRates).toHaveLength(2);
      winRates.forEach((rate) => {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('event logging', () => {
    it('should log routing events', async () => {
      const router = createBedrockRouter();

      await router.route('Test 1');
      await router.route('Test 2');

      const events = router.getRecentEvents();
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('should truncate long prompts in events', async () => {
      const router = createBedrockRouter();
      const longPrompt = 'x'.repeat(1000);

      await router.route(longPrompt);

      const events = router.getRecentEvents();
      expect(events[0].prompt.length).toBeLessThanOrEqual(500);
    });
  });
});

describe('LLMRouterController.calibrateThreshold', () => {
  it('should calibrate threshold for target percentage', async () => {
    const { RuleBasedRouter } = await import('./routers/rule-based');
    const router = new RuleBasedRouter();

    const sampleQueries = [
      'Hello',
      'Hi',
      'Write complex code with async/await',
      'Explain quantum computing',
      'What is 2+2?',
      'Implement a distributed system',
    ];

    const result = await LLMRouterController.calibrateThreshold(router, sampleQueries, 50);

    expect(result.threshold).toBeGreaterThanOrEqual(0);
    expect(result.threshold).toBeLessThanOrEqual(1);
    expect(result.targetPercentage).toBe(50);
    expect(result.sampleSize).toBe(6);
    expect(result.winRateDistribution).toBeDefined();
  });

  it('should throw error for empty sample queries', async () => {
    const { RuleBasedRouter } = await import('./routers/rule-based');
    const router = new RuleBasedRouter();

    await expect(
      LLMRouterController.calibrateThreshold(router, [], 50)
    ).rejects.toThrow('Sample queries required');
  });
});
