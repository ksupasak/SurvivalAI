/**
 * LLM Service
 *
 * Manages AI chat responses across different modes:
 * - knowledge: Uses the local survival knowledge base
 * - offline-llm: On-device AI model via llama.rn (GGUF)
 * - online: OpenAI ChatGPT API with survival system prompt
 */

import { Platform } from 'react-native';
import { searchKnowledge, type KnowledgeEntry } from '@/services/knowledge-base';
import { getApiKey } from '@/services/settings';
import { getActiveModel, getModelPath, type ModelInfo } from '@/services/model-download';

// llama.rn is native-only — lazy-load to avoid crashing on web
let _initLlama: typeof import('llama.rn').initLlama | null = null;
let _LlamaContext: any = null;

async function getLlamaRn() {
  if (Platform.OS === 'web') return null;
  if (!_initLlama) {
    try {
      const mod = require('llama.rn');
      _initLlama = mod.initLlama;
      _LlamaContext = mod.LlamaContext;
    } catch {
      return null;
    }
  }
  return { initLlama: _initLlama! };
}

export type ChatMode = 'knowledge' | 'offline-llm' | 'online';

export const SURVIVAL_SYSTEM_PROMPT = `You are SurvivalAI, an expert wilderness survival and emergency preparedness assistant. Your role is to provide clear, accurate, and actionable survival guidance.

Key principles:
- Prioritize life safety above all else
- Follow the Rule of 3s: 3 minutes without air, 3 hours without shelter (in extreme conditions), 3 days without water, 3 weeks without food
- Give concise, step-by-step instructions when possible
- Warn about dangers and common mistakes
- Adapt advice to the user's described situation and environment
- When uncertain, err on the side of caution and recommend seeking professional help
- Include relevant first aid information when applicable
- Cover mental health, morale, and psychological resilience during crisis situations

You should be prepared to help with:
- Water finding, purification, and storage
- Shelter building and insulation
- Fire starting and management
- Food foraging, hunting, and preparation
- Navigation without instruments
- First aid and medical emergencies
- Signaling for rescue
- Weather prediction and preparation
- Wildlife encounters and safety
- Emergency preparedness and kit planning
- Nuclear, chemical, and biological survival
- War zone survival and civilian safety
- Mental health, stress management, and group morale
- Government emergency preparedness guidelines (FEMA, Red Cross, WHO, military FM 21-76)`;

function formatKnowledgeResponse(results: KnowledgeEntry[], query: string): string {
  if (results.length === 0) {
    return `I don't have specific information about "${query}" in my knowledge base. Try rephrasing your question or ask about topics like water purification, shelter building, fire starting, first aid, or navigation.`;
  }

  if (results.length === 1) {
    return results[0].a;
  }

  const primary = results[0];
  let response = primary.a;

  if (results.length > 1) {
    const additionalTips = results
      .slice(1, 3)
      .map((entry) => entry.a)
      .filter((answer) => answer !== primary.a);

    if (additionalTips.length > 0) {
      response += '\n\nRelated tips:\n';
      for (const tip of additionalTips) {
        const shortened = tip.split('. ').slice(0, 2).join('. ');
        response += `\n- ${shortened}.`;
      }
    }
  }

  return response;
}

// ─── Chat History (for online mode) ─────────────────────────────────────────

let chatHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];

export function clearChatHistory(): void {
  chatHistory = [];
}

// ─── On-Device LLM (llama.rn) ──────────────────────────────────────────────

let llamaContext: any = null;
let isLoadingModel = false;

type LlmStatusListener = (status: LlmStatus) => void;
let llmStatusListeners: LlmStatusListener[] = [];

export type LlmStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number }
  | { state: 'ready'; modelName: string }
  | { state: 'error'; message: string };

let currentLlmStatus: LlmStatus = { state: 'idle' };

function setLlmStatus(status: LlmStatus) {
  currentLlmStatus = status;
  llmStatusListeners.forEach((l) => l(status));
}

export function getLlmStatus(): LlmStatus {
  return currentLlmStatus;
}

export function subscribeLlmStatus(listener: LlmStatusListener): () => void {
  llmStatusListeners.push(listener);
  listener(currentLlmStatus);
  return () => {
    llmStatusListeners = llmStatusListeners.filter((l) => l !== listener);
  };
}

/**
 * Initialize the on-device LLM with a downloaded model.
 */
export async function initOfflineLlm(model?: ModelInfo): Promise<boolean> {
  if (isLoadingModel) return false;
  if (llamaContext) return true; // Already loaded

  const activeModel = model || await getActiveModel();
  if (!activeModel) {
    setLlmStatus({ state: 'error', message: 'No model downloaded' });
    return false;
  }

  isLoadingModel = true;
  setLlmStatus({ state: 'loading', progress: 0 });

  try {
    const llama = await getLlamaRn();
    if (!llama) {
      setLlmStatus({ state: 'error', message: 'Offline LLM not available on this platform' });
      isLoadingModel = false;
      return false;
    }

    const modelPath = getModelPath(activeModel);
    console.log('[LLM] Loading model:', modelPath);

    llamaContext = await llama.initLlama(
      {
        model: modelPath,
        n_ctx: 2048,
        n_batch: 512,
        n_threads: 4,
        flash_attn_type: 'auto',
        cache_type_k: 'q4_0',
        cache_type_v: 'q4_0',
      },
      (progress) => {
        setLlmStatus({ state: 'loading', progress: progress / 100 });
      }
    );

    console.log('[LLM] Model loaded successfully. GPU:', llamaContext.gpu);
    setLlmStatus({ state: 'ready', modelName: activeModel.name });
    isLoadingModel = false;
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to load model';
    console.error('[LLM] Model load error:', msg);
    setLlmStatus({ state: 'error', message: msg });
    isLoadingModel = false;
    llamaContext = null;
    return false;
  }
}

/**
 * Release the on-device LLM context to free memory.
 */
export async function releaseOfflineLlm(): Promise<void> {
  if (llamaContext) {
    try {
      await llamaContext.release();
    } catch {
      // Ignore release errors
    }
    llamaContext = null;
  }
  setLlmStatus({ state: 'idle' });
}

/**
 * Check if the offline LLM is ready for inference.
 */
export function isOfflineLlmReady(): boolean {
  return llamaContext !== null && currentLlmStatus.state === 'ready';
}

/**
 * Run inference on the on-device LLM.
 */
async function callOfflineLlm(message: string): Promise<string> {
  if (!llamaContext) {
    throw new Error('MODEL_NOT_LOADED');
  }

  const messages = [
    { role: 'system', content: SURVIVAL_SYSTEM_PROMPT },
    { role: 'user', content: message },
  ];

  try {
    const result = await llamaContext.completion({
      messages,
      n_predict: 512,
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      stop: ['<|end|>', '<|eot_id|>', '</s>', '<|im_end|>'],
    });

    return result.text.trim() || 'No response generated.';
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Inference failed';
    console.error('[LLM] Inference error:', msg);
    throw new Error(`INFERENCE_ERROR: ${msg}`);
  }
}

// ─── Online LLM (ChatGPT) ──────────────────────────────────────────────────

async function callChatGPT(message: string): Promise<string> {
  const apiKey = await getApiKey('openai');

  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  if (chatHistory.length === 0) {
    chatHistory.push({ role: 'system', content: SURVIVAL_SYSTEM_PROMPT });
  }

  chatHistory.push({ role: 'user', content: message });

  const messages = chatHistory.length > 21
    ? [chatHistory[0], ...chatHistory.slice(-20)]
    : chatHistory;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;

    if (response.status === 401) throw new Error('INVALID_API_KEY');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(`API Error: ${errorMsg}`);
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };
  const assistantMessage = data.choices[0]?.message?.content || 'No response received.';

  chatHistory.push({ role: 'assistant', content: assistantMessage });

  return assistantMessage;
}

// ─── Main Response Handler ──────────────────────────────────────────────────

export async function getResponse(message: string, mode: ChatMode): Promise<string> {
  switch (mode) {
    case 'knowledge': {
      const results = searchKnowledge(message);
      return formatKnowledgeResponse(results, message);
    }

    case 'offline-llm': {
      try {
        // Try to auto-init if model is downloaded but not loaded
        if (!llamaContext) {
          const loaded = await initOfflineLlm();
          if (!loaded) {
            const results = searchKnowledge(message);
            return '⚠️ No offline model loaded. Download a model in Settings to enable on-device AI.\n\nUsing knowledge base:\n\n' +
              formatKnowledgeResponse(results, message);
          }
        }
        return await callOfflineLlm(message);
      } catch (error: unknown) {
        const err = error as Error;
        console.log('[LLM] Offline LLM failed:', err.message);

        if (err.message === 'MODEL_NOT_LOADED') {
          const results = searchKnowledge(message);
          return '⚠️ Model not loaded. Tap the settings icon to download and load an AI model.\n\nUsing knowledge base:\n\n' +
            formatKnowledgeResponse(results, message);
        }

        const results = searchKnowledge(message);
        return '⚠️ On-device AI error. Falling back to knowledge base.\n\n' +
          formatKnowledgeResponse(results, message);
      }
    }

    case 'online': {
      try {
        return await callChatGPT(message);
      } catch (error: unknown) {
        const err = error as Error;

        if (err.message === 'NO_API_KEY') {
          return '⚠️ No API key configured.\n\nTo use online AI (ChatGPT), tap the ⚙️ icon in the header to enter your OpenAI API key. The key is stored locally on your device only.\n\nFalling back to knowledge base...\n\n' +
            formatKnowledgeResponse(searchKnowledge(message), message);
        }

        if (err.message === 'INVALID_API_KEY') {
          return '⚠️ Invalid API key. Please check your OpenAI API key in settings.\n\nFalling back to knowledge base...\n\n' +
            formatKnowledgeResponse(searchKnowledge(message), message);
        }

        if (err.message === 'RATE_LIMITED') {
          return '⚠️ Rate limited by OpenAI. Please wait a moment and try again.\n\nFalling back to knowledge base...\n\n' +
            formatKnowledgeResponse(searchKnowledge(message), message);
        }

        console.log('[LLM] Online mode failed:', err.message);
        return '⚠️ Could not reach ChatGPT (no network?).\n\nFalling back to offline knowledge base...\n\n' +
          formatKnowledgeResponse(searchKnowledge(message), message);
      }
    }

    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unknown chat mode: ${_exhaustive}`);
    }
  }
}

export function getAvailableModes(): ChatMode[] {
  return ['knowledge', 'offline-llm', 'online'];
}
