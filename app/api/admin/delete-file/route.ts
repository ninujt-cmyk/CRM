import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/meilisearch';

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json();

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    const client = adminClient();
    const index = client.index('companies');

    // 1. CRUCIAL: Meilisearch requires an attribute to be "filterable" before you can delete by it.
    // We update the settings here to guarantee it works.
    await index.updateFilterableAttributes(['file_name']);

    // 2. Execute the deletion filter
    // This tells Meilisearch: "Delete every document where file_name equals the requested name"
    const task = await index.deleteDocuments({
      filter: `file_name = "${fileName}"`
    });

    return NextResponse.json({ success: true, taskUid: task.taskUid });

  } catch (error) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete file data' }, { status: 500 });
  }
}
