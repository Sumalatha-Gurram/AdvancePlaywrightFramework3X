/**
 * Checkout E2E built on the login fixtures from test-base:
 *   - validLogin:   standard_user buys one item and completes checkout.
 *   - invalidLogin: locked_out_user is stopped at the login page.
 */

import { test, expect } from '@fixtures/test-base';
import { DataGenerator } from '@utils/DataGenerator';
import { visualStep } from '@utils/visualSteps';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateJson, isLLMConfigured } from '../../AI/LLMGateway';

// First product card on the TTACart inventory page.
const FIRST_ITEM_ID = 'test-allthethings-tshirt-red';

interface CheckoutCustomer {
    firstName: string;
    lastName: string;
    postalCode: string;
}

function isCheckoutCustomer(value: unknown, firstInitial: string, lastInitial: string): value is CheckoutCustomer {
    if (typeof value !== 'object' || value === null
        || !('firstName' in value) || !('lastName' in value) || !('postalCode' in value)) {
        return false;
    }

    return typeof value.firstName === 'string'
        && /^[A-Za-z]{2,20}$/.test(value.firstName)
        && value.firstName.startsWith(firstInitial)
        && typeof value.lastName === 'string'
        && /^[A-Za-z]{2,20}$/.test(value.lastName)
        && value.lastName.startsWith(lastInitial)
        && typeof value.postalCode === 'string'
        && /^\d{5}$/.test(value.postalCode);
}

test.describe('@P0 @Regression E2E @Checkout Checkout Feature', () => {
    // Each step ends on the page in its title, so its screenshot shows that page.
    test('should complete checkout successfully', async ({
        page,
        validLogin, // logs in as standard_user before the test body runs
        inventoryPage,
        cartPage,
        checkoutStepOnePage,
        checkoutStepTwoPage,
        checkoutCompletePage,
    }) => {
        test.skip(!isLLMConfigured(), 'Configure LLM_PROVIDER, LLM_MODEL, and its API key to run this AI test.');

        await visualStep(page, 'Inventory page: add first item to cart', async () => {
            await inventoryPage.assertLoaded();
            await inventoryPage.addToCart(FIRST_ITEM_ID);
        });

        await visualStep(page, 'Cart page: verify one item in cart', async () => {
            await cartPage.open();
            expect(await cartPage.rowCount()).toBe(1);
        });

        await visualStep(page, 'Checkout step one: enter customer details', async () => {
            await cartPage.checkout();
            await checkoutStepOnePage.assertLoaded();

            const firstInitial = DataGenerator.firstName().charAt(0).toUpperCase();
            const lastInitial = DataGenerator.lastName().charAt(0).toUpperCase();
            const promptPath = resolve(__dirname, '../../AI/Prompts/checkoutCustomer.prompt.md');
            const promptTemplate = await readFile(promptPath, 'utf8');
            const prompt = promptTemplate
                .replace('{{FIRST_INITIAL}}', firstInitial)
                .replace('{{LAST_INITIAL}}', lastInitial)
                .replace('{{STATE}}', 'California');
            const generatedCustomer = await generateJson(prompt);

            if (!isCheckoutCustomer(generatedCustomer, firstInitial, lastInitial)) {
                throw new Error('The LLM returned checkout data in an invalid format.');
            }

            await checkoutStepOnePage.fillGuest(generatedCustomer);
        });

        await visualStep(page, 'Checkout step two: review order overview', async () => {
            await checkoutStepOnePage.continue();
            await checkoutStepTwoPage.assertLoaded();
        });

        await visualStep(page, 'Checkout complete: finish and verify confirmation', async () => {
            await checkoutStepTwoPage.finish();
            await checkoutCompletePage.assertOrderComplete();
        });
    });

    test('should reject login for a locked-out user', async ({ page, invalidLogin }) => {
        // invalidLogin has already submitted the form and waited for the error box.
        const { loginPage, username } = invalidLogin;
        await visualStep(page, `Login page: ${username} sees locked-out error`, async () => {
            await loginPage.expectErrorContains('locked out');
            await expect(page).not.toHaveURL(/inventory/);
        });
    });
});