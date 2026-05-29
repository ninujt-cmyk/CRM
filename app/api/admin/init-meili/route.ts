import { NextResponse } from 'next/server';
import { createClient as createServerClient } from "@/lib/supabase/server";
import { adminClient } from '@/lib/meilisearch';

export async function GET() {
  try {
    // 🔒 AUTH CHECK (To ensure only logged-in tenant admins can trigger initialization)
    const supabase = await createServerClient();
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userCheck } = await supabase
      .from("users")
      .select("role, tenant_id")
      .eq("id", currentUser.id)
      .single();

    const allowedRoles = ["super_admin", "tenant_admin", "team_leader"];
    if (!userCheck?.role || !allowedRoles.includes(userCheck.role)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to execute this admin action." }, { status: 403 });
    }

    const tenantId = userCheck?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID not found for active user profile." }, { status: 400 });
    }

    console.log("⚙️ Paginated Initialization of Meilisearch index settings and migrating legacy documents...");

    const client = adminClient();
    const index = client.index('companies');
    
    // 1. Register 'tenant_id' and 'file_name' as filterable attributes in Meilisearch.
    await index.updateFilterableAttributes(['tenant_id', 'file_name']);

    // 2. Register 'company_name' and 'pincode' as searchable attributes in Meilisearch.
    // This is critical because using 'attributesToSearchOn' in search queries requires those fields to be explicitly searchable.
    await index.updateSearchableAttributes(['company_name', 'pincode']);

    // 2. Paginate through the entire Meilisearch database to find and update all legacy records (both companies & pincodes)
    let offset = 0;
    const limit = 1000; // Meilisearch maximum retrieval batch limit
    let totalMigrated = 0;
    let totalInIndex = 0;

    while (true) {
      // Fetch documents in batches of 1,000
      const response = await index.getDocuments({ limit, offset });
      const documents = response.results || [];
      
      if (documents.length === 0) {
        break; // Reached the end of the index
      }
      
      totalInIndex += documents.length;
      
      const docsToUpdate = [];
      
      for (const doc of documents) {
        const updatedDoc = { ...doc };
        let needsUpdate = false;

        // 1. Stamp tenant_id if missing
        if (!updatedDoc.tenant_id) {
          updatedDoc.tenant_id = tenantId;
          needsUpdate = true;
        }

        // 2. Normalize pincode (handle cases, trailing spaces, convert numbers to string)
        const pincodeKey = Object.keys(updatedDoc).find(k => k.toLowerCase().trim() === 'pincode');
        if (pincodeKey) {
          const rawPincode = updatedDoc[pincodeKey];
          const cleanPincode = typeof rawPincode === 'string' ? rawPincode.trim() : String(rawPincode || '').trim();
          
          if (updatedDoc.pincode !== cleanPincode || pincodeKey !== 'pincode') {
            updatedDoc.pincode = cleanPincode;
            if (pincodeKey !== 'pincode') {
              delete updatedDoc[pincodeKey];
            }
            needsUpdate = true;
          }
        }

        // 3. Normalize company_name
        const companyKey = Object.keys(updatedDoc).find(k => k.toLowerCase().trim() === 'company_name' || k.toLowerCase().trim() === 'company name');
        if (companyKey) {
          const rawCompany = updatedDoc[companyKey];
          const cleanCompany = typeof rawCompany === 'string' ? rawCompany.trim() : String(rawCompany || '').trim();
          
          if (updatedDoc.company_name !== cleanCompany || companyKey !== 'company_name') {
            updatedDoc.company_name = cleanCompany;
            if (companyKey !== 'company_name') {
              delete updatedDoc[companyKey];
            }
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          docsToUpdate.push(updatedDoc);
        }
      }

      if (docsToUpdate.length > 0) {
        // Batch upload the updated records to Meilisearch
        await index.addDocuments(docsToUpdate);
        totalMigrated += docsToUpdate.length;
      }
      
      offset += limit;
      
      // Safety brake to prevent any runaway execution loops
      if (offset >= 150000) {
        console.warn("⚠️ Migration limit safeguard reached (150k documents).");
        break;
      }
    }

    console.log(`✅ Paginated migration completed. Successfully stamped ${totalMigrated} legacy records (companies/pincodes) with tenant_id: ${tenantId}`);

    return NextResponse.json({ 
      success: true, 
      message: `Meilisearch index successfully initialized. Paginated and migrated all ${totalMigrated} legacy company and pincode records to your tenant.`,
      totalRecordsInIndex: totalInIndex,
      migratedCount: totalMigrated
    });

  } catch (error: any) {
    console.error('Init Meili Paginated Migration Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to initialize Meilisearch' }, { status: 500 });
  }
}
