"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';
import { 
  Building2, MapPin, Search, CheckCircle2, XCircle, 
  Map, Lightbulb, FileText, ChevronRight, Loader2, AlertCircle
} from 'lucide-react';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Contextual Verification State
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [pinQuery, setPinQuery] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'loading' | 'found' | 'missing' | 'error'>('idle');
  const [pinResultData, setPinResultData] = useState<any>(null);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setVerifyingId(null);
    setSearchError(null);
  };

  // Main Search Effect
  useEffect(() => {
    let isMounted = true;
    
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        setSuggestions([]);
        setSearchError(null);
        return;
      }
      
      setIsSearching(true);
      setSearchError(null);
      
      try {
        const searchOptions = {
          limit: 15,
          attributesToSearchOn: searchMode === 'company' ? ['company_name'] : ['pincode'],
        };

        const searchResult = await searchClient.index('companies').search(query, searchOptions);
        
        if (!isMounted) return;

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
          if(isMounted) setSuggestions(suggestionResult.hits);
        }
      } catch (error) {
        console.error('Search error:', error);
        if(isMounted) setSearchError('Failed to fetch results. Please try again.');
      } finally {
        if(isMounted) setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 300);
    return () => {
      isMounted = false;
      clearTimeout(debounceFn);
    };
  }, [query, searchMode]);

  // Inline Verification Effect
  useEffect(() => {
    let isMounted = true;

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

        if (!isMounted) return;

        const exactMatch = result.hits.find((item) => String(item.pincode) === pinQuery);

        if (exactMatch) {
          setPinResultData(exactMatch);
          setPinStatus('found');
        } else {
          setPinStatus('missing');
        }
      } catch (error) {
        console.error('Inline verification failed:', error);
        if(isMounted) setPinStatus('error');
      }
    };

    const debounceFn = setTimeout(() => verifyInlinePincode(), 300);
    
    return () => {
        isMounted = false;
        clearTimeout(debounceFn);
    };
  }, [pinQuery]);

  const toggleVerification = (id: string) => {
    if (verifyingId === id) {
      setVerifyingId(null); 
    } else {
      setVerifyingId(id);
      setPinQuery(''); 
      setPinStatus('idle');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto min-h-screen bg-slate-50/30">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Directory Search</h1>
        <p className="text-slate-500 mt-2 text-sm sm:text-base max-w-2xl">Quickly locate verified companies and check serviceable pincodes to ensure accurate lead processing.</p>
      </div>
      
      {/* Segmented Control */}
      <div 
        className="flex p-1.5 bg-slate-200/60 rounded-xl mb-8 w-full sm:w-fit shadow-inner"
        role="tablist"
        aria-label="Search Mode"
      >
        <button 
          role="tab"
          aria-selected={searchMode === 'company'}
          onClick={() => handleModeSwitch('company')} 
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            searchMode === 'company' 
              ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
          }`}
        >
          <Building2 className="w-4 h-4" /> Company
        </button>
        <button 
          role="tab"
          aria-selected={searchMode === 'pincode'}
          onClick={() => handleModeSwitch('pincode')} 
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            searchMode === 'pincode' 
              ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
          }`}
        >
          <MapPin className="w-4 h-4" /> Pincode
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-8 group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className={`h-6 w-6 transition-colors ${isSearching ? 'text-blue-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
        </div>
        <input
          type="text"
          placeholder={searchMode === 'company' ? "Search by exact company name (e.g., Hanva Technologies)..." : "Enter 6-digit Pincode..."}
          className="w-full pl-12 pr-12 py-4 bg-white border-2 border-slate-200 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-lg transition-all placeholder:text-slate-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search for ${searchMode}`}
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
             <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          </div>
        )}
        {query && !isSearching && (
            <button 
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label="Clear search"
            >
                <XCircle className="h-5 w-5" />
            </button>
        )}
      </div>

      {/* Error State */}
      {searchError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{searchError}</p>
          </div>
      )}

      {/* Results Section */}
      <div className="space-y-4">
        {results.length > 0 ? (
          results.map((item) => (
            <div 
              key={item.id} 
              className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                verifyingId === item.id 
                  ? 'border-blue-400 ring-4 ring-blue-50 shadow-md transform scale-[1.01]' 
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              
              <div className="p-5 sm:p-6">
                {/* File Badge */}
                <div className="flex justify-between items-start mb-4">
                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100/50 uppercase tracking-wide">
                    <FileText className="w-3.5 h-3.5" />
                    {item.file_name ? item.file_name.replace(/\.[^/.]+$/, "") : 'UNKNOWN SOURCE'}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    {searchMode === 'company' ? (
                      <h3 className="text-xl font-bold text-slate-900 leading-tight">{item.company_name}</h3>
                    ) : (
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-slate-400" /> {item.pincode}
                      </h3>
                    )}
                  </div>

                  <div className="flex-shrink-0 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                    {searchMode === 'company' ? (
                      <span className="flex flex-col gap-0.5 text-sm font-semibold text-slate-700">
                        <span className="text-slate-400 uppercase text-[10px] tracking-wider font-bold">Category</span> 
                        {item.category || 'Uncategorized'}
                      </span>
                    ) : (
                      <span className="flex flex-col gap-0.5 text-sm font-semibold text-slate-700">
                        <span className="text-slate-400 uppercase text-[10px] tracking-wider font-bold">City</span> 
                        {item.city || 'Unknown Location'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Two-Step Verification (Companies Only) */}
              {searchMode === 'company' && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  <button 
                    onClick={() => toggleVerification(item.id)}
                    className={`w-full py-3.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                        verifyingId === item.id ? 'text-blue-700 bg-blue-50/50' : 'text-blue-600 hover:bg-blue-50'
                    }`}
                    aria-expanded={verifyingId === item.id}
                  >
                    {verifyingId === item.id ? 'Close Verification' : 'Verify Serviceable Pincode'}
                    <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${verifyingId === item.id ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
                  </button>

                  {/* Inline Checker Panel */}
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${verifyingId === item.id ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}
                    aria-hidden={verifyingId !== item.id}
                  >
                    <div className="p-6 bg-blue-50/30 border-t border-blue-100">
                      <label className="block text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                        <Map className="w-4 h-4 text-blue-500" /> Check Location Serviceability
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit Pincode..."
                        className="w-full p-3.5 bg-white border border-slate-300 rounded-lg shadow-inner focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono text-lg transition-all"
                        value={pinQuery}
                        onChange={(e) => setPinQuery(e.target.value.replace(/[^0-9]/g, ''))}
                        aria-label="Enter pincode to verify"
                      />

                      {/* Status Indicators */}
                      <div className="mt-4 h-14 flex items-center" aria-live="polite">
                        {pinStatus === 'idle' && pinQuery.length > 0 && pinQuery.length < 6 && (
                          <p className="text-slate-500 text-sm flex items-center gap-2 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" /> Keep typing...
                          </p>
                        )}
                        {pinStatus === 'loading' && (
                          <p className="text-blue-600 text-sm font-medium flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Verifying against database...
                          </p>
                        )}
                        {pinStatus === 'found' && pinResultData && (
                          <div className="w-full bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-emerald-700 font-bold flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Location Approved
                            </span>
                            <span className="text-emerald-800 font-medium text-sm bg-emerald-100/50 px-2.5 py-1 rounded border border-emerald-200">
                              {pinResultData.city}
                            </span>
                          </div>
                        )}
                        {pinStatus === 'missing' && (
                          <div className="w-full bg-red-50 border border-red-200 p-3.5 rounded-lg shadow-sm animate-in fade-in slide-in-from-bottom-2 flex items-center justify-between">
                            <span className="text-red-700 font-bold flex items-center gap-2">
                              <XCircle className="w-5 h-5 text-red-600" /> Pincode Not Serviceable
                            </span>
                            <span className="text-red-600 text-xs font-medium bg-red-100/50 px-2 py-1 rounded">Out of Bounds</span>
                          </div>
                        )}
                        {pinStatus === 'error' && (
                            <p className="text-red-600 text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Error verifying pincode.
                            </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          query && !isSearching && !searchError && (
            <div className="animate-in fade-in duration-300">
              {suggestions.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 p-6 sm:p-8 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                  <div className="flex flex-col sm:flex-row items-start gap-5">
                    <div className="bg-amber-100 p-3.5 rounded-full flex-shrink-0 shadow-inner">
                      <Lightbulb className="w-8 h-8 text-amber-600" />
                    </div>
                    <div className="w-full">
                      <h3 className="text-xl font-bold text-amber-900 mb-1">Exact Pincode Not Found</h3>
                      <p className="text-amber-700/80 text-sm mb-4">We found some nearby serviceable locations you can suggest.</p>
                      
                      {/* Coaching Card */}
                      <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm relative mb-6">
                        <span className="absolute -top-2.5 left-4 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-200 shadow-sm">
                          Suggested Pivot Script
                        </span>
                        <p className="text-slate-700 font-medium text-base italic leading-relaxed">
                          "We aren't currently servicing that exact pin code, but are you by chance available to meet or process this in any of these nearby areas?"
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {suggestions.map((suggestion) => (
                          <div key={suggestion.id} className="bg-white p-3.5 border border-amber-100 hover:border-amber-300 hover:shadow-md transition-all duration-200 rounded-xl flex flex-col justify-center items-center text-center group cursor-default">
                            <span className="font-black text-xl text-slate-800 group-hover:text-blue-600 transition-colors">{suggestion.pincode}</span>
                            <span className="text-xs text-slate-500 font-semibold mt-1.5 uppercase tracking-wide line-clamp-1 w-full">{suggestion.city || 'Unknown'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 px-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 border border-slate-100">
                    <Search className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">No results found</h3>
                  <p className="text-slate-500 mt-2 max-w-md mx-auto">We couldn't find any records matching <span className="font-semibold text-slate-700">"{query}"</span>. Please check the spelling and try again.</p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
