// Vitest test setup file
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  // Cleanup DOM or other resources if needed
  document.body.innerHTML = '';
});
