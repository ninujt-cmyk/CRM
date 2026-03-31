import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/meilisearch';
import Papa from 'papaparse';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileText = await file.text();
    let data: any[] = [];

    // 1. Parse based on file type
    if (file.name.toLowerCase().endsWith('.csv')) {
      const parsedCsv = Papa.parse(fileText, {
        header: true, // Uses the first row as object keys (id, company_name, pincode)
        skipEmptyLines: true,
      });
      data = parsedCsv.data;
    } else if (file.name.toLowerCase().endsWith('.json')) {
      data = JSON.parse(fileText);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload .csv or .json' }, 
        { status: 400 }
      );
    }

    // 2. Data Cleaning: Ensure formatting is standard before saving
    const formattedData = data.map((row) => {
      if (row.company_name) {
        // Standardize formatting for private limited companies
        row.company_name = row.company_name
          .replace(/\bpvt\.?\b/gi, 'PVT')
          .replace(/\bltd\.?\b/gi, 'LTD');
      }
      return row;
    });

    // 3. Send to Meilisearch
    const client = adminClient();
    const task = await client.index('companies').addDocuments(formattedData);

    return NextResponse.json({ success: true, taskUid: task.taskUid });

  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Failed to upload data' }, { status: 500 });
  }
}
