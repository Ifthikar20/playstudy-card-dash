/**
 * reCAPTCHA v3 Service
 *
 * Handles reCAPTCHA v3 token generation for bot protection.
 * Note: Site key should be configured in environment variables.
 */

// Get site key from environment variables
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

// Track if reCAPTCHA is ready
let recaptchaReady = false;
let readyPromise: Promise<void> | null = null;

/**
 * Wait for reCAPTCHA to be ready
 */
function waitForRecaptcha(): Promise<void> {
  if (recaptchaReady) {
    return Promise.resolve();
  }

  if (readyPromise) {
    return readyPromise;
  }

  readyPromise = new Promise((resolve) => {
    const checkRecaptcha = () => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        window.grecaptcha.ready(() => {
          recaptchaReady = true;
          resolve();
        });
      } else {
        setTimeout(checkRecaptcha, 100);
      }
    };
    checkRecaptcha();
  });

  return readyPromise;
}

/**
 * Generate reCAPTCHA v3 token for a specific action
 *
 * @param action - The action name (e.g., 'login', 'register')
 * @returns Promise resolving to the reCAPTCHA token, or null if disabled/failed
 */
export async function generateRecaptchaToken(action: string): Promise<string | null> {
  // Skip if reCAPTCHA is not configured
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('[reCAPTCHA] Site key not configured, skipping verification');
    return null;
  }

  try {
    // Wait for reCAPTCHA to be ready
    await waitForRecaptcha();

    // Generate token
    const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    console.log(`[reCAPTCHA] Generated token for action: ${action}`);
    return token;
  } catch (error) {
    console.error('[reCAPTCHA] Failed to generate token:', error);
    // Return null to allow operation to proceed (backend will handle gracefully)
    return null;
  }
}

/**
 * Initialize reCAPTCHA on page load
 */
export function initRecaptcha(): void {
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('[reCAPTCHA] Site key not configured');
    return;
  }

  waitForRecaptcha().then(() => {
    console.log('[reCAPTCHA] Initialized successfully');
  });
}

// Type augmentation for grecaptcha global
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}
