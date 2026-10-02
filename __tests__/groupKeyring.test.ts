if (typeof (globalThis as any).crypto?.getRandomValues !== 'function') {
  (globalThis as any).crypto = {
    getRandomValues(arr: Uint8Array) {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  };
}

import {
  attachGroupKeyFallbacks,
  decryptGroupMessage,
  deriveGroupMessageKey,
  deriveStableGroupKey,
  encryptGroupMessage,
} from '../src/services/e2ee/groupConversationCrypto';

describe('group key fallbacks', () => {
  it('opens a message sealed with the stable key regardless of roster', () => {
    const wire = encryptGroupMessage('hi', deriveStableGroupKey('g1'));
    const reader = new Uint8Array(deriveStableGroupKey('g1'));
    attachGroupKeyFallbacks(reader, [deriveGroupMessageKey('g1', ['a', 'b'])]);
    expect(decryptGroupMessage(wire, reader)).toBe('hi');
  });

  it('opens legacy roster-keyed history through a fallback', () => {
    const wire = encryptGroupMessage('old', deriveGroupMessageKey('g1', ['a', 'b', 'c']));
    const reader = new Uint8Array(deriveStableGroupKey('g1'));
    expect(decryptGroupMessage(wire, reader)).toBeNull();
    attachGroupKeyFallbacks(reader, [
      deriveGroupMessageKey('g1', ['a', 'b']),
      deriveGroupMessageKey('g1', ['a', 'b', 'c']),
    ]);
    expect(decryptGroupMessage(wire, reader)).toBe('old');
  });
});

describe('lazy roster guesses', () => {
  it('opens history sealed under the roster minus one member', () => {
    const wire = encryptGroupMessage('older', deriveGroupMessageKey('g2', ['a', 'b']));
    const reader = new Uint8Array(deriveStableGroupKey('g2'));
    attachGroupKeyFallbacks(reader, [], () => [deriveGroupMessageKey('g2', ['a', 'b'])]);
    expect(decryptGroupMessage(wire, reader)).toBe('older');
  });
});
