/**
 * Cryptography Service
 *
 * Handles all encryption/decryption for API communication using Web Crypto API.
 * Implements hybrid RSA + AES-256-GCM encryption:
 * - RSA-2048 for secure key exchange
 * - AES-256-GCM for fast payload encryption with authentication
 * - Nonce-based replay protection
 * - Request signing with HMAC-SHA256
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface EncryptedPayload {
  encryptedKey: string;      // RSA-encrypted AES key (base64)
  encryptedData: string;      // AES-encrypted payload (base64)
  iv: string;                 // Initialization vector (base64)
  authTag: string;            // GCM authentication tag (base64)
  nonce: string;              // Unique request nonce (UUID)
  timestamp: number;          // Unix timestamp
  signature: string;          // HMAC-SHA256 signature (base64)
  keyVersion: string;         // RSA key version for rotation support
}

export interface DecryptedResponse {
  data: any;
  timestamp: number;
}

class CryptoService {
  private rsaPublicKey: CryptoKey | null = null;
  private keyVersion: string = 'v1';
  private initialized: boolean = false;

  /**
   * Initialize the crypto service by fetching the public key from backend
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.rsaPublicKey) {
      return; // Already initialized
    }

    try {
      console.log('[CryptoService] Fetching RSA public key from backend...');

      const response = await fetch(`${API_URL}/crypto/public-key`);
      if (!response.ok) {
        throw new Error(`Failed to fetch public key: ${response.statusText}`);
      }

      const data = await response.json();
      const publicKeyPem = data.public_key;
      this.keyVersion = data.version || 'v1';

      // Import RSA public key
      this.rsaPublicKey = await this.importRSAPublicKey(publicKeyPem);

      this.initialized = true;
      console.log('[CryptoService] ✅ Initialized with key version:', this.keyVersion);
    } catch (error) {
      console.error('[CryptoService] Initialization failed:', error);
      throw new Error('Failed to initialize encryption service');
    }
  }

  /**
   * Import RSA public key from PEM format
   */
  private async importRSAPublicKey(pemKey: string): Promise<CryptoKey> {
    // Remove PEM headers and decode base64
    const pemContents = pemKey
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');

    const binaryKey = this.base64ToArrayBuffer(pemContents);

    return await window.crypto.subtle.importKey(
      'spki',
      binaryKey,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );
  }

  /**
   * Generate a random AES-256 key
   */
  private async generateAESKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,  // extractable (need to encrypt with RSA)
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate cryptographically secure random IV (12 bytes for GCM)
   */
  private generateIV(): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(12));
  }

  /**
   * Generate unique nonce (UUID v4)
   */
  generateNonce(): string {
    return window.crypto.randomUUID();
  }

  /**
   * Encrypt payload with AES-256-GCM
   */
  private async encryptWithAES(
    data: any,
    aesKey: CryptoKey,
    iv: Uint8Array
  ): Promise<{ ciphertext: ArrayBuffer; authTag: ArrayBuffer }> {
    const plaintext = JSON.stringify(data);
    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext);

    // AES-GCM encryption includes authentication tag
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128  // 128-bit authentication tag
      },
      aesKey,
      plaintextBuffer
    );

    // GCM outputs ciphertext with auth tag appended (last 16 bytes)
    const ciphertextOnly = ciphertext.slice(0, -16);
    const authTag = ciphertext.slice(-16);

    return { ciphertext: ciphertextOnly, authTag };
  }

  /**
   * Decrypt payload with AES-256-GCM
   */
  private async decryptWithAES(
    encryptedData: ArrayBuffer,
    authTag: ArrayBuffer,
    aesKey: CryptoKey,
    iv: Uint8Array
  ): Promise<any> {
    // Combine ciphertext and auth tag for GCM
    const combined = new Uint8Array(encryptedData.byteLength + authTag.byteLength);
    combined.set(new Uint8Array(encryptedData), 0);
    combined.set(new Uint8Array(authTag), encryptedData.byteLength);

    const plaintext = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      aesKey,
      combined
    );

    const decoder = new TextDecoder();
    const plaintextString = decoder.decode(plaintext);
    return JSON.parse(plaintextString);
  }

  /**
   * Encrypt AES key with RSA public key
   */
  private async encryptAESKey(aesKey: CryptoKey): Promise<ArrayBuffer> {
    if (!this.rsaPublicKey) {
      throw new Error('RSA public key not initialized');
    }

    // Export AES key as raw bytes
    const aesKeyBytes = await window.crypto.subtle.exportKey('raw', aesKey);

    // Encrypt with RSA-OAEP
    return await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      this.rsaPublicKey,
      aesKeyBytes
    );
  }

  /**
   * Sign request for integrity verification (HMAC-SHA256)
   */
  private async signRequest(
    method: string,
    url: string,
    timestamp: number,
    nonce: string,
    encryptedData: string
  ): Promise<string> {
    // Create signing key from nonce (temporary key for this request)
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(nonce),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign: method + url + timestamp + nonce + encrypted data
    const message = `${method}|${url}|${timestamp}|${nonce}|${encryptedData}`;
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      keyMaterial,
      encoder.encode(message)
    );

    return this.arrayBufferToBase64(signature);
  }

  /**
   * Encrypt a request payload
   */
  async encryptPayload(data: any): Promise<EncryptedPayload> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // 1. Generate random AES key for this request
      const aesKey = await this.generateAESKey();

      // 2. Generate random IV
      const iv = this.generateIV();

      // 3. Generate nonce and timestamp
      const nonce = this.generateNonce();
      const timestamp = Math.floor(Date.now() / 1000);

      // 4. Add replay protection data to payload
      const payloadWithMeta = {
        ...data,
        _meta: { timestamp, nonce }
      };

      // 5. Encrypt payload with AES
      const { ciphertext, authTag } = await this.encryptWithAES(
        payloadWithMeta,
        aesKey,
        iv
      );

      // 6. Encrypt AES key with RSA
      const encryptedKey = await this.encryptAESKey(aesKey);

      // 7. Convert to base64 for transport
      const encryptedDataBase64 = this.arrayBufferToBase64(ciphertext);
      const encryptedKeyBase64 = this.arrayBufferToBase64(encryptedKey);
      const ivBase64 = this.arrayBufferToBase64(iv);
      const authTagBase64 = this.arrayBufferToBase64(authTag);

      // 8. Sign the request
      const signature = await this.signRequest(
        'POST',
        '/api/encrypted',
        timestamp,
        nonce,
        encryptedDataBase64
      );

      return {
        encryptedKey: encryptedKeyBase64,
        encryptedData: encryptedDataBase64,
        iv: ivBase64,
        authTag: authTagBase64,
        nonce,
        timestamp,
        signature,
        keyVersion: this.keyVersion
      };
    } catch (error) {
      console.error('[CryptoService] Encryption failed:', error);
      throw new Error('Request encryption failed');
    }
  }

  /**
   * Decrypt a response payload
   */
  async decryptResponse(encrypted: EncryptedPayload): Promise<any> {
    try {
      // 1. Convert from base64
      const encryptedData = this.base64ToArrayBuffer(encrypted.encryptedData);
      const encryptedKey = this.base64ToArrayBuffer(encrypted.encryptedKey);
      const iv = new Uint8Array(this.base64ToArrayBuffer(encrypted.iv));
      const authTag = this.base64ToArrayBuffer(encrypted.authTag);

      // 2. For response decryption, we need to receive the AES key
      // In a real implementation, the server would encrypt with a session key
      // For now, this is a placeholder showing the structure
      console.warn('[CryptoService] Response decryption needs session key exchange');

      // TODO: Implement proper session key management
      throw new Error('Response decryption not yet fully implemented');
    } catch (error) {
      console.error('[CryptoService] Decryption failed:', error);
      throw new Error('Response decryption failed');
    }
  }

  /**
   * Utility: Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Check if crypto service is ready
   */
  isReady(): boolean {
    return this.initialized && this.rsaPublicKey !== null;
  }

  /**
   * Get current key version
   */
  getKeyVersion(): string {
    return this.keyVersion;
  }
}

// Export singleton instance
export const cryptoService = new CryptoService();

// Export class for testing
export default CryptoService;
