import { fetchServerApi, resolveApiUrls } from './apiBaseUrl';

export async function fetchPublicApiJson<T>(
  path: string,
  errorLabel = 'Content',
  timeoutMs = 10000
): Promise<T> {
  const endpoints = resolveApiUrls(path);
  if (!endpoints.length) {
    throw new Error(`Could not resolve the ${errorLabel.toLowerCase()} endpoint.`);
  }

  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetchServerApi(
        endpoint,
        { headers: { Accept: 'application/json' } },
        timeoutMs
      );
      const data = (await response.json().catch(() => null)) as
        | (T & { error?: string })
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? `${errorLabel} request failed (${response.status}).`);
      }
      if (!data) throw new Error(`${errorLabel} returned an invalid response.`);
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`${errorLabel} request failed.`);
    }
  }

  throw lastError ?? new Error(`${errorLabel} request failed.`);
}
