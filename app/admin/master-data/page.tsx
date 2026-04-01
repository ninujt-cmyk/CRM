"use client";

import { useState } from 'react';

export default function MasterDataPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'company' | 'pincode'>('company');
  const [file, setFile] = useState<File | null>(null);

  // Generates a sample CSV file on the fly for the admin to download
  const downloadSample = () => {
    let csvContent = "";
    let fileName = "";

    if (uploadType === 'company') {
      csvContent = "company_name,category\nHanva Technologies PVT LTD,IT Software\nTata Consultancy Services,IT Services";
      fileName = "sample_company_upload.csv";
    } else {
      csvContent = "pincode,city\n560001,Bengaluru\n400001,Mumbai";
      fileName = "sample_pincode_upload.csv";
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadType', uploadType); // Tell the server which format this is

    try {
      const response = await fetch('/api/admin/upload-companies', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        alert(`${uploadType === 'company' ? 'Company' : 'Pincode'} data uploaded successfully!`);
        setFile(null); // Reset the file input
        // Optional: Reset the actual HTML input element if you use a ref
      } else {
        const errorData = await response.json();
        alert(`Upload failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("A network error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Master Data Management</h1>
      
      <div className="p-6 border border-gray-200 rounded-xl bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-6">Upload Directory Data</h2>
        
        {/* Step 1: Select Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Data Type to Upload</label>
          <select 
            className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as 'company' | 'pincode')}
          >
            <option value="company">Company Data (Company Name, Category)</option>
            <option value="pincode">Pincode Data (Pincode, City)</option>
          </select>
        </div>

        {/* Step 2: Download Sample */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900">Need the exact Excel/CSV format?</p>
            <p className="text-sm text-blue-700 mt-1">
              Columns required: <strong className="font-mono bg-blue-100 px-1 rounded">
                {uploadType === 'company' ? 'company_name, category' : 'pincode, city'}
              </strong>
            </p>
          </div>
          <button 
            onClick={downloadSample}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Download Sample CSV
          </button>
        </div>

        {/* Step 3: File Selection & Submit */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">2. Select your filled CSV file</label>
          <input 
            type="file" 
            accept=".csv, .json" 
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
          />
        </div>

        <button 
          onClick={handleUploadSubmit}
          disabled={!file || isUploading}
          className={`w-full mt-4 py-3 rounded-lg font-bold text-white transition-colors ${
            !file || isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-md'
          }`}
        >
          {isUploading ? 'Uploading to Database...' : 'Upload Data'}
        </button>
      </div>
    </div>
  );
}
