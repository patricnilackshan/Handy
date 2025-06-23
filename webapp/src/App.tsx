import { io } from "socket.io-client";
import { auth } from "@config/firebase";
import apiService from "@utils/apiService";
import { createAppRouter } from "@routes/index";
import { RouterProvider } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { setUser, logout } from "@store/userSlice";
import { fetchOffers } from "@store/offersSlice";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { useState, useMemo, useCallback, useEffect } from "react";
import { fetchServiceRequestsBasedOnService } from "@store/serviceRequestsSlice";
import { ThemeProvider, createTheme, CssBaseline, Snackbar, Alert, CircularProgress } from "@mui/material";
import { fetchProviderOffers } from "./store/providerOffersSlice";
import { getEnvVar, getDeploymentEnvironment } from "@utils/envConfig";

/**
 * Theme and WebSocket constants
 */
const THEME_KEY = "handy_theme_mode";
// Debug environment configuration
const deploymentEnv = getDeploymentEnvironment();
console.log(`🔧 Environment configuration loaded from: ${deploymentEnv}`);

const SOCKET_IO_BASE_URL = getEnvVar("VITE_SOCKET_IO_BASE_URL");
const SOCKET_IO_PATH = getEnvVar("VITE_SOCKET_IO_PATH");

console.log(`🌐 Socket.IO URL: ${SOCKET_IO_BASE_URL}`);
console.log(`📡 Socket.IO Path: ${SOCKET_IO_PATH}`);
const socket = io(SOCKET_IO_BASE_URL, {
  autoConnect: false,
  path: SOCKET_IO_PATH,
});

/**
 * Get theme mode from localStorage or system preference
 */
const getStoredTheme = (): "light" | "dark" | null => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  }
  return null;
};

const getSystemTheme = (): "light" | "dark" =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/**
 * Main App Component
 * Handles theme, authentication, WebSocket events, and global notifications.
 */
const App = () => {
  // State
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => getStoredTheme() || getSystemTheme());
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    severity: "info" as "info" | "success" | "warning" | "error",
  });

  // Redux
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user);
  const serviceRequests = useAppSelector((state) => state.serviceRequests) as any;

  // Toast helper
  const showToast = useCallback((msg: string, severity: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ open: true, msg, severity });
  }, []);

  // Theme toggle handler
  const handleToggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // MUI Theme
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          ...(themeMode === "dark"
            ? {
                primary: { main: "#1976d2" },
                secondary: { main: "#90caf9" },
                background: { default: "#23272f", paper: "#2c313a" },
                text: { primary: "#f3f6fa", secondary: "#b0b8c1" },
              }
            : {
                primary: { main: "#1565c0" },
                secondary: { main: "#1565c0" },
                background: { default: "#f4f6fa", paper: "#fff" },
                text: { primary: "#23272f", secondary: "#5c6b7a" },
              }),
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily: "Inter, Roboto, Arial, sans-serif",
          fontWeightBold: 700,
          h6: { fontWeight: 700 },
          button: { textTransform: "none", fontWeight: 600 },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                fontWeight: 600,
                boxShadow: "none",
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 12,
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                borderRadius: 0,
              },
            },
          },
        },
      }),
    [themeMode]
  );

  // Router
  const router = useMemo(
    () => createAppRouter({ themeMode, onToggleTheme: handleToggleTheme }),
    [themeMode, handleToggleTheme]
  );

  // Authentication state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const isInRegistration = window.location.pathname.includes("/register");

          try {
            const token = await firebaseUser.getIdToken();
            const userInfoResponse = await apiService.get(`/users/user_info/${firebaseUser.uid}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const userData = userInfoResponse.data;
            dispatch(
              setUser({
                uid: firebaseUser.uid,
                name: userData.name || firebaseUser.displayName || firebaseUser.email || "",
                avatarUrl: userData.avatar || firebaseUser.photoURL || "",
                userType: userData.user_type || "",
                platform_tokens: userData.platform_tokens,
                location: userData.location || "",
                services_array: userData.services_array || [],
              })
            );
          } catch (userFetchError: any) {
            // If user doesn't exist in backend but we're not in registration, sign out
            if (!isInRegistration && userFetchError.response?.status === 404) {
              await auth.signOut();
              dispatch(logout());
              showToast("Account not found. Please register first.", "warning");
            } else if (!isInRegistration) {
              // Other errors during non-registration
              await auth.signOut();
              dispatch(logout());
              showToast("Session expired. Please sign in again.", "warning");
            }
          }
        } else {
          dispatch(logout());
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        dispatch(logout());
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [dispatch, showToast]);

  // Listen for system theme changes if no theme is stored
  useEffect(() => {
    if (!getStoredTheme()) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = (e: MediaQueryListEvent) => {
        setThemeMode(e.matches ? "dark" : "light");
      };
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, []);

  // Persist theme mode in localStorage
  useEffect(() => {
    localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  // WebSocket event handling for providers and consumers
  useEffect(() => {
    if (user?.isAuthenticated && user?.uid) {
      socket.connect();
      socket.on("connect", () => {
        // Connected to WebSocket server
      });
      if (user.userType === "provider") {
        const providerServices = user.services_array;
        if (Array.isArray(providerServices)) {
          providerServices.forEach((service: string) => {
            socket.off(`new_request_${service}`);
            socket.on(`new_request_${service}`, (data) => {
              showToast(`New request: ${data.title} (Budget: LKR ${data.budget})`, "info");
              if (user?.uid) {
                dispatch(fetchServiceRequestsBasedOnService(user.uid));
              }
            });
          });
        }
        const offerRejectionTopic = `offer_declined_${user.uid}`;

        socket.off(offerRejectionTopic);
        socket.on(offerRejectionTopic, (rejectionData) => {
          showToast(rejectionData.message);
          if (user?.uid) {
            dispatch(fetchServiceRequestsBasedOnService(user.uid));
            dispatch(fetchProviderOffers(user.uid));
            dispatch(
              setUser({
                uid: user.uid!,
                name: user.name,
                avatarUrl: user.avatarUrl,
                userType: user.userType,
                location: user.location,
                services_array: user.services_array,
                platform_tokens: rejectionData.platform_tokens || user.platform_tokens,
              })
            );
          }
        });

        const pairedJobsTopic = `paired_jobs_${user.uid}`;
        socket.off(pairedJobsTopic);
        socket.on(pairedJobsTopic, (jobData) => {
          // console.log("Accepted Offer job notification:", jobData);
          showToast(jobData.message, "success");
          if (user?.uid) {
            dispatch(fetchServiceRequestsBasedOnService(user.uid));
            dispatch(fetchProviderOffers(user.uid));
          }
        });
        return () => {
          if (Array.isArray(providerServices)) {
            providerServices.forEach((service: string) => {
              socket.off(`new_request_${service}`);
            });
          }
          socket.off(pairedJobsTopic);
          socket.off(offerRejectionTopic);
          socket.disconnect();
        };
      }
      if (user.userType === "consumer") {
        const offerTopic = `new_offer_${user.uid}`;
        const deleteOfferTopic = `delete_offer_${user.uid}`;
        const updateOfferTopic = `update_offer_${user.uid}`;
        socket.off(offerTopic);
        socket.off(deleteOfferTopic);
        socket.off(updateOfferTopic);
        socket.on(offerTopic, (offerData) => {
          showToast(
            `New offer: LKR ${offerData.budget} for "${offerData.request_title}" from ${offerData.provider_name}`,
            "success"
          );
          const { selectedRequestId } = serviceRequests;
          if (selectedRequestId && selectedRequestId.toString() === offerData.request_id.toString()) {
            dispatch(fetchOffers(selectedRequestId.toString()));
          }
        });
        socket.on(deleteOfferTopic, (offerData) => {
          showToast(`Offer deleted for "${offerData.request_title}" from ${offerData.provider_name}`, "warning");
          const { selectedRequestId } = serviceRequests;
          if (selectedRequestId && selectedRequestId.toString() === offerData.request_id.toString()) {
            dispatch(fetchOffers(selectedRequestId.toString()));
          }
        });
        socket.on(updateOfferTopic, (offerData) => {
          // console.log("Received updated offer notification:", offerData);
          showToast(
            `Offer budget updated: from LKR ${offerData.old_budget} to LKR ${offerData.new_budget} for "${offerData.request_title}" from ${offerData.provider_name}`,
            "info"
          );
          // Refresh offers for the specific request if it's currently selected
          const { selectedRequestId } = serviceRequests;
          if (selectedRequestId && selectedRequestId.toString() === offerData.request_id.toString()) {
            // console.log("Refreshing offers for selected request after update:", selectedRequestId);
            dispatch(fetchOffers(selectedRequestId.toString()));
          }
        });
        return () => {
          socket.off(offerTopic);
          socket.off(deleteOfferTopic);
          socket.off(updateOfferTopic);
          socket.disconnect();
        };
      }
      return () => {
        socket.disconnect();
      };
    }
    return () => {
      socket.disconnect();
    };
  }, [
    user?.userType,
    user?.services_array,
    user?.uid,
    user?.isAuthenticated,
    dispatch,
    showToast,
    serviceRequests?.selectedRequestId,
  ]);

  // Loading screen
  if (authLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            background: theme.palette.background.default,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "1rem", color: theme.palette.text.secondary, marginBottom: 12 }}>Loading...</h2>
            <CircularProgress size={36} thickness={4} />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Main app
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
      <Snackbar
        open={toast.open}
        autoHideDuration={8000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default App;
