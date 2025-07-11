import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Paper, Typography, Button, TextField, Chip, useTheme, alpha, Stack } from "@mui/material";
import { useAppSelector, useAppDispatch } from "@store/hooks";
import apiService from "@utils/apiService";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { setUser } from "@store/userSlice";

const CreateOffer: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { requestId } = useParams<{ requestId: string }>();
  const [budget, setBudget] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestDetails, setRequestDetails] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const user = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();

  // Enhanced chip styling for better dark theme visibility
  const getChipStyles = (color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info', variant: 'filled' | 'outlined' = 'filled') => {
    const themeColor = theme.palette[color];
    
    return {
      fontWeight: 'medium',
      borderWidth: variant === 'outlined' ? 2 : 0,
      backgroundColor: variant === 'filled' ? undefined : alpha(themeColor.main, 0.1),
      borderColor: variant === 'outlined' ? themeColor.main : undefined,
      color: variant === 'outlined' ? themeColor.main : themeColor.contrastText,
      '&:hover': {
        backgroundColor: alpha(themeColor.main, variant === 'outlined' ? 0.2 : 0.8)
      }
    };
  };

  // Fetch request details when component mounts
  useEffect(() => {
    if (requestId) {
      fetchRequestDetails();
    }
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      setLoadingRequest(true);
      const response = await apiService.get(`/requests/getRequest/${requestId}`);
      setRequestDetails(response.data);
    } catch (error) {
      console.error("Error fetching request details:", error);
      setError("Failed to load request details");
    } finally {
      setLoadingRequest(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!requestId) {
      setError("Request ID is required");
      setLoading(false);
      return;
    }

    if (!budget || budget <= 0) {
      setError("Please enter a valid budget amount");
      setLoading(false);
      return;
    }

    if (!timeframe.trim()) {
      setError("Please enter a timeframe");
      setLoading(false);
      return;
    }

    // Only send the required attributes
    const data = {
      request_id: parseInt(requestId),
      provider_id: user.uid,
      budget: budget,
      timeframe: timeframe.trim(),
    };
    
    try {
      const response = await apiService.post("/offers/createOffers", data);

      // Update the user's platform tokens in Redux store
      if (response.data.platform_tokens !== undefined) {
        dispatch(
          setUser({
            uid: user.uid!,
            name: user.name,
            avatarUrl: user.avatarUrl,
            userType: user.userType,
            location: user.location,
            services_array: user.services_array,
            platform_tokens: response.data.platform_tokens, // Updated token count
          })
        );
      }

      navigate("/dashboard");
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Failed to create offer";
      setError(errorMessage);
      console.error("Error creating offer:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loadingRequest) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="70vh">
        <Typography>Loading request details...</Typography>
      </Box>
    );
  }

  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      alignItems="center" 
      minHeight="70vh" 
      p={2}
      sx={{
        backgroundColor: theme.palette.background.default,
        marginTop: "80px", // Add space from navbar
      }}
    >
      <Paper 
        sx={{ 
          p: 4, 
          minWidth: 400, 
          maxWidth: 600, 
          width: "100%",
          backgroundColor: theme.palette.background.paper,
          boxShadow: theme.shadows[8],
        }}
      >
        {/* Header with back button */}
        <Box display="flex" alignItems="center" mb={3}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/dashboard")}
            sx={{ 
              mr: 2,
              "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
              },
            }}
          >
            Back
          </Button>
          <LocalOfferIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h5" fontWeight={600}>
            Create Offer
          </Typography>
        </Box>

        {/* Request Details Section */}
        {requestDetails && (
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              mb: 3,
              borderRadius: 2, 
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
            }}
          >
            <Typography variant="h6" gutterBottom color="primary" fontWeight="bold">
              Request Details
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
              {requestDetails.title}
            </Typography>
            <Typography variant="body1" color="text.primary" gutterBottom lineHeight={1.6}>
              {requestDetails.description}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mt={2}>
              {requestDetails.budget && (
                <Chip 
                  label={`Customer Budget: LKR ${requestDetails.budget}`} 
                  size="small" 
                  color="success" 
                  variant="outlined" 
                  sx={getChipStyles('success', 'outlined')}
                />
              )}
              {requestDetails.timeframe && (
                <Chip 
                  label={`Requested Timeframe: ${requestDetails.timeframe}`} 
                  size="small" 
                  color="info" 
                  variant="outlined" 
                  sx={getChipStyles('info', 'outlined')}
                />
              )}
              {requestDetails.location && (
                <Chip 
                  label={`Location: ${requestDetails.location}`} 
                  size="small" 
                  color="warning"
                  variant="outlined" 
                  sx={getChipStyles('warning', 'outlined')}
                />
              )}
            </Stack>
          </Paper>
        )}

        {/* Simplified Offer Form */}
        <form onSubmit={handleSubmit}>
          <TextField
            label="Your Quote ($)"
            type="number"
            value={budget || ""}
            onChange={(e) => setBudget(Number(e.target.value))}
            fullWidth
            required
            margin="normal"
            placeholder="Enter your price for this job"
            helperText={requestDetails?.budget ? 
              `Customer's budget is LKR ${requestDetails.budget}. Provide a competitive quote.` : 
              "Provide a competitive quote for the requested service"
            }
            inputProps={{ min: 1, step: 0.01 }}
            sx={{
              "& .MuiOutlinedInput-root": {
                "&:hover fieldset": {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
              },
            }}
          />

          <TextField
            label="Estimated Timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            fullWidth
            required
            margin="normal"
            placeholder="e.g., 2-3 days, 1 week, Same day"
            helperText={requestDetails?.timeframe ? 
              `Customer requested: ${requestDetails.timeframe}. When can you complete this job?` : 
              "When can you complete this job?"
            }
            sx={{
              "& .MuiOutlinedInput-root": {
                "&:hover fieldset": {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
              },
            }}
          />

          {error && (
            <Box 
              mt={2} 
              p={1.5} 
              sx={{ 
                backgroundColor: alpha(theme.palette.error.main, 0.1),
                borderRadius: 1,
                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
              }}
            >
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            </Box>
          )}

          <Box mt={3} display="flex" gap={2} justifyContent="flex-end">
            <Button 
              variant="outlined" 
              onClick={() => navigate("/dashboard")}
              disabled={loading}
              sx={{
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                },
              }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              disabled={loading}
              sx={{ 
                minWidth: 120,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.8),
                },
              }}
            >
              {loading ? "Creating..." : "Submit Offer"}
            </Button>
          </Box>
        </form>

        {/* Help Text */}
        <Box 
          mt={3} 
          p={2} 
          sx={{ 
            backgroundColor: alpha(theme.palette.info.main, 0.1),
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          }}
        >
          <Typography variant="body2">
            <strong>Tips for a great offer:</strong>
            <br />
            • Be competitive with your pricing
            <br />
            • Provide a realistic timeframe
            <br />
            • Consider the customer's budget and timeline
            <br />
            • You can discuss details through chat after offer submission
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateOffer;