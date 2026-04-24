import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function TeamIntelligenceRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/work-context?tab=ai-sessions')
  }, [])
  return null
}
