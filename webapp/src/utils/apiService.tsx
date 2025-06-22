/**
 * Axios API service instance with authentication and global error handling.
 * Automatically attaches Firebase auth token to requests and handles network/auth errors.
 */
import axios from "axios";
import { auth } from "@config/firebase";
import { getEnvVar } from "@utils/envConfig";

const API_BASE_URL = getEnvVar("VITE_API_BASE_URL");

const apiService = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 second timeout
});

// Attach auth token to all requests
apiService.interceptors.request.use(
  async (config) => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken(false);
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error("Failed to get auth token:", error);
      }
    } else {
      // console.log("No current user for request:", config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Global response error handling
apiService.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === "ERR_NETWORK") {
      console.error("Network error - backend server may be down");
      throw new Error("Backend server is not available. Please try again later.");
    }

    if (error.response?.status === 401) {
      console.warn("Authentication error detected");

      // Don't sign out during registration processes
      const isRegistrationRequest =
        error.config?.url?.includes("/register") ||
        error.config?.url?.includes("/registerProvider") ||
        error.config?.url?.includes("/registerConsumer");

      if (!isRegistrationRequest) {
        console.log("Signing out due to auth error");
        await auth.signOut();
      } else {
        console.log("Auth error during registration - not signing out");
      }
    }
    return Promise.reject(error);
  }
);

export default apiService;
