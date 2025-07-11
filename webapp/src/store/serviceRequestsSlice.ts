import apiService from '@utils/apiService';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Redux slice for service requests.
 * Handles fetching, selecting, and error state for service requests.
 */
interface ServiceRequestsState {
  items: any[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  selectedRequestId: string | null;
}

const initialState: ServiceRequestsState = {
  items: [],
  status: 'idle',
  error: null,
  selectedRequestId: null,
};

// Thunks for fetching service requests
export const fetchServiceRequests = createAsyncThunk(
  'serviceRequests/fetchServiceRequests',
  async () => {
    const response = await apiService.get('/requests/getActiveRequests');
    return response.data;
  }
);

export const fetchServiceRequestsForConsumer = createAsyncThunk(
  'serviceRequests/fetchServiceRequestsForConsumer',
  async (consumerId: string) => {
    const response = await apiService.get(`/requests/getActiveRequestsForConsumer/${consumerId}`);
    return response.data;
  }
);

export const fetchServiceRequestsBasedOnService = createAsyncThunk(
  'serviceRequests/fetchServiceRequestsBasedOnService',
  async (providerId: string) => {
    const response = await apiService.get(`/requests/getActiveRequestsForProvider/${providerId}`);
    return response.data;
  }
);

const serviceRequestsSlice = createSlice({
  name: 'serviceRequests',
  initialState,
  reducers: {
    /**
     * Set the currently selected service request ID.
     */
    setSelectedRequestId(state, action) {
      state.selectedRequestId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServiceRequestsForConsumer.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchServiceRequestsForConsumer.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchServiceRequestsForConsumer.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Failed to fetch Service Requests!';
      })
      .addCase(fetchServiceRequestsBasedOnService.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchServiceRequestsBasedOnService.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchServiceRequestsBasedOnService.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Failed to fetch Service Requests!';
      });
  },
});

export const { setSelectedRequestId } = serviceRequestsSlice.actions;
export default serviceRequestsSlice.reducer;
