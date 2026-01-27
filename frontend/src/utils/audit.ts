import axios from './axiosSetup';
import { API_BASE_URL } from '../config/api';

export async function trackEvent(event: string, details?: Record<string, any>) {
  try {
    await axios.post(`${API_BASE_URL}/audit`, { event, details, ts: new Date().toISOString() });
  } catch {
    // non-blocking; ignore network errors
  }
}
