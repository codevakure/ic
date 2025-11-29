const { createBedrockRouter } = require('./dist/index.js');
const router = createBedrockRouter('costOptimized');

const tests = [
  // Expected: TRIVIAL (0.00-0.15) - Greetings, acknowledgments
  { query: 'hello', expectedTier: 'trivial' },
  { query: 'thanks!', expectedTier: 'trivial' },
  { query: 'ok', expectedTier: 'trivial' },
  { query: 'yes', expectedTier: 'trivial' },
  
  // Expected: SIMPLE (0.15-0.35) or TRIVIAL - Basic Q&A, definitions
  { query: 'What is JavaScript?', expectedTier: ['trivial', 'simple'] },
  { query: 'What does async mean?', expectedTier: 'simple' },
  { query: 'How do I center a div in CSS?', expectedTier: ['trivial', 'simple'] },
  
  // Expected: MODERATE (0.35-0.60) or SIMPLE - Explanations, standard coding
  { query: 'Explain how JavaScript promises work with examples', expectedTier: 'moderate' },
  { query: 'Write a function that calculates factorial', expectedTier: ['simple', 'moderate'] },
  { query: 'Compare and contrast SQL vs NoSQL databases', expectedTier: ['simple', 'moderate'] },
  
  // Expected: COMPLEX (0.60-0.80) or MODERATE - Debugging, detailed analysis
  { query: 'Debug this TypeError in my React useEffect hook and explain the root cause', expectedTier: ['moderate', 'complex'] },
  { query: 'Review this code for security vulnerabilities and suggest improvements', expectedTier: ['simple', 'moderate', 'complex'] },
  { query: 'Analyze the time complexity of this algorithm and suggest optimizations', expectedTier: ['moderate', 'complex'] },
  
  // Expected: EXPERT (0.80+) or COMPLEX - Advanced reasoning, system design, complex algorithms
  { query: 'Design a scalable distributed system architecture for a real-time chat application with millions of users, including message queuing, load balancing, and database sharding strategies', expectedTier: ['complex', 'expert'] },
  { query: 'Implement a complete microservices architecture with authentication, rate limiting, circuit breakers, and implement distributed tracing from scratch', expectedTier: 'expert' },
  { query: 'Build a machine learning pipeline with data preprocessing, model training, hyperparameter optimization, and implement A/B testing for model deployment', expectedTier: 'expert' }
];

(async () => {
  console.log('5-Tier Routing Test');
  console.log('===================\n');
  console.log('Tier Thresholds:');
  console.log('  - TRIVIAL (0.00-0.15): Nova Micro ($0.035/$0.14)');
  console.log('  - SIMPLE  (0.15-0.35): Nova Lite ($0.06/$0.24)');
  console.log('  - MODERATE(0.35-0.60): Haiku 4.5 ($1/$5)');
  console.log('  - COMPLEX (0.60-0.80): Sonnet 4.5 ($3/$15)');
  console.log('  - EXPERT  (0.80-1.00): Opus 4.5 ($5/$25)\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const { query, expectedTier } of tests) {
    const r = await router.route(query);
    const modelName = r.model.split('.').pop().replace('-v1:0', '').substring(0, 18).padEnd(18);
    const expectedTiers = Array.isArray(expectedTier) ? expectedTier : [expectedTier];
    const tierMatch = expectedTiers.includes(r.tier);
    const status = tierMatch ? '✓' : '✗';
    
    if (tierMatch) passed++;
    else failed++;
    
    console.log(`${status} [${r.tier.toUpperCase().padEnd(8)}] Score: ${r.strongWinRate.toFixed(2)} | ${modelName} | Expected: ${expectedTiers.join('/')}`);
    console.log(`  Query: "${query.substring(0, 70)}${query.length > 70 ? '...' : ''}"\n`);
  }
  
  console.log('===================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  // Test stats
  const stats = router.getStats();
  console.log('\nRouting Stats:');
  console.log(`  Total: ${stats.totalRequests}`);
  console.log(`  Expert %: ${stats.expertPercentage.toFixed(1)}%`);
  console.log(`  Trivial %: ${stats.trivialPercentage.toFixed(1)}%`);
  console.log('  Tier counts:', stats.tierCounts);
})();
