/**
 * PBKDF2 key derivation utilities
 */

export const PBKDF2 = {
    /**
     * Derive a key from a string using PBKDF2
     * @param keyMaterial String to derive key from
     * @param salt Salt for derivation
     * @returns CryptoKey for encryption/decryption
     */
    deriveKey: async (keyMaterial: string, salt: string): Promise<CryptoKey> => {
      // Import the key material as a raw key
      const importedKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(keyMaterial),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      // Derive a key using PBKDF2
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode(salt),
          iterations: 100000,
          hash: 'SHA-256'
        },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      return derivedKey;
    }
  };