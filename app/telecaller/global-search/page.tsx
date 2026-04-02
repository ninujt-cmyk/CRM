"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';
import { 
  Building2, MapPin, Search, CheckCircle2, XCircle, 
  Map, Lightbulb, FileText, ChevronRight, Loader2
} from 'lucide-react';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Contextual Verification State
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

    const debounceFn = setTimeout(() => performSearch(), 300);
    return () => clearTimeout(debounceFn);
  }, [query, searchMode]);

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
    <div className="p-4 sm:p-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Directory Search</h1>
        <p className="text-slate-500 mt-2 text-sm sm:text-base">Quickly locate companies and verify serviceable pincodes.</p>
      </div>
      
      {/* Segmented Control */}
      <div className="flex p-1 bg-slate-100 rounded-xl mb-8 w-full sm:w-fit shadow-inner">
        <button 
          onClick={() => handleModeSwitch('company')} 
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${searchMode === 'company' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
        >
          <Building2 className="w-4 h-4" /> Company
        </button>
        <button 
          onClick={() => handleModeSwitch('pincode')} 
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${searchMode === 'pincode' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
        >
          <MapPin className="w-4 h-4" /> Pincode
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-6 group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className={`h-6 w-6 transition-colors ${isSearching ? 'text-blue-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
        </div>
        <input
          type="text"
          placeholder={searchMode === 'company' ? "Type company name (e.g., Hanva)..." : "Type 6-digit Pincode..."}
          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-lg transition-all"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
             <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="space-y-5">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${verifyingId === item.id ? 'border-blue-400 ring-4 ring-blue-50 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
              
              <div className="p-5 sm:p-6">
                {/* File Badge */}
                <div className="flex justify-between items-start mb-3">
                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wide">
                    <FileText className="w-3 h-3" />
                    {item.file_name ? item.file_name.replace(/\.[^/.]+$/, "") : 'UNKNOWN FILE'}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    {searchMode === 'company' ? (
                      <h3 className="text-xl font-bold text-slate-900">{item.company_name}</h3>
                    ) : (
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-slate-400" /> {item.pincode}
                      </h3>
                    )}
                  </div>

                  <div className="flex-shrink-0 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                    {searchMode === 'company' ? (
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="text-slate-400 uppercase text-[10px] tracking-wider font-bold">Category</span> 
                        {item.category || 'N/A'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="text-slate-400 uppercase text-[10px] tracking-wider font-bold">City</span> 
                        {item.city || 'N/A'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Two-Step Verification */}
              {searchMode === 'company' && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  <button 
                    onClick={() => openVerification(item.id)}
                    className="w-full py-3.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 group"
                  >
                    {verifyingId === item.id ? 'Close Verification' : 'Verify Customer Pincode'}
                    <ChevronRight className={`w-4 h-4 transition-transform ${verifyingId === item.id ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
                  </button>

                  {/* Inline Checker Panel */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${verifyingId === item.id ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-6 bg-blue-50/30 border-t border-blue-100">
                      <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                        <Map className="w-4 h-4 text-blue-500" /> Is this location serviceable?
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit Pincode..."
                        className="w-full p-3 bg-white border border-slate-300 rounded-lg shadow-inner focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono text-lg transition-all"
                        value={pinQuery}
                        onChange={(e) => setPinQuery(e.target.value.replace(/[^0-9]/g, ''))}
                      />

                      {/* Status Indicators */}
                      <div className="mt-4 h-14 flex items-center">
                        {pinStatus === 'idle' && pinQuery.length > 0 && pinQuery.length < 6 && (
                          <p className="text-slate-500 text-sm flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" /> Keep typing...
                          </p>
                        )}
                        {pinStatus === 'loading' && (
                          <p className="text-blue-600 text-sm font-medium flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Checking database...
                          </p>
                        )}
                        {pinStatus === 'found' && pinResultData && (
                          <div className="w-full bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-emerald-700 font-bold flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Approved
                            </span>
                            <span className="text-emerald-800 font-medium text-sm bg-emerald-100 px-2 py-1 rounded">
                              {pinResultData.city}
                            </span>
                          </div>
                        )}
                        {pinStatus === 'missing' && (
                          <div className="w-full bg-red-50 border border-red-200 p-3 rounded-lg shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-red-700 font-bold flex items-center gap-2">
                              <XCircle className="w-5 h-5 text-red-600" /> Pincode Not Serviceable
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          query && !isSearching && (
            <div className="animate-in fade-in duration-300">
              {suggestions.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 p-6 sm:p-8 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="bg-amber-100 p-3 rounded-full flex-shrink-0">
                      <Lightbulb className="w-8 h-8 text-amber-600" />
                    </div>
                    <div className="w-full">
                      <h3 className="text-xl font-bold text-amber-900">Exact Pincode Not Found</h3>
                      
                      {/* Coaching Card */}
                      <div className="mt-3 bg-white p-4 rounded-xl border border-amber-100 shadow-sm relative">
                        <span className="absolute -top-2.5 left-4 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-200">
                          Pivot Script
                        </span>
                        <p className="text-slate-700 font-medium text-base italic mt-1">
                          "We aren't in that exact code, but are you available in any of these nearby locations?"
                        </p>
                      </div>

                      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {suggestions.map((suggestion) => (
                          <div key={suggestion.id} className="bg-white p-3 border border-amber-100 hover:border-amber-300 hover:shadow-md transition-all rounded-xl flex flex-col justify-center items-center text-center group cursor-default">
                            <span className="font-black text-xl text-slate-800 group-hover:text-blue-600 transition-colors">{suggestion.pincode}</span>
                            <span className="text-xs text-slate-500 font-semibold mt-1 uppercase tracking-wide">{suggestion.city || 'Unknown'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700">No results found</h3>
                  <p className="text-slate-500 mt-1">We couldn't find anything matching "{query}"</p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
