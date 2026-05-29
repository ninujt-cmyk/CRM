"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, LayoutDashboard, FileText, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client"; // Import Supabase client

export interface UserProfile {
    full_name: string | null;
    role: string | null;
}

const navItems = [
    { name: "Dashboard", href: "/kyc-team", icon: LayoutDashboard },
    { name: "My Leads", href: "/kyc-team/leads", icon: FileText },
];

export default function KycSidebar({ userProfile }: { userProfile: UserProfile }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    // Updated Sign Out Logic
    const handleSignOut = async () => {
        // 1. Sign out from Supabase to clear the session cookie
        await supabase.auth.signOut();
        
        // 2. Refresh the router to clear Next.js client-side cache
        // This ensures the middleware knows the user is gone
        router.refresh();
        
        // 3. Force redirect to the login page
        router.replace("/auth/login");
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-white border-r border-gray-200 md:block shadow-lg">
                <div className="flex h-full flex-col justify-between p-6">
                    {/* Header/Logo */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 text-2xl font-bold text-primary">
                            <ShieldCheck className="w-8 h-8 text-purple-600" />
                            <span>KYC Portal</span>
                        </div>

                        {/* User Profile Info */}
                        <div className="flex items-center p-3 bg-gray-100 rounded-lg">
                            <div className="bg-purple-100 p-2 rounded-full mr-3">
                                <User className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-semibold truncate">{userProfile.full_name || "KYC User"}</p>
                                <p className="text-xs text-gray-500 capitalize">{userProfile.role?.replace('_', ' ') || "KYC"}</p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="space-y-2">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link key={item.name} href={item.href} passHref>
                                        <div
                                            className={`
                                                flex items-center px-4 py-2 rounded-lg transition-colors duration-150 cursor-pointer
                                                ${isActive
                                                    ? "bg-purple-100 text-purple-700 font-semibold"
                                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                                                }
                                            `}
                                        >
                                            <item.icon className="w-5 h-5 mr-3" />
                                            {item.name}
                                        </div>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Footer / Logout */}
                    <div className="mt-auto pt-6 border-t border-gray-100">
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={handleSignOut}
                        >
                            <LogOut className="w-5 h-5 mr-3" />
                            Sign Out
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
