import { expect, test } from '@playwright/test';
import { DataGenerator } from '../../utils/DataGenerator';
import { requireEnv } from '../../config/env';

const bankUrl = 'https://app.thetestingacademy.com/playwright/tta-bank/dashboard';

test('debit a transfer from the TTA Bank account', async ({ page }) => {
  const email = requireEnv('TTA_BANK_EMAIL');
  const password = requireEnv('TTA_BANK_PASSWORD');

  await page.goto(bankUrl);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  const accountBalance = page.getByRole('region', { name: 'Account balance' });
  await expect(accountBalance.getByText('₹50,000', { exact: true })).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: 'Send money' }).click();
  await page.getByRole('option', { name: 'Pay Meera Iyer' }).click();
  await page.getByLabel('Amount in rupees').fill('5000');
  await page.getByLabel('Expense category').selectOption({ label: 'Travel' });
  await page.getByLabel('Transfer note').fill(DataGenerator.transferNote());

  await page.getByRole('button', { name: 'Review transfer' }).click();

  const confirmPopup = page.getByRole('dialog', { name: 'Confirm transfer' });
  await expect(confirmPopup).toContainText('Meera Iyer');
  await expect(confirmPopup).toContainText('₹5,000');
  await expect(confirmPopup).toContainText('Travel');

  await confirmPopup.getByRole('button', { name: 'Confirm and send' }).click();

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(accountBalance.getByText('₹45,000', { exact: true })).toBeVisible();

  const debitRow = page.getByRole('table', { name: 'Recent transactions table' })
    .getByRole('row')
    .filter({ hasText: 'Meera Iyer' });

  await expect(debitRow).toContainText('Travel');
  await expect(debitRow).toContainText('debit');
  await expect(debitRow).toContainText('-₹5,000');
});
