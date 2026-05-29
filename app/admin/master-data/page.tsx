"use client";

import { useState, useEffect } from 'react';
import Papa from 'papaparse'; 
import { searchClient } from '@/lib/meilisearch';
import { 
  Database, UploadCloud, Trash2, Search, 
  FileText, AlertTriangle, Building2, MapPin, Loader2, Download,
  CheckCircle2, XCircle
} from 'lucide-react';

export default function MasterDataPage() {
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadType, setUploadType] = useState<'company' | 'pincode'>('company');
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{type: 'success'|'error', msg: string} | null>(null);

  // Delete State
  const [deleteFileName, setDeleteFileName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{type: 'success'|'error', msg: string} | null>(null);

  // Search State
  const [searchMode, setSearchMode] = useState<'company' | 'pincode'>('company');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced Verification Search
  useEffect(() => {
    let isMounted = true;

    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const searchOptions = {
          limit: 10,
          attributesToSearchOn: searchMode === 'company' ? ['company_name'] : ['pincode'],
        };

        const result = await searchClient.index('companies').search(searchQuery, searchOptions);
        
        if (!isMounted) return;

        let validHits = result.hits;
        if (searchMode === 'pincode') {
          validHits = validHits.filter((item) => String(item.pincode) === searchQuery.trim());
        }

        setSearchResults(validHits);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        if(isMounted) setIsSearching(false);
      }
    };

    const debounceFn = setTimeout(() => performSearch(), 300);
    return () => {
        isMounted = false;
        clearTimeout(debounceFn);
    }
  }, [searchQuery, searchMode]);

  const handleModeSwitch = (mode: 'company' | 'pincode') => {
    setSearchMode(mode);
    setSearchQuery('');
    setSearchResults([]);
  };

  const downloadSample = () => {
    let csvContent = uploadType === 'company' 
      ? "company_name,category\nHanva Technologies PVT LTD,IT Software" 
      : "pincode,city\n560001,Bengaluru";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sample_${uploadType}_upload.csv`;
    link.click();
  };

  const handleUploadSubmit = () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatus(null);
    setUploadProgress({ current: 0, total: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const allRows = results.data;
        const totalRows = allRows.length;
        setUploadProgress({ current: 0, total: totalRows });

        const chunkSize = 2500; 
        
        for (let i = 0; i < totalRows; i += chunkSize) {
          const chunk = allRows.slice(i, i + chunkSize);
          
          try {
            const response = await fetch('/api/admin/upload-companies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chunk: chunk,
                uploadType: uploadType,
                fileName: file.name
              }),
            });

            if (!response.ok) throw new Error(`Batch failed: ${response.statusText}`);
            
            setUploadProgress(prev => ({ 
              ...prev, 
              current: Math.min(prev.current + chunkSize, totalRows) 
            }));
            
          } catch (error: any) {
            console.error("Upload interrupted:", error);
            setUploadStatus({type: 'error', msg: `Upload failed at row ${i}. ${error.message}`});
            setIsUploading(false);
            return;
          }
        }

        setUploadStatus({type: 'success', msg: `Successfully uploaded ${totalRows} records.`});
        setIsUploading(false);
        setFile(null);
        // Clear success message after a few seconds
        setTimeout(() => setUploadStatus(null), 5000);
      },
      error: (error) => {
        setUploadStatus({type: 'error', msg: `Error parsing CSV: ${error.message}`});
        setIsUploading(false);
      }
    });
  };

  const handleDeleteSubmit = async () => {
    if (!deleteFileName.trim()) return;

    const confirmDelete = window.confirm(
      `WARNING: Are you sure you want to delete ALL data associated with "${deleteFileName}"? This cannot be undone.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    setDeleteStatus(null);
    
    try {
      const response = await fetch('/api/admin/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: deleteFileName.trim() }),
      });

      if (response.ok) {
        setDeleteStatus({type: 'success', msg: `Deletion process started for "${deleteFileName}".`});
        setDeleteFileName(''); 
        setTimeout(() => setDeleteStatus(null), 5000);
      } else {
        const errorData = await response.json();
        setDeleteStatus({type: 'error', msg: `Delete failed: ${errorData.error}`});
      }
    } catch (error) {
      console.error(error);
      setDeleteStatus({type: 'error', msg: "A network error occurred during deletion."});
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 bg-slate-50/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-600/20">
          <Database className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Master Data Management</h1>
          <p className="text-slate-500 text-sm mt-1.5">Upload, manage, and verify global directories and serviceable pincodes.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- UPLOAD SECTION --- */}
        <div className="p-6 sm:p-8 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col h-full relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8 opacity-50 pointer-events-none"></div>

          <div className="flex items-center gap-2.5 mb-6 relative z-10">
            <UploadCloud className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-800">Upload Directory</h2>
          </div>
          
          <div className="space-y-6 flex-1 relative z-10">
            {/* Status Alert */}
            {uploadStatus && (
                <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {uploadStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <p>{uploadStatus.msg}</p>
                </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">1. Select Data Type</label>
              <div className="relative">
                <select 
                  className="w-full p-3.5 pl-4 pr-10 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-slate-800 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as 'company' | 'pincode')}
                  disabled={isUploading}
                >
                  <option value="company">🏢 Company Directory</option>
                  <option value="pincode">📍 Serviceable Pincodes</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">2. Upload CSV File</label>
                 <button 
                    onClick={downloadSample} 
                    className="flex items-center gap-1.5 text-blue-600 font-semibold hover:text-blue-800 transition-colors text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    disabled={isUploading}
                >
                   <Download className="w-3.5 h-3.5" /> Get Sample CSV
                 </button>
              </div>
              
              {/* Custom Styled File Input */}
              <label 
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl transition-all duration-200 ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${
                    file 
                        ? 'border-blue-400 bg-blue-50/30 hover:bg-blue-50/50' 
                        : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                  {file ? (
                    <>
                      <div className="bg-blue-100 p-2 rounded-full mb-3">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 truncate w-full max-w-[250px]">{file.name}</p>
                      <p className="text-xs text-blue-600 font-medium mt-1">{(file.size / 1024).toFixed(1)} KB • Ready to process</p>
                    </>
                  ) : (
                    <>
                      <div className="bg-slate-200 p-2 rounded-full mb-3 group-hover:bg-slate-300 transition-colors">
                        <UploadCloud className="w-6 h-6 text-slate-500" />
                      </div>
                      <p className="mb-1 text-sm font-bold text-slate-700">Click or drag file here</p>
                      <p className="text-xs text-slate-500 font-medium">Standard CSV formats only</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={isUploading}
                  className="hidden" 
                />
              </label>
            </div>

            {/* Progress Bar UI */}
            <div className={`transition-all duration-300 overflow-hidden ${isUploading ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wide mb-2.5">
                  <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> Syncing to Database</span>
                  <span className="text-blue-600">{Math.round((uploadProgress.current / uploadProgress.total) * 100) || 0}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden" 
                    style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                  >
                      {/* Shimmer effect on progress bar */}
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2.5 font-mono text-right tracking-wider">{uploadProgress.current.toLocaleString()} / {uploadProgress.total.toLocaleString()} records processed</p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleUploadSubmit}
            disabled={!file || isUploading}
            className={`mt-6 w-full py-4 rounded-xl font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${
              !file || isUploading 
                ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                : 'bg-slate-900 hover:bg-slate-800 hover:-translate-y-0.5 shadow-lg hover:shadow-xl active:translate-y-0'
            }`}
          >
            {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing Batch...</> : <><UploadCloud className="w-5 h-5" /> Start Injection</>}
          </button>
        </div>

        {/* --- DELETION SECTION --- */}
        <div className="p-6 sm:p-8 border border-red-200/60 rounded-2xl bg-gradient-to-b from-white to-red-50/30 shadow-sm flex flex-col h-full relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-8 -mt-8 opacity-50 pointer-events-none"></div>

          <div className="flex items-center gap-2.5 mb-6 relative z-10">
            <Trash2 className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-slate-800">Purge Dataset</h2>
          </div>
          
          <div className="flex-1 flex flex-col relative z-10">
            {/* Status Alert */}
            {deleteStatus && (
                <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm ${deleteStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {deleteStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <p>{deleteStatus.msg}</p>
                </div>
            )}

            <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 mb-6 flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
               <div className="space-y-1">
                   <h4 className="text-sm font-bold text-red-900">Danger Zone</h4>
                   <p className="text-sm text-red-700/90 leading-relaxed">
                    This action will permanently delete all records injected by a specific upload file. Enter the exact filename (e.g., <code className="bg-white text-red-800 px-1.5 py-0.5 rounded border border-red-200 text-xs">batch_01.csv</code>) to purge its data from the search index.
                  </p>
               </div>
            </div>

            <div className="mt-auto">
               <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Target Filename to Delete</label>
               <input 
                 type="text" 
                 placeholder="exact_filename.csv" 
                 value={deleteFileName}
                 onChange={(e) => setDeleteFileName(e.target.value)}
                 disabled={isDeleting}
                 className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-mono text-slate-800 placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
               />
            </div>
          </div>

          <button 
            onClick={handleDeleteSubmit}
            disabled={!deleteFileName || isDeleting}
            className={`mt-6 w-full py-4 rounded-xl font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 ${
              !deleteFileName || isDeleting 
                ? 'bg-red-200 cursor-not-allowed' 
                : 'bg-red-600 hover:bg-red-700 hover:-translate-y-0.5 shadow-lg shadow-red-600/20 hover:shadow-xl active:translate-y-0'
            }`}
          >
            {isDeleting ? <><Loader2 className="w-5 h-5 animate-spin" /> Purging Data...</> : <><Trash2 className="w-5 h-5" /> Confirm Deletion</>}
          </button>
        </div>
      </div>

      {/* --- DATA VERIFICATION SECTION --- */}
      <div className="p-6 sm:p-8 border border-slate-200 rounded-2xl bg-white shadow-sm mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b border-slate-100 pb-6">
           <div className="flex items-center gap-3">
             <div className="bg-blue-50 p-2 rounded-lg">
                <Search className="w-5 h-5 text-blue-600" />
             </div>
             <div>
                 <h2 className="text-xl font-bold text-slate-800">Verify Live Data</h2>
                 <p className="text-sm text-slate-500 mt-0.5">Search the index to confirm successful uploads.</p>
             </div>
           </div>
           
           <div 
             className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-fit shadow-inner"
             role="tablist"
           >
             <button 
               role="tab"
               aria-selected={searchMode === 'company'}
               onClick={() => handleModeSwitch('company')} 
               className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                   searchMode === 'company' 
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
             >
               Companies
             </button>
             <button 
               role="tab"
               aria-selected={searchMode === 'pincode'}
               onClick={() => handleModeSwitch('pincode')} 
               className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg font-bold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                   searchMode === 'pincode' 
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
             >
               Pincodes
             </button>
           </div>
        </div>

        <div className="relative mb-8 group max-w-2xl">
           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <Search className={`h-5 w-5 transition-colors ${isSearching ? 'text-blue-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
           </div>
           <input
             type="text"
             placeholder={searchMode === 'company' ? "Type company name to verify..." : "Type 6-digit Pincode to verify..."}
             className="w-full pl-12 pr-12 py-3.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-800"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
           {isSearching && (
             <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
               <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
             </div>
           )}
           {searchQuery && !isSearching && (
            <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
                <XCircle className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="space-y-3">
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map((item) => (
                <div key={item.id} className="p-4 border border-slate-200 hover:border-blue-300 rounded-xl bg-white flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md group">
                    
                    <div className="flex items-start gap-3 mb-4">
                    <div className={`p-2.5 rounded-lg mt-0.5 ${searchMode === 'company' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'} transition-colors`}>
                        {searchMode === 'company' ? <Building2 className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        {searchMode === 'company' ? (
                        <h3 className="text-base font-bold text-slate-900 leading-tight truncate" title={item.company_name}>{item.company_name}</h3>
                        ) : (
                        <h3 className="text-base font-bold text-slate-900">{item.pincode}</h3>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                            <Database className="w-3 h-3" />
                            <span className="font-mono truncate" title={item.file_name}>Source: {item.file_name || 'Manual Entry'}</span>
                        </div>
                    </div>
                    </div>

                    <div className="flex items-center pt-3 border-t border-slate-100">
                    {searchMode === 'company' ? (
                        <span className="bg-slate-50 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Cat:</span>
                        <span className="truncate max-w-[200px]" title={item.category}>{item.category || 'Uncategorized'}</span>
                        </span>
                    ) : (
                        <span className="bg-slate-50 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">City:</span>
                        <span className="truncate max-w-[200px]">{item.city || 'Unknown Location'}</span>
                        </span>
                    )}
                    </div>

                </div>
                ))}
            </div>
          ) : (
            searchQuery && !isSearching && (
              <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">No records found</h3>
                <p className="text-slate-500 text-sm mt-1">We couldn't find any data matching "{searchQuery}"</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
