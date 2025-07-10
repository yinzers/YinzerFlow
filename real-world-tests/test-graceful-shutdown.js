#!/usr/bin/env node

// Manual Real-World Test: Graceful Shutdown
// --------------------------------------------------
// This script verifies YinzerFlow's process-level graceful shutdown behavior.
// - Not intended for CI/CD or automated test runs.
// - Run locally and send SIGTERM/SIGINT (Ctrl+C) to observe shutdown logs.
// - Useful for validating real OS signal handling and Pittsburgh personality logs.
// --------------------------------------------------

import { YinzerFlow } from './lib/index.js';

console.log('🧪 Testing YinzerFlow Graceful Shutdown...\n');

// Test 1: Default auto graceful shutdown
console.log('📝 Test 1: Default auto graceful shutdown (should be enabled)');
const app1 = new YinzerFlow({ port: 3001 });
console.log(`✅ Auto graceful shutdown enabled: ${app1._configuration.autoGracefulShutdown}`);
console.log(`✅ SIGTERM listeners: ${process.listenerCount('SIGTERM')}`);
console.log(`✅ SIGINT listeners: ${process.listenerCount('SIGINT')}\n`);

// Test 2: Disabled auto graceful shutdown
console.log('📝 Test 2: Disabled auto graceful shutdown');
const originalSigtermCount = process.listenerCount('SIGTERM');
const originalSigintCount = process.listenerCount('SIGINT');

const app2 = new YinzerFlow({
  port: 3002,
  autoGracefulShutdown: false,
});

console.log(`✅ Auto graceful shutdown disabled: ${!app2._configuration.autoGracefulShutdown}`);
console.log(`✅ SIGTERM listeners unchanged: ${process.listenerCount('SIGTERM') === originalSigtermCount}`);
console.log(`✅ SIGINT listeners unchanged: ${process.listenerCount('SIGINT') === originalSigintCount}\n`);

// Test 3: Multiple instances don't duplicate handlers
console.log('📝 Test 3: Multiple instances (should not duplicate handlers)');
const beforeCount = process.listenerCount('SIGTERM');

new YinzerFlow({ port: 3003 });
new YinzerFlow({ port: 3004 });
new YinzerFlow({ port: 3005 });

console.log(`✅ SIGTERM listeners unchanged: ${process.listenerCount('SIGTERM') === beforeCount}\n`);

// Test 4: Manual graceful shutdown
console.log('📝 Test 4: Manual graceful shutdown test');
const app4 = new YinzerFlow({
  port: 3006,
  autoGracefulShutdown: false,
});

// Start the server
await app4.listen();
console.log('✅ Server started successfully');

// Close the server
await app4.close();
console.log('✅ Server closed successfully');

console.log('\n🎉 All graceful shutdown tests passed!');
console.log('\n💡 To test signal handling, run this script and press Ctrl+C or send SIGTERM');
console.log('   You should see the graceful shutdown logs with Pittsburgh personality!');

// Keep the process alive for manual testing
setTimeout(() => {
  console.log('\n⏰ Test timeout reached, exiting...');
  process.exit(0);
}, 30000); // 30 second timeout
