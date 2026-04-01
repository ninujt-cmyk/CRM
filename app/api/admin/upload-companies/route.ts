import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/meilisearch';
import Papa from 'papaparse';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadType = formData.get('uploadType') as string; // 'company' or 'pincode'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const uploadedFileName = file.name; 
    const fileText = await file.text();
    let data: any[] = [];

    if (file.name.toLowerCase().endsWith('.csv')) {
      const parsedCsv = Papa.parse(fileText, {
        header: true,
        skipEmptyLines: true,
      });
      data = parsedCsv.data;
    } else if (file.name.toLowerCase().endsWith('.json')) {
      data = JSON.parse(fileText);
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use .csv or .json' }, { status: 400 });
    }

    // Process and clean the data
    const formattedData = data.map((row) => {
      // Auto-generate an ID so the admin doesn't need an 'id' column in the Excel file
      row.id = randomUUID();
      row.file_name = uploadedFileName;
      row.data_type = uploadType; // Tag the data type

      // Clean company names only if it's a company upload
      if (uploadType === 'company' && row.company_name) {
        row.company_name = row.company_name
          .replace(/\bpvt\.?\b/gi, 'PVT')
          .replace(/\bltd\.?\b/gi, 'LTD');
      }
      
      return row;
    });

    const client = adminClient();
    const task = await client.index('companies').addDocuments(formattedData);

    return NextResponse.json({ success: true, taskUid: task.taskUid });

  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Failed to upload data' }, { status: 500 });
  }
}
