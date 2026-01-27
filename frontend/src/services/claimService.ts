import axios from '../utils/axiosSetup';
import { SearchFilters, PaginatedClaimsResponse, VisitClaim, HistoryFilters } from '../types/claim';
import { API_BASE_URL } from '../config/api';

// Helper to get the auth token from localStorage
const getAuthToken = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No auth token found in localStorage');
    return '';
  }
  return `Bearer ${token}`;
};

export const fetchClaims = async (
  filters: Omit<SearchFilters, 'page' | 'limit'>,
  pageInput?: number,
  limitInput?: number
): Promise<PaginatedClaimsResponse> => {  try {
    const params = new URLSearchParams();
    // Correctly map frontend filter fields to backend parameter names
    if (filters.patientId) params.append('patient_id', filters.patientId);
    if (filters.billingId) params.append('billingId', filters.billingId); 
    if (filters.dos) params.append('dos', filters.dos); 
    if (filters.firstName) params.append('first_name', filters.firstName);
    if (filters.lastName) params.append('last_name', filters.lastName);
    if (filters.payerName) params.append('prim_ins', filters.payerName);
    if (filters.dateOfBirth) params.append('date_of_birth', filters.dateOfBirth);
    if (filters.cptCode) params.append('cpt_code', filters.cptCode);
    if (filters.clinicName) params.append('clinic_name', filters.clinicName);
    if (filters.providerName) params.append('provider_name', filters.providerName);

    // Use the explicit page and limit arguments for pagination
    if (pageInput) params.append('page', pageInput.toString());
    if (limitInput) params.append('limit', limitInput.toString());    

    const authToken = getAuthToken();

    const response = await axios.get(`${API_BASE_URL}/claims`, {
      headers: { 
        Authorization: authToken,
        'Content-Type': 'application/json'
      },
      params
    });

    if (response.data && typeof response.data.totalCount === 'number') {
      return {
        success: true,
        data: response.data.data,
        totalCount: response.data.totalCount,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages,
      };
    } else {
      // Handle cases where the response is not as expected (e.g., from a non-paginated endpoint or error)
      // For now, assuming if it's an array, it's a non-paginated full list (though backend should be consistent)
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
          totalCount: response.data.length,
          page: 1,
          limit: limitInput || (response.data.length > 0 ? response.data.length : 10),
          totalPages: 1,
        };
      }
      console.error('Unexpected response structure from /api/claims:', response.data);
      return {
        success: false,
        message: 'Unexpected response structure',
        data: [],
        totalCount: 0,
        page: 1,
        limit: limitInput || 10,
        totalPages: 0,
        error: 'Unexpected response structure'
      };
    }
  } catch (error: any) {
    console.error('Error fetching claims:', error);
    let errorMessage = 'Failed to fetch claims';
    
    // Check for specific authentication errors
    if (error.response && error.response.status === 401) {
      errorMessage = 'Authentication required. Please log in.';
      // Force redirect to login page by clearing token
      localStorage.removeItem('token');
      console.error('Failed to fetch claims: ' + errorMessage, error);
    } else if (error.response && error.response.data && error.response.data.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      message: errorMessage,
      data: [],
      totalCount: 0,
      page: pageInput || 1,
      limit: limitInput || 10,
      totalPages: 0,
      error: errorMessage
    };  }
};

export const fetchClaimById = async (id: string): Promise<any> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/claims/${id}`, {
      headers: { Authorization: getAuthToken() }
    });
    // If backend returns { success, data }, return only the data
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    // Fallback: if backend returns the claim directly
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching claim by ID ${id}:`, error);
    return null;
  }
};

export const updateClaim = async (id: string, updatedData: Partial<VisitClaim>, retries = 0): Promise<{ success: boolean; data?: VisitClaim; message?: string; error?: any }> => {
  try {
    const response = await axios.put(`${API_BASE_URL}/claims/${id}`, updatedData, {
      headers: { Authorization: getAuthToken() }
    });
    return { success: true, data: response.data.data }; // Assuming backend wraps updated claim in a 'data' object
  } catch (error: any) {
    console.error(`Error updating claim ${id}:`, error);
    return { success: false, message: error.response?.data?.message || error.message || 'Failed to update claim', error: error.response?.data?.error || error.message };
  }
};

// Add other service functions as needed, e.g., for fetching history, user management, etc.

export const fetchAllHistory = async (filters: HistoryFilters): Promise<PaginatedClaimsResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters.user_name) params.append('username', filters.user_name); // Ensure this matches backend query param
    if (filters.cpt_id) params.append('cpt_id', filters.cpt_id.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await axios.get(`${API_BASE_URL}/history/all`, { // Assuming /history/all is the correct endpoint
      headers: { Authorization: getAuthToken() },
      params
    });

    // Ensure the response structure matches PaginatedHistoryResponse
    if (response.data && Array.isArray(response.data.data) && typeof response.data.totalCount === 'number') {
      return {
        success: true,
        data: response.data.data,
        totalCount: response.data.totalCount,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages,
      };
    } else {
      console.error('Unexpected response structure from /api/history/all:', response.data);
      return {
        success: false,
        message: 'Unexpected response structure',
        data: [],
        totalCount: 0,
        page: filters.page || 1,
        limit: filters.limit || 10,
        totalPages: 0,
      };
    }
  } catch (error: any) {
    console.error('Error fetching all history:', error);
    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch history';
    return {
      success: false,
      message: errorMessage,
      data: [],
      totalCount: 0,
      page: filters.page || 1,
      limit: filters.limit || 10,
      totalPages: 0,
    };
  }
};

export const fetchClaimHistory = async (claimId: string, page: number = 1, limit: number = 10) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/claims/${claimId}/history`, {
      headers: { Authorization: getAuthToken() },
      params: { page, limit }
    });
    return response.data; // Expects a paginated response: { data: [], totalCount, page, limit, totalPages }
  } catch (error: any) {
    console.error(`Error fetching history for claim ${claimId}:`, error);
    throw error; // Re-throw to be handled by the calling component/context
  }
};