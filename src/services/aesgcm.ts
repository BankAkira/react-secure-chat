/**
 * AES-GCM encryption/decryption utilities
 */
// import { TextEncoder, TextDecoder } from 'util';

export interface Share {
  x: number;
  y: string;
}

export const AESGCM = {
  /**
   * Encrypt a message using AES-GCM
   * @param key CryptoKey for encryption
   * @param iv Initialization vector
   * @param message Message to encrypt
   * @returns Encrypted data
   */
  encrypt: async (key: CryptoKey, iv: Uint8Array, message: string): Promise<ArrayBuffer> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    try {
      return await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        data
      );
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  },
  
  /**
   * Decrypt data using AES-GCM
   * @param key CryptoKey for decryption
   * @param iv Initialization vector
   * @param ciphertext Encrypted data
   * @returns Decrypted message string
   */
  decrypt: async (key: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array): Promise<string> => {
    try {
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        ciphertext
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  },
  
  /**
   * Encrypt a Shamir's Secret Share using AES-GCM
   * @param share Share to encrypt
   * @param password Password for encryption
   * @returns Encrypted share as Uint8Array
   */
  encryptShare: async (share: Share, password: string): Promise<Uint8Array> => {
    // Generate a salt for key derivation
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Convert share to JSON string then to bytes
    const shareJson = JSON.stringify(share);
    const shareBytes = new TextEncoder().encode(shareJson);
    
    // Encrypt share
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      shareBytes
    );
    
    // Combine salt, IV, and ciphertext
    const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(ciphertext), salt.length + iv.length);
    
    return result;
  },
  
  /**
   * Decrypt an encrypted Shamir's Secret Share
   * @param encryptedShare Encrypted share
   * @param password Password for decryption
   * @returns Decrypted share
   */
  decryptShare: async (encryptedShare: Uint8Array, password: string): Promise<Share> => {
    // Extract components
    const salt = encryptedShare.slice(0, 16);
    const iv = encryptedShare.slice(16, 28);
    const ciphertext = encryptedShare.slice(28);
    
    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt share
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      ciphertext
    );
    
    // Parse decrypted data
    const shareJson = new TextDecoder().decode(decryptedData);
    return JSON.parse(shareJson) as Share;
  }
};