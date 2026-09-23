// User-provided experiment assumptions, not independently verified provider pricing.
export const pricing = { contextTokens: 32000, inputUsdPerBillion: 42, outputUsdPerBillion: 0 };
export function inputCost(tokens: number) {
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('Invalid input token count');
  return tokens * pricing.inputUsdPerBillion / 1e9;
}

// Deliberately conservative local sizing proxy, NOT the provider's tokenizer.
// Counts one token per serialized UTF-8 byte and reserves room for API framing.
export function contextProxy(request: unknown) {
  return Buffer.byteLength(JSON.stringify(request), 'utf8') + 2048;
}
