export function getPreviousApiUrl(): string {
  try {
    return localStorage.getItem('eli_tracker_gas_endpoint_url') || '';
  } catch {
    return '';
  }
}
