const DEFAULT_TIMEOUT_MS = 8000;

export async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetchOptions = { ...options };
  delete fetchOptions.timeoutMs;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...fetchOptions.headers
      }
    });

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("L’API a renvoyé un JSON invalide.");
    }

    if (!response.ok) {
      const error = new Error(
        payload && (payload.error || payload.message)
          ? payload.error || payload.message
          : `L’API a répondu avec le statut ${response.status}.`
      );
      error.status = response.status;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    return cached && cached.data && Number.isFinite(cached.savedAt)
      ? cached
      : null;
  } catch (error) {
    console.warn(`Lecture du cache ${key} impossible.`, error);
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (error) {
    console.warn(`Écriture du cache ${key} impossible.`, error);
  }
}

export async function fetchCached(key, maxAgeMs, load, shouldCache = () => true) {
  const cached = readCache(key);
  if (cached && Date.now() - cached.savedAt < maxAgeMs) {
    return { ...cached.data, cache: "session" };
  }

  try {
    const data = await load();
    if (shouldCache(data)) writeCache(key, data);
    return data;
  } catch (error) {
    if (!cached) throw error;
    console.warn(`API ${key} indisponible ; utilisation du cache de session.`, error);
    return { ...cached.data, cache: "stale-session" };
  }
}
