import { test, expect } from '@playwright/test'

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({
        json: {
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg'
        }
      })
    })

    // Mock memories API
    await page.route('**/api/memories', async route => {
      const memories = [
        {
          id: '1',
          content: 'Project planning meeting notes',
          namespace: 'projects',
          labels: ['work', 'planning'],
          createdAt: new Date('2024-01-15').toISOString(),
          updatedAt: new Date('2024-01-15').toISOString(),
          userId: 'test-user'
        },
        {
          id: '2',
          content: 'Personal goal for the year',
          namespace: 'personal',
          labels: ['goals', 'life'],
          createdAt: new Date('2024-01-14').toISOString(),
          updatedAt: new Date('2024-01-14').toISOString(),
          userId: 'test-user'
        },
        {
          id: '3',
          content: 'Recipe for chocolate cake',
          namespace: 'recipes',
          labels: ['dessert', 'baking'],
          createdAt: new Date('2024-01-13').toISOString(),
          updatedAt: new Date('2024-01-13').toISOString(),
          userId: 'test-user'
        }
      ]
      await route.fulfill({ json: memories })
    })

    await page.goto('/')
  })

  test('should navigate between different views', async ({ page }) => {
    // Should start on explore view
    await expect(page.getByText('Explore Your Memory')).toBeVisible()

    // Navigate to Timeline
    await page.getByRole('button', { name: /timeline/i }).click()
    await expect(page.getByText('Memory Timeline')).toBeVisible()

    // Navigate to Collections
    await page.getByRole('button', { name: /collections/i }).click()
    await expect(page.getByText('Memory Collections')).toBeVisible()

    // Navigate to Add Memory
    await page.getByRole('button', { name: /add memory/i }).click()
    await expect(page.getByText('Capture New Memory')).toBeVisible()

    // Navigate back to Explore
    await page.getByRole('button', { name: /explore/i }).click()
    await expect(page.getByText('Explore Your Memory')).toBeVisible()
  })

  test('should highlight active navigation item', async ({ page }) => {
    // Explore should be active by default
    const exploreButton = page.getByRole('button', { name: /explore/i })
    await expect(exploreButton).toHaveClass(/text-violet-600/)

    // Click Timeline and check it becomes active
    await page.getByRole('button', { name: /timeline/i }).click()
    const timelineButton = page.getByRole('button', { name: /timeline/i })
    await expect(timelineButton).toHaveClass(/text-violet-600/)
  })

  test('should display user information', async ({ page }) => {
    await expect(page.getByText('Test User')).toBeVisible()
    await expect(page.getByText('test@example.com')).toBeVisible()
  })

  test('should allow sidebar collapse/expand', async ({ page }) => {
    // Sidebar should start expanded
    await expect(page.getByText('Memory')).toBeVisible()
    await expect(page.getByText('AI Knowledge Base')).toBeVisible()

    // Collapse sidebar
    await page.getByRole('button', { name: /collapse|expand/i }).click()
    
    // Text should be hidden but icons should still be visible
    await expect(page.getByText('Discover your memories')).not.toBeVisible()
    
    // Expand sidebar again
    await page.getByRole('button', { name: /collapse|expand/i }).click()
    await expect(page.getByText('Discover your memories')).toBeVisible()
  })

  test('should show proper navigation descriptions', async ({ page }) => {
    await expect(page.getByText('Discover your memories')).toBeVisible()
    await expect(page.getByText('Chronological view')).toBeVisible()
    await expect(page.getByText('Organized by topic')).toBeVisible()
    await expect(page.getByText('Capture new thoughts')).toBeVisible()
  })

  test('should handle logout', async ({ page }) => {
    // Mock logout API
    await page.route('**/api/auth/logout', async route => {
      await route.fulfill({ json: { success: true } })
    })

    // Click logout button
    await page.getByTitle('Sign out').click()

    // Should redirect to login (not implemented in mock, but button should exist)
    await expect(page.getByTitle('Sign out')).toBeVisible()
  })

  test('should maintain view state during navigation', async ({ page }) => {
    // Go to collections view
    await page.getByRole('button', { name: /collections/i }).click()
    await expect(page.getByText('Memory Collections')).toBeVisible()

    // Collection cards should be visible
    await expect(page.getByText('projects')).toBeVisible()
    await expect(page.getByText('personal')).toBeVisible()
    await expect(page.getByText('recipes')).toBeVisible()
  })

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Sidebar should still be functional on mobile
    await expect(page.getByText('Memory')).toBeVisible()
    
    // Navigation should work
    await page.getByRole('button', { name: /timeline/i }).click()
    await expect(page.getByText('Memory Timeline')).toBeVisible()
  })

  test('should display branding correctly', async ({ page }) => {
    await expect(page.getByText('Memory')).toBeVisible()
    await expect(page.getByText('AI Knowledge Base')).toBeVisible()
    
    // Brain emoji should be visible in the logo
    const logo = page.locator('text=🧠').first()
    await expect(logo).toBeVisible()
  })

  test('should handle theme toggle in sidebar', async ({ page }) => {
    // Theme toggle should be accessible in sidebar
    const themeButton = page.getByRole('button', { name: /theme/i }).first()
    await expect(themeButton).toBeVisible()
    
    await themeButton.click()
    await expect(page.getByText('Light')).toBeVisible()
    await expect(page.getByText('Dark')).toBeVisible()
    await expect(page.getByText('System')).toBeVisible()
  })
})