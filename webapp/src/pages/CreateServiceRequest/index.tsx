import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  MenuItem,
  TextField,
  useTheme,
  IconButton,
  alpha,
  Card,
  CardMedia,
  CircularProgress,
  Grid,
  Chip,
} from "@mui/material";
import { useAppSelector, useAppDispatch } from "@store/hooks";
import { ArrowBack, PhotoCamera, Delete as DeleteIcon, CloudUpload, Add as AddIcon } from "@mui/icons-material";
import apiService from "@utils/apiService";
import CONSTANTS from "@config/constants";
import { setUser } from "@store/userSlice";
import { getEnvVar } from "@utils/envConfig";

const SERVICE_TYPES = [
  { value: "electricity", label: "Electricity", id: 1 },
  { value: "plumbing", label: "Plumbing", id: 2 },
  { value: "carpentry", label: "Carpentry", id: 3 },
  { value: "cleaning", label: "Cleaning", id: 4 },
  { value: "gardening", label: "Gardening", id: 5 },
  { value: "painting", label: "Painting", id: 6 },
  { value: "moving", label: "Moving", id: 7 },
  { value: "locksmith", label: "Locksmith", id: 8 },
  { value: "pest_control", label: "Pest Control", id: 9 },
  { value: "hvac", label: "HVAC", id: 10 },
];

const CreateServiceRequest: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const [serviceType, setServiceType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const user = useAppSelector((state) => state.user);
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState("");

  // Updated for multiple images
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const MAX_IMAGES = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleCancel = () => {
    navigate("/dashboard");
  };

  // Handle multiple image selection
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    // Check if adding these files would exceed the maximum
    if (selectedImages.length + files.length > MAX_IMAGES) {
      setError(`You can only upload a maximum of ${MAX_IMAGES} images`);
      return;
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!validTypes.includes(file.type)) {
        setError(`${file.name} is not a valid image file (JPEG, PNG, WebP)`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} is too large. Maximum size is 5MB`);
        continue;
      }

      validFiles.push(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        newPreviews.push(result);

        // Update previews when all files are processed
        if (newPreviews.length === validFiles.length) {
          setImagePreviews((prev) => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    }

    if (validFiles.length > 0) {
      setSelectedImages((prev) => [...prev, ...validFiles]);
      setError(""); // Clear any previous errors
    }

    // Clear the input value to allow selecting the same files again
    event.target.value = "";
  };

  // Upload multiple images to Cloudinary
  const uploadImagesToCloudinary = async (files: File[]): Promise<string[]> => {
    const uploadPromises = files.map(async (file, index) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", getEnvVar("VITE_CLOUDINARY_UPLOAD_PRESET"));
      formData.append("folder", "handy-requests");

      try {
        console.log(`Uploading file ${index + 1}/${files.length}: ${file.name}`);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${getEnvVar("VITE_CLOUDINARY_CLOUD_NAME")}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error.message || "Cloudinary upload failed");
        }

        const data = await response.json();
        console.log(`Successfully uploaded ${file.name}`);
        return data.secure_url;
      } catch (err: any) {
        console.error(`Error uploading ${file.name}:`, err);
        throw new Error(`Failed to upload ${file.name}: ${err.message}`);
      }
    });

    return Promise.all(uploadPromises);
  };

  // Remove a specific image
  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setError("");
  };

  // Clear all images
  const handleClearAllImages = () => {
    setSelectedImages([]);
    setImagePreviews([]);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let finalImageUrls: string[] = [];

      // Upload images if selected
      if (selectedImages.length > 0) {
        setUploadingImages(true);
        try {
          finalImageUrls = await uploadImagesToCloudinary(selectedImages);
        } catch (uploadError: any) {
          setError(uploadError.message || "Failed to upload images. Please try again.");
          setLoading(false);
          setUploadingImages(false);
          return;
        }
        setUploadingImages(false);
      }

      const data = {
        user_id: user.uid,
        service_id: SERVICE_TYPES.find((type) => type.value === serviceType)?.id,
        title,
        description,
        location: user.location || location,
        budget,
        timeframe,
        status: CONSTANTS.REQUEST_STATUS.PENDING,
        created_at: new Date().toISOString(),
        image_urls: finalImageUrls.length > 0 ? finalImageUrls : null, // Changed to array
      };

      const response = await apiService.post("/requests/createRequest", data);

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

      setSuccess("Request created successfully!");

      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create service request");
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        paddingTop: "80px",
        paddingBottom: 3,
        paddingX: 3,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Paper
        sx={{
          p: 4,
          minWidth: 400,
          maxWidth: 700,
          width: "100%",
          borderRadius: 2,
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          backgroundColor: theme.palette.background.paper,
          my: 2,
        }}
      >
        {/* Header with back button */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton
            onClick={handleCancel}
            sx={{
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            <ArrowBack color="primary" />
          </IconButton>
          <Typography variant="h5" fontWeight="bold">
            Create Service Request
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <TextField
            select
            label="Service Type"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            fullWidth
            required
            margin="normal"
            helperText="Select the type of service you need"
          >
            {SERVICE_TYPES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Service Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            margin="normal"
            placeholder="e.g., Fix kitchen sink plumbing"
            helperText="Provide a clear, descriptive title for your service request"
          />

          <TextField
            label="Service Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            required
            margin="normal"
            multiline
            minRows={3}
            placeholder="Describe the service you need in detail..."
            helperText="Include as much detail as possible to help providers understand your needs"
          />

          <TextField
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            fullWidth
            required
            margin="normal"
            placeholder="e.g., No 123, Main Street, Colombo"
            helperText="Where will the service be performed?"
          />

          <TextField
            label="Budget (LKR)"
            type="number"
            value={budget || ""}
            onChange={(e) => setBudget(Number(e.target.value))}
            fullWidth
            required
            margin="normal"
            placeholder="Enter your budget in LKR"
            helperText="What's your budget for this service?"
            inputProps={{ min: 1, step: 0.01 }}
          />

          <TextField
            label="Expected Timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            fullWidth
            required
            margin="normal"
            placeholder="e.g., Within 1 week, ASAP, Next month"
            helperText="When do you need this service completed?"
          />

          {/* Multiple Images Upload Section */}
          <Box mt={3} mb={2}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Add Images (Optional)</Typography>
              {selectedImages.length > 0 && (
                <Chip
                  label={`${selectedImages.length}/${MAX_IMAGES} images`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Upload up to {MAX_IMAGES} images to help providers understand your request better
            </Typography>

            {/* Upload Button */}
            <Box mb={2}>
              <input
                accept="image/*"
                style={{ display: "none" }}
                id="image-upload"
                type="file"
                multiple
                onChange={handleImageSelect}
                disabled={selectedImages.length >= MAX_IMAGES}
              />
              <label htmlFor="image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={selectedImages.length === 0 ? <PhotoCamera /> : <AddIcon />}
                  disabled={selectedImages.length >= MAX_IMAGES}
                  sx={{
                    borderStyle: "dashed",
                    borderWidth: 2,
                    p: 2,
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                >
                  {selectedImages.length === 0 ? "Select Images" : "Add More Images"}
                </Button>
              </label>
              {selectedImages.length >= MAX_IMAGES && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Maximum number of images reached
                </Typography>
              )}
            </Box>

            {/* Image Previews Grid */}
            {imagePreviews.length > 0 && (
              <Box>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="subtitle2">Selected Images:</Typography>
                  <Button size="small" color="error" onClick={handleClearAllImages} startIcon={<DeleteIcon />}>
                    Clear All
                  </Button>
                </Box>
                <Grid container spacing={2}>
                  {imagePreviews.map((preview, index) => (
                    <Grid key={index} size={{ xs: 6, sm: 4, md: 3 }}>
                      <Card sx={{ position: "relative", borderRadius: 1 }}>
                        <CardMedia
                          component="img"
                          height="120"
                          image={preview}
                          alt={`Preview ${index + 1}`}
                          sx={{ objectFit: "cover" }}
                        />
                        <IconButton
                          onClick={() => handleRemoveImage(index)}
                          sx={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            backgroundColor: alpha(theme.palette.error.main, 0.8),
                            color: "white",
                            width: 24,
                            height: 24,
                            "&:hover": {
                              backgroundColor: theme.palette.error.main,
                            },
                          }}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: alpha(theme.palette.common.black, 0.7),
                            color: "white",
                            p: 0.5,
                          }}
                        >
                          <Typography variant="caption" noWrap>
                            {selectedImages[index]?.name}
                          </Typography>
                        </Box>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Total size:{" "}
                  {(selectedImages.reduce((total, file) => total + file.size, 0) / (1024 * 1024)).toFixed(2)} MB
                </Typography>
              </Box>
            )}
          </Box>

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

          {success && (
            <Box
              mt={2}
              p={1.5}
              sx={{
                backgroundColor: alpha(theme.palette.success.main, 0.1),
                borderRadius: 1,
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
              }}
            >
              <Typography color="success.main" variant="body2">
                {success}
              </Typography>
            </Box>
          )}

          <Box mt={3} display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleCancel}
              disabled={loading || uploadingImages}
              sx={{ minWidth: 100 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || uploadingImages}
              startIcon={
                uploadingImages ? (
                  <CircularProgress size={16} color="inherit" />
                ) : loading ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CloudUpload />
                )
              }
              sx={{ minWidth: 140 }}
            >
              {uploadingImages ? "Uploading..." : loading ? "Creating..." : "Create Request"}
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
            <strong>Tips for a great service request:</strong>
            <br />
            • Be specific about what you need
            <br />
            • Include multiple images from different angles
            <br />
            • Show the problem area clearly
            <br />
            • Set a realistic budget and timeframe
            <br />
            • Provide clear location details
            <br />• You can chat with providers after they submit offers
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateServiceRequest;
