/**
 * Environment configuration utility that works for both Vercel and Choreo deployments.
 *
 * For Vercel: Uses import.meta.env (loaded from .env file)
 * For Choreo: Uses window.config (loaded from public/config.js)
 */

// Type definition for the configuration
interface Config {
  VITE_API_BASE_URL: string;
  VITE_FIREBASE_API_KEY: string;
  VITE_FIREBASE_APP_ID: string;
  VITE_FIREBASE_AUTH_DOMAIN: string;
  VITE_FIREBASE_DATABASE_URL: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  VITE_FIREBASE_PROJECT_ID: string;
  VITE_FIREBASE_STORAGE_BUCKET: string;
  VITE_FIREBASE_VAPID_KEY: string;
  VITE_SOCKET_IO_BASE_URL: string;
  VITE_SOCKET_IO_PATH: string;
  VITE_STRIPE_PUBLISHABLE_KEY: string;
  VITE_CLOUDINARY_CLOUD_NAME: string;
  VITE_CLOUDINARY_UPLOAD_PRESET: string;
}

// Extend window interface for TypeScript
declare global {
  interface Window {
    config?: Config;
    getConfig?: (key: keyof Config) => string | undefined;
  }
}

/**
 * Get environment variable value that works for both deployment platforms.
 * Priority: window.config (Choreo) > import.meta.env (Vercel/Local)
 */
export const getEnvVar = (key: keyof Config): string => {
  // For Choreo deployment, use window.config if available
  if (typeof window !== "undefined" && window.config && window.config[key]) {
    return window.config[key];
  }

  // For Vercel/local development, use import.meta.env (with safety checks)
  try {
    if (import.meta && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (error) {
    // Silently handle cases where import.meta.env is not available
    console.debug(`import.meta.env not available for ${key}`);
  }

  // Fallback error handling with more context
  console.warn(`Environment variable ${key} not found. Ensure it's set in either:
    - public/config.js (for Choreo deployment)
    - .env file (for Vercel/local development)`);
  return "";
};

/**
 * Get all environment variables as an object
 */
export const getAllEnvVars = (): Partial<Config> => {
  const keys: (keyof Config)[] = [
    "VITE_API_BASE_URL",
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_APP_ID",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_DATABASE_URL",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_VAPID_KEY",
    "VITE_SOCKET_IO_BASE_URL",
    "VITE_SOCKET_IO_PATH",
    "VITE_STRIPE_PUBLISHABLE_KEY",
    "VITE_CLOUDINARY_CLOUD_NAME",
    "VITE_CLOUDINARY_UPLOAD_PRESET",
  ];

  const config: Partial<Config> = {};

  keys.forEach((key) => {
    const value = getEnvVar(key);
    if (value) {
      config[key] = value;
    }
  });

  return config;
};

/**
 * Check if we're running in Choreo environment
 */
export const isChoreoDeployment = (): boolean => {
  return typeof window !== "undefined" && !!window.config;
};

/**
 * Check if we're running in Vercel environment
 */
export const isVercelDeployment = (): boolean => {
  try {
    return (
      !isChoreoDeployment() &&
      import.meta &&
      import.meta.env &&
      Object.keys(import.meta.env).some((key) => key.startsWith("VITE_"))
    );
  } catch (error) {
    return false;
  }
};

/**
 * Get deployment environment name
 */
export const getDeploymentEnvironment = (): "choreo" | "vercel" | "unknown" => {
  if (isChoreoDeployment()) return "choreo";
  if (isVercelDeployment()) return "vercel";
  return "unknown";
};

export default {
  getEnvVar,
  getAllEnvVars,
  isChoreoDeployment,
  isVercelDeployment,
  getDeploymentEnvironment,
};
