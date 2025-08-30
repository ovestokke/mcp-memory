import { env } from '@/env'
import { protectedResourceHandler } from 'mcp-handler'

const handler = protectedResourceHandler({ authServerUrls: [env.NEXTAUTH_URL] })

export { handler as GET }
