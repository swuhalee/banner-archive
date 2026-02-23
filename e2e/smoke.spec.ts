import { test, expect } from '@playwright/test'

test('home page renders the global navigation', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Banner Archive' })).toBeVisible()
  await expect(page.getByRole('link', { name: '아카이브' })).toBeVisible()
  await expect(page.getByRole('link', { name: '통계' })).toBeVisible()
})
