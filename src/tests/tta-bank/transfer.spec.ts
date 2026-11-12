import { expect, test } from '@playwright/test';
import { DataGenerator } from '../../utils/DataGenerator';

const bankUrl = 'https://app.thetestingacademy.com/playwright/tta-bank/dashboard';
const email = process.env.TTA_BANK_EMAIL ?? 'priya.tester@ttabank.in';
const password = process.env.TTA_BANK_PASSWORD ?? 'Test@1234';

test('debit a transfer from the TTA Bank account', async ({ page }) => {
    await page.goto(bankUrl);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    const balance = page.getByRole('region', { name: 'Account balance' });
    await expect(balance.getByText('₹50,000', { exact: true })).toBeVisible();

    const recentTransactions = page.getByRole('table', { name: 'Recent transactions table' });
    const openingDeposit = recentTransactions.getByRole('row').filter({ hasText: 'TTA Bank' });
    await expect(openingDeposit).toContainText('+₹50,000');

    await page.getByRole('main').getByRole('link', { name: 'Send money' }).click();
    await page.getByRole('option', { name: 'Pay Meera Iyer' }).click();
    await page.getByLabel('Amount in rupees').fill('5000');
    await page.getByLabel('Expense category').selectOption({ label: 'Travel' });
    const note = DataGenerator.transferNote();
    const noteField = page.getByLabel('Transfer note');
    await noteField.fill(note);
    await expect(noteField).toHaveValue(note);
    await page.getByRole('button', { name: 'Review transfer' }).click();

    const confirmation = page.getByRole('dialog', { name: 'Confirm transfer' });
    await expect(confirmation).toContainText('Meera Iyer');
    await expect(confirmation).toContainText('₹5,000');
    await expect(confirmation).toContainText('Travel');
    await confirmation.getByRole('button', { name: 'Confirm and send' }).click();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(balance.getByText('₹45,000', { exact: true })).toBeVisible();

    const debit = recentTransactions.getByRole('row').filter({ hasText: 'Meera Iyer' });
    await expect(debit).toContainText('Travel');
    await expect(debit).toContainText('debit');
    await expect(debit).toContainText('-₹5,000');
});
