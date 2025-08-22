/**
 * E2E tests for Programs feature - Full workflow
 */

import { test, expect, Page } from '@playwright/test'

// Test data
const TEST_PROGRAM = {
  name: 'Test Course - E2E Testing',
  url: 'https://yonote.ru/course/test-e2e',
  cookie: 'test_session=abc123; expires=2025-12-31',
}

// Helper functions
async function login(page: Page) {
  await page.goto('/auth/login')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="password"]', 'testpassword123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
}

async function navigateToPrograms(page: Page) {
  await page.click('text=Программы')
  await page.waitForURL('/programs')
}

async function addYonoteCredential(page: Page) {
  // Open credential modal
  await page.click('button:has-text("Добавить учетные данные")')
  
  // Fill credential form
  await page.fill('input[name="name"]', 'Test Yonote Account')
  await page.fill('textarea[name="cookie"]', TEST_PROGRAM.cookie)
  
  // Save credential
  await page.click('button:has-text("Сохранить")')
  await page.waitForSelector('text=Учетные данные сохранены')
}

test.describe('Programs Feature - Full Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page)
  })

  test('Complete program workflow: Create, Enumerate, Run, Monitor', async ({ page }) => {
    // Step 1: Navigate to Programs
    await navigateToPrograms(page)
    
    // Verify programs page loaded
    await expect(page.locator('h1')).toContainText('Программы')
    
    // Step 2: Add Yonote Credential (if not exists)
    const hasCredentials = await page.locator('text=Test Yonote Account').count() > 0
    if (!hasCredentials) {
      await addYonoteCredential(page)
    }
    
    // Step 3: Create New Program
    await page.click('button:has-text("Новая программа")')
    
    // Fill program form
    await page.fill('input[name="name"]', TEST_PROGRAM.name)
    await page.fill('input[name="rootUrl"]', TEST_PROGRAM.url)
    await page.selectOption('select[name="sourceType"]', 'yonote')
    await page.selectOption('select[name="credentialId"]', { index: 1 }) // Select first credential
    
    // Save program
    await page.click('button:has-text("Создать программу")')
    await page.waitForSelector(`text=${TEST_PROGRAM.name}`)
    
    // Step 4: Open Program Details
    await page.click(`text=${TEST_PROGRAM.name}`)
    await page.waitForSelector('h1:has-text("' + TEST_PROGRAM.name + '")')
    
    // Step 5: Enumerate Lessons
    await page.click('button:has-text("Получить список уроков")')
    
    // Wait for enumeration to complete
    await page.waitForSelector('text=Уроки загружены', { timeout: 30000 })
    
    // Verify lessons are displayed
    const lessonCount = await page.locator('.lesson-item').count()
    expect(lessonCount).toBeGreaterThan(0)
    
    // Step 6: Start Analysis Run
    await page.click('button:has-text("Начать анализ")')
    
    // Configure run settings
    await page.selectOption('select[name="metricsMode"]', 'lx')
    await page.fill('input[name="maxConcurrency"]', '3')
    
    // Start the run
    await page.click('button:has-text("Запустить")')
    
    // Wait for run to start
    await page.waitForSelector('text=Анализ запущен')
    
    // Step 7: Monitor Progress
    // Check that progress bar appears
    await expect(page.locator('.progress-bar')).toBeVisible()
    
    // Check status indicators
    await expect(page.locator('text=Выполняется')).toBeVisible()
    
    // Wait for at least one lesson to complete (or timeout after 60s)
    await page.waitForSelector('.lesson-status-success', { timeout: 60000 })
    
    // Step 8: Test Run Controls
    // Pause the run
    await page.click('button:has-text("Пауза")')
    await page.waitForSelector('text=Приостановлено')
    
    // Resume the run
    await page.click('button:has-text("Продолжить")')
    await page.waitForSelector('text=Выполняется')
    
    // Step 9: View Results
    // Click on a completed lesson
    const completedLesson = page.locator('.lesson-status-success').first()
    await completedLesson.click()
    
    // Verify analysis results are displayed
    await expect(page.locator('.analysis-results')).toBeVisible()
    await expect(page.locator('.metric-card')).toHaveCount(5) // 5 LX metrics
    
    // Step 10: Stop the run
    await page.click('button:has-text("Остановить")')
    await page.click('button:has-text("Да, остановить")') // Confirm dialog
    await page.waitForSelector('text=Остановлено')
    
    // Verify final statistics
    const stats = page.locator('.run-statistics')
    await expect(stats).toContainText('Обработано:')
    await expect(stats).toContainText('Успешно:')
    await expect(stats).toContainText('Ошибки:')
  })

  test('Handle authentication errors gracefully', async ({ page }) => {
    await navigateToPrograms(page)
    
    // Create program with invalid credentials
    await page.click('button:has-text("Новая программа")')
    await page.fill('input[name="name"]', 'Invalid Credential Test')
    await page.fill('input[name="rootUrl"]', 'https://yonote.ru/course/invalid')
    await page.selectOption('select[name="sourceType"]', 'yonote')
    
    // Don't select credential (or select expired one)
    await page.click('button:has-text("Создать программу")')
    
    // Try to enumerate
    await page.click(`text=Invalid Credential Test`)
    await page.click('button:has-text("Получить список уроков")')
    
    // Should show authentication error
    await expect(page.locator('.error-message')).toContainText('Ошибка аутентификации')
    await expect(page.locator('text=Обновите учетные данные')).toBeVisible()
  })

  test('Incremental runs skip unchanged content', async ({ page }) => {
    await navigateToPrograms(page)
    
    // Assume program already exists with completed run
    const existingProgram = page.locator('text=Existing Program').first()
    if (await existingProgram.count() > 0) {
      await existingProgram.click()
      
      // Start new run
      await page.click('button:has-text("Начать анализ")')
      await page.click('button:has-text("Запустить")')
      
      // Should show skipped lessons
      await page.waitForSelector('.lesson-status-skipped', { timeout: 10000 })
      
      // Verify skip message
      await expect(page.locator('text=Контент не изменился')).toBeVisible()
    }
  })

  test('Concurrent processing with multiple workers', async ({ page, context }) => {
    await navigateToPrograms(page)
    
    // Start a run on first page
    await page.click('text=Test Program')
    await page.click('button:has-text("Начать анализ")')
    await page.fill('input[name="maxConcurrency"]', '5')
    await page.click('button:has-text("Запустить")')
    
    // Open second tab and trigger acceleration
    const page2 = await context.newPage()
    await page2.goto('/programs')
    await page2.click('text=Test Program')
    
    // Trigger page-driven tick
    await page2.click('button:has-text("Ускорить обработку")')
    
    // Both pages should show progress
    await expect(page.locator('.progress-bar')).toBeVisible()
    await expect(page2.locator('.progress-bar')).toBeVisible()
    
    // Verify concurrent processing (multiple lessons in "running" state)
    const runningLessons = await page.locator('.lesson-status-running').count()
    expect(runningLessons).toBeGreaterThanOrEqual(2)
  })

  test('Export results after completion', async ({ page }) => {
    await navigateToPrograms(page)
    
    // Open completed program
    await page.click('text=Completed Program')
    
    // Click export button
    await page.click('button:has-text("Экспорт результатов")')
    
    // Select export format
    await page.selectOption('select[name="exportFormat"]', 'csv')
    
    // Download should start
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Скачать")')
    ])
    
    // Verify download
    expect(download.suggestedFilename()).toContain('.csv')
  })

  test('Real-time progress updates via WebSocket/Polling', async ({ page }) => {
    await navigateToPrograms(page)
    await page.click('text=Test Program')
    
    // Start run
    await page.click('button:has-text("Начать анализ")')
    await page.click('button:has-text("Запустить")')
    
    // Monitor progress updates
    const progressBar = page.locator('.progress-percentage')
    
    // Get initial progress
    const initialProgress = await progressBar.textContent()
    
    // Wait for progress to update (polling interval is 2-5s)
    await page.waitForTimeout(6000)
    
    // Progress should have changed
    const updatedProgress = await progressBar.textContent()
    expect(updatedProgress).not.toBe(initialProgress)
    
    // Lesson statuses should update in real-time
    await page.waitForSelector('.lesson-status-success, .lesson-status-failed', { 
      timeout: 30000 
    })
  })

  test('Error recovery and retry mechanism', async ({ page }) => {
    await navigateToPrograms(page)
    
    // Create program that will have some failures
    await page.click('button:has-text("Новая программа")')
    await page.fill('input[name="name"]', 'Error Test Program')
    await page.fill('input[name="rootUrl"]', 'https://yonote.ru/course/error-test')
    await page.click('button:has-text("Создать программу")')
    
    // Start run
    await page.click('text=Error Test Program')
    await page.click('button:has-text("Начать анализ")')
    await page.click('button:has-text("Запустить")')
    
    // Wait for some errors
    await page.waitForSelector('.lesson-status-failed', { timeout: 30000 })
    
    // Check that retry attempts are shown
    await expect(page.locator('text=/Попытка \\d+ из 3/')).toBeVisible()
    
    // View error details
    const failedLesson = page.locator('.lesson-status-failed').first()
    await failedLesson.click()
    
    // Error details should be displayed
    await expect(page.locator('.error-details')).toBeVisible()
    await expect(page.locator('.error-message')).toContainText(/Error|Failed|Ошибка/)
  })
})

test.describe('Programs Feature - Accessibility', () => {
  test('Keyboard navigation works correctly', async ({ page }) => {
    await login(page)
    await navigateToPrograms(page)
    
    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await expect(page.locator('button:has-text("Новая программа")')).toBeFocused()
    
    // Open modal with Enter
    await page.keyboard.press('Enter')
    await expect(page.locator('dialog')).toBeVisible()
    
    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).not.toBeVisible()
    
    // Navigate through program list with arrow keys
    await page.keyboard.press('Tab')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    
    // Should open program details
    await expect(page.url()).toContain('/programs/')
  })

  test('Screen reader announcements', async ({ page }) => {
    await login(page)
    await navigateToPrograms(page)
    
    // Check ARIA labels
    await expect(page.locator('button[aria-label="Создать новую программу"]')).toBeVisible()
    await expect(page.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow')
    await expect(page.locator('[role="status"]')).toContainText(/Выполняется|Завершено|Остановлено/)
  })
})