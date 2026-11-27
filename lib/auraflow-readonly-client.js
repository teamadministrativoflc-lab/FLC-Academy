// AuraFlow / LeadConnector read-only server client — PREPARATION ONLY.
//
// This module is not imported from browser code and exposes no HTTP route.
// Never commit the token or call this code from a publicly accessible endpoint
// without verifying a privileged, authenticated server identity.
// Its first operation is a safe GET, not an update or CRM write.

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

function validateContactId(contactId) {
  if (typeof contactId !== 'string' || !/^[a-zA-Z0-9]{20}$/.test(contactId)) {
    throw new Error('Invalid AuraFlow native contact ID');
  }
  return contactId;
}

export async function getAuraFlowContactReadOnly(contactId, { signal } = {}) {
  const id = validateContactId(contactId);
  const token = process.env.AURAFLOW_API_TOKEN;
  if (!token || !token.startsWith('pit-')) {
    throw new Error('AuraFlow server credential is not configured');
  }
  // Only GET is permitted here. This function performs no contact updates.
  const response = await fetch(`${BASE_URL}/contacts/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: API_VERSION,
      Accept: 'application/json',
    },
    signal,
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok) {
    // Never include token, request headers, body, or contact PII in logs.
    throw new Error(`AuraFlow contact lookup failed (HTTP ${response.status})`);
  }
  const data = await response.json();
  if (!data || data.contact?.id !== id) {
    throw new Error('AuraFlow contact response did not match the requested ID');
  }
  return data.contact;
}
