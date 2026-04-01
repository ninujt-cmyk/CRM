export const adminClient = () => {
  const host = process.env.NEXT_PUBLIC_MEILISEARCH_HOST;
  const masterKey = process.env.MEILISEARCH_MASTER_KEY;

  if (!host) {
    throw new Error("Missing NEXT_PUBLIC_MEILISEARCH_HOST environment variable");
  }
  if (!masterKey) {
    throw new Error("Missing MEILISEARCH_MASTER_KEY environment variable. Check Vercel settings.");
  }

  return new MeiliSearch({
    host: host,
    apiKey: masterKey,
  });
};
