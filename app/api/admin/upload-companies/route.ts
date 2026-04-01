import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/meilisearch';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chunk, uploadType, fileName } = body;

    if (!chunk || !Array.isArray(chunk)) {
      return NextResponse.json({ error: 'Invalid batch data' }, { status: 400 });
    }

    // Process and clean the data chunk
    const formattedData = chunk.map((row: any) => {
      row.id = randomUUID();
      row.file_name = fileName;
      row.data_type = uploadType;

      if (uploadType === 'company' && row.company_name) {
        // Ensure Pvt and ltd are strictly capital letters
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
    console.error('Batch Upload Error:', error);
    return NextResponse.json({ error: 'Failed to upload batch' }, { status: 500 });
  }
}
