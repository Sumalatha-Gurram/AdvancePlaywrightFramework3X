# LLM Gateway

The gateway can send prompts to Groq, OpenRouter, OpenAI, Anthropic, or DeepSeek
and return the response as parsed JSON. Provider credentials are read from
environment variables; do not put API keys in source code or commit them.

Set these variables in `.env` or your shell:

```env
LLM_PROVIDER=groq
LLM_MODEL=your-provider-model-name
GROQ_API_KEY=your-key
```

`LLM_PROVIDER` supports `groq`, `openrouter`, `openai`, `anthropic`, and
`deepseek`. Set the key for the selected provider:

| Provider | API key variable |
| --- | --- |
| Groq | `GROQ_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |

Use the model name supported by your provider and account. Availability, free
tiers, and pricing depend on the provider and can change; API access is not
necessarily free.

```ts
import { generateJson, generateJsonFile } from './LLMGateway';

const response = await generateJson('Return a JSON object with a greeting.');
await generateJsonFile('Return a JSON object with a greeting.', 'output.json');
```

`generateJson` returns parsed JSON as `unknown`; validate its shape before
using it as a specific TypeScript type. `generateJsonFile` also writes the
formatted JSON to the given path.
