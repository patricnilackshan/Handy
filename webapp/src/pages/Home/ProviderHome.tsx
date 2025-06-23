import React, { useEffect, useState } from "react";
import {
  Typography,
  useTheme,
  Button,
  Chip,
  TextField,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Divider,
  IconButton,
  Card,
  CardContent,
  alpha,
  Stack,
  Paper,
  Tabs,
  Tab,
  CardMedia,
  Grid,
} from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchServiceRequestsBasedOnService } from "../../store/serviceRequestsSlice";
import { fetchProviderOffers, updateOfferBudget } from "../../store/providerOffersSlice";
import type { RootState } from "../../store/store";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ChatIcon from "@mui/icons-material/Chat";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PersonIcon from "@mui/icons-material/Person";
import DescriptionIcon from "@mui/icons-material/Description";
import WorkIcon from "@mui/icons-material/Work";
import StarIcon from "@mui/icons-material/Star";
import RateReviewIcon from "@mui/icons-material/RateReview";
import Warning from "@mui/icons-material/Warning";
import { useNavigate } from "react-router-dom";
import apiService from "@utils/apiService";
import { createOrGetChat } from "@utils/chatUtils";
import { setUser } from "../../store/userSlice";

const ProviderHome: React.FC = () => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const navigate = useNavigate();
  const serviceRequests = useAppSelector((state: RootState) => state.serviceRequests) as any;
  const providerOffers = useAppSelector((state: RootState) => state.providerOffers) as any;
  const user = useAppSelector((state: RootState) => state.user);
  const { items: requests = [], status: requestsStatus = "" } = serviceRequests;
  const { items: myOffers = [] } = providerOffers;

  const getInitialTab = (): "requests" | "jobs" => {
    const savedTab = localStorage.getItem("providerActiveTab");
    return savedTab === "requests" || savedTab === "jobs" ? savedTab : "requests";
  };

  // Tab state
  const [activeTab, setActiveTab] = useState<"requests" | "jobs">(getInitialTab());

  // Persist activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("providerActiveTab", activeTab);
  }, [activeTab]);

  // State for editing offers
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState<number>(0);
  const [updateLoading, setUpdateLoading] = useState(false);

  // State for request details modal
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // State for offer details modal
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [offerDetailsModalOpen, setOfferDetailsModalOpen] = useState(false);

  // State for delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<any>(null);
  const [deletingOffer, setDeletingOffer] = useState(false);

  // State for paired jobs
  const [pairedJobs, setPairedJobs] = useState<any[]>([]);
  const [pairedJobsLoading, setPairedJobsLoading] = useState(false);

  // State for job details modal
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [jobDetailsModalOpen, setJobDetailsModalOpen] = useState(false);

  // Show all pending requests for providers
  const safeRequests = Array.isArray(requests)
    ? requests
        .filter((req) => req.status === "pending")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  const safeOffers = Array.isArray(myOffers)
    ? [...myOffers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  // Single useEffect to fetch both requests and offers
  useEffect(() => {
    if (user.uid) {
      dispatch(fetchServiceRequestsBasedOnService(user.uid));
      dispatch(fetchProviderOffers(user.uid));
    }
  }, [dispatch, user.uid]);

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
      const response = await apiService.get(`/pairedJobs?provider_id=${user.uid}`);
      setPairedJobs(response.data || []);
    } catch (error) {
      console.error("Error fetching paired jobs:", error);
      setPairedJobs([]);
    } finally {
      setPairedJobsLoading(false);
    }
  };

  // Function to handle starting a chat with a consumer
  const handleStartChat = async (consumerId: string, consumerName: string) => {
    try {
      const chatId = await createOrGetChat(user.uid!, consumerId, user.name, consumerName);
      navigate(`/dashboard/chats/${chatId}`);
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const handleCreateOffer = (requestId: string) => {
    navigate(`/dashboard/create-offer/${requestId}`);
  };

  const handleDeleteOffer = (offerId: string, offerData: any) => {
    setOfferToDelete({ id: offerId, ...offerData });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteOffer = async () => {
    if (!offerToDelete) return;

    setDeletingOffer(true);
    try {
      // Call the backend API directly to handle token refund
      const response = await apiService.delete(`/offers/deleteOffer/${offerToDelete.id}`);

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
            platform_tokens: user.platform_tokens! + 1,
          })
        );
      }

      console.log("SUCCESS: Offer deleted successfully and platform token refunded!");

      // Refresh offers from the backend
      if (user.uid) {
        dispatch(fetchProviderOffers(user.uid));
      }

      setDeleteDialogOpen(false);
      setOfferToDelete(null);
    } catch (error) {
      console.error("Error deleting offer:", error);
    } finally {
      setDeletingOffer(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setOfferToDelete(null);
  };

  const handleEditOffer = (offer: any) => {
    setEditingOfferId(offer.offer_id);
    setEditBudget(offer.budget);
  };

  const handleSaveEdit = async (offerId: string) => {
    if (!editBudget || editBudget <= 0) {
      console.log("WARNING: Please enter a valid budget");
      return;
    }

    setUpdateLoading(true);
    try {
      await dispatch(updateOfferBudget({ offerId, budget: editBudget }));
      setEditingOfferId(null);
      console.log("SUCCESS: Offer budget updated successfully");
    } catch (error) {
      console.error("Error updating offer:", error);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingOfferId(null);
    setEditBudget(0);
  };

  // Handle request details modal
  const handleViewRequestDetails = (request: any) => {
    setSelectedRequest(request);
    setDetailsModalOpen(true);
  };

  const handleCloseRequestDetails = () => {
    setDetailsModalOpen(false);
    setSelectedRequest(null);
  };

  // Handle offer details modal
  const handleViewOfferDetails = (offer: any) => {
    setSelectedOffer(offer);
    setOfferDetailsModalOpen(true);
  };

  const handleCloseOfferDetails = () => {
    setOfferDetailsModalOpen(false);
    setSelectedOffer(null);
  };

  // Handle job details modal
  const handleViewJobDetails = (job: any) => {
    setSelectedJob(job);
    setJobDetailsModalOpen(true);
  };

  const handleCloseJobDetails = () => {
    setJobDetailsModalOpen(false);
    setSelectedJob(null);
  };

  // Optimized function to check if provider has an offer for a specific request
  const getExistingOffer = (requestId: string) => {
    return myOffers.find((offer: any) => (offer.request_id || offer.id).toString() === requestId.toString());
  };

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

  // Render star rating display
  const renderStarRating = (rating: number) => {
    return (
      <Box display="flex" alignItems="center" gap={0.5}>
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            sx={{
              fontSize: 20,
              color: star <= rating ? theme.palette.warning.main : theme.palette.grey[300],
            }}
          />
        ))}
        <Typography variant="body2" color="textSecondary" ml={0.5}>
          ({rating}/5)
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
      {/* Left: Available Service Requests */}
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
            <AssignmentIcon color="primary" style={{ fontSize: 28 }} />
            <Typography variant="h6" gutterBottom style={{ margin: 0 }}>
              Available Service Requests ({safeRequests.length})
            </Typography>

            <Button
              variant="outlined"
              size="medium"
              startIcon={<ChatIcon />}
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
                <div>No pending service requests found.</div>
                <Typography variant="body2" color="textSecondary">
                  Check back later for new opportunities
                </Typography>
              </div>
            ) : (
              <div>
                {safeRequests.map((req: any) => {
                  const requestId = req.request_id || req.id;
                  const existingOffer = getExistingOffer(requestId.toString());

                  return (
                    <Box
                      key={requestId}
                      sx={{
                        padding: 2,
                        marginBottom: 1.5,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        flexDirection: "row", // Changed from column to row
                        gap: 2,
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        "&:hover": {
                          bgcolor: "action.hover",
                          boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                          transform: "translateY(-2px)",
                          borderColor: "primary.main",
                        },
                      }}
                    >
                      {/* Left Side: Details */}
                      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <AssignmentIcon color="primary" style={{ fontSize: 22 }} />
                          <Typography variant="h6" style={{ fontWeight: 600 }}>
                            {req.title}
                          </Typography>
                          {existingOffer && (
                            <Chip
                              label="Offer Submitted"
                              color="success"
                              size="small"
                              variant="filled"
                              sx={getChipStyles("success", "filled")}
                            />
                          )}
                        </div>

                        {req.description && (
                          <Typography variant="body2" color="textSecondary">
                            {req.description.length > 120 ? `${req.description.substring(0, 120)}...` : req.description}
                          </Typography>
                        )}

                        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                          {req.budget && (
                            <Chip
                              label={`Budget: LKR ${req.budget}`}
                              color="primary"
                              variant="outlined"
                              size="small"
                              sx={getChipStyles("primary", "outlined")}
                            />
                          )}
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

                        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                          {existingOffer ? (
                            <>
                              <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleDeleteOffer(existingOffer.offer_id, existingOffer)}
                              >
                                Delete Offer
                              </Button>
                            </>
                          ) : (
                            <Button variant="contained" size="small" onClick={() => handleCreateOffer(requestId)}>
                              Create Offer
                            </Button>
                          )}
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={() => handleViewRequestDetails(req)}
                          >
                            View Details
                          </Button>
                        </div>
                      </Box>

                      {/* Right Side: Image */}
                      {req.image_url && (
                        <Box sx={{ width: 140, flexShrink: 0, alignSelf: "flex-start" }}>
                          <Card sx={{ borderRadius: 1, width: "100%" }}>
                            <CardMedia
                              component="img"
                              height="120"
                              image={req.image_url}
                              alt="Request image"
                              sx={{
                                objectFit: "cover",
                                cursor: "pointer",
                                transition: "transform 0.2s",
                                "&:hover": {
                                  transform: "scale(1.05)",
                                },
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(req.image_url, "_blank");
                              }}
                            />
                          </Card>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: My Offers */}
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
            <LocalOfferIcon color="primary" style={{ fontSize: 28 }} />
            <Typography variant="h6" gutterBottom style={{ margin: 0 }}>
              My Offers ({safeOffers.length})
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
            {safeOffers.length === 0 ? (
              <div>No offers submitted yet.</div>
            ) : (
              <div>
                {safeOffers.map((offer: any) => (
                  <Box
                    key={offer.offer_id || offer.id}
                    sx={{
                      padding: 1.5,
                      marginBottom: 1,
                      borderRadius: 0.75,
                      border: "1px solid",
                      borderColor: "divider",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                      "&:hover": {
                        bgcolor: "action.hover",
                        boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                        transform: "translateY(-2px)",
                        borderColor: "primary.main",
                      },
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <LocalOfferIcon color="action" style={{ fontSize: 22 }} />
                      <Typography>{offer.request_title || `Request #${offer.request_id}`}</Typography>
                      <Chip
                        label={offer.status || "pending"}
                        color={
                          offer.status === "accepted" ? "success" : offer.status === "rejected" ? "error" : "warning"
                        }
                        size="small"
                        variant="filled"
                        sx={getChipStyles(
                          offer.status === "accepted" ? "success" : offer.status === "rejected" ? "error" : "warning",
                          "filled"
                        )}
                      />
                    </div>

                    {/* Budget Edit Section */}
                    {editingOfferId === offer.offer_id ? (
                      <Box display="flex" alignItems="center" gap={1} mt={1}>
                        <TextField
                          type="number"
                          value={editBudget}
                          onChange={(e) => setEditBudget(Number(e.target.value))}
                          size="small"
                          label="Budget ($)"
                          inputProps={{ min: 1, step: 0.01 }}
                          sx={{ minWidth: 120 }}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          startIcon={<SaveIcon />}
                          onClick={() => handleSaveEdit(offer.offer_id)}
                          disabled={updateLoading}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<CancelIcon />}
                          onClick={handleCancelEdit}
                          disabled={updateLoading}
                        >
                          Cancel
                        </Button>
                      </Box>
                    ) : (
                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                        <Chip
                          label={`Your Quote: LKR ${offer.budget}`}
                          color="success"
                          variant="outlined"
                          size="small"
                          sx={getChipStyles("success", "outlined")}
                        />
                        {offer.customer_budget && (
                          <Chip
                            label={`Customer Budget: LKR ${offer.customer_budget}`}
                            color="info"
                            variant="outlined"
                            size="small"
                            sx={getChipStyles("info", "outlined")}
                          />
                        )}
                        <Chip
                          label={`Timeframe: ${offer.timeframe}`}
                          color="primary"
                          variant="outlined"
                          size="small"
                          sx={getChipStyles("primary", "outlined")}
                        />
                      </Stack>
                    )}

                    <Typography variant="caption" color="textSecondary">
                      {new Date(offer.created_at).toLocaleDateString()} at{" "}
                      {new Date(offer.created_at).toLocaleTimeString()}
                    </Typography>

                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleViewOfferDetails(offer)}
                      >
                        View Details
                      </Button>
                      {offer.status === "pending" && editingOfferId !== offer.offer_id && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="primary"
                          startIcon={<EditIcon />}
                          onClick={() => handleEditOffer(offer)}
                        >
                          Edit
                        </Button>
                      )}
                      {offer.status === "pending" && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDeleteOffer(offer.offer_id, offer)}
                        >
                          Delete
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
          <WorkIcon color="primary" style={{ fontSize: 28 }} />
          <Typography variant="h6" gutterBottom style={{ margin: 0 }}>
            My Paired Jobs ({pairedJobs.length})
          </Typography>

          <Button
            variant="outlined"
            size="medium"
            startIcon={<ChatIcon />}
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
              <WorkIcon color="disabled" style={{ fontSize: 48 }} />
              <Typography variant="body1" color="textSecondary" textAlign="center">
                No paired jobs found.
              </Typography>
              <Typography variant="body2" color="textSecondary" textAlign="center">
                Paired jobs will appear here when consumers accept your offers.
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
                    borderColor: job.rating ? alpha(theme.palette.warning.main, 0.3) : "divider",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    transition: "all 0.3s ease",
                    backgroundColor: job.rating ? alpha(theme.palette.warning.main, 0.05) : "transparent",
                    "&:hover": {
                      bgcolor: job.rating ? alpha(theme.palette.warning.main, 0.08) : "action.hover",
                      boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                      transform: "translateY(-2px)",
                      borderColor: "primary.main",
                    },
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <WorkIcon color="primary" style={{ fontSize: 22 }} />
                      <Typography variant="h6" style={{ fontWeight: 600 }}>
                        {job.title}
                      </Typography>
                    </div>
                    {job.rating && (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <StarIcon color="warning" style={{ fontSize: 20 }} />
                        <Typography variant="body2" fontWeight="bold" color="warning.main">
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
                      label={`Earned: LKR ${job.cost}`}
                      color="success"
                      variant="outlined"
                      size="small"
                      sx={getChipStyles("success", "outlined")}
                    />
                    <Chip
                      label={`Consumer: ${job.consumer_name || "Unknown"}`}
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

                  {/* Review preview for jobs with reviews */}
                  {job.review && (
                    <Box
                      sx={{
                        mt: 1,
                        p: 1.5,
                        bgcolor: alpha(theme.palette.warning.main, 0.08),
                        borderRadius: 1,
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <RateReviewIcon color="warning" style={{ fontSize: 16 }} />
                        <Typography variant="caption" color="warning.main" fontWeight="bold">
                          CUSTOMER REVIEW
                        </Typography>
                      </Box>
                      <Typography variant="body2" style={{ fontStyle: "italic" }}>
                        "{job.review.length > 100 ? `${job.review.substring(0, 100)}...` : job.review}"
                      </Typography>
                    </Box>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ChatIcon />}
                      onClick={() => {
                        handleStartChat(job.consumer_id, job.consumer_name || "Consumer");
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
                      Message Consumer
                    </Button>

                    {job.rating && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="warning"
                        startIcon={<RateReviewIcon />}
                        onClick={() => handleViewJobDetails(job)}
                      >
                        View Details
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
          <Tab value="requests" label="Requests & Offers" icon={<AssignmentIcon />} iconPosition="start" />
          <Tab value="jobs" label="Paired Jobs" icon={<WorkIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box
        sx={{
          position: "fixed",
          top: 128, // Below navbar + tab bar
          height: "calc(100vh - 128px)",
        }}
      >
        {activeTab === "requests" && renderRequestsAndOffers()}
        {activeTab === "jobs" && renderPairedJobs()}
      </Box>

      {/* Request Details Modal */}
      <Dialog
        open={detailsModalOpen}
        onClose={handleCloseRequestDetails}
        maxWidth="md"
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
                bgcolor: theme.palette.primary.main,
                width: 48,
                height: 48,
              }}
            >
              <AssignmentIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {selectedRequest?.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Request Details
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseRequestDetails}
            sx={{
              color: theme.palette.text.secondary,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 3, backgroundColor: theme.palette.background.paper }}>
          {selectedRequest && (
            <Stack spacing={3}>
              {/* Main Information Section */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <DescriptionIcon color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    Service Request
                  </Typography>
                </Box>

                <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
                  {selectedRequest.title}
                </Typography>

                <Typography variant="body1" lineHeight={1.6} mb={3}>
                  {selectedRequest.description || "No description provided"}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  <Chip
                    label={`Budget: LKR ${selectedRequest.budget}`}
                    color="success"
                    variant="outlined"
                    sx={getChipStyles("success", "outlined")}
                  />
                  {selectedRequest.timeframe && (
                    <Chip
                      label={`Timeframe: ${selectedRequest.timeframe}`}
                      color="info"
                      variant="outlined"
                      sx={getChipStyles("info", "outlined")}
                    />
                  )}
                  <Chip
                    label={selectedRequest.status || "pending"}
                    color={selectedRequest.status === "pending" ? "warning" : "success"}
                    variant="filled"
                    sx={getChipStyles(selectedRequest.status === "pending" ? "warning" : "success", "filled")}
                  />
                  {selectedRequest.service && (
                    <Chip
                      label={selectedRequest.service}
                      color="primary"
                      variant="outlined"
                      sx={getChipStyles("primary", "outlined")}
                    />
                  )}
                </Stack>
              </Paper>

              {/* Details Grid */}
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {/* Location Info */}
                <Card
                  variant="outlined"
                  sx={{ borderRadius: 2, flex: "1 1 300px", backgroundColor: theme.palette.background.paper }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <LocationOnIcon color="error" />
                      <Typography variant="h6" fontWeight="bold">
                        Location
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedRequest.location || "Location not specified"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Service location
                    </Typography>
                  </CardContent>
                </Card>

                {/* Customer Info */}
                <Card
                  variant="outlined"
                  sx={{ borderRadius: 2, flex: "1 1 300px", backgroundColor: theme.palette.background.paper }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <PersonIcon color="info" />
                      <Typography variant="h6" fontWeight="bold">
                        Customer
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Customer ID
                    </Typography>
                    <Typography
                      variant="body1"
                      fontWeight="medium"
                      sx={{ fontFamily: "monospace", fontSize: "0.9rem" }}
                    >
                      {selectedRequest.user_id}
                    </Typography>
                  </CardContent>
                </Card>

                {/* Posted Date */}
                <Card
                  variant="outlined"
                  sx={{ borderRadius: 2, flex: "1 1 300px", backgroundColor: theme.palette.background.paper }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <CalendarTodayIcon color="warning" />
                      <Typography variant="h6" fontWeight="bold">
                        Posted Date
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight="medium">
                      {new Date(selectedRequest.created_at).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      at{" "}
                      {new Date(selectedRequest.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* Request Images */}
              {selectedRequest.image_urls &&
                Array.isArray(selectedRequest.image_urls) &&
                selectedRequest.image_urls.length > 0 && (
                  <Box mt={2} mb={2}>
                    <Typography variant="h6" gutterBottom>
                      Request Images ({selectedRequest.image_urls.length})
                    </Typography>
                    {selectedRequest.image_urls.length === 1 ? (
                      // Single image - display larger
                      <Card sx={{ maxWidth: 400, borderRadius: 2 }}>
                        <CardMedia
                          component="img"
                          height="250"
                          image={selectedRequest.image_urls[0]}
                          alt="Service request image"
                          sx={{
                            objectFit: "cover",
                            cursor: "pointer",
                            transition: "transform 0.2s",
                            "&:hover": {
                              transform: "scale(1.02)",
                            },
                          }}
                          onClick={() => window.open(selectedRequest.image_urls[0], "_blank")}
                        />
                      </Card>
                    ) : (
                      // Multiple images - display in grid
                      <Grid container spacing={2}>
                        {selectedRequest.image_urls.map((imageUrl: string, index: number) => (
                          <Grid key={index} size={{ xs: 6, sm: 4 }}>
                            <Card sx={{ position: "relative", borderRadius: 1 }}>
                              <CardMedia
                                component="img"
                                height="150"
                                image={imageUrl}
                                alt={`Request image ${index + 1}`}
                                sx={{
                                  objectFit: "cover",
                                  cursor: "pointer",
                                  transition: "transform 0.2s",
                                  "&:hover": {
                                    transform: "scale(1.05)",
                                  },
                                }}
                                onClick={() => window.open(imageUrl, "_blank")}
                              />
                              <Box
                                sx={{
                                  position: "absolute",
                                  bottom: 4,
                                  right: 4,
                                  backgroundColor: alpha(theme.palette.common.black, 0.7),
                                  color: "white",
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                }}
                              >
                                <Typography variant="caption">
                                  {index + 1}/{selectedRequest.image_urls.length}
                                </Typography>
                              </Box>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                    <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                      Click images to view full size
                    </Typography>
                  </Box>
                )}

              {/* Fallback for single image (backward compatibility) */}
              {!selectedRequest.image_urls && selectedRequest.image_url && (
                <Box mt={2} mb={2}>
                  <Typography variant="h6" gutterBottom>
                    Request Image
                  </Typography>
                  <Card sx={{ maxWidth: 400, borderRadius: 2 }}>
                    <CardMedia
                      component="img"
                      height="250"
                      image={selectedRequest.image_url}
                      alt="Service request image"
                      sx={{
                        objectFit: "cover",
                        cursor: "pointer",
                        transition: "transform 0.2s",
                        "&:hover": {
                          transform: "scale(1.02)",
                        },
                      }}
                      onClick={() => window.open(selectedRequest.image_url, "_blank")}
                    />
                  </Card>
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    Click to view full size
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 3, gap: 1, backgroundColor: theme.palette.background.paper }}>
          <Button onClick={handleCloseRequestDetails} variant="outlined" size="large">
            Close
          </Button>
          {selectedRequest && (
            <>
              {getExistingOffer(selectedRequest.request_id || selectedRequest.id) ? (
                <Button variant="contained" color="success" size="large" startIcon={<LocalOfferIcon />} disabled>
                  Offer Already Submitted
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<LocalOfferIcon />}
                  onClick={() => {
                    handleCloseRequestDetails();
                    handleCreateOffer(selectedRequest.request_id || selectedRequest.id);
                  }}
                >
                  Create Offer
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Offer Details Modal */}
      <Dialog
        open={offerDetailsModalOpen}
        onClose={handleCloseOfferDetails}
        maxWidth="md"
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
                bgcolor: theme.palette.secondary.main,
                width: 48,
                height: 48,
              }}
            >
              <LocalOfferIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {selectedOffer?.request_title || `Offer #${selectedOffer?.offer_id}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Offer Details
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseOfferDetails}
            sx={{
              color: theme.palette.text.secondary,
            }}
          >
            <CloseIcon />
          </IconButton>
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
                  bgcolor: alpha(theme.palette.secondary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocalOfferIcon color="secondary" />
                  <Typography variant="h6" fontWeight="bold">
                    Offer Summary
                  </Typography>
                </Box>

                <Typography variant="h5" fontWeight="bold" color="secondary" gutterBottom>
                  {selectedOffer.request_title || `Request #${selectedOffer.request_id}`}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mb={2}>
                  <Chip
                    label={`Your Quote: LKR ${selectedOffer.budget}`}
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
                    label={selectedOffer.status || "pending"}
                    color={
                      selectedOffer.status === "accepted"
                        ? "success"
                        : selectedOffer.status === "rejected"
                        ? "error"
                        : "warning"
                    }
                    variant="filled"
                    sx={getChipStyles(
                      selectedOffer.status === "accepted"
                        ? "success"
                        : selectedOffer.status === "rejected"
                        ? "error"
                        : "warning",
                      "filled"
                    )}
                  />
                  {selectedOffer.customer_budget && (
                    <Chip
                      label={`Customer Budget: LKR ${selectedOffer.customer_budget}`}
                      color="primary"
                      variant="outlined"
                      sx={getChipStyles("primary", "outlined")}
                    />
                  )}
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  Offer ID: {selectedOffer.offer_id} • Request ID: {selectedOffer.request_id}
                </Typography>
              </Paper>

              {/* Additional Details */}
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {/* Submission Date */}
                <Card
                  variant="outlined"
                  sx={{ borderRadius: 2, flex: "1 1 300px", backgroundColor: theme.palette.background.paper }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <CalendarTodayIcon color="warning" />
                      <Typography variant="h6" fontWeight="bold">
                        Submitted On
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight="medium">
                      {new Date(selectedOffer.created_at).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      at{" "}
                      {new Date(selectedOffer.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </CardContent>
                </Card>

                {/* Request Description (if available) */}
                {selectedOffer.request_description && (
                  <Card
                    variant="outlined"
                    sx={{ borderRadius: 2, flex: "1 1 400px", backgroundColor: theme.palette.background.paper }}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <DescriptionIcon color="primary" />
                        <Typography variant="h6" fontWeight="bold">
                          Original Request
                        </Typography>
                      </Box>
                      <Typography variant="body1" lineHeight={1.6}>
                        {selectedOffer.request_description}
                      </Typography>
                    </CardContent>
                  </Card>
                )}

                {/* Location (if available) */}
                {selectedOffer.request_location && (
                  <Card
                    variant="outlined"
                    sx={{ borderRadius: 2, flex: "1 1 300px", backgroundColor: theme.palette.background.paper }}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <LocationOnIcon color="error" />
                        <Typography variant="h6" fontWeight="bold">
                          Service Location
                        </Typography>
                      </Box>
                      <Typography variant="body1" fontWeight="medium">
                        {selectedOffer.request_location}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Where the service will be performed
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 3, gap: 1, backgroundColor: theme.palette.background.paper }}>
          <Button onClick={handleCloseOfferDetails} variant="outlined" size="large">
            Close
          </Button>
          {selectedOffer && selectedOffer.status === "pending" && (
            <>
              <Button
                variant="outlined"
                size="large"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => {
                  handleCloseOfferDetails();
                  handleEditOffer(selectedOffer);
                }}
              >
                Edit Budget
              </Button>
              <Button
                variant="outlined"
                size="large"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => {
                  handleCloseOfferDetails();
                  handleDeleteOffer(selectedOffer.offer_id, selectedOffer);
                }}
              >
                Delete Offer
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Job Rating & Review Details Modal */}
      <Dialog
        open={jobDetailsModalOpen}
        onClose={handleCloseJobDetails}
        maxWidth="md"
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
              <RateReviewIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {selectedJob?.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Customer Rating & Review
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseJobDetails}
            sx={{
              color: theme.palette.text.secondary,
            }}
          >
            <CloseIcon />
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
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <WorkIcon color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    Job Details
                  </Typography>
                </Box>

                <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
                  {selectedJob.title}
                </Typography>

                {selectedJob.description && (
                  <Typography variant="body1" lineHeight={1.6} mb={3}>
                    {selectedJob.description}
                  </Typography>
                )}

                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  <Chip
                    label={`Earned: LKR ${selectedJob.cost}`}
                    color="success"
                    variant="filled"
                    sx={getChipStyles("success", "filled")}
                  />
                  <Chip
                    label={`Consumer: ${selectedJob.consumer_name || "Unknown"}`}
                    color="info"
                    variant="outlined"
                    sx={getChipStyles("info", "outlined")}
                  />
                  <Chip
                    label={`Job ID: ${selectedJob.job_id}`}
                    color="info"
                    variant="outlined"
                    sx={getChipStyles("info", "outlined")}
                  />
                </Stack>
              </Paper>

              {/* Rating Section */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <StarIcon color="warning" />
                  <Typography variant="h6" fontWeight="bold">
                    Customer Rating
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  {renderStarRating(selectedJob.rating)}
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {selectedJob.rating}/5
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary">
                  This rating contributes to your overall provider score and helps other customers make informed
                  decisions.
                </Typography>
              </Paper>

              {/* Review Section */}
              {selectedJob.review && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.info.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <RateReviewIcon color="info" />
                    <Typography variant="h6" fontWeight="bold">
                      Customer Review
                    </Typography>
                  </Box>

                  <Typography
                    variant="body1"
                    lineHeight={1.6}
                    sx={{
                      fontStyle: "italic",
                      fontSize: "1.1rem",
                      p: 2,
                      bgcolor: alpha(theme.palette.info.main, 0.03),
                      borderRadius: 1,
                      borderLeft: `4px solid ${theme.palette.info.main}`,
                    }}
                  >
                    "{selectedJob.review}"
                  </Typography>

                  <Typography variant="body2" color="text.secondary" mt={2}>
                    Review from: {selectedJob.consumer_name || "Customer"}
                  </Typography>
                </Paper>
              )}

              {/* Additional Job Details */}
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {/* Consumer Info */}
                <Card
                  variant="outlined"
                  sx={{ borderRadius: 2, flex: "1 1 300px", backgroundColor: theme.palette.background.paper }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <PersonIcon color="info" />
                      <Typography variant="h6" fontWeight="bold">
                        Consumer
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedJob.consumer_name || "Unknown"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Consumer ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {selectedJob.consumer_id}
                    </Typography>
                  </CardContent>
                </Card>

                {/* Job Completion */}
                <Card
                  variant="outlined"
                  sx={{ borderRadius: 2, flex: "1 1 300px", backgroundColor: theme.palette.background.paper }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <CalendarTodayIcon color="success" />
                      <Typography variant="h6" fontWeight="bold">
                        Job Status
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight="medium" color="success.main">
                      Completed & Rated
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This job has been successfully completed and reviewed by the customer.
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 3, gap: 1, backgroundColor: theme.palette.background.paper }}>
          <Button onClick={handleCloseJobDetails} variant="outlined" size="large">
            Close
          </Button>
          {selectedJob && (
            <Button
              variant="contained"
              size="large"
              startIcon={<ChatIcon />}
              onClick={() => {
                handleCloseJobDetails();
                handleStartChat(selectedJob.consumer_id, selectedJob.consumer_name || "Consumer");
              }}
            >
              Message Consumer
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Offer Confirmation Dialog */}
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
                Delete Offer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This action cannot be undone
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseDeleteDialog} sx={{ color: theme.palette.text.secondary }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 3, backgroundColor: theme.palette.background.paper }}>
          {offerToDelete && (
            <Stack spacing={3}>
              {/* Offer Information */}
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
                  {offerToDelete.request_title || `Request #${offerToDelete.request_id}`}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Your Quote: LKR {offerToDelete.budget}
                </Typography>
                {offerToDelete.timeframe && (
                  <Typography variant="body2" color="text.secondary">
                    Timeframe: {offerToDelete.timeframe}
                  </Typography>
                )}
              </Paper>

              <Typography variant="body2" color="text.secondary">
                Are you sure you want to delete this offer? This action cannot be undone.
              </Typography>
            </Stack>
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 3, gap: 1, backgroundColor: theme.palette.background.paper }}>
          <Button onClick={handleCloseDeleteDialog} variant="outlined" size="large" disabled={deletingOffer}>
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteOffer}
            variant="contained"
            color="error"
            size="large"
            disabled={deletingOffer}
            startIcon={<DeleteIcon />}
          >
            {deletingOffer ? "Deleting..." : "Delete Offer"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProviderHome;
