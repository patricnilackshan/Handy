import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
} from "@mui/material";
import { useAppSelector, useAppDispatch } from "@store/hooks";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import apiService from "@utils/apiService";
import { setUser } from "@store/userSlice";
import { getEnvVar } from "@utils/envConfig";

// Initialize Stripe
const stripePromise = loadStripe(getEnvVar("VITE_STRIPE_PUBLISHABLE_KEY"));

interface PaymentFormProps {
  tokens: number;
  quantity: number;
  totalPrice: number;
  unitPrice: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ tokens, quantity, totalPrice, unitPrice, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const user = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError("Payment system not loaded");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // Create payment intent
      const paymentIntentResponse = await apiService.post("/payment/createPaymentIntent", {
        tokens,
        quantity,
        userType: user.userType,
        user_id: user.uid,
        unitPrice,
      });

      const { clientSecret, paymentIntentId } = paymentIntentResponse.data;

      // Confirm payment
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError("Card element not found");
        setProcessing(false);
        return;
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: user.name,
          },
        },
      });

      if (stripeError) {
        setError(stripeError.message || "Payment failed");
        setProcessing(false);
        return;
      }

      // Confirm payment on backend
      if (paymentIntent.status === "succeeded") {
        const confirmResponse = await apiService.post(`/payment/confirmPayment/${paymentIntentId}`);

        // Update user tokens in Redux store
        dispatch(
          setUser({
            uid: user.uid!,
            name: user.name,
            avatarUrl: user.avatarUrl,
            userType: user.userType,
            location: user.location,
            services_array: user.services_array,
            platform_tokens: confirmResponse.data.platform_tokens,
          })
        );

        onSuccess();
      } else {
        setError("Payment was not completed");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      setError(error.response?.data?.message || "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Payment Details
        </Typography>
        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <Chip label={`${tokens * quantity} tokens`} color="primary" />
          <Chip label={`${totalPrice.toLocaleString()} LKR`} color="success" />
          <Chip label={user.userType || "user"} color="info" />
        </Box>
      </Box>

      <Box mb={3} p={2} border="1px solid #ccc" borderRadius={1}>
        <Typography variant="body2" color="text.secondary" mb={1}>
          Card Information
        </Typography>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": {
                  color: "#aab7c4",
                },
              },
            },
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" gap={2} justifyContent="flex-end">
        <Button variant="outlined" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!stripe || processing}
          startIcon={processing ? <CircularProgress size={20} /> : null}
        >
          {processing ? "Processing..." : `Pay ${totalPrice.toLocaleString()} LKR`}
        </Button>
      </Box>
    </Box>
  );
};

export default function TokenPurchase() {
  const user = useAppSelector((state) => state.user);
  const navigate = useNavigate();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{
    tokens: number;
    price: number;
    quantity: number;
  } | null>(null);
  const [success, setSuccess] = useState(false);

  if (!user?.userType) return <Typography>Loading…</Typography>;

  const pricing = {
    consumer: [
      { tokens: 1, price: 100 },
      { tokens: 20, price: 1800 },
      { tokens: 50, price: 4000 },
    ],
    provider: [
      { tokens: 1, price: 150 },
      { tokens: 20, price: 2800 },
      { tokens: 50, price: 6500 },
    ],
  };

  const packages = user.userType === "provider" ? pricing.provider : pricing.consumer;

  const [quantities, setQuantities] = useState<number[]>(Array(packages.length).fill(1));

  const handleQuantityChange = (index: number, value: string) => {
    const num = parseInt(value, 10);
    const updated = [...quantities];
    updated[index] = isNaN(num) || num <= 0 ? 1 : num;
    setQuantities(updated);
  };

  const handlePurchase = (tokens: number, price: number, quantity: number) => {
    setSelectedPackage({ tokens, price, quantity });
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    setSuccess(true);
    setTimeout(() => {
      navigate("/dashboard");
    }, 2000);
  };

  const handlePaymentCancel = () => {
    setPaymentModalOpen(false);
    setSelectedPackage(null);
  };

  if (success) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="70vh" gap={2}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Payment successful! Your tokens have been added to your account.
        </Alert>
        <Typography variant="body1">Redirecting to dashboard...</Typography>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: { xs: 7, sm: 8 }, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Buy Platform Tokens
      </Typography>

      <Box mb={3}>
        <Typography variant="body1" color="text.secondary">
          Current Balance: {user.platform_tokens || 0} tokens
        </Typography>
      </Box>

      <Grid container spacing={3} mt={2}>
        {packages.map(({ tokens, price }, index) => (
          <Grid key={tokens} size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper elevation={3} sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="h6" gutterBottom>
                {tokens} Token{tokens > 1 ? "s Package" : ""}
              </Typography>
              <Typography variant="body1" gutterBottom>
                Unit Price: {price.toLocaleString()} LKR
              </Typography>

              <TextField
                type="number"
                inputProps={{ min: 1 }}
                label="Quantity"
                variant="outlined"
                size="small"
                value={quantities[index]}
                onChange={(e) => handleQuantityChange(index, e.target.value)}
                sx={{ mt: 1, width: "80px" }}
              />

              <Typography variant="body2" sx={{ mt: 1 }}>
                Total: {(price * quantities[index]).toLocaleString()} LKR
              </Typography>

              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => handlePurchase(tokens, price, quantities[index])}
              >
                Buy {quantities[index] * tokens} Tokens
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onClose={handlePaymentCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Your Purchase</DialogTitle>
        <DialogContent>
          {selectedPackage && (
            <Elements stripe={stripePromise}>
              <PaymentForm
                tokens={selectedPackage.tokens}
                quantity={selectedPackage.quantity}
                totalPrice={selectedPackage.price * selectedPackage.quantity}
                unitPrice={selectedPackage.price} // Pass unitPrice to PaymentForm
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
