import { UserForm } from "@/components/admin/user-form"
export default function NewUserPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Add New User</h1>
        <p className="text-gray-600 mt-1">Create a new user and assign them to a team.</p>
      </div>
      
      <UserForm />
    </div>
  )
}
