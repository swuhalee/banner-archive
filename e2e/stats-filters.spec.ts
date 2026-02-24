import { test, expect } from '@playwright/test'

test('통계 페이지에서 필터 입력 후 초기화할 수 있다', async ({ page }) => {
  await page.goto('/stats')

  const regionInput = page.getByPlaceholder('지역 검색 (Enter로 검색)')
  const hashtagInput = page.getByPlaceholder('해시태그 (Enter로 검색)')

  await regionInput.fill('서울')
  await regionInput.press('Enter')
  await hashtagInput.fill('교통')
  await hashtagInput.press('Enter')

  const resetButton = page.getByRole('button', { name: '필터 초기화' })
  await expect(resetButton).toBeVisible()
  await resetButton.click()

  await expect(regionInput).toHaveValue('')
  await expect(hashtagInput).toHaveValue('')
})
