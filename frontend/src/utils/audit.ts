import axios from './axiosSetup';

const API_BASE_URL = '/api';

export async function trackEvent(event: string, details?: Record<string, any>) {
  try {
    await axios.post(`${API_BASE_URL}/audit`, { event, details, ts: new Date().toISOString() });
  } catch {
    // non-blocking; ignore network errors
  }
}
