/**
 * Firebase configuration and initialization.
 * Exports initialized Firebase app and core services for use throughout the application.
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getEnvVar } from "@utils/envConfig";

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: getEnvVar("VITE_FIREBASE_API_KEY"),
  appId: getEnvVar("VITE_FIREBASE_APP_ID"),
  authDomain: getEnvVar("VITE_FIREBASE_AUTH_DOMAIN"),
  messagingSenderId: getEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  projectId: getEnvVar("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnvVar("VITE_FIREBASE_STORAGE_BUCKET"),
  databaseURL: getEnvVar("VITE_FIREBASE_DATABASE_URL"),
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const storage = getStorage(app);
const database = getDatabase(app);
const firestore = getFirestore(app);

export { app, auth, firestore, storage, database };
