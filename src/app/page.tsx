import { auth } from '@/auth'
import { SignOut } from '@/components/auth/SignOutButton'
import UserAvatar from '@/components/auth/UserAvatar'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <h1 className="text-3xl font-bold text-gray-900">MCP Memory</h1>
          <div className="flex items-center space-x-4">
            <UserAvatar />
            <SignOut />
          </div>
        </div>
        
        <div className="py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome, {session.user?.name}!
            </h2>
            <p className="text-gray-600 mb-8">
              Your personal memory assistant is ready to help you remember important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
