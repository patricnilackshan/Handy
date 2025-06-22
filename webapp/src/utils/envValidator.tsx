/**
 * Environment Configuration Validation Script
 * This script validates that environment variables are properly configured
 * for both Vercel and Choreo deployments.
 */

import { getEnvVar, isChoreoDeployment, isVercelDeployment } from "./envConfig";

// Type definition for the configuration (matching envConfig.ts)
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

// Required environment variables
const REQUIRED_VARS: (keyof Config)[] = [
  "VITE_API_BASE_URL",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_SOCKET_IO_BASE_URL",
  "VITE_STRIPE_PUBLISHABLE_KEY",
  "VITE_CLOUDINARY_CLOUD_NAME",
  "VITE_CLOUDINARY_UPLOAD_PRESET",
];

// Optional environment variables
const OPTIONAL_VARS: (keyof Config)[] = ["VITE_FIREBASE_VAPID_KEY", "VITE_SOCKET_IO_PATH"];

/**
 * Validate environment configuration
 */
export const validateEnvironment = (): boolean => {
  console.log("🔍 Validating Environment Configuration...\n");

  // Detect deployment platform
  const platform = isChoreoDeployment() ? "Choreo" : isVercelDeployment() ? "Vercel" : "Local Development";

  console.log(`📱 Platform: ${platform}`);
  console.log(`🔧 Config Source: ${isChoreoDeployment() ? "window.config" : "import.meta.env"}\n`);

  // Check required variables
  const missingRequired: string[] = [];
  const foundRequired: string[] = [];

  REQUIRED_VARS.forEach((varName) => {
    const value = getEnvVar(varName);
    if (value && value.trim() !== "") {
      foundRequired.push(varName);
    } else {
      missingRequired.push(varName);
    }
  });

  // Check optional variables
  const foundOptional: string[] = [];
  const missingOptional: string[] = [];

  OPTIONAL_VARS.forEach((varName) => {
    const value = getEnvVar(varName);
    if (value && value.trim() !== "") {
      foundOptional.push(varName);
    } else {
      missingOptional.push(varName);
    }
  });

  // Report results
  console.log("✅ Found Required Variables:");
  foundRequired.forEach((varName) => {
    const value = getEnvVar(varName as keyof Config);
    const maskedValue = varName.includes("KEY") || varName.includes("SECRET") ? value.substring(0, 8) + "..." : value;
    console.log(`   ${varName}: ${maskedValue}`);
  });

  if (foundOptional.length > 0) {
    console.log("\n✅ Found Optional Variables:");
    foundOptional.forEach((varName) => {
      const value = getEnvVar(varName as keyof Config);
      const maskedValue = varName.includes("KEY") || varName.includes("SECRET") ? value.substring(0, 8) + "..." : value;
      console.log(`   ${varName}: ${maskedValue}`);
    });
  }

  if (missingRequired.length > 0) {
    console.log("\n❌ Missing Required Variables:");
    missingRequired.forEach((varName) => {
      console.log(`   ${varName}`);
    });
  }

  if (missingOptional.length > 0) {
    console.log("\n⚠️  Missing Optional Variables:");
    missingOptional.forEach((varName) => {
      console.log(`   ${varName}`);
    });
  }

  // Overall status
  const isValid = missingRequired.length === 0;
  console.log(`\n${isValid ? "✅" : "❌"} Environment Status: ${isValid ? "VALID" : "INVALID"}`);

  if (!isValid) {
    console.log("\n🔧 Fix required:");
    if (isChoreoDeployment()) {
      console.log("   - Update public/config.js with missing variables");
    } else {
      console.log("   - Update .env file with missing variables");
      console.log("   - Ensure variables are prefixed with VITE_");
    }
  }

  return isValid;
};

/**
 * Test environment configuration in browser
 */
export const testEnvironmentInBrowser = (): boolean => {
  if (typeof window === "undefined") {
    console.error("This function can only be run in a browser environment");
    return false;
  }

  console.log("🌐 Testing Environment in Browser...\n");

  // Test window.config availability (for Choreo)
  if (window.config) {
    console.log("✅ window.config is available (Choreo deployment)");
    console.log("   Available keys:", Object.keys(window.config));
  } else {
    console.log("❌ window.config is not available");
  }

  // Test import.meta.env availability (for Vercel)
  if (import.meta && import.meta.env) {
    console.log("✅ import.meta.env is available (Vercel/local deployment)");
    const viteVars = Object.keys(import.meta.env).filter((key) => key.startsWith("VITE_"));
    console.log("   Available VITE_ variables:", viteVars.length);
  } else {
    console.log("❌ import.meta.env is not available");
  }

  return validateEnvironment();
};

// Auto-run validation if in browser environment
if (typeof window !== "undefined" && window.console) {
  // Wait for DOM to load before validating
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(testEnvironmentInBrowser, 100);
    });
  } else {
    setTimeout(testEnvironmentInBrowser, 100);
  }
}

export default {
  validateEnvironment,
  testEnvironmentInBrowser,
};
