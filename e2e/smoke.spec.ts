import { test, expect } from '@playwright/test'

test('홈페이지에서 글로벌 내비게이션을 렌더링한다', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Banner Archive' })).toBeVisible()
  await expect(page.getByRole('link', { name: '아카이브' })).toBeVisible()
  await expect(page.getByRole('link', { name: '통계' })).toBeVisible()
})
