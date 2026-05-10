const BASE_URL = 'https://api.hopenity.com';

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
    `${BASE_URL}/api/v1/auth/device-approvals/${encodeURIComponent(
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
