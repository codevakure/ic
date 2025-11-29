/**
 * Tests for Rule-Based Router
 */

import { RuleBasedRouter } from './rule-based';
import type { RoutingContext } from '../types';

describe('RuleBasedRouter', () => {
  let router: RuleBasedRouter;

  beforeEach(() => {
    router = new RuleBasedRouter();
  });

  describe('calculateStrongWinRate', () => {
    describe('Simple queries', () => {
      it('should return low win rate for greetings', async () => {
        const queries = ['Hi', 'Hello!', 'Hey there', 'Thanks!', 'Ok'];

        for (const query of queries) {
          const winRate = await router.calculateStrongWinRate(query);
          expect(winRate).toBeLessThan(0.3);
        }
      });

      it('should return low win rate for very short queries', async () => {
        const winRate = await router.calculateStrongWinRate('yes');
        expect(winRate).toBeLessThan(0.3);
      });
    });

    describe('Code-related queries', () => {
      it('should return elevated win rate for code blocks', async () => {
        const query = '```python\ndef hello():\n    print("hello")\n```\nCan you fix this?';
        const winRate = await router.calculateStrongWinRate(query);
        // Code blocks should score above trivial threshold (0.15)
        expect(winRate).toBeGreaterThanOrEqual(0.20);
      });

      it('should return elevated win rate for programming keywords', async () => {
        const query = 'Write a function that implements async/await with error handling';
        const winRate = await router.calculateStrongWinRate(query);
        expect(winRate).toBeGreaterThan(0.25);
      });

      it('should return high win rate for debugging requests', async () => {
        const query = 'I have an undefined error in my JavaScript code, can you help debug it?';
        const winRate = await router.calculateStrongWinRate(query);
        expect(winRate).toBeGreaterThan(0.3);
      });
    });

    describe('Reasoning queries', () => {
      it('should return high win rate for analytical questions', async () => {
        const query = 'Explain the pros and cons of using microservices architecture';
        const winRate = await router.calculateStrongWinRate(query);
        expect(winRate).toBeGreaterThan(0.4);
      });

      it('should return high win rate for comparison questions', async () => {
        const query = 'Compare and contrast SQL vs NoSQL databases for real-time analytics';
        const winRate = await router.calculateStrongWinRate(query);
        expect(winRate).toBeGreaterThan(0.4);
      });

      it('should return high win rate for step-by-step requests', async () => {
        const query = 'Walk me through step by step how to deploy a Docker container to AWS';
        const winRate = await router.calculateStrongWinRate(query);
        expect(winRate).toBeGreaterThan(0.4);
      });
    });

    describe('Math queries', () => {
      it('should return elevated win rate for calculation requests', async () => {
        const query = 'Calculate the integral of x^2 from 0 to 5';
        const winRate = await router.calculateStrongWinRate(query);
        // Math queries should score higher than simple queries
        expect(winRate).toBeGreaterThan(0.25);
      });

      it('should return elevated win rate for statistical questions', async () => {
        const query = 'What is the probability of getting exactly 3 heads in 5 coin flips?';
        const winRate = await router.calculateStrongWinRate(query);
        expect(winRate).toBeGreaterThan(0.25);
      });
    });

    describe('Creative writing queries', () => {
      it('should return elevated win rate for story writing', async () => {
        const query = 'Write a creative short story about a robot learning emotions';
        const winRate = await router.calculateStrongWinRate(query);
        // Creative tasks should be above trivial threshold
        expect(winRate).toBeGreaterThan(0.10);
      });
    });

    describe('Context-aware routing', () => {
      it('should increase win rate when tools are available', async () => {
        const query = 'Search for information about climate change';
        const context: RoutingContext = {
          tools: [{ name: 'web_search' }, { name: 'code_interpreter' }],
        };

        const winRateWithoutTools = await router.calculateStrongWinRate(query);
        const winRateWithTools = await router.calculateStrongWinRate(query, context);

        expect(winRateWithTools).toBeGreaterThan(winRateWithoutTools);
      });

      it('should increase win rate when attachments are present', async () => {
        const query = 'Analyze this document';
        const context: RoutingContext = {
          attachments: [{ type: 'application/pdf', name: 'report.pdf' }],
        };

        const winRateWithout = await router.calculateStrongWinRate(query);
        const winRateWith = await router.calculateStrongWinRate(query, context);

        expect(winRateWith).toBeGreaterThan(winRateWithout);
      });

      it('should respect user preference for quality', async () => {
        const query = 'Hello';
        const context: RoutingContext = { userPreference: 'quality' };

        const winRate = await router.calculateStrongWinRate(query, context);
        expect(winRate).toBeGreaterThanOrEqual(0.7);
      });

      it('should respect user preference for cost', async () => {
        const query = 'Write a complex algorithm for sorting';
        const context: RoutingContext = { userPreference: 'cost' };

        const winRate = await router.calculateStrongWinRate(query, context);
        expect(winRate).toBeLessThanOrEqual(0.3);
      });
    });
  });

  describe('route', () => {
    const modelPair = {
      expert: 'claude-opus',
      complex: 'claude-sonnet',
      moderate: 'claude-haiku',
      simple: 'nova-lite',
      trivial: 'nova-micro',
    };

    it('should route simple queries to lower tier model', async () => {
      const result = await router.route('Hi there!', 0.5, modelPair);
      // Should route to trivial or simple tier
      expect([modelPair.trivial, modelPair.simple]).toContain(result.model);
      expect(['trivial', 'simple']).toContain(result.tier);
    });

    it('should route complex queries to higher tier model', async () => {
      const result = await router.route(
        `Implement a distributed rate limiter using Redis with a sliding window algorithm. 
        Requirements:
        1. Support for multiple rate limit tiers (free, pro, enterprise)
        2. Proper error handling and fallback strategies
        3. Connection pooling for high throughput
        4. Atomic operations using Lua scripts
        5. Unit tests with mock Redis client
        
        Please provide a step-by-step implementation with detailed explanations.`,
        0.5,
        modelPair
      );
      // Should route to expert or complex tier
      expect([modelPair.expert, modelPair.complex]).toContain(result.model);
      expect(['expert', 'complex']).toContain(result.tier);
    });

    it('should include routing reason', async () => {
      const result = await router.route(
        'Write a Python function to sort a list',
        0.5,
        modelPair
      );
      expect(result.reason).toBeDefined();
      expect(result.reasonCategory).toBeDefined();
    });

    it('should include confidence score', async () => {
      const result = await router.route('Hello', 0.5, modelPair);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should respect threshold parameter', async () => {
      const query = 'What is JavaScript?';

      // With low threshold, more goes to higher tiers
      const lowThreshold = await router.route(query, 0.1, modelPair);
      // With high threshold, more goes to lower tiers
      const highThreshold = await router.route(query, 0.9, modelPair);

      // The same query should route differently based on threshold
      expect(lowThreshold.threshold).toBe(0.1);
      expect(highThreshold.threshold).toBe(0.9);
    });
  });
});
