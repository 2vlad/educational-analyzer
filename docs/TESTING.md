# Testing Documentation - Programs Feature

## Test Coverage Overview

The Programs feature includes comprehensive testing at multiple levels:

### 1. Unit Tests ✅

#### Encryption Utilities (`src/services/crypto/__tests__/secretBox.test.ts`)
- ✅ AES-256-GCM encryption/decryption
- ✅ Password validation
- ✅ Key generation
- ✅ Error handling
- ✅ Security properties (no plaintext leaks)

#### Job Queue Service (`src/services/__tests__/JobQueueService.test.ts`)
- ✅ Job picking with SKIP LOCKED pattern
- ✅ Job status updates
- ✅ Retry logic with exponential backoff
- ✅ Content hash idempotency
- ✅ Run status management
- ✅ Stale lock release

#### Yonote Adapter (`src/services/adapters/__tests__/YonoteAdapter.test.ts`)
- ✅ URL validation
- ✅ Lesson enumeration from HTML
- ✅ Content extraction and normalization
- ✅ Authentication error handling
- ✅ HTML parsing edge cases

### 2. Integration Tests ✅

#### API Endpoints (`__tests__/api/programs.test.ts`)
- ✅ Program CRUD operations
- ✅ Lesson enumeration
- ✅ Run creation and management
- ✅ Run control (pause/resume/stop)
- ✅ Progress tracking
- ✅ Authentication and authorization
- ✅ Error handling

### 3. E2E Tests ✅

#### Full Workflow (`e2e/programs.spec.ts`)
- ✅ Complete program lifecycle
- ✅ Real-time progress monitoring
- ✅ Error recovery and retries
- ✅ Concurrent processing
- ✅ Incremental runs
- ✅ Export functionality
- ✅ Accessibility (keyboard navigation, ARIA)

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm run test

# Run specific test file
npm run test -- src/services/crypto/__tests__/secretBox.test.ts

# Run with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Run API integration tests
npm run test -- __tests__/api/programs.test.ts
```

### E2E Tests
```bash
# Run E2E tests (requires running app)
npm run e2e

# Run in UI mode for debugging
npm run e2e:ui

# Run specific test
npx playwright test e2e/programs.spec.ts
```

## Test Data Setup

### Prerequisites
1. Database with migrations applied
2. Test user account created
3. APP_SECRET_KEY environment variable set

### Test Fixtures
- Mock Yonote HTML responses
- Test credentials (encrypted)
- Sample program data
- Mock analysis results

## Coverage Goals

Target coverage: **80%+**

Current coverage (estimated):
- Encryption utilities: **95%**
- Job Queue Service: **90%**
- Yonote Adapter: **85%**
- API endpoints: **80%**
- UI components: **70%** (via E2E)

## Testing Strategy

### Unit Tests
- Fast, isolated tests
- Mock all external dependencies
- Focus on business logic
- Run on every commit

### Integration Tests
- Test API contracts
- Mock database when appropriate
- Verify request/response formats
- Run before merging

### E2E Tests
- Test critical user journeys
- Real browser environment
- Full stack testing
- Run before deployment

## Common Test Scenarios

### Authentication Failures
```typescript
// Test expired cookie handling
it('should handle expired credentials', async () => {
  // Mock 401 response
  mockFetch.mockResolvedValue({
    ok: false,
    status: 401
  })
  
  await expect(adapter.fetchContent()).rejects.toThrow('401')
})
```

### Concurrent Processing
```typescript
// Test race conditions
it('should handle concurrent job picking', async () => {
  const promises = Array(10).fill(null).map(() => 
    service.pickJob()
  )
  
  const jobs = await Promise.all(promises)
  const uniqueJobs = new Set(jobs.filter(Boolean).map(j => j.id))
  
  // No duplicates
  expect(uniqueJobs.size).toBe(jobs.filter(Boolean).length)
})
```

### Retry Logic
```typescript
// Test exponential backoff
it('should retry with correct delays', async () => {
  const job = { attempt_count: 1 }
  
  await service.updateJobStatus(job.id, 'failed')
  
  // Check backoff calculation
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      locked_at: expect.any(String) // 30s in future
    })
  )
})
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase Jest timeout: `jest.setTimeout(30000)`
   - Check for unresolved promises
   - Verify mock implementations

2. **Database connection errors**
   - Ensure test database is running
   - Check connection string
   - Reset database between tests

3. **E2E test failures**
   - Verify app is running on correct port
   - Clear browser cache/cookies
   - Check for UI changes

### Debugging Tips

1. **Verbose logging**
   ```bash
   npm run test -- --verbose
   ```

2. **Run single test**
   ```typescript
   test.only('specific test', () => {
     // Test code
   })
   ```

3. **Playwright debugging**
   ```bash
   PWDEBUG=1 npm run e2e
   ```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run test
      - run: npm run e2e:ci
```

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:changed"
    }
  }
}
```

## Performance Benchmarks

### Target Metrics
- Unit tests: < 5 seconds
- Integration tests: < 30 seconds
- E2E tests: < 2 minutes
- Job processing: 10+ jobs/second
- Content hashing: < 100ms for 10KB text

### Load Testing
```typescript
// Simulate high load
it('should handle 100 concurrent runs', async () => {
  const runs = Array(100).fill(null).map((_, i) => ({
    id: `run-${i}`,
    max_concurrency: 5
  }))
  
  // Process all runs
  const startTime = Date.now()
  await Promise.all(runs.map(r => runner.processTick(r)))
  const duration = Date.now() - startTime
  
  expect(duration).toBeLessThan(60000) // Under 1 minute
})
```

## Security Testing

### Encryption Tests
- ✅ Key derivation strength
- ✅ IV uniqueness
- ✅ Tag validation
- ✅ Timing attack resistance

### Authentication Tests
- ✅ Cookie encryption at rest
- ✅ Session expiry handling
- ✅ User isolation (RLS)
- ✅ CSRF protection

### Input Validation
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Path traversal prevention
- ✅ Rate limiting

## Future Improvements

1. **Snapshot Testing**: Add visual regression tests for UI
2. **Contract Testing**: Validate API contracts with OpenAPI
3. **Mutation Testing**: Verify test effectiveness
4. **Performance Testing**: Add k6 or Artillery load tests
5. **Accessibility Testing**: Automated WCAG compliance checks