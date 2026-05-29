"use client";

import { useState, useEffect } from 'react';
import { searchClient } from '@/lib/meilisearch';
import { 
  Building2, MapPin, Search, CheckCircle2, XCircle, 
  Map, Lightbulb, FileText, ChevronRight, Loader2, AlertCircle,
  Calculator, Copy, Check
} from 'lucide-react';

export default function TelecallerSearchPage() {
  const [searchMode, setSearchMode] = useState<'company' | 'pincode' | 'eligibility'>('company');
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

  // Eligibility Calculator States
  const [companyInput, setCompanyInput] = useState('');
  const [salaryInput, setSalaryInput] = useState('');
  const [cibilInput, setCibilInput] = useState('');
  const [pincodeInput, setPincodeInput] = useState('');
  const [companySuggestions, setCompanySuggestions] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<{ name: string; listedBanks: string[] } | null>(null);
  const [pincodeListedBanks, setPincodeListedBanks] = useState<string[]>([]);
  const [isCompanySearching, setIsCompanySearching] = useState(false);
  const [isPincodeVerifying, setIsPincodeVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleModeSwitch = (mode: 'company' | 'pincode' | 'eligibility') => {
    setSearchMode(mode);
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setVerifyingId(null);
    setSearchError(null);
  };

  // Main Search Effect for Directory Search
  useEffect(() => {
    let isMounted = true;
    
    const performSearch = async () => {
      if (searchMode === 'eligibility' || !query.trim()) {
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

  // Eligibility Autocomplete search
  useEffect(() => {
    if (searchMode !== 'eligibility' || !companyInput.trim()) {
      setCompanySuggestions([]);
      return;
    }
    
    const searchCompany = async () => {
      setIsCompanySearching(true);
      try {
        const searchOptions = {
          limit: 8,
          attributesToSearchOn: ['company_name']
        };
        const result = await searchClient.index('companies').search(companyInput, searchOptions);
        const companyHits = result.hits.filter((hit: any) => hit.data_type === 'company');
        setCompanySuggestions(companyHits);
      } catch (err) {
        console.error(err);
      } finally {
        setIsCompanySearching(false);
      }
    };

    const timer = setTimeout(searchCompany, 200);
    return () => clearTimeout(timer);
  }, [companyInput, searchMode]);

  // Eligibility Pincode directory verification
  useEffect(() => {
    if (searchMode !== 'eligibility' || pincodeInput.length !== 6) {
      setPincodeListedBanks([]);
      return;
    }
    
    const checkPincode = async () => {
      setIsPincodeVerifying(true);
      try {
        const result = await searchClient.index('companies').search(pincodeInput, {
          limit: 40,
          attributesToSearchOn: ['pincode']
        });
        
        const exactMatches = result.hits.filter((hit: any) => 
          hit.data_type === 'pincode' && 
          String(hit.pincode).trim() === pincodeInput.trim()
        );
        
        const banks = exactMatches.map((hit: any) => 
          hit.file_name ? hit.file_name.replace(/\.[^/.]+$/, "").toLowerCase() : ""
        ).filter(Boolean);
        
        setPincodeListedBanks(banks);
      } catch (err) {
        console.error(err);
      } finally {
        setIsPincodeVerifying(false);
      }
    };
    
    const timer = setTimeout(checkPincode, 200);
    return () => clearTimeout(timer);
  }, [pincodeInput, searchMode]);

  const handleSelectCompany = async (company: any) => {
    setIsCompanySearching(true);
    try {
      const result = await searchClient.index('companies').search(company.company_name, {
        limit: 40,
        attributesToSearchOn: ['company_name']
      });
      
      const exactMatches = result.hits.filter((hit: any) => 
        hit.data_type === 'company' && 
        hit.company_name.toLowerCase().trim() === company.company_name.toLowerCase().trim()
      );
      
      const banks = exactMatches.map((hit: any) => 
        hit.file_name ? hit.file_name.replace(/\.[^/.]+$/, "").toLowerCase() : ""
      ).filter(Boolean);
      
      setSelectedCompany({
        name: company.company_name,
        listedBanks: banks
      });
      setCompanyInput(company.company_name);
      setCompanySuggestions([]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCompanySearching(false);
    }
  };

  const handleClearCompany = () => {
    setSelectedCompany(null);
    setCompanyInput('');
    setCompanySuggestions([]);
  };

  // Inline Pincode Verification Effect
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

  const getEligibilityResults = () => {
    const salary = parseFloat(salaryInput) || 0;
    const cibil = parseInt(cibilInput) || 0;
    const pincode = pincodeInput.trim();
    const hasPincode = pincode.length === 6;
    
    const isCompanyListedForBank = (bankKey: string) => {
      if (!selectedCompany) return false;
      return selectedCompany.listedBanks.some(b => b.includes(bankKey.toLowerCase()));
    };
    
    const isPincodeListedForBank = (bankKey: string) => {
      return pincodeListedBanks.some(b => b.includes(bankKey.toLowerCase()));
    };

    const results = [];

    // 1. ICICI
    {
      const isListed = isCompanyListedForBank('icici');
      const requiredSalary = isListed ? 30000 : 50000;
      const requiredCibil = 725;
      
      const salaryOk = salary >= requiredSalary;
      const cibilOk = cibil >= requiredCibil;
      const eligible = salaryOk && cibilOk;
      
      const reasons = [];
      if (!salaryOk) reasons.push(`Salary is ₹${salary.toLocaleString('en-IN')} (min required for ${isListed ? 'listed' : 'unlisted'} is ₹${requiredSalary.toLocaleString('en-IN')})`);
      if (!cibilOk) reasons.push(`CIBIL is ${cibil} (required >= ${requiredCibil})`);
      
      results.push({
        bankName: "ICICI Bank",
        eligible,
        isListed,
        reasons: eligible ? [`Meets all requirements for ${isListed ? 'listed' : 'unlisted'} company`] : reasons,
        details: `Listed Company Salary >= ₹30k, Unlisted >= ₹50k. CIBIL >= 725. All pincodes accepted.`,
        checklist: [
          { label: `Company: ${isListed ? 'Listed (ICICI)' : 'Unlisted (Requires ₹50k salary)'}`, passed: true },
          { label: `Salary: ₹${salary.toLocaleString('en-IN')} / ₹${requiredSalary.toLocaleString('en-IN')}`, passed: salaryOk },
          { label: `CIBIL: ${cibil} / ${requiredCibil}`, passed: cibilOk },
          { label: "Pincode: Accepted", passed: true }
        ]
      });
    }

    // 2. HDFC
    {
      const isListed = isCompanyListedForBank('hdfc');
      const salaryOk = salary >= 30000;
      const cibilOk = cibil >= 700;
      const eligible = isListed && salaryOk && cibilOk;
      
      const reasons = [];
      if (!isListed) reasons.push("Company is not listed on HDFC directory");
      if (!salaryOk) reasons.push("Salary is below ₹30,000");
      if (!cibilOk) reasons.push(`CIBIL is ${cibil} (required >= 700)`);
      
      results.push({
        bankName: "HDFC Bank",
        eligible,
        isListed,
        reasons: eligible ? ["Listed company with salary >= ₹30k & CIBIL >= 700"] : reasons,
        details: "Only listed companies. Salary >= ₹30k. CIBIL >= 700. All pincodes accepted.",
        checklist: [
          { label: "Company: Must be Listed (HDFC)", passed: isListed },
          { label: "Salary: >= ₹30,000", passed: salaryOk },
          { label: "CIBIL: >= 700", passed: cibilOk },
          { label: "Pincode: Accepted", passed: true }
        ]
      });
    }

    // 3. InCred / Finnable
    {
      const isPincodeListed = isPincodeListedForBank('incred') || isPincodeListedForBank('finnable');
      const salaryOk = salary >= 15000;
      const pincodeOk = !hasPincode || isPincodeListed;
      const eligible = salaryOk && pincodeOk;
      
      const reasons = [];
      if (!salaryOk) reasons.push("Salary is below ₹15,000");
      if (hasPincode && !isPincodeListed) reasons.push("Pincode is not listed for InCred/Finnable");
      
      results.push({
        bankName: "InCred / Finnable",
        eligible,
        isListed: false,
        reasons: eligible ? ["Salary >= ₹15k & serviceable pincode (no payslip needed)"] : reasons,
        details: "Salary >= ₹15k (No payslip required). No company list required. Only listed pincodes.",
        checklist: [
          { label: "Company: Not Required", passed: true },
          { label: "Salary: >= ₹15,000", passed: salaryOk },
          { label: "CIBIL: No Minimum", passed: true },
          { label: hasPincode ? "Pincode: Serviceable (InCred/Finnable)" : "Pincode: Enter 6 digits to verify", passed: pincodeOk, warning: !hasPincode }
        ]
      });
    }

    // 4. IDFC
    {
      const isListed = isCompanyListedForBank('idfc');
      const salaryOk = salary >= 20000;
      const isPincodeListed = isPincodeListedForBank('idfc');
      const pincodeOk = !hasPincode || isPincodeListed;
      const eligible = isListed && salaryOk && pincodeOk;
      
      const reasons = [];
      if (!isListed) reasons.push("Company is not listed on IDFC directory");
      if (!salaryOk) reasons.push("Salary is below ₹20,000");
      if (hasPincode && !isPincodeListed) reasons.push("Pincode is not listed for IDFC");
      
      results.push({
        bankName: "IDFC First Bank",
        eligible,
        isListed,
        reasons: eligible ? ["Listed company, salary >= ₹20k & serviceable pincode"] : reasons,
        details: "Only listed companies. Salary >= ₹20k. No minimum CIBIL. Only listed pincodes.",
        checklist: [
          { label: "Company: Must be Listed (IDFC)", passed: isListed },
          { label: "Salary: >= ₹20,000", passed: salaryOk },
          { label: "CIBIL: No Minimum", passed: true },
          { label: hasPincode ? "Pincode: Serviceable (IDFC)" : "Pincode: Enter 6 digits to verify", passed: pincodeOk, warning: !hasPincode }
        ]
      });
    }

    // 5. IndusInd
    {
      const salaryOk = salary >= 25000;
      const isPincodeListed = isPincodeListedForBank('idusind') || isPincodeListedForBank('indusind');
      const pincodeOk = !hasPincode || isPincodeListed;
      const eligible = salaryOk && pincodeOk;
      
      const reasons = [];
      if (!salaryOk) reasons.push("Salary is below ₹25,000");
      if (hasPincode && !isPincodeListed) reasons.push("Pincode is not listed for IndusInd");
      
      results.push({
        bankName: "IndusInd Bank",
        eligible,
        isListed: false,
        reasons: eligible ? ["Salary >= ₹25k & serviceable pincode"] : reasons,
        details: "Listed & unlisted companies. Salary >= ₹25k. Only listed pincodes.",
        checklist: [
          { label: "Company: Not Required", passed: true },
          { label: "Salary: >= ₹25,000", passed: salaryOk },
          { label: "CIBIL: No Minimum", passed: true },
          { label: hasPincode ? "Pincode: Serviceable (IndusInd)" : "Pincode: Enter 6 digits to verify", passed: pincodeOk, warning: !hasPincode }
        ]
      });
    }

    // 6. L&T
    {
      const isListed = isCompanyListedForBank('l & t') || isCompanyListedForBank('l&t') || isCompanyListedForBank('l_t') || isCompanyListedForBank('lt');
      const salaryOk = salary >= 25000;
      const eligible = isListed && salaryOk;
      
      const reasons = [];
      if (!isListed) reasons.push("Company is not listed on L&T directory");
      if (!salaryOk) reasons.push("Salary is below ₹25,000");
      
      results.push({
        bankName: "L&T Finance",
        eligible,
        isListed,
        reasons: eligible ? ["Listed company & salary >= ₹25k"] : reasons,
        details: "Only listed companies. Salary >= ₹25k. No minimum CIBIL. All pincodes accepted.",
        checklist: [
          { label: "Company: Must be Listed (L&T)", passed: isListed },
          { label: "Salary: >= ₹25,000", passed: salaryOk },
          { label: "CIBIL: No Minimum", passed: true },
          { label: "Pincode: Accepted", passed: true }
        ]
      });
    }

    return results;
  };

  const handleCopySummary = () => {
    const results = getEligibilityResults();
    const eligible = results.filter(b => b.eligible).map(b => `✅ ${b.bankName} (${b.reasons.join(', ')})`);
    const ineligible = results.filter(b => !b.eligible).map(b => `❌ ${b.bankName} (Reason: ${b.reasons.join('; ')})`);

    const summaryText = `📋 Bank Eligibility Summary
Company: ${selectedCompany ? `${selectedCompany.name} (${selectedCompany.listedBanks.length > 0 ? 'Listed' : 'Unlisted'})` : (companyInput || 'Not Provided')}
Salary: ₹${(parseFloat(salaryInput) || 0).toLocaleString('en-IN')}/mo
CIBIL: ${cibilInput || 'N/A'}
Pincode: ${pincodeInput || 'N/A'}

Eligible Lenders:
${eligible.length > 0 ? eligible.join('\n') : 'None'}

Ineligible Lenders:
${ineligible.length > 0 ? ineligible.join('\n') : 'None'}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <button 
          role="tab"
          aria-selected={searchMode === 'eligibility'}
          onClick={() => handleModeSwitch('eligibility')} 
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            searchMode === 'eligibility' 
              ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
          }`}
        >
          <Calculator className="w-4 h-4" /> Bank Suggestions
        </button>
      </div>

      {searchMode === 'eligibility' ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Glassmorphic Calculator Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full -mr-8 -mt-8 opacity-50 pointer-events-none"></div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" /> Loan Login Eligibility Check
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Selection */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                  Company Name
                </label>
                {selectedCompany ? (
                  <div className="flex items-center justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-blue-900 block truncate">{selectedCompany.name}</span>
                      <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">
                        Listed in: {selectedCompany.listedBanks.length > 0 ? selectedCompany.listedBanks.join(', ') : 'None'}
                      </span>
                    </div>
                    <button
                      onClick={handleClearCompany}
                      className="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search company (e.g. Tata)..."
                      className="w-full p-3.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-800 font-semibold"
                      value={companyInput}
                      onChange={(e) => setCompanyInput(e.target.value)}
                    />
                    {isCompanySearching && (
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                      </div>
                    )}
                    
                    {/* Autocomplete Suggestions */}
                    {companySuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 overflow-hidden">
                        {companySuggestions.map((company, index) => {
                          const bankName = company.file_name ? company.file_name.replace(/\.[^/.]+$/, "") : "Directory";
                          return (
                            <button
                              key={index}
                              onClick={() => handleSelectCompany(company)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex justify-between items-center"
                            >
                              <span className="font-semibold text-slate-800 text-sm truncate pr-2">
                                {company.company_name}
                              </span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0">
                                {bankName}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => {
                            setSelectedCompany({ name: companyInput, listedBanks: [] });
                            setCompanySuggestions([]);
                          }}
                          className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 text-blue-600 font-bold text-xs transition-colors flex items-center justify-between"
                        >
                          <span>Use entered name (Treat as Unlisted)</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Monthly Net Salary */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                  Monthly Net Salary (INR)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="text"
                    placeholder="Enter monthly net salary..."
                    className="w-full pl-8 pr-4 py-3.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-semibold text-slate-800"
                    value={salaryInput}
                    onChange={(e) => setSalaryInput(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {[15000, 20000, 25000, 30000, 50000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSalaryInput(String(val))}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 hover:text-slate-900 text-slate-600 font-bold rounded-lg transition-colors"
                    >
                      ₹{(val / 1000)}k
                    </button>
                  ))}
                </div>
              </div>

              {/* CIBIL Score */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                  CIBIL Score (300 - 900)
                </label>
                <input
                  type="text"
                  placeholder="Enter CIBIL Score..."
                  className="w-full p-3.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-semibold text-slate-800"
                  value={cibilInput}
                  onChange={(e) => setCibilInput(e.target.value.replace(/[^0-9]/g, ''))}
                />
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {[650, 700, 725, 750].map((val) => (
                    <button
                      key={val}
                      onClick={() => setCibilInput(String(val))}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 hover:text-slate-900 text-slate-600 font-bold rounded-lg transition-colors"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pincode Check */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide flex justify-between items-center">
                  <span>Pincode (6-digit)</span>
                  {isPincodeVerifying && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit Pincode..."
                  className="w-full p-3.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-semibold text-slate-800"
                  value={pincodeInput}
                  onChange={(e) => setPincodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                />
                {pincodeInput.length === 6 && (
                  <div className="mt-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Serviceable for: {pincodeListedBanks.length > 0 ? (
                      <span className="text-emerald-600 font-black">{pincodeListedBanks.join(', ')}</span>
                    ) : (
                      <span className="text-rose-500 font-black">None Listed</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Grid */}
          {(selectedCompany || salaryInput || cibilInput || pincodeInput) && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Login Suggestions</h3>
                <button
                  onClick={handleCopySummary}
                  className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all duration-200 focus:outline-none bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/50"
                >
                  {copied ? (
                    <><Check className="w-3.5 h-3.5" /> Copied Remarks</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copy Remarks Summary</>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {getEligibilityResults().map((bank, index) => (
                  <div
                    key={index}
                    className={`bg-white rounded-2xl border transition-all duration-300 p-6 flex flex-col justify-between ${
                      bank.eligible
                        ? 'border-emerald-200 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/5 bg-gradient-to-b from-white to-emerald-50/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Bank Header */}
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-black text-slate-800 tracking-tight">{bank.bankName}</h4>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-sm ${
                            bank.eligible
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                              : 'bg-rose-50 text-rose-700 border-rose-200/50'
                          }`}
                        >
                          {bank.eligible ? '✅ Eligible' : '❌ Ineligible'}
                        </span>
                      </div>

                      {/* Criteria Details */}
                      <p className="text-xs text-slate-400 mb-4 leading-relaxed italic">{bank.details}</p>

                      {/* Checklist */}
                      <div className="space-y-2 mb-4 bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
                        {bank.checklist.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-semibold">
                            {item.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                            )}
                            <span className={item.passed ? 'text-slate-700' : 'text-rose-700 font-bold'}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Eligibility Reason / Notes */}
                    <div className="mt-2 pt-3 border-t border-slate-100">
                      {bank.eligible ? (
                        <div className="text-xs text-emerald-700 bg-emerald-50/50 border border-emerald-100/50 px-3 py-2 rounded-lg font-bold">
                          {bank.reasons.join(', ')}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-rose-400 font-bold block">Failing Criteria:</span>
                          {bank.reasons.map((reason, rIdx) => (
                            <span key={rIdx} className="text-xs text-rose-600 font-bold block">• {reason}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Search Input */}
          <div className="relative mb-8 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className={`h-6 w-6 transition-colors ${isSearching ? 'text-blue-500' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
            </div>
            <input
              type="text"
              placeholder={searchMode === 'company' ? "Search by exact company name (e.g., Hanva Technologies)..." : "Enter 6-digit Pincode..."}
              className="w-full pl-12 pr-12 py-4 bg-white border-2 border-slate-200 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-lg transition-all placeholder:text-slate-400 font-semibold"
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
        </>
      )}
    </div>
  );
}
