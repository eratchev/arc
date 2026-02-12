import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAnthropicCreate = vi.fn();
const mockOpenAICreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { messages: { create: mockAnthropicCreate } };
    }),
  };
});

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { chat: { completions: { create: mockOpenAICreate } } };
    }),
  };
});

import { chat } from '../chat';

describe('chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_PROVIDER;
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  it('uses claude by default', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello from Claude' }],
    });

    const result = await chat('system', 'user');
    expect(result).toBe('Hello from Claude');
    expect(mockAnthropicCreate).toHaveBeenCalled();
  });

  it('uses openai when provider is "openai"', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello from OpenAI' } }],
    });

    const result = await chat('system', 'user', { provider: 'openai' });
    expect(result).toBe('Hello from OpenAI');
    expect(mockOpenAICreate).toHaveBeenCalled();
  });

  it('uses LLM_PROVIDER env var', async () => {
    process.env.LLM_PROVIDER = 'openai';
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'env provider' } }],
    });

    const result = await chat('system', 'user');
    expect(result).toBe('env provider');
  });

  it('throws for unknown provider', async () => {
    await expect(
      chat('system', 'user', { provider: 'gemini' as 'claude' }),
    ).rejects.toThrow('Unknown chat provider');
  });

  it('returns empty string when claude returns no text block', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 't1' }],
    });

    const result = await chat('system', 'user');
    expect(result).toBe('');
  });
});
