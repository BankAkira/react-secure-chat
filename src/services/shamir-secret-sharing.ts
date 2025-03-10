/**
 * Implementation of Shamir's Secret Sharing for secure private key management
 * Fixed version for TypeScript
 */

// ตรวจสอบการรองรับ BigInt
if (typeof BigInt === 'undefined') {
    throw new Error('Your browser does not support BigInt. Please use a modern browser.');
  }
  
  export interface Secretshare {
    x: number;  // Share index
    y: string;  // Share value (as string to handle large integers)
  }
  
  export const ShamirSecretSharing = {
    // Prime field for finite field arithmetic (large prime used by secp256k1)
    PRIME: BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639747'),
    
    /**
     * Split a secret into n shares with threshold t
     */
    splitSecret: (secretBytes: Uint8Array, numShares: number, threshold: number): Secretshare[] => {
      if (threshold > numShares) {
        throw new Error('Threshold cannot be greater than the number of shares');
      }
      
      // Convert secret bytes to bigint
      const secret = ShamirSecretSharing._bytesToBigint(secretBytes);
      
      // Generate random polynomial
      const polynomial = ShamirSecretSharing._generatePolynomial(secret, threshold);
      
      // Generate shares
      const shares: Secretshare[] = [];
      for (let i = 1; i <= numShares; i++) {
        const x = i;
        const y = ShamirSecretSharing._evaluatePolynomial(polynomial, x);
        shares.push({ x, y: y.toString() });
      }
      
      return shares;
    },
    
    /**
     * Reconstruct secret from t shares
     */
    reconstructSecret: (shares: Secretshare[], secretLength: number): Uint8Array => {
      if (shares.length < 2) {
        throw new Error('Need at least 2 shares to reconstruct secret');
      }
      
      const prime = ShamirSecretSharing.PRIME;
      const xs: number[] = shares.map(share => share.x);
      const ys: bigint[] = shares.map(share => BigInt(share.y));
      
      // Interpolate at x=0 to get the secret (constant term)
      let secret = BigInt(0);
      
      for (let j = 0; j < shares.length; j++) {
        const basis = ShamirSecretSharing._lagrangeBasis(0, xs, j);
        const term = (ys[j] * basis) % prime;
        secret = (secret + term) % prime;
        
        // Ensure secret is positive
        if (secret < BigInt(0)) {
          secret = secret + prime;
        }
      }
      
      // Convert bigint to byte array
      return ShamirSecretSharing._bigintToBytes(secret, secretLength);
    },
    
    /**
     * Generate random polynomial of degree (threshold-1)
     */
    _generatePolynomial: (secret: bigint, threshold: number): bigint[] => {
      const polynomial: bigint[] = [secret]; // Constant term is the secret
      
      // Generate random coefficients for the polynomial
      for (let i = 1; i < threshold; i++) {
        // Generate 32 random bytes
        const randBytes = new Uint8Array(32);
        crypto.getRandomValues(randBytes);
        
        // Convert to bigint and mod with prime
        const randomCoeff = ShamirSecretSharing._bytesToBigint(randBytes) % ShamirSecretSharing.PRIME;
        polynomial.push(randomCoeff);
      }
      
      return polynomial;
    },
    
    /**
     * Evaluate polynomial at point x using Horner's method
     */
    _evaluatePolynomial: (polynomial: bigint[], x: number): bigint => {
      let result = BigInt(0);
      const prime = ShamirSecretSharing.PRIME;
      const bigX = BigInt(x);
      
      // Evaluate using Horner's method
      for (let i = polynomial.length - 1; i >= 0; i--) {
        result = (result * bigX + polynomial[i]) % prime;
      }
      
      return result;
    },
    
    /**
     * Calculate Lagrange basis polynomial for interpolation
     */
    _lagrangeBasis: (x: number, xs: number[], j: number): bigint => {
      let basis = BigInt(1);
      const prime = ShamirSecretSharing.PRIME;
      const bigX = BigInt(x);
      
      for (let m = 0; m < xs.length; m++) {
        if (m !== j) {
          const bigXm = BigInt(xs[m]);
          const bigXj = BigInt(xs[j]);
          
          // Calculate numerator: (x - xs[m])
          let numerator = (bigX - bigXm) % prime;
          // Ensure numerator is positive
          if (numerator < BigInt(0)) {
            numerator = numerator + prime;
          }
          
          // Calculate denominator: (xs[j] - xs[m])
          let denominator = (bigXj - bigXm) % prime;
          // Ensure denominator is positive
          if (denominator < BigInt(0)) {
            denominator = denominator + prime;
          }
          
          // Calculate modular inverse of denominator
          const inverse = ShamirSecretSharing._modInverse(denominator, prime);
          
          // Multiply basis by (numerator * inverse) % prime
          basis = (basis * ((numerator * inverse) % prime)) % prime;
        }
      }
      
      // Ensure basis is positive
      if (basis < BigInt(0)) {
        basis = basis + prime;
      }
      
      return basis;
    },
    
    /**
     * Calculate modular inverse using Extended Euclidean Algorithm
     */
    _modInverse: (a: bigint, m: bigint): bigint => {
      if (m === BigInt(1)) return BigInt(0);
      
      let m0 = m;
      let x0 = BigInt(0);
      let x1 = BigInt(1);
      
      while (a > BigInt(1)) {
        // q is quotient
        const q = a / m;
        let t = m;
        
        // m is remainder now, process same as Euclid's algo
        m = a % m;
        a = t;
        t = x0;
        
        // Update x0 and x1
        x0 = x1 - q * x0;
        x1 = t;
      }
      
      // Make x1 positive
      if (x1 < BigInt(0)) {
        x1 = x1 + m0;
      }
      
      return x1;
    },
    
    /**
     * Convert bytes to bigint
     */
    _bytesToBigint: (bytes: Uint8Array): bigint => {
      let hex = '0x';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      return BigInt(hex);
    },
    
    /**
     * Convert bigint to bytes
     */
    _bigintToBytes: (value: bigint, length: number): Uint8Array => {
      const bytes = new Uint8Array(length);
      let tempValue = value; // Use temporary value for shifting
      
      for (let i = length - 1; i >= 0; i--) {
        // Extract lowest byte
        const byteValue = tempValue & BigInt(0xff);
        // Convert to number (safe because it's only 0-255)
        bytes[i] = Number(byteValue);
        // Shift right 8 bits
        tempValue = tempValue >> BigInt(8);
      }
      
      return bytes;
    }
  };