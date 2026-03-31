"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      try {
        const searchResult = await searchClient.index('companies').search(query, { limit: 10 });
        setResults(searchResult.hits);
      } catch (error) {
        console.error('Search error:', error);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 200);
    return () => clearTimeout(debounceFn);
  }, [query]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Global Company Search</h1>
      <input
        type="text"
        placeholder="Enter company name or pincode..."
        className="w-full max-w-2xl p-4 border rounded-lg shadow-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      
      <div className="mt-6 max-w-2xl space-y-3">
        {results.map((company) => (
          <div key={company.id} className="p-4 border rounded bg-white shadow-sm">
            <h3 className="font-semibold text-lg">{company.company_name}</h3>
            <p className="text-gray-600">Pincode: {company.pincode}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
