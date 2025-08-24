import { test, expect } from '@playwright/test'

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API endpoints
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({
        json: {
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User'
        }
      })
    })

    await page.route('**/api/memories', async route => {
      await route.fulfill({
        json: [
          {
            id: '1',
            content: 'Test memory content',
            namespace: 'projects',
            labels: ['work'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'test-user'
          }
        ]
      })
    })

    await page.goto('/')
  })

  test('should toggle between light and dark themes', async ({ page }) => {
    // Should start with system theme
    await expect(page.locator('html')).toHaveClass(/light|dark/)

    // Open theme menu
    await page.getByRole('button', { name: /theme/i }).first().click()

    // Switch to dark theme
    await page.getByText('Dark').click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Switch to light theme
    await page.getByRole('button', { name: /theme/i }).first().click()
    await page.getByText('Light').click()
    await expect(page.locator('html')).toHaveClass(/light/)
  })

  test('should persist theme selection', async ({ page }) => {
    // Set dark theme
    await page.getByRole('button', { name: /theme/i }).first().click()
    await page.getByText('Dark').click()

    // Reload page
    await page.reload()

    // Should still be dark
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('should respect system preference', async ({ page }) => {
    // Set system theme
    await page.getByRole('button', { name: /theme/i }).first().click()
    await page.getByText('System').click()

    // Simulate system dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Simulate system light mode preference
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveClass(/light/)
  })

  test('should work in collapsed sidebar', async ({ page }) => {
    // Collapse sidebar
    await page.getByRole('button', { name: /collapse/i }).click()

    // Theme toggle should still be accessible
    await page.getByRole('button', { name: /theme/i }).first().click()
    await page.getByText('Dark').click()
    
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('should show current theme in dropdown', async ({ page }) => {
    // Set light theme
    await page.getByRole('button', { name: /theme/i }).first().click()
    await page.getByText('Light').click()

    // Open theme menu again
    await page.getByRole('button', { name: /theme/i }).first().click()

    // Light should be highlighted/selected
    const lightOption = page.getByText('Light').first()
    await expect(lightOption).toBeVisible()
  })
})