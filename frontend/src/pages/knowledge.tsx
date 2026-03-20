import { useEffect } from 'react'
import { useRouter } from 'next/router'

// Redirect /knowledge to /context?tab=strategy
export default function KnowledgeRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/context?tab=strategy')
  }, [router])

  return null
}
