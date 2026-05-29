import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KycSidebar, { UserProfile } from "@/components/kyc-team/KycSidebar";
import { Watermark } from "@/components/watermark"; // <--- 1. IMPORT THIS

export default async function KycTeamLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single();
    
  if (error || !profile) {
      console.error("Profile fetch error in KYC Layout:", error || "Profile not found.");
      redirect("/"); 
  }
  
  if (profile.role !== 'kyc_team') {
    console.warn(`Access denied for user ${user.id}. Role is ${profile.role}.`);
    redirect("/"); 
  }

  const userProfile: UserProfile = {
    full_name: profile.full_name,
    role: profile.role,
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Watermark /> {/* <--- 2. ADD COMPONENT HERE */}
      
      {/* Sidebar */}
      <KycSidebar userProfile={userProfile} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden pt-4 md:ml-64 w-full relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
