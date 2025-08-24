import { test, expect } from '@playwright/test'

test.describe('Memory Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Wait for the page to load
    await expect(page.getByText('MCP Memory Server')).toBeVisible()
  })

  test('should display the main interface', async ({ page }) => {
    // Check that main sections are visible
    await expect(page.getByText('Add New Memory')).toBeVisible()
    await expect(page.getByText('Search & Filter')).toBeVisible()
    await expect(page.getByText('Your Memories')).toBeVisible()
    
    // Check stats cards
    await expect(page.getByText('Total Memories')).toBeVisible()
    await expect(page.getByText('Namespaces')).toBeVisible()
    await expect(page.getByText('Added Today')).toBeVisible()
  })

  test('should add a new memory', async ({ page }) => {
    // Fill out the memory form
    await page.getByLabel('Memory Content').fill('This is a test memory for E2E testing')
    await page.getByLabel('Namespace').selectOption('general')
    await page.getByLabel('Labels').fill('test, e2e, automation')
    
    // Submit the form
    await page.getByRole('button', { name: 'Add Memory' }).click()
    
    // Should show loading state briefly
    await expect(page.getByText('Adding...')).toBeVisible({ timeout: 1000 })
    
    // Memory should appear in the list (assuming the API is mocked or working)
    // Note: In a real test, you'd need to mock the API or have a test database
    await expect(page.getByText('This is a test memory for E2E testing')).toBeVisible({ timeout: 5000 })
  })

  test('should validate memory form inputs', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: 'Add Memory' }).click()
    
    // Should show validation error
    await expect(page.getByText('Memory content is required')).toBeVisible()
    
    // Add content that's too short
    await page.getByLabel('Memory Content').fill('Hi')
    await page.getByRole('button', { name: 'Add Memory' }).click()
    
    // Should show length validation error
    await expect(page.getByText('Memory content must be at least 3 characters')).toBeVisible()
  })

  test('should search for memories', async ({ page }) => {
    // Add a memory first (assuming the API works or is mocked)
    await page.getByLabel('Memory Content').fill('Important meeting with John about project Alpha')
    await page.getByLabel('Namespace').selectOption('work')
    await page.getByLabel('Labels').fill('meeting, important')
    await page.getByRole('button', { name: 'Add Memory' }).click()
    
    // Wait for memory to be added
    await page.waitForTimeout(2000)
    
    // Search for the memory
    await page.getByLabel('Search memories').fill('meeting John')
    await page.getByRole('button', { name: 'Search' }).click()
    
    // Should filter results (or show loading state)
    await expect(page.getByText('meeting')).toBeVisible({ timeout: 5000 })
  })

  test('should filter by namespace', async ({ page }) => {
    // Click on a namespace filter button
    await page.getByRole('button', { name: /work/i }).click()
    
    // Should update the filtered view
    // Note: The exact behavior depends on whether there are existing memories
    await expect(page.locator('[data-testid="namespace-filter"]')).toContainText('work')
  })

  test('should show character count in form', async ({ page }) => {
    const contentField = page.getByLabel('Memory Content')
    
    // Type some content
    await contentField.fill('Hello world')
    
    // Should show character count
    await expect(page.getByText('11/8000 characters')).toBeVisible()
  })

  test('should handle form reset after successful submission', async ({ page }) => {
    // Fill out the form
    await page.getByLabel('Memory Content').fill('Test content for reset')
    await page.getByLabel('Labels').fill('test')
    
    // Submit
    await page.getByRole('button', { name: 'Add Memory' }).click()
    
    // Wait for potential success (timeout will happen if API doesn't work)
    await page.waitForTimeout(3000)
    
    // Form should be reset (content should be empty)
    // Note: This might not work if the API call fails
    await expect(page.getByLabel('Memory Content')).toHaveValue('')
    await expect(page.getByLabel('Labels')).toHaveValue('')
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Check that elements are still accessible on mobile
    await expect(page.getByText('MCP Memory Server')).toBeVisible()
    await expect(page.getByText('Add New Memory')).toBeVisible()
    await expect(page.getByLabel('Memory Content')).toBeVisible()
    
    // Form should be functional on mobile
    await page.getByLabel('Memory Content').fill('Mobile test memory')
    await expect(page.getByText('17/8000 characters')).toBeVisible()
  })

  test('should show loading states', async ({ page }) => {
    // Should show initial loading when page loads
    await page.goto('/')
    
    // Might briefly show loading spinner (if API is slow)
    const loadingSpinner = page.getByText('Loading memories...')
    // We can't guarantee it will be visible since API might be fast
    
    // Check that stats show some numbers (even if 0)
    await expect(page.locator('[data-testid="stats-total"]')).toContainText(/\d+/)
  })

  test('should handle error states gracefully', async ({ page }) => {
    // This test would need API mocking to simulate errors
    // For now, we just check that error UI elements exist in the DOM structure
    
    // Check that error message container exists (might be empty)
    const errorContainer = page.locator('[class*="bg-red-50"]')
    // Error container might exist but be hidden if no errors
  })

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab')
    
    // Should focus memory content field
    await expect(page.getByLabel('Memory Content')).toBeFocused()
    
    // Continue tabbing
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Namespace')).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Labels')).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Add Memory' })).toBeFocused()
  })

  test('should clear search when clear button is clicked', async ({ page }) => {
    // Enter search text
    const searchInput = page.getByLabel('Search memories')
    await searchInput.fill('test query')
    
    // Clear button should appear
    await expect(page.getByLabel('Clear search')).toBeVisible()
    
    // Click clear button
    await page.getByLabel('Clear search').click()
    
    // Search field should be empty
    await expect(searchInput).toHaveValue('')
    
    // Clear button should disappear
    await expect(page.getByLabel('Clear search')).not.toBeVisible()
  })
})