"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- NEW: Contextual Verification State ---
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [pinQuery, setPinQuery] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');
  const [pinResultData, setPinResultData] = useState<any>(null);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setVerifyingId(null); // Reset verification on tab switch
  };

  // 1. The Main Search Effect
  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const searchOptions = {
          limit: 15,
          attributesToSearchOn: searchMode === 'company' ? ['company_name'] : ['pincode'],
        };

        const searchResult = await searchClient.index('companies').search(query, searchOptions);
        
        let validHits = searchResult.hits;
        if (searchMode === 'pincode') {
          validHits = validHits.filter((item) => String(item.pincode) === query.trim());
        }

        setResults(validHits);
        setSuggestions([]); 

        // Smart Intelligence for main pincode tab
        if (searchMode === 'pincode' && validHits.length === 0 && query.length >= 4) {
          const prefix = query.length === 6 ? query.substring(0, 4) : query.substring(0, 3);
          const suggestionResult = await searchClient.index('companies').search(prefix, {
            limit: 6,
            attributesToSearchOn: ['pincode'],
          });
          setSuggestions(suggestionResult.hits);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 250);
    return () => clearTimeout(debounceFn);
  }, [query, searchMode]);

  // 2. The NEW Inline Pincode Verification Effect
  useEffect(() => {
    const verifyInlinePincode = async () => {
      if (pinQuery.length !== 6) {
        setPinStatus('idle');
        setPinResultData(null);
        return;
      }

      setPinStatus('loading');
      try {
        const result = await searchClient.index('companies').search(pinQuery, {
          limit: 5,
          attributesToSearchOn: ['pincode'],
        });

        // Strict exact match filter
        const exactMatch = result.hits.find((item) => String(item.pincode) === pinQuery);

        if (exactMatch) {
          setPinResultData(exactMatch);
          setPinStatus('found');
        } else {
          setPinStatus('missing');
        }
      } catch (error) {
        console.error('Inline verification failed:', error);
        setPinStatus('missing');
      }
    };

    verifyInlinePincode();
  }, [pinQuery]);

  // Function to open the verification panel inside a company card
  const openVerification = (id: string) => {
    if (verifyingId === id) {
      setVerifyingId(null); // Toggle off if already open
    } else {
      setVerifyingId(id);
      setPinQuery(''); // Clear previous inputs
      setPinStatus('idle');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Telecaller Directory</h1>
      
      <div className="flex space-x-4 mb-6">
        <button onClick={() => handleModeSwitch('company')} className={`px-6 py-2 rounded-lg font-medium transition-colors ${searchMode === 'company' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
          Search by Company Name
        </button>
        <button onClick={() => handleModeSwitch('pincode')} className={`px-6 py-2 rounded-lg font-medium transition-colors ${searchMode === 'pincode' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
          Search by Pincode
        </button>
      </div>

      <input
        type="text"
        placeholder={searchMode === 'company' ? "Type company name (e.g., HCL)..." : "Type 6-digit Pincode..."}
        className="w-full p-4 border-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-lg"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isSearching && <p className="text-gray-500 mt-4 animate-pulse">Searching database...</p>}

      <div className="mt-6 space-y-6">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className={`border border-gray-200 rounded-xl bg-white shadow-md transition-all flex flex-col relative overflow-hidden ${verifyingId === item.id ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'}`}>
              
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>
              
              <div className="p-6 pb-4">
                <div className="flex justify-center w-full mb-4 mt-2">
                  <div className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-lg md:text-xl font-black px-6 py-2 rounded-lg text-center tracking-wide shadow-sm">
                    {item.file_name ? item.file_name.replace(/\.[^/.]+$/, "") : 'UNKNOWN FILE'}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="text-center md:text-left mb-3 md:mb-0">
                    {searchMode === 'company' ? (
                      <h3 className="text-xl font-bold text-gray-900">{item.company_name}</h3>
                    ) : (
                      <h3 className="text-xl font-bold text-gray-900">Pincode: {item.pincode}</h3>
                    )}
                  </div>

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

              {/* --- NEW: INTELLIGENT TWO-STEP VERIFICATION --- */}
              {searchMode === 'company' && (
                <div className="border-t border-gray-100 bg-gray-50">
                  <button 
                    onClick={() => openVerification(item.id)}
                    className="w-full py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {verifyingId === item.id ? 'Close Verification ✕' : 'Verify Customer Pincode 📍'}
                  </button>

                  {/* Inline Pincode Checker panel */}
                  {verifyingId === item.id && (
                    <div className="p-6 bg-blue-50/50 border-t border-blue-100">
                      <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                        Is this location serviceable?
                      </p>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit Pincode..."
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-inner focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-lg"
                        value={pinQuery}
                        onChange={(e) => setPinQuery(e.target.value.replace(/[^0-9]/g, ''))}
                        autoFocus
                      />

                      {/* Live Status Indicators */}
                      <div className="mt-4 h-12 flex items-center">
                        {pinStatus === 'idle' && pinQuery.length > 0 && pinQuery.length < 6 && (
                          <p className="text-gray-500 text-sm">Keep typing...</p>
                        )}
                        {pinStatus === 'loading' && (
                          <p className="text-blue-500 text-sm animate-pulse font-medium">Checking database...</p>
                        )}
                        {pinStatus === 'found' && pinResultData && (
                          <div className="w-full bg-green-100 border border-green-300 p-3 rounded-lg flex items-center justify-between shadow-sm">
                            <span className="text-green-800 font-bold flex items-center gap-2">
                              ✅ Approved
                            </span>
                            <span className="text-green-700 font-medium text-sm">
                              City: {pinResultData.city}
                            </span>
                          </div>
                        )}
                        {pinStatus === 'missing' && (
                          <div className="w-full bg-red-100 border border-red-300 p-3 rounded-lg shadow-sm">
                            <span className="text-red-800 font-bold flex items-center gap-2">
                              ❌ Pincode Not Serviceable
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          ))
        ) : (
          query && !isSearching && (
            <div>
              {suggestions.length > 0 ? (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg shadow-sm">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 text-amber-500 text-3xl mr-4">💡</div>
                    <div className="w-full">
                      <h3 className="text-xl font-bold text-amber-900">Exact Pincode Not Found</h3>
                      <p className="mt-1 text-amber-800 font-medium text-lg">
                        Pivot Script: <span className="italic">"Are you available in any of these nearby locations?"</span>
                      </p>
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {suggestions.map((suggestion) => (
                          <div key={suggestion.id} className="bg-white p-3 border border-amber-200 rounded-lg shadow-sm flex flex-col justify-center items-center text-center">
                            <span className="font-black text-xl text-gray-900">{suggestion.pincode}</span>
                            <span className="text-sm text-gray-600 font-medium mt-1">{suggestion.city || 'Unknown City'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500 text-lg">No results found for "{query}"</p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
