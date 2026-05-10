import { API_BASE_URL } from '../config/env';

export type DeviceApprovalStatusResponse = {
  requestToken: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | string;
  deviceName?: string;
  expiresAt?: string;
  message?: string;
};

export async function fetchDeviceApprovalStatus(
  requestToken: string
): Promise<DeviceApprovalStatusResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/auth/device-approvals/${encodeURIComponent(
      requestToken
    )}/status`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const json = await response.json().catch(() => null);
  return json?.responseObject ?? json;
}
