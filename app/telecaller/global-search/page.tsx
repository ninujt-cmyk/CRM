"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- Verification State ---
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [pinQuery, setPinQuery] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');
  const [pinResultData, setPinResultData] = useState<any>(null);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setVerifyingId(null); 
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

        // Smart Suggestions for missing pincodes
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

  // 2. The INTELLIGENT Context-Aware Pincode Verification
  useEffect(() => {
    const verifyInlinePincode = async () => {
      // Find the exact company the telecaller is verifying
      const verifyingCompany = results.find(r => r.id === verifyingId);

      if (pinQuery.length !== 6 || !verifyingCompany) {
        setPinStatus('idle');
        setPinResultData(null);
        return;
      }

      setPinStatus('loading');
      try {
        // Fetch up to 50 records for this pincode to ensure we catch all file overlap
        const result = await searchClient.index('companies').search(pinQuery, {
          limit: 50, 
          attributesToSearchOn: ['pincode'],
        });

        // STRICT MATCH: Pincode must match exactly AND belong to the exact same file
        const exactMatch = result.hits.find((item) => 
          String(item.pincode) === pinQuery && 
          item.file_name === verifyingCompany.file_name
        );

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
  }, [pinQuery, verifyingId, results]);

  const openVerification = (id: string) => {
    if (verifyingId === id) {
      setVerifyingId(null); 
    } else {
      setVerifyingId(id);
      setPinQuery(''); 
      setPinStatus('idle');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Telecaller Directory</h1>
      
      {/* Navigation */}
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
        className="w-full p-4 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none text-lg"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isSearching && <p className="text-gray-500 mt-4 animate-pulse font-medium">Searching database...</p>}

      <div className="mt-6 space-y-4">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className={`border rounded-xl bg-white transition-all flex flex-col relative overflow-hidden ${verifyingId === item.id ? 'border-blue-400 ring-1 ring-blue-400 shadow-md' : 'border-gray-200 shadow-sm hover:shadow-md'}`}>
              
              {/* Clean UI mapping your screenshot */}
              <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center">
                
                {/* Left Side: Name */}
                <div>
                   {searchMode === 'company' ? (
                      <h3 className="text-lg font-bold text-gray-900 uppercase">{item.company_name}</h3>
                    ) : (
                      <h3 className="text-lg font-bold text-gray-900">Pincode: {item.pincode}</h3>
                    )}
                </div>

                {/* Right Side: File Pill & Category */}
                <div className="mt-3 md:mt-0 flex flex-col items-start md:items-end">
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium border border-gray-200 mb-1">
                    File: {item.file_name || 'Unknown.csv'}
                  </span>
                  {searchMode === 'company' ? (
                    <span className="text-sm text-gray-500">
                      Category: <span className="text-blue-600 font-semibold">{item.category || 'N/A'}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">
                      City: <span className="text-green-600 font-semibold">{item.city || 'N/A'}</span>
                    </span>
                  )}
                </div>

              </div>

              {/* TELECALLER INTELLIGENCE: Contextual Verification */}
              {searchMode === 'company' && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  <button 
                    onClick={() => openVerification(item.id)}
                    className="w-full py-2.5 text-sm font-semibold text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {verifyingId === item.id ? 'Close ✕' : 'Check Pincode Availability 📍'}
                  </button>

                  {/* Inline Pincode Checker panel */}
                  {verifyingId === item.id && (
                    <div className="p-5 bg-blue-50/30 border-t border-blue-100">
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                        Check if serviceable in: <span className="text-blue-600">{item.file_name}</span>
                      </p>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit Pincode..."
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-lg bg-white"
                        value={pinQuery}
                        onChange={(e) => setPinQuery(e.target.value.replace(/[^0-9]/g, ''))}
                        autoFocus
                      />

                      {/* Live Status Indicators */}
                      <div className="mt-3 h-12 flex items-center">
                        {pinStatus === 'idle' && pinQuery.length > 0 && pinQuery.length < 6 && (
                          <p className="text-gray-500 text-sm">Keep typing...</p>
                        )}
                        {pinStatus === 'loading' && (
                          <p className="text-blue-500 text-sm animate-pulse font-medium">Verifying against {item.file_name}...</p>
                        )}
                        {pinStatus === 'found' && pinResultData && (
                          <div className="w-full bg-green-50 border border-green-200 p-3 rounded-lg flex items-center justify-between shadow-sm">
                            <span className="text-green-700 font-bold flex items-center gap-2">
                              ✅ Approved for this Campaign
                            </span>
                            <span className="text-green-600 font-medium text-sm">
                              City: {pinResultData.city}
                            </span>
                          </div>
                        )}
                        {pinStatus === 'missing' && (
                          <div className="w-full bg-red-50 border border-red-200 p-3 rounded-lg shadow-sm">
                            <span className="text-red-700 font-bold flex items-center gap-2">
                              ❌ Not serviceable under {item.file_name}
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
                <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-lg shadow-sm">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 text-amber-500 text-2xl mr-3">💡</div>
                    <div className="w-full">
                      <h3 className="text-lg font-bold text-amber-900">Exact Pincode Not Found</h3>
                      <p className="mt-1 text-amber-800 font-medium text-sm">
                        Pivot Script: <span className="italic">"Are you available in any of these nearby locations?"</span>
                      </p>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {suggestions.map((suggestion) => (
                          <div key={suggestion.id} className="bg-white p-2 border border-amber-200 rounded text-center">
                            <span className="font-bold text-gray-900 block">{suggestion.pincode}</span>
                            <span className="text-xs text-gray-500 block truncate">{suggestion.city || 'Unknown'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500">No results found for "{query}"</p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
