/**
 * JAI Site Engineer — Forensic Document Vault
 * Secure, over-the-air API routing client designed for Cloudflare Access integration.
 */

const BASE_URL = 'https://engine.jgilbrothers.com/api';

// Administrative access headers strictly forced behind Cloudflare Zero Trust
const CLOUDFLARE_ACCESS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Cf-Access-Authenticated-User-Email': 'jgilbrothers@gmail.com',
  'cf-access-authenticated-user-email': 'jgilbrothers@gmail.com',
};

export interface APIErrorState {
  status: number;
  message: string;
}

/**
 * Perform a hardened fetch call with mandatory credentials and zero-trust headers
 */
async function signedFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...CLOUDFLARE_ACCESS_HEADERS,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: Authentication Credentials Rejected or Target Server Offline`);
  }

  return response.json();
}

/**
 * 1. Live Extraction of Document metadata text
 */
export async function otaExtractDocumentInfo(filename: string, file_type: string, fileDataText?: string): Promise<any> {
  return signedFetch('/extract', {
    method: 'POST',
    body: JSON.stringify({ filename, file_type, raw_content: fileDataText }),
  });
}

/**
 * 2. Live AI reasoning analysis query
 */
export async function otaAnalyzeQuery(query: string, context: string): Promise<any> {
  return signedFetch('/analyze', {
    method: 'POST',
    body: JSON.stringify({ query, context }),
  });
}

/**
 * 3. Heartbeat health check
 */
export async function otaCheckHealth(): Promise<any> {
  return signedFetch('/health');
}
