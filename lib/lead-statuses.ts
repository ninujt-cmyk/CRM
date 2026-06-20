import { 
    Sparkles, ThumbsUp, FileText, LogIn, CheckCircle2, 
    ThumbsDown, PhoneForwarded, XCircle, PhoneMissed, Briefcase, Recycle
  } from "lucide-react"
  
  export const MASTER_STATUSES = [
    { value: "new", label: "New", color: "bg-blue-100 text-blue-800", btnColor: "bg-blue-600 hover:bg-blue-700", icon: Sparkles },
    { value: "contacted", label: "Contacted", color: "bg-cyan-100 text-cyan-800", btnColor: "bg-cyan-600 hover:bg-cyan-700", icon: PhoneForwarded },
    { value: "Interested", label: "Interested", color: "bg-green-100 text-green-800", btnColor: "bg-green-600 hover:bg-green-700", icon: ThumbsUp },
    { value: "Documents_Sent", label: "Docs Pending", color: "bg-purple-100 text-purple-800", btnColor: "bg-purple-600 hover:bg-purple-700", icon: FileText },
    { value: "Login Done", label: "Login Done", color: "bg-orange-100 text-orange-800", btnColor: "bg-orange-600 hover:bg-orange-700", icon: LogIn },
    { value: "Transferred to KYC", label: "Transferred to KYC", color: "bg-indigo-100 text-indigo-800", btnColor: "bg-indigo-600 hover:bg-indigo-700", icon: CheckCircle2 },
    { value: "Underwriting", label: "Underwriting", color: "bg-yellow-100 text-yellow-800", btnColor: "bg-yellow-600 hover:bg-yellow-700", icon: FileText },
    { value: "Approved", label: "Approved", color: "bg-emerald-100 text-emerald-800", btnColor: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 },
    { value: "Disbursed", label: "Disbursed", color: "bg-emerald-100 text-emerald-800", btnColor: "bg-emerald-600 hover:bg-emerald-700", icon: CheckCircle2 },
    { value: "Not_Interested", label: "Not Interested", color: "bg-red-100 text-red-800", btnColor: "bg-red-600 hover:bg-red-700", icon: ThumbsDown },
    { value: "follow_up", label: "Call Back", color: "bg-indigo-100 text-indigo-800", btnColor: "bg-indigo-600 hover:bg-indigo-700", icon: PhoneForwarded },
    { value: "not_eligible", label: "Not Eligible", color: "bg-rose-100 text-rose-800", btnColor: "bg-rose-600 hover:bg-rose-700", icon: XCircle },
    { value: "nr", label: "NR", color: "bg-gray-100 text-gray-800", btnColor: "bg-slate-600 hover:bg-slate-700", icon: PhoneMissed },
    { value: "self_employed", label: "Self Employed", color: "bg-amber-100 text-amber-800", btnColor: "bg-amber-600 hover:bg-amber-700", icon: Briefcase },
    { value: "recycle_pool", label: "Recycle Pool", color: "bg-gray-200 text-gray-800", btnColor: "bg-gray-600 hover:bg-gray-700", icon: Recycle }
  ];
  
  export const DEFAULT_WORKFLOW_TRIGGERS = {
    on_document_request: "Documents_Sent",
    on_kyc_transfer: "Transferred to KYC",
    on_revenue_marked: "Disbursed",
    on_login_done: "Login Done"
  };
  
