// 1. THIS IS THE MISSING LINE: You must import MeiliSearch at the top
import { MeiliSearch } from 'meilisearch';

// This client is safe to use in your React frontend (pages)
export const searchClient = new MeiliSearch({
  host: process.env.NEXT_PUBLIC_MEILISEARCH_HOST as string,
  apiKey: process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY as string,
});

// This client is strictly for server-side API routes (uploading/deleting data)
export const adminClient = () => {
  const host = process.env.NEXT_PUBLIC_MEILISEARCH_HOST;
  const masterKey = process.env.MEILISEARCH_MASTER_KEY;

  if (!host) {
    throw new Error("Missing NEXT_PUBLIC_MEILISEARCH_HOST environment variable");
  }
  if (!masterKey) {
    throw new Error("Missing MEILISEARCH_MASTER_KEY environment variable. Check Vercel settings.");
  }

  // The crash happened here because 'MeiliSearch' wasn't imported above
  return new MeiliSearch({
    host: host,
    apiKey: masterKey,
  });
};
