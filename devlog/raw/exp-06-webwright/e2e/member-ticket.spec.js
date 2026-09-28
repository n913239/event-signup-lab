// 從 Webwright 的 final_script.py 改寫:流程與選擇器沿用,期望值來自 seed.sql(一般票 100000 分 = NT$1,000),不是從畫面讀。
import { test, expect } from '@playwright/test'

test('會員訂一般票:畫面上的金額要等於 seed 的票價', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'email' }).fill('member@example.com')
  await page.getByRole('textbox', { name: '密碼(至少 8 字元)' }).fill('password123')
  await page.getByRole('button', { name: '登入', exact: true }).click()
  await expect(page.getByRole('button', { name: '登出' })).toBeVisible()

  await page.getByRole('link', { name: '秋季音樂會' }).click()
  await page.locator('#tt').selectOption('tt-general')
  await expect(page.locator('#tt option:checked')).toContainText('NT$1,000')

  const seat = page.locator('[data-seat].btn-outline').first()
  const seatNo = await seat.getAttribute('data-seat')
  await seat.click()
  await expect(page.locator('#hold')).toHaveText('保留 1 席')
  await page.locator('#hold').click()

  await expect(page.locator('#price')).toContainText('應付')
  await expect(page.locator('#price')).toContainText('NT$1,000')
  await page.getByRole('button', { name: '確認', exact: true }).click()

  await expect(page).toHaveURL(/#\/tickets/)
  const card = page.locator('.card').filter({ hasText: `${seatNo} 一般` })
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('總計 NT$1,000')
})
