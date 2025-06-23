import {
  Box,
  Chip,
  Button,
  Dialog,
  useTheme,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  alpha,
  Stack,
  Paper,
  Avatar,
  Divider,
  Tabs,
  Tab,
  TextField,
  Rating,
  IconButton,
  Alert,
} from "@mui/material";
import apiService from "@utils/apiService";
import type { RootState } from "@store/store";
import { useNavigate } from "react-router-dom";
import { fetchOffers } from "@store/offersSlice";
import { createOrGetChat } from "@utils/chatUtils";
import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
  AddCircleOutline,
  Assignment,
  LocalOffer,
  Chat,
  CheckCircle,
  Work,
  Star,
  RateReview,
  Close,
  Delete,
  Warning,
} from "@mui/icons-material";
import { fetchServiceRequestsForConsumer, setSelectedRequestId } from "@store/serviceRequestsSlice";
import { setUser } from "@store/userSlice";

const ConsumerHome: React.FC = () => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const navigate = useNavigate();
  const serviceRequests = useAppSelector((state: RootState) => state.serviceRequests) as any;
  const offersState = useAppSelector((state: RootState) => state.offers) as any;
  const user = useAppSelector((state: RootState) => state.user);
  const { items: requests = [], status: requestsStatus = "", selectedRequestId = null } = serviceRequests;
  const { items: offers = [], status: offersStatus = "" } = offersState;

  const getInitialTab = (): "requests" | "jobs" => {
    const savedTab = localStorage.getItem("consumerActiveTab");
    return savedTab === "requests" || savedTab === "jobs" ? savedTab : "requests";
  };

  // Tab state
  const [activeTab, setActiveTab] = useState<"requests" | "jobs">(getInitialTab());

  useEffect(() => {
    localStorage.setItem("consumerActiveTab", activeTab);
  }, [activeTab]);

  // State for offer confirmation
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [acceptingOffer, setAcceptingOffer] = useState(false);

  // State for delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<any>(null);
  const [deletingRequest, setDeletingRequest] = useState(false);

  // State for paired jobs
  const [pairedJobs, setPairedJobs] = useState<any[]>([]);
  const [pairedJobsLoading, setPairedJobsLoading] = useState(false);

  // State for rating and review
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // Filter requests by current user (consumer)
  const safeRequests = Array.isArray(requests)
    ? requests
        .filter((req) => req.user_id === user.uid)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  // Sort offers by latest first
  const safeOffers = Array.isArray(offers)
    ? [...offers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  useEffect(() => {
    if (user.uid) {
      dispatch(fetchServiceRequestsForConsumer(user.uid));
    }
  }, [dispatch, user.uid]);

  useEffect(() => {
    if (selectedRequestId) {
      dispatch(fetchOffers(selectedRequestId));
    }
  }, [dispatch, selectedRequestId]);

  // Fetch paired jobs when the jobs tab is active
  useEffect(() => {
    if (activeTab === "jobs" && user.uid) {
      fetchPairedJobs();
    }
  }, [activeTab, user.uid]);

  const fetchPairedJobs = async () => {
    if (!user.uid) return;

    setPairedJobsLoading(true);
    try {
      const response = await apiService.get(`/pairedJobs?consumer_id=${user.uid}`);
      setPairedJobs(response.data || []);
    } catch (error) {
      console.error("Error fetching paired jobs:", error);
      setPairedJobs([]);
    } finally {
      setPairedJobsLoading(false);
    }
  };

  // Function to handle starting a chat with a provider
  const handleStartChat = async (providerId: string, providerName: string) => {
    try {
      const chatId = await createOrGetChat(user.uid!, providerId, user.name, providerName);
      navigate(`/dashboard/chats/${chatId}`);
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const handleRequestClick = (requestId: string) => {
    dispatch(setSelectedRequestId(requestId));
  };

  // Handle offer acceptance confirmation
  const handleAcceptOffer = (offer: any) => {
    setSelectedOffer(offer);
    setConfirmDialogOpen(true);
  };

  // Confirm and accept the offer
  const confirmAcceptOffer = async () => {
    if (!selectedOffer || !selectedRequestId) return;

    setAcceptingOffer(true);
    try {
      // Accept the offer
      await apiService.put(`/offers/updateStatus/${selectedOffer.offer_id}`, {
        status: "accepted",
        request_id: selectedRequestId,
      });

      // Reject all other offers for this request
      await apiService.put(`/offers/rejectOtherOffers/${selectedRequestId}`, {
        accepted_offer_id: selectedOffer.offer_id,
      });

      // Create paired job
      await apiService.post("/pairedJobs/create", {
        consumer_id: user.uid,
        provider_id: selectedOffer.provider_id,
        request_id: selectedRequestId,
        offer_id: selectedOffer.offer_id,
        budget: selectedOffer.budget,
        timeframe: selectedOffer.timeframe,
      });

      // Update request status to assigned
      await apiService.put(`/requests/updateStatus/${selectedRequestId}`, {
        status: "assigned",
      });

      console.log("SUCCESS: Offer accepted successfully!");

      // Refresh data
      if (user.uid) {
        dispatch(fetchServiceRequestsForConsumer(user.uid));
      }
      // Clear selected request and offers
      dispatch(setSelectedRequestId(null));
      setSelectedOffer(null);
      setConfirmDialogOpen(false);
    } catch (error) {
      console.error("Error accepting offer:", error);
    } finally {
      setAcceptingOffer(false);
    }
  };

  // Handle request deletion
  const handleDeleteRequest = (request: any, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the request selection
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteRequest = async () => {
    if (!requestToDelete) return;

    setDeletingRequest(true);
    try {
      const response = await apiService.delete(
        `/requests/deleteRequest/${requestToDelete.request_id || requestToDelete.id}`
      );

      // Update user's platform tokens if refund was given
      if (response.data.platform_tokens !== undefined) {
        dispatch(
          setUser({
            uid: user.uid!,
            name: user.name,
            avatarUrl: user.avatarUrl,
            userType: user.userType,
            location: user.location,
            services_array: user.services_array,
            platform_tokens: response.data.platform_tokens,
          })
        );
      }

      console.log("SUCCESS: Request deleted successfully!");

      // If this was the selected request, clear the selection
      if (selectedRequestId === (requestToDelete.request_id || requestToDelete.id)) {
        dispatch(setSelectedRequestId(null));
      }

      // Refresh requests
      if (user.uid) {
        dispatch(fetchServiceRequestsForConsumer(user.uid));
      }

      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    } catch (error) {
      console.error("Error deleting request:", error);
    } finally {
      setDeletingRequest(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setRequestToDelete(null);
  };

  // Handle rating and review
  const handleRateJob = (job: any) => {
    setSelectedJob(job);
    setRating(0);
    setReview("");
    setRatingDialogOpen(true);
  };

  const handleSubmitRating = async () => {
    if (!selectedJob || rating === 0) {
      console.log("Please provide a rating");
      return;
    }

    setSubmittingRating(true);
    try {
      await apiService.put(`/pairedJobs/${selectedJob.job_id}/rate`, {
        rating,
        review: review.trim() || null,
      });

      console.log("SUCCESS: Rating and review submitted successfully!");

      // Refresh paired jobs
      await fetchPairedJobs();

      // Close dialog and reset state
      setRatingDialogOpen(false);
      setSelectedJob(null);
      setRating(0);
      setReview("");
    } catch (error) {
      console.error("Error submitting rating:", error);
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleCloseRatingDialog = () => {
    setRatingDialogOpen(false);
    setSelectedJob(null);
    setRating(0);
    setReview("");
  };

  // Get the selected request details
  const selectedRequest = safeRequests.find(
    (req) => (req.request_id || req.id).toString() === selectedRequestId?.toString()
  );

  // Check if request is already assigned
  const isRequestAssigned = selectedRequest?.status === "assigned";

  // Enhanced chip styling for better dark theme visibility
  const getChipStyles = (
    color: "primary" | "secondary" | "success" | "error" | "warning" | "info",
    variant: "filled" | "outlined" = "filled"
  ) => {
    const themeColor = theme.palette[color];

    return {
      fontWeight: "medium",
      borderWidth: variant === "outlined" ? 2 : 0,
      backgroundColor: variant === "filled" ? undefined : alpha(themeColor.main, 0.1),
      borderColor: variant === "outlined" ? themeColor.main : undefined,
      color: variant === "outlined" ? themeColor.main : themeColor.contrastText,
      "&:hover": {
        backgroundColor: alpha(themeColor.main, variant === "outlined" ? 0.2 : 0.8),
      },
    };
  };

  // Render star rating display for providers
  const renderProviderRating = (rating: any, reviewCount: any = 0) => {
    // Convert rating to number and handle edge cases
    const numericRating = rating ? Number(rating) : 0;
    const validRating = isNaN(numericRating) ? 0 : numericRating;

    // Convert review count to number and handle edge cases
    const numericReviewCount = reviewCount ? Number(reviewCount) : 0;
    const validReviewCount = isNaN(numericReviewCount) ? 0 : numericReviewCount;

    if (validRating === 0 || validRating === null || validRating === undefined) {
      return (
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="body2" color="textSecondary" fontSize="0.8rem">
            No rating yet
          </Typography>
        </Box>
      );
    }

    return (
      <Box display="flex" alignItems="center" gap={0.5}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            sx={{
              fontSize: 16,
              color: star <= validRating ? theme.palette.warning.main : theme.palette.grey[300],
            }}
          />
        ))}
        <Typography variant="body2" color="textSecondary" ml={0.5} fontSize="0.8rem">
          ({validRating.toFixed(1)}/5{validReviewCount > 0 ? `, ${validReviewCount} reviews` : ""})
        </Typography>
      </Box>
    );
  };

  // Render Requests & Offers Tab Content
  const renderRequestsAndOffers = () => (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        position: "fixed",
        top: 112,
        left: 0,
        overflow: "hidden",
      }}
    >
      {/* Left: My Service Requests */}
      <div
        style={{
          width: "50%",
          height: "100vh",
          display: "flex",
          alignItems: "stretch",
          minHeight: 0,
        }}
      >
        <div
          style={{
            margin: 12,
            flex: 1,
            height: "calc(100vh - 136px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
            borderRadius: 12,
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Header - Fixed height */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px 12px 24px",
              flexShrink: 0,
            }}
          >
            <Assignment color="primary" style={{ fontSize: 28 }} />
            <Typography variant="h6" gutterBottom style={{ margin: 0 }}>
              My Service Requests ({safeRequests.length})
            </Typography>

            {/* Enhanced Messages Button */}
            <Button
              variant="outlined"
              size="medium"
              startIcon={<Chat />}
              onClick={() => navigate("/dashboard/chats")}
              sx={{
                ml: "auto",
                minWidth: 120,
                borderRadius: 2,
                borderWidth: 2,
                fontWeight: 600,
                px: 2.5,
                py: 1,
                position: "relative",
                backgroundColor: alpha(theme.palette.primary.main, 0.03),
                borderColor: alpha(theme.palette.primary.main, 0.3),
                "&:hover": {
                  borderWidth: 2,
                  borderColor: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  transform: "translateY(-1px)",
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
                },
                "&:active": {
                  transform: "translateY(0px)",
                },
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="button" sx={{ fontWeight: 600 }}>
                  Messages
                </Typography>
              </Box>
            </Button>
          </div>

          {/* Create Service Request Button - Fixed height */}
          <div
            style={{
              padding: "0 24px 12px 24px",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => navigate("/dashboard/create-service-request")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                background: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                border: "none",
                borderRadius: 8,
                padding: "12px 22px",
                fontSize: "1rem",
                fontWeight: 600,
                boxShadow: `0 2px 8px ${theme.palette.primary.main}22`,
                cursor: "pointer",
                transition: "background 0.2s, box-shadow 0.2s, transform 0.1s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = theme.palette.primary.dark;
                e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = theme.palette.primary.main;
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <AddCircleOutline style={{ fontSize: 20 }} />
              Create Service Request
            </button>
          </div>

          {/* Scrollable content area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "12px 24px 24px 24px",
              minHeight: 0,
            }}
          >
            {requestsStatus === "loading" ? (
              <div>Loading...</div>
            ) : safeRequests.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <Assignment color="disabled" style={{ fontSize: 48 }} />
                <Typography variant="body1" color="textSecondary" textAlign="center">
                  No service requests found.
                </Typography>
                <Typography variant="body2" color="textSecondary" textAlign="center">
                  Click the "Create Service Request" button above to get started.
                </Typography>
              </div>
            ) : (
              <div>
                {safeRequests.map((req: any) => {
                  const requestId = req.request_id || req.id;
                  const isSelected = selectedRequestId === requestId;

                  return (
                    <Box
                      key={requestId}
                      sx={{
                        padding: 2,
                        marginBottom: 1.5,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: isSelected ? "primary.main" : "divider",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.08) : "transparent",
                        "&:hover": {
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : "action.hover",
                          boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                          transform: "translateY(-2px)",
                          borderColor: "primary.main",
                        },
                      }}
                      onClick={() => handleRequestClick(requestId)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Assignment color={isSelected ? "primary" : "action"} style={{ fontSize: 22 }} />
                          <Typography
                            variant="h6"
                            style={{
                              fontWeight: isSelected ? 600 : 500,
                              color: isSelected ? theme.palette.primary.main : undefined,
                            }}
                          >
                            {req.title}
                          </Typography>
                          {req.status === "assigned" && (
                            <Chip
                              label="Assigned"
                              color="success"
                              size="small"
                              variant="filled"
                              sx={getChipStyles("success", "filled")}
                            />
                          )}
                        </div>

                        {/* Delete button - only show if request is not assigned */}
                        {req.status !== "assigned" && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleDeleteRequest(req, e)}
                            sx={{
                              opacity: 0.7,
                              "&:hover": {
                                opacity: 1,
                                backgroundColor: alpha(theme.palette.error.main, 0.1),
                              },
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </div>

                      {req.description && (
                        <Typography variant="body2" color="textSecondary">
                          {req.description.length > 100 ? `${req.description.substring(0, 100)}...` : req.description}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                        <Chip
                          label={`Budget: LKR ${req.budget}`}
                          color="success"
                          variant="outlined"
                          size="small"
                          sx={getChipStyles("success", "outlined")}
                        />
                        {req.timeframe && (
                          <Chip
                            label={`Timeframe: ${req.timeframe}`}
                            color="info"
                            variant="outlined"
                            size="small"
                            sx={getChipStyles("info", "outlined")}
                          />
                        )}
                      </Stack>

                      <Typography variant="caption" color="textSecondary">
                        Posted on {new Date(req.created_at).toLocaleDateString()} at{" "}
                        {new Date(req.created_at).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Offers for Selected Request */}
      <div
        style={{
          width: "50%",
          height: "100vh",
          alignItems: "stretch",
          minHeight: 0,
        }}
      >
        <div
          style={{
            margin: 12,
            flex: 1,
            height: "calc(100vh - 136px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
            borderRadius: 12,
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Header - Fixed height */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px 12px 24px",
              flexShrink: 0,
            }}
          >
            <LocalOffer color="primary" style={{ fontSize: 28 }} />
            <Typography variant="h6" gutterBottom style={{ margin: 0 }}>
              {selectedRequestId ? `Offers (${safeOffers.length})` : "Select a Service Request"}
            </Typography>
          </div>

          {/* Scrollable content area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "12px 24px 24px 24px",
              minHeight: 0,
            }}
          >
            {selectedRequestId ? (
              offersStatus === "loading" ? (
                <div>Loading offers...</div>
              ) : safeOffers.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 40 }}>
                  <LocalOffer color="disabled" style={{ fontSize: 48 }} />
                  <Typography variant="body1" color="textSecondary" textAlign="center">
                    No offers found for this request.
                  </Typography>
                  <Typography variant="body2" color="textSecondary" textAlign="center">
                    Providers will submit offers which will appear here.
                  </Typography>
                </div>
              ) : (
                <div>
                  {safeOffers.map((offer: any) => (
                    <Box
                      key={offer.offer_id || offer.id}
                      sx={{
                        padding: 2,
                        marginBottom: 1.5,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: offer.status === "accepted" ? "success.main" : "divider",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        backgroundColor:
                          offer.status === "accepted" ? alpha(theme.palette.success.main, 0.08) : "transparent",
                        "&:hover": {
                          bgcolor:
                            offer.status === "accepted" ? alpha(theme.palette.success.main, 0.12) : "action.hover",
                          boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                          transform: "translateY(-2px)",
                          borderColor: "primary.main",
                        },
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <LocalOffer color="primary" style={{ fontSize: 22 }} />
                          <Typography variant="h6" style={{ fontWeight: 600 }}>
                            LKR {offer.budget}
                          </Typography>
                        </div>
                        {offer.status === "accepted" && (
                          <Chip
                            label="Accepted"
                            color="success"
                            size="small"
                            variant="filled"
                            icon={<CheckCircle />}
                            sx={getChipStyles("success", "filled")}
                          />
                        )}
                      </div>

                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                        {offer.timeframe && (
                          <Chip
                            label={`Timeframe: ${offer.timeframe}`}
                            color="info"
                            variant="outlined"
                            size="small"
                            sx={getChipStyles("info", "outlined")}
                          />
                        )}
                        {offer.provider_name && (
                          <Chip
                            label={`Provider: ${offer.provider_name}`}
                            color="primary"
                            variant="outlined"
                            size="small"
                            sx={getChipStyles("primary", "outlined")}
                          />
                        )}
                      </Stack>

                      {/* Provider Rating */}
                      {offer.provider_name && (
                        <Box mt={1}>
                          {renderProviderRating(offer.provider_rating || 0, offer.provider_review_count || 0)}
                        </Box>
                      )}

                      <Typography variant="caption" color="textSecondary">
                        Received on {new Date(offer.created_at).toLocaleDateString()} at{" "}
                        {new Date(offer.created_at).toLocaleTimeString()}
                      </Typography>

                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Chat />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartChat(offer.provider_id, offer.provider_name || "Provider");
                          }}
                          sx={{
                            borderRadius: 1.5,
                            fontWeight: 500,
                            textTransform: "none",
                            minWidth: 80,
                            borderColor: alpha(theme.palette.info.main, 0.5),
                            color: theme.palette.info.main,
                            backgroundColor: alpha(theme.palette.info.main, 0.05),
                            "&:hover": {
                              borderColor: theme.palette.info.main,
                              backgroundColor: alpha(theme.palette.info.main, 0.1),
                              transform: "translateY(-1px)",
                              boxShadow: `0 2px 8px ${alpha(theme.palette.info.main, 0.2)}`,
                            },
                            "&:active": {
                              transform: "translateY(0px)",
                            },
                            transition: "all 0.15s ease-in-out",
                          }}
                        >
                          Message
                        </Button>

                        {offer.status !== "accepted" && !isRequestAssigned && (
                          <Button
                            variant="contained"
                            size="small"
                            color="success"
                            startIcon={<CheckCircle />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptOffer(offer);
                            }}
                          >
                            Accept Offer
                          </Button>
                        )}
                      </div>
                    </Box>
                  ))}
                </div>
              )
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 40 }}>
                <LocalOffer color="disabled" style={{ fontSize: 48 }} />
                <Typography variant="body1" color="textSecondary" textAlign="center">
                  Select a service request to view offers
                </Typography>
                <Typography variant="body2" color="textSecondary" textAlign="center">
                  Click on any request from the left panel to see received offers.
                </Typography>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render Paired Jobs Tab Content
  const renderPairedJobs = () => (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 112,
        left: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          margin: 12,
          height: "calc(100vh - 136px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          borderRadius: 12,
          background: theme.palette.background.paper,
          color: theme.palette.text.primary,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px 12px 24px",
            flexShrink: 0,
          }}
        >
          <Work color="primary" style={{ fontSize: 28 }} />
          <Typography variant="h6" gutterBottom style={{ margin: 0 }}>
            My Paired Jobs ({pairedJobs.length})
          </Typography>

          <Button
            variant="outlined"
            size="medium"
            startIcon={<Chat />}
            onClick={() => navigate("/dashboard/chats")}
            sx={{
              ml: "auto",
              minWidth: 120,
              borderRadius: 2,
              borderWidth: 2,
              fontWeight: 600,
              px: 2.5,
              py: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.03),
              borderColor: alpha(theme.palette.primary.main, 0.3),
              "&:hover": {
                borderWidth: 2,
                borderColor: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                transform: "translateY(-1px)",
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
              },
              "&:active": {
                transform: "translateY(0px)",
              },
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <Typography variant="button" sx={{ fontWeight: 600 }}>
              Messages
            </Typography>
          </Button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "12px 24px 24px 24px",
            minHeight: 0,
          }}
        >
          {pairedJobsLoading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
              <Typography>Loading paired jobs...</Typography>
            </div>
          ) : pairedJobs.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 40 }}>
              <Work color="disabled" style={{ fontSize: 48 }} />
              <Typography variant="body1" color="textSecondary" textAlign="center">
                No paired jobs found.
              </Typography>
              <Typography variant="body2" color="textSecondary" textAlign="center">
                Paired jobs will appear here when you accept offers from providers.
              </Typography>
            </div>
          ) : (
            <div>
              {pairedJobs.map((job: any) => (
                <Box
                  key={job.job_id}
                  sx={{
                    padding: 2,
                    marginBottom: 1.5,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      bgcolor: "action.hover",
                      boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                      transform: "translateY(-2px)",
                      borderColor: "primary.main",
                    },
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Work color="primary" style={{ fontSize: 22 }} />
                    <Typography variant="h6" style={{ fontWeight: 600 }}>
                      {job.title}
                    </Typography>
                    {job.rating && (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Star color="warning" style={{ fontSize: 20 }} />
                        <Typography variant="body2" color="textSecondary">
                          {job.rating}/5
                        </Typography>
                      </Box>
                    )}
                  </div>

                  {job.description && (
                    <Typography variant="body2" color="textSecondary">
                      {job.description}
                    </Typography>
                  )}

                  <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                    <Chip
                      label={`Cost: LKR ${job.cost}`}
                      color="success"
                      variant="outlined"
                      size="small"
                      sx={getChipStyles("success", "outlined")}
                    />
                    <Chip
                      label={`Provider: ${job.provider_name || "Unknown"}`}
                      color="info"
                      variant="outlined"
                      size="small"
                      sx={getChipStyles("info", "outlined")}
                    />
                    <Chip
                      label={`Job ID: ${job.job_id}`}
                      color="info"
                      variant="outlined"
                      size="small"
                      sx={getChipStyles("info", "outlined")}
                    />
                  </Stack>

                  {job.review && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 1 }}>
                      <Typography variant="body2" style={{ fontStyle: "italic" }}>
                        "{job.review}"
                      </Typography>
                    </Box>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Chat />}
                      onClick={() => {
                        // Navigate to chat with provider
                        handleStartChat(job.provider_id, job.provider_name || "Provider");
                      }}
                      sx={{
                        borderRadius: 1.5,
                        fontWeight: 500,
                        textTransform: "none",
                        borderColor: alpha(theme.palette.primary.main, 0.5),
                        color: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        "&:hover": {
                          borderColor: theme.palette.primary.main,
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          transform: "translateY(-1px)",
                          boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
                        },
                        "&:active": {
                          transform: "translateY(0px)",
                        },
                        transition: "all 0.15s ease-in-out",
                      }}
                    >
                      Message Provider
                    </Button>

                    {!job.rating && (
                      <Button
                        variant="contained"
                        size="small"
                        color="warning"
                        startIcon={<RateReview />}
                        onClick={() => handleRateJob(job)}
                      >
                        Rate & Review
                      </Button>
                    )}
                  </div>
                </Box>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Tab Bar */}
      <Box
        sx={{
          position: "fixed",
          top: 64, // Right below navbar
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
          sx={{
            minHeight: 48,
            "& .MuiTab-root": {
              minHeight: 48,
              textTransform: "none",
              fontWeight: 600,
              fontSize: "1rem",
            },
          }}
        >
          <Tab value="requests" label="Requests & Offers" icon={<Assignment />} iconPosition="start" />
          <Tab value="jobs" label="Paired Jobs" icon={<Work />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box
        sx={{
          position: "fixed",
          top: 128,
          height: "calc(100vh - 128px)",
        }}
      >
        {activeTab === "requests" && renderRequestsAndOffers()}
        {activeTab === "jobs" && renderPairedJobs()}
      </Box>

      {/* Offer Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: "90vh",
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              sx={{
                bgcolor: theme.palette.success.main,
                width: 48,
                height: 48,
              }}
            >
              <CheckCircle />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                Confirm Offer Acceptance
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review offer details before accepting
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 3, backgroundColor: theme.palette.background.paper }}>
          {selectedOffer && (
            <Stack spacing={3}>
              {/* Main Offer Information */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.success.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocalOffer color="success" />
                  <Typography variant="h6" fontWeight="bold">
                    Offer Details
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mb={2}>
                  <Chip
                    label={`Budget: LKR ${selectedOffer.budget}`}
                    color="success"
                    variant="filled"
                    sx={getChipStyles("success", "filled")}
                  />
                  <Chip
                    label={`Timeframe: ${selectedOffer.timeframe}`}
                    color="info"
                    variant="outlined"
                    sx={getChipStyles("info", "outlined")}
                  />
                  <Chip
                    label={`Provider: ${selectedOffer.provider_name || "Provider"}`}
                    color="primary"
                    variant="outlined"
                    sx={getChipStyles("primary", "outlined")}
                  />
                </Stack>

                {/* Provider Rating in confirmation dialog */}
                {selectedOffer.provider_name && (
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Provider Rating:
                    </Typography>
                    {renderProviderRating(selectedOffer.provider_rating || 0, selectedOffer.provider_review_count || 0)}
                  </Box>
                )}

                <Typography variant="body2" color="text.secondary" mt={2}>
                  By accepting this offer, a job will be created and this request will be marked as assigned. You'll be
                  able to communicate with the provider through the chat system.
                </Typography>
              </Paper>
            </Stack>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 3, gap: 1, backgroundColor: theme.palette.background.paper }}>
          <Button onClick={() => setConfirmDialogOpen(false)} variant="outlined" size="large" disabled={acceptingOffer}>
            Cancel
          </Button>
          <Button
            onClick={confirmAcceptOffer}
            variant="contained"
            color="success"
            size="large"
            disabled={acceptingOffer}
            startIcon={<CheckCircle />}
          >
            {acceptingOffer ? "Accepting..." : "Accept Offer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Request Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: "90vh",
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              sx={{
                bgcolor: theme.palette.error.main,
                width: 48,
                height: 48,
              }}
            >
              <Warning />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                Delete Service Request
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This action cannot be undone
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseDeleteDialog} sx={{ color: theme.palette.text.secondary }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 3, backgroundColor: theme.palette.background.paper }}>
          {requestToDelete && (
            <Stack spacing={3}>
              {/* Request Information */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.error.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" color="error" gutterBottom>
                  {requestToDelete.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Budget: LKR {requestToDelete.budget}
                </Typography>
                {requestToDelete.timeframe && (
                  <Typography variant="body2" color="text.secondary">
                    Timeframe: {requestToDelete.timeframe}
                  </Typography>
                )}
              </Paper>

              {/* Warning Message */}
              <Alert
                severity="warning"
                icon={<Warning />}
                sx={{
                  borderRadius: 2,
                  "& .MuiAlert-message": {
                    fontSize: "0.95rem",
                  },
                }}
              >
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Important: Platform Token Refund Policy
                </Typography>
                <Typography variant="body2">
                  Platform tokens may not be refunded if providers have already submitted offers for this request. By
                  deleting this request, you acknowledge that token refunds are subject to our policy.
                </Typography>
              </Alert>

              <Typography variant="body2" color="text.secondary">
                Are you sure you want to delete this service request? This action cannot be undone.
              </Typography>
            </Stack>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 3, gap: 1, backgroundColor: theme.palette.background.paper }}>
          <Button onClick={handleCloseDeleteDialog} variant="outlined" size="large" disabled={deletingRequest}>
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteRequest}
            variant="contained"
            color="error"
            size="large"
            disabled={deletingRequest}
            startIcon={<Delete />}
          >
            {deletingRequest ? "Deleting..." : "Delete Request"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rating and Review Dialog */}
      <Dialog
        open={ratingDialogOpen}
        onClose={handleCloseRatingDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: "90vh",
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 1,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              sx={{
                bgcolor: theme.palette.warning.main,
                width: 48,
                height: 48,
              }}
            >
              <RateReview />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                Rate & Review Job
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Share your experience with this service
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseRatingDialog} sx={{ color: theme.palette.text.secondary }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 3, backgroundColor: theme.palette.background.paper }}>
          {selectedJob && (
            <Stack spacing={3}>
              {/* Job Information */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <Typography variant="h6" fontWeight="bold" color="primary" gutterBottom>
                  {selectedJob.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Provider: {selectedJob.provider_name || "Unknown"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cost: LKR {selectedJob.cost}
                </Typography>
              </Paper>

              {/* Rating Section */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Rating *
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Rating
                    value={rating}
                    onChange={(_, newValue) => setRating(newValue || 0)}
                    size="large"
                    sx={{
                      "& .MuiRating-iconFilled": {
                        color: theme.palette.warning.main,
                      },
                      "& .MuiRating-iconHover": {
                        color: theme.palette.warning.light,
                      },
                    }}
                  />
                  <Typography variant="body2" color="text.secondary" ml={1}>
                    {rating > 0 && `${rating} star${rating !== 1 ? "s" : ""}`}
                  </Typography>
                </Box>
              </Box>

              {/* Review Section */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Review (Optional)
                </Typography>
                <TextField
                  multiline
                  rows={4}
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your experience with this service provider..."
                  fullWidth
                  variant="outlined"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "&:hover fieldset": {
                        borderColor: alpha(theme.palette.primary.main, 0.5),
                      },
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Your review will help other consumers make informed decisions.
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 3, gap: 1, backgroundColor: theme.palette.background.paper }}>
          <Button onClick={handleCloseRatingDialog} variant="outlined" size="large" disabled={submittingRating}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitRating}
            variant="contained"
            color="warning"
            size="large"
            disabled={submittingRating || rating === 0}
            startIcon={<RateReview />}
          >
            {submittingRating ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConsumerHome;
