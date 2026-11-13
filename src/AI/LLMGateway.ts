import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { requireEnv } from '../config/env';

export type LLMProvider = 'groq' | 'openrouter' | 'openai' | 'anthropic' | 'deepseek';

export interface LLMOptions {
    provider?: LLMProvider;
    model?: string;
}

const API_KEY_ENV: Record<LLMProvider, string> = {
    groq: 'GROQ_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
};

const CHAT_COMPLETIONS_URL: Record<Exclude<LLMProvider, 'anthropic'>, string> = {
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/chat/completions',
};

const JSON_INSTRUCTIONS = 'Return only a valid JSON object. Do not include markdown or extra text.';

function getProvider(provider?: LLMProvider): LLMProvider {
    const value = provider ?? requireEnv('LLM_PROVIDER').toLowerCase();

    switch (value) {
        case 'groq':
        case 'openrouter':
        case 'openai':
        case 'anthropic':
        case 'deepseek':
            return value;
        default:
            throw new Error(
                `Unsupported LLM_PROVIDER "${value}". Choose groq, openrouter, openai, anthropic, or deepseek.`,
            );
    }
}

export function isLLMConfigured(): boolean {
    if (!process.env.LLM_MODEL?.trim()) {
        return false;
    }

    switch (process.env.LLM_PROVIDER?.trim().toLowerCase()) {
        case 'groq':
            return Boolean(process.env.GROQ_API_KEY?.trim());
        case 'openrouter':
            return Boolean(process.env.OPENROUTER_API_KEY?.trim());
        case 'openai':
            return Boolean(process.env.OPENAI_API_KEY?.trim());
        case 'anthropic':
            return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
        case 'deepseek':
            return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
        default:
            return false;
    }
}

function getResponseText(responseBody: unknown, provider: LLMProvider): string {
    if (typeof responseBody !== 'object' || responseBody === null) {
        throw new Error('The LLM provider returned an unexpected response.');
    }

    const body = responseBody as Record<string, unknown>;

    if (provider === 'anthropic') {
        if (!Array.isArray(body.content)) {
            throw new Error('The Anthropic response did not include content.');
        }

        const text = body.content
            .filter((block): block is { type: string; text: string } =>
                typeof block === 'object'
                && block !== null
                && 'type' in block
                && block.type === 'text'
                && 'text' in block
                && typeof block.text === 'string',
            )
            .map((block) => block.text)
            .join('');

        if (!text) {
            throw new Error('The Anthropic response did not contain text.');
        }
        return text;
    }

    if (!Array.isArray(body.choices) || body.choices.length === 0) {
        throw new Error('The LLM provider returned no response choices.');
    }

    const choice = body.choices[0];
    if (typeof choice !== 'object' || choice === null || !('message' in choice)) {
        throw new Error('The LLM provider returned an unexpected response choice.');
    }

    const message = choice.message;
    if (typeof message !== 'object' || message === null || !('content' in message)) {
        throw new Error('The LLM provider returned no message content.');
    }

    if (typeof message.content !== 'string') {
        throw new Error('The LLM response content was not text.');
    }

    return message.content;
}

function parseJson(text: string): unknown {
    const cleanedText = text.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');

    try {
        const result: unknown = JSON.parse(cleanedText);
        return result;
    } catch {
        throw new Error('The LLM response was not valid JSON.');
    }
}

/**
 * Sends a prompt to the selected provider and returns its response as parsed JSON.
 * Set LLM_PROVIDER, LLM_MODEL, and the matching provider API key in the environment.
 */
export async function generateJson(prompt: string, options: LLMOptions = {}): Promise<unknown> {
    if (!prompt.trim()) {
        throw new Error('The LLM prompt cannot be empty.');
    }

    const provider = getProvider(options.provider);
    const model = options.model?.trim() || requireEnv('LLM_MODEL');
    const apiKey = requireEnv(API_KEY_ENV[provider]);
    const isAnthropic = provider === 'anthropic';

    const headers: Record<string, string> = {
        'content-type': 'application/json',
    };

    let url: string;
    let requestBody: Record<string, unknown>;

    if (isAnthropic) {
        url = 'https://api.anthropic.com/v1/messages';
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        requestBody = {
            model,
            max_tokens: 2048,
            system: JSON_INSTRUCTIONS,
            messages: [{ role: 'user', content: prompt }],
        };
    } else {
        url = CHAT_COMPLETIONS_URL[provider];
        headers.authorization = `Bearer ${apiKey}`;
        requestBody = {
            model,
            messages: [
                { role: 'system', content: JSON_INSTRUCTIONS },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60_000),
    });
    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(`LLM request failed (${response.status}): ${responseText.slice(0, 1000)}`);
    }

    let responseBody: unknown;
    try {
        responseBody = JSON.parse(responseText);
    } catch {
        throw new Error('The LLM provider returned a non-JSON API response.');
    }

    return parseJson(getResponseText(responseBody, provider));
}

/** Generates JSON and writes it to the requested file path. */
export async function generateJsonFile(
    prompt: string,
    outputPath: string,
    options: LLMOptions = {},
): Promise<unknown> {
    const result = await generateJson(prompt, options);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    return result;
}
