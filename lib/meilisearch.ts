import { MeiliSearch } from 'meilisearch';

// This client is safe to use in your React frontend (pages)
export const searchClient = new MeiliSearch({
  host: process.env.NEXT_PUBLIC_MEILISEARCH_HOST as string,
  apiKey: process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY as string,
});

// This client is strictly for server-side API routes (uploading/deleting data)
export const adminClient = () => {
  return new MeiliSearch({
    host: process.env.NEXT_PUBLIC_MEILISEARCH_HOST as string,
    apiKey: process.env.MEILISEARCH_MASTER_KEY as string,
  });
};
