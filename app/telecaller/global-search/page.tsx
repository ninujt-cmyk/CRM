"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

// Define the shape of your new data
interface CompanyData {
  id: string | number;
  company_name: string;
  pincode: string;
  bank_name: string;
  category: string;
  city_name: string;
}

export default function TelecallerSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CompanyData[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        const searchResult = await searchClient.index('companies').search(query, { 
          limit: 15 // Fetch top 15 results
        });
        setResults(searchResult.hits as CompanyData[]);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 200);
    return () => clearTimeout(debounceFn);
  }, [query]);

  // Simple logic to check if the user is typing a pincode (only numbers)
  const isPincodeSearch = /^\d+$/.test(query.trim());

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Global Search</h1>
        
        {/* Search Bar */}
        <div className="relative mb-8">
          <input
            type="text"
            placeholder="Search by Company Name or Pincode..."
            className="w-full p-5 pl-12 text-lg border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {/* A simple search icon placeholder */}
          <span className="absolute left-4 top-5 text-gray-400 text-xl">🔍</span>
        </div>

        {isSearching && <p className="text-gray-500 mb-4 animate-pulse">Searching...</p>}

        {/* Results Container */}
        <div className="space-y-3">
          {results.length > 0 ? (
            results.map((item) => (
              <div 
                key={item.id} 
                className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
              >
                {/* CONDITIONAL RENDER: Pincode vs Company Name */}
                {isPincodeSearch ? (
                  <>
                    {/* View for Pincode Search */}
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">Pincode Match</div>
                      <h3 className="font-bold text-xl text-gray-800">{item.pincode}</h3>
                    </div>
                    <div className="flex-1 border-l pl-6 border-gray-100">
                      <div className="text-sm text-gray-500">City</div>
                      <div className="font-medium text-gray-700">{item.city_name || 'N/A'}</div>
                    </div>
                    <div className="flex-1 border-l pl-6 border-gray-100">
                      <div className="text-sm text-gray-500">Bank Name</div>
                      <div className="font-medium text-blue-600">{item.bank_name || 'N/A'}</div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* View for Company Search */}
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-1">Company</div>
                      <h3 className="font-bold text-lg text-gray-800">{item.company_name}</h3>
                    </div>
                    <div className="flex-1 border-l pl-6 border-gray-100">
                      <div className="text-sm text-gray-500">Bank Name</div>
                      <div className="font-medium text-blue-600">{item.bank_name || 'N/A'}</div>
                    </div>
                    <div className="flex-1 border-l pl-6 border-gray-100">
                      <div className="text-sm text-gray-500">Category</div>
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium mt-1">
                        {item.category || 'N/A'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            query && !isSearching && (
              <div className="p-8 text-center bg-white border border-gray-200 rounded-xl">
                <p className="text-gray-500 text-lg">No records found for "{query}"</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
