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
      <div className="mt-6 space-y-6">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className="p-6 border border-gray-200 rounded-xl bg-white shadow-md hover:shadow-lg transition-shadow flex flex-col relative overflow-hidden">
              
              {/* Highlight strip at the top for visual pop */}
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>
              
              {/* CENTERED, BIG FILE NAME (Extension & label removed) */}
              <div className="flex justify-center w-full mb-6 mt-4">
                <div className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xl md:text-2xl font-black px-8 py-3 rounded-lg text-center tracking-wide shadow-sm">
                  {item.file_name ? item.file_name.replace(/\.[^/.]+$/, "") : 'UNKNOWN FILE'}
                </div>
              </div>

              {/* Bottom Section: Company/Pincode and Category/City */}
              <div className="flex flex-col md:flex-row items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
                
                {/* Left Side: The Match */}
                <div className="text-center md:text-left mb-3 md:mb-0">
                  {searchMode === 'company' ? (
                    <h3 className="text-xl font-bold text-gray-900">{item.company_name}</h3>
                  ) : (
                    <h3 className="text-xl font-bold text-gray-900">Pincode: {item.pincode}</h3>
                  )}
                </div>

                {/* Right Side: The Context */}
                <div className="text-lg">
                  {searchMode === 'company' ? (
                    <span className="text-blue-700 font-semibold flex items-center gap-2">
                      <span className="text-gray-500 font-normal text-sm uppercase tracking-wider">Category:</span> 
                      {item.category || 'N/A'}
                    </span>
                  ) : (
                    <span className="text-green-700 font-semibold flex items-center gap-2">
                      <span className="text-gray-500 font-normal text-sm uppercase tracking-wider">City:</span> 
                      {item.city || 'N/A'}
                    </span>
                  )}
                </div>

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
