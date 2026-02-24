import { test, expect } from '@playwright/test'

test('업로드 페이지에서 필수 입력이 채워져야 분석 버튼이 활성화된다', async ({ page }) => {
  await page.goto('/upload')

  const analyzeButton = page.getByRole('button', { name: '현수막 분석 시작' })
  await expect(analyzeButton).toBeDisabled()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'banner.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YxM1x8AAAAASUVORK5CYII=', 'base64'),
  })

  const regionSelect = page.getByRole('combobox').first()
  await regionSelect.selectOption({ index: 1 })

  await page.getByLabel('사진을 촬영한 실제 위치와 날짜 정보가 정확합니다.').check()
  await page.getByLabel('직접 촬영한 사진이며, 본 아카이브 서비스의 기록 목적으로 활용됨에 동의합니다.').check()

  await expect(analyzeButton).toBeEnabled()
})
