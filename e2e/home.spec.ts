import { test, expect } from '@playwright/test'

test('has title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Educational Content Analyzer/)
})

test('health check API works', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBeTruthy()
  const data = await response.json()
  expect(data.status).toBe('ok')
})
