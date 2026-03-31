import { useState, useEffect } from 'react';
import { MeiliSearch } from 'meilisearch';

// Initialize the client outside the component so it doesn't recreate on every render
const client = new MeiliSearch({
  host: 'https://hanva-search.onrender.com',
  apiKey: 'https://api.render.com/deploy/srv-d75qkt24d50c73cl9c00?key=pRI677ZxcXo', 
});

export default function CompanySearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      if (query.trim() === '') {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Search the 'companies' index
        const searchResult = await client.index('companies').search(query, {
          limit: 10, // Only fetch top 10 results to keep it fast
        });
        setResults(searchResult.hits);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    };

    // Simple debounce: wait 200ms after user stops typing to search
    const delayDebounceFn = setTimeout(() => {
      performSearch();
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Instant Company Search</h2>
      
      <input
        type="text"
        placeholder="Search by company name or pincode..."
        className="w-full p-3 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isSearching && <p className="text-sm text-gray-500 mt-2">Searching...</p>}

      <div className="mt-4">
        {results.length > 0 ? (
          <ul className="border rounded divide-y">
            {results.map((company) => (
              <li key={company.id} className="p-3 hover:bg-gray-50">
                <div className="font-semibold">{company.company_name}</div>
                <div className="text-sm text-gray-600">Pincode: {company.pincode}</div>
              </li>
            ))}
          </ul>
        ) : (
          query && !isSearching && <p className="text-gray-500">No companies found.</p>
        )}
      </div>
    </div>
  );
}
