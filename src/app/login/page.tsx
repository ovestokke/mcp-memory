import { auth } from '@/auth'
import { SignIn } from '@/components/auth/SignInButton'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const session = await auth()
  
  if (session) {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to MCP Memory
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Connect your Google account to access your personal memory assistant
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <SignIn />
        </div>
      </div>
    </div>
  )
}