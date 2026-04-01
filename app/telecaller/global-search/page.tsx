"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Clear results when switching tabs
  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
  };

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        // Here is the magic: We restrict the search to ONLY the selected column
        const searchOptions = {
          limit: 15,
          attributesToSearchOn: searchMode === 'company' ? ['company_name'] : ['pincode'],
        };

        const searchResult = await searchClient.index('companies').search(query, searchOptions);
        setResults(searchResult.hits);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 250);
    return () => clearTimeout(debounceFn);
  }, [query, searchMode]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Telecaller Directory</h1>
      
      {/* Search Mode Toggles */}
      <div className="flex space-x-4 mb-6">
        <button 
          onClick={() => handleModeSwitch('company')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            searchMode === 'company' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Search by Company Name
        </button>
        <button 
          onClick={() => handleModeSwitch('pincode')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            searchMode === 'pincode' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Search by Pincode
        </button>
      </div>

      {/* Search Input */}
      <input
        type="text"
        placeholder={searchMode === 'company' ? "Type company name (e.g., Hanva Technologies)..." : "Type 6-digit Pincode..."}
        className="w-full p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-lg"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isSearching && <p className="text-gray-500 mt-4 animate-pulse">Searching database...</p>}

      {/* Results Display */}
      <div className="mt-6 space-y-4">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between">
              
              {/* Left Side: The Match */}
              <div>
                {searchMode === 'company' ? (
                  <h3 className="text-xl font-bold text-gray-900">{item.company_name}</h3>
                ) : (
                  <h3 className="text-xl font-bold text-gray-900">Pincode: {item.pincode}</h3>
                )}
              </div>

              {/* Right Side: The Context (File Name, City, Category) */}
              <div className="mt-3 md:mt-0 flex flex-col items-start md:items-end text-sm">
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full border border-gray-200 mb-2 font-medium">
                  File: {item.file_name || 'Unknown File'}
                </span>
                
                {searchMode === 'company' ? (
                  <span className="text-blue-600 font-semibold flex items-center gap-1">
                    <span className="text-gray-500 font-normal">Category:</span> {item.category || 'N/A'}
                  </span>
                ) : (
                  <span className="text-green-600 font-semibold flex items-center gap-1">
                    <span className="text-gray-500 font-normal">City:</span> {item.city || 'N/A'}
                  </span>
                )}
              </div>

            </div>
          ))
        ) : (
          query && !isSearching && (
            <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500 text-lg">No results found for "{query}"</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
