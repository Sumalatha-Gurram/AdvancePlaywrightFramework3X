import { test, expect } from '@playwright/test';
import { generateJsonFile, isLLMConfigured } from '../../AI/LLMGateway';

/**
 * LLM Gateway demo. Uses LLM_PROVIDER, LLM_MODEL, and the matching API key
 * from the environment. Skips cleanly when they are not configured.
 *
 *   npx playwright test src/tests/aiTests --project=chromium
 *   LLM_PROVIDER=groq npx playwright test src/tests/aiTests --project=chromium
 */

interface LoginCase {
    title: string;
    username: string;
    password: string;
    expected: string;
}

function isLoginCases(value: unknown): value is { cases: LoginCase[] } {
    if (typeof value !== 'object' || value === null || !('cases' in value) || !Array.isArray(value.cases)) {
        return false;
    }

    return value.cases.every((item) =>
        typeof item === 'object'
        && item !== null
        && 'title' in item && typeof item.title === 'string'
        && 'username' in item && typeof item.username === 'string'
        && 'password' in item && typeof item.password === 'string'
        && 'expected' in item && typeof item.expected === 'string',
    );
}

test.describe('LLM Gateway', () => {
    test('generates login test data as JSON and saves it', async () => {
        test.skip(!isLLMConfigured(), 'Configure LLM_PROVIDER, LLM_MODEL, and its API key to run this AI test.');
        test.setTimeout(120_000);

        const result = await generateJsonFile(
            'Generate 3 negative login test cases. Return a JSON object with a "cases" array. ' +
                'Each item must contain string fields: title, username, password, and expected.',
            'reports/ai/login-cases.json',
        );

        expect(isLoginCases(result)).toBe(true);
        if (!isLoginCases(result)) {
            throw new Error('The LLM returned login test cases in an invalid format.');
        }
        expect(result.cases.length).toBeGreaterThan(0);
    });
});