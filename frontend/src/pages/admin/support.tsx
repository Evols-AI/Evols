import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { MessageSquare, Mail, User, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, Check } from 'lucide-react'
import { isAuthenticated, getCurrentUser } from '@/utils/auth'
import Header from '@/components/Header'

interface SupportTicket {
  id: string
  name: string
  email: string
  topic: string
  message: string
  status: string
  created_at: string
}

export default function SupportTicketsAdmin() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState<string[]>(['open', 'in_progress', 'resolved', 'closed'])
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    const userData = getCurrentUser()
    setCurrentUser(userData)

    if (userData?.role !== 'SUPER_ADMIN') {
      setError('Access denied')
      setLoading(false)
      return
    }

    loadTickets()
  }, [router])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTickets = async () => {
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/support/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error('Failed to load support tickets')
      }

      const data = await response.json()
      setTickets(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/support/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to update ticket status')
      }

      await loadTickets()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string, icon: any }> = {
      open: { color: 'bg-[#A78BFA]/10 dark:bg-[#A78BFA]/10 text-[#8B5CF6] dark:text-[#A78BFA]', icon: AlertCircle },
      in_progress: { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', icon: Clock },
      resolved: { color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', icon: CheckCircle },
      closed: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300', icon: XCircle }
    }

    const config = statusConfig[status] || statusConfig.open
    const Icon = config.icon

    return (
      <span className={`px-2 py-1 text-xs rounded inline-flex items-center gap-1 ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const getTopicIcon = (topic: string) => {
    switch (topic) {
      case 'technical':
        return '🔧'
      case 'billing':
        return '💳'
      case 'feature_request':
        return '💡'
      default:
        return '💬'
    }
  }

  const toggleStatusFilter = (status: string) => {
    setFilterStatus(prev => {
      if (prev.includes(status)) {
        // Don't allow removing all filters
        if (prev.length === 1) return prev
        return prev.filter(s => s !== status)
      } else {
        return [...prev, status]
      }
    })
  }

  const getFilterDisplayText = () => {
    if (filterStatus.length === 4) return 'All Status'
    const statusNames = filterStatus.map(s => {
      if (s === 'in_progress') return 'In Progress'
      return s.charAt(0).toUpperCase() + s.slice(1)
    })
    return statusNames.join(' & ')
  }

  const filteredTickets = tickets.filter(ticket => filterStatus.includes(ticket.status))

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Support Tickets - Evols Admin</title>
      </Head>

      <Header user={currentUser} currentPage="support" />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl text-gray-900 dark:text-white mb-2">
                  Support Tickets
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage customer support requests
                </p>
              </div>
              <div className="relative" ref={statusDropdownRef}>
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[180px]"
                >
                  <span className="text-sm font-medium">{getFilterDisplayText()}</span>
                  <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>

                {showStatusDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50">
                    <div className="p-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">
                        Filter by Status
                      </div>
                      {[
                        { value: 'open', label: 'Open', color: 'text-[#A78BFA] dark:text-[#A78BFA]' },
                        { value: 'in_progress', label: 'In Progress', color: 'text-yellow-600 dark:text-yellow-400' },
                        { value: 'resolved', label: 'Resolved', color: 'text-green-600 dark:text-green-400' },
                        { value: 'closed', label: 'Closed', color: 'text-gray-600 dark:text-gray-400' },
                      ].map((status) => (
                        <button
                          key={status.value}
                          onClick={() => toggleStatusFilter(status.value)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          <div className="w-4 h-4 flex items-center justify-center border-2 border-gray-300 dark:border-gray-500 rounded">
                            {filterStatus.includes(status.value) && (
                              <Check className="w-3 h-3 text-[#A78BFA] dark:text-[#A78BFA]" />
                            )}
                          </div>
                          <span className={`text-sm font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</div>
              <div className="text-2xl text-gray-900 dark:text-white">{tickets.length}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Open</div>
              <div className="text-2xl text-[#A78BFA] dark:text-[#A78BFA]">
                {tickets.filter(t => t.status === 'open').length}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">In Progress</div>
              <div className="text-2xl text-yellow-600 dark:text-yellow-400">
                {tickets.filter(t => t.status === 'in_progress').length}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Resolved</div>
              <div className="text-2xl text-green-600 dark:text-green-400">
                {tickets.filter(t => t.status === 'resolved').length}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Closed</div>
              <div className="text-2xl text-gray-600 dark:text-gray-400">
                {tickets.filter(t => t.status === 'closed').length}
              </div>
            </div>
          </div>

          {/* Tickets List */}
          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl text-gray-900 dark:text-white mb-2">
                  No tickets found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {filterStatus.length < 4 ? 'No tickets with the selected status filters' : 'No support tickets yet'}
                </p>
              </div>
            ) : (
              filteredTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getTopicIcon(ticket.topic)}</span>
                        <h3 className="text-lg text-gray-900 dark:text-white capitalize">
                          {ticket.topic.replace('_', ' ')}
                        </h3>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {ticket.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {ticket.email}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(ticket.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
