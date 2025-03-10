/**
 * Elliptic Curve Cryptography utilities
 */

export const ECCUtils = {
    /**
     * Generate a new ECC key pair
     * @returns Object containing private key and public key bytes
     */
    generateKeyPair: async (): Promise<{ privateKeyBytes: Uint8Array, publicKeyBytes: Uint8Array }> => {
      try {
        // Generate a new key pair using P-256 curve (secp256r1)
        const keyPair = await crypto.subtle.generateKey(
          {
            name: 'ECDH',
            namedCurve: 'P-256'
          },
          true, // extractable
          ['deriveKey', 'deriveBits'] // key usages
        );
        
        // Export the private key
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
        
        // Convert JWK private key to bytes (we only need the 'd' parameter which is the private key value)
        const privateKeyBase64 = privateKeyJwk.d as string;
        const privateKeyBytes = ECCUtils.base64UrlToBytes(privateKeyBase64);
        
        // Export the public key in raw format (x and y coordinates)
        const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const publicKeyBytes = new Uint8Array(publicKeyRaw);
        
        return { privateKeyBytes, publicKeyBytes };
      } catch (error) {
        console.error('Error generating ECC key pair:', error);
        throw new Error('Failed to generate ECC key pair');
      }
    },
    
    /**
     * Import an ECC private key from bytes
     * @param privateKeyBytes Private key bytes
     * @returns CryptoKey
     */
    importPrivateKey: async (privateKeyBytes: Uint8Array): Promise<CryptoKey> => {
      try {
        // Convert private key bytes to JWK format
        const privateKeyBase64 = ECCUtils.bytesToBase64Url(privateKeyBytes);
        
        // Create JWK from d parameter (private key value)
        const jwk = {
          kty: 'EC',
          crv: 'P-256',
          d: privateKeyBase64,
          ext: true
        };
        
        // Import the private key
        return await crypto.subtle.importKey(
          'jwk',
          jwk,
          {
            name: 'ECDH',
            namedCurve: 'P-256'
          },
          true,
          ['deriveKey', 'deriveBits']
        );
      } catch (error) {
        console.error('Error importing private key:', error);
        throw new Error('Failed to import private key');
      }
    },
    
    /**
     * Import an ECC public key from bytes
     * @param publicKeyBytes Public key bytes
     * @returns CryptoKey
     */
    importPublicKey: async (publicKeyBytes: Uint8Array): Promise<CryptoKey> => {
      try {
        // Import the public key from raw format
        return await crypto.subtle.importKey(
          'raw',
          publicKeyBytes,
          {
            name: 'ECDH',
            namedCurve: 'P-256'
          },
          true,
          []
        );
      } catch (error) {
        console.error('Error importing public key:', error);
        throw new Error('Failed to import public key');
      }
    },
    
    /**
     * Helper function to convert base64url to bytes
     * @param base64url Base64URL encoded string
     * @returns Uint8Array of bytes
     */
    base64UrlToBytes: (base64url: string): Uint8Array => {
      // Convert base64url to base64
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      
      // Add padding if needed
      const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4 || 4)) % 4, '=');
      
      // Decode base64 to binary string
      const binaryString = atob(paddedBase64);
      
      // Convert binary string to Uint8Array
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes;
    },
    
    /**
     * Helper function to convert bytes to base64url
     * @param bytes Uint8Array of bytes
     * @returns Base64URL encoded string
     */
    bytesToBase64Url: (bytes: Uint8Array): string => {
      // Convert Uint8Array to binary string
      let binaryString = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }
      
      // Encode binary string to base64
      const base64 = btoa(binaryString);
      
      // Convert base64 to base64url
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
  };