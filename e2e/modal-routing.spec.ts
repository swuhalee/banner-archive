import { test, expect } from '@playwright/test'

test('아카이브에서 업로드 링크를 누르면 from 경로가 포함된 모달 라우팅이 동작한다', async ({ page }) => {
  await page.goto('/archive')

  await page.getByRole('link', { name: '업로드' }).click()
  await expect(page).toHaveURL(/\/upload\?from=%2Farchive/)
  await expect(page.getByRole('heading', { name: '정보 입력' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/archive/)
})
