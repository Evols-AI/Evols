import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { Sparkles, Mail, User, Building, MessageSquare, CheckCircle, Calendar } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'

export default function BookDemo() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    company: '',
    job_title: '',
    company_size: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1500)
  }

  if (submitted) {
    return (
      <>
        <Head><title>Thank You - ProductOS</title></Head>
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl text-center">
            <div className="mb-8">
              <Link href="/" className="inline-flex items-center justify-center space-x-2 mb-2">
                <LogoIcon size={64} />
              </Link>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12">
              <svg viewBox="0 0 250 250" className="w-64 mx-auto mb-8 drop-shadow-lg">
                <defs>
                  <linearGradient id="successGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#10b981',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#059669',stopOpacity:1}} />
                  </linearGradient>
                </defs>
                <circle cx="125" cy="125" r="100" fill="url(#successGrad)" opacity="0.1"/>
                <circle cx="125" cy="125" r="75" fill="url(#successGrad)"/>
                <path d="M 85 125 L 110 150 L 170 95" stroke="white" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Thank You!</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                We've received your demo request. Our team will reach out within 1 business day to schedule a personalized demo.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">30-Min Demo</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Live walkthrough tailored to your needs</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Sparkles className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">AI Features</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">See personas and clustering in action</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <MessageSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">Q&A</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Ask questions about your use case</p>
                </div>
              </div>
              <Link href="/" className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition">
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head><title>Book a Demo - ProductOS</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Header */}
        <header className="container mx-auto px-6 py-8">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <LogoIcon size={40} />
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">ProductOS</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/login" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Login</Link>
              <Link href="/register" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-2 rounded-lg hover:opacity-90 transition">
                Get Started
              </Link>
            </div>
          </nav>
        </header>

        <div className="container mx-auto px-6 py-12">
          <div className="w-full max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Left - Info */}
              <div className="flex flex-col justify-center">
                <svg viewBox="0 0 300 300" className="w-full max-w-sm mx-auto mb-8 drop-shadow-lg">
                  <defs>
                    <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor:'#6366f1',stopOpacity:1}} />
                      <stop offset="100%" style={{stopColor:'#8b5cf6',stopOpacity:1}} />
                    </linearGradient>
                  </defs>
                  <rect x="60" y="60" width="180" height="200" rx="8" fill="url(#calGrad)" opacity="0.9"/>
                  <rect x="60" y="60" width="180" height="40" rx="8" fill="white" opacity="0.2"/>
                  <rect x="80" y="45" width="20" height="30" rx="4" fill="url(#calGrad)"/>
                  <rect x="200" y="45" width="20" height="30" rx="4" fill="url(#calGrad)"/>
                  {[0,1,2,3].map(row => [0,1,2,3].map(col => (
                    <rect key={`${row}-${col}`} x={85 + col * 40} y={120 + row * 30} width="30" height="20" rx="3" fill="white" opacity="0.3"/>
                  )))}
                  <rect x="85" y="210" width="30" height="20" rx="3" fill="#10b981"/>
                  <circle cx="260" cy="220" r="25" fill="#10b981"/>
                  <path d="M 250 220 L 257 227 L 270 212" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
                </svg>
                <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">See ProductOS in Action</h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                  Book a 30-minute personalized demo to see how ProductOS can transform your product decision-making.
                </p>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">AI-Powered Insights</h3>
                      <p className="text-gray-600 dark:text-gray-400">See how AI clustering and digital twin personas work with your data</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">Tailored to Your Needs</h3>
                      <p className="text-gray-600 dark:text-gray-400">We'll customize the demo based on your specific use case and goals</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">No Pressure</h3>
                      <p className="text-gray-600 dark:text-gray-400">Just a friendly conversation about how we can help you make better product decisions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - Form */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Request a Demo</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        id="full_name" name="full_name" type="text" required
                        value={formData.full_name} onChange={handleChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Work Email *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        id="email" name="email" type="email" required
                        value={formData.email} onChange={handleChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        id="company" name="company" type="text" required
                        value={formData.company} onChange={handleChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Acme Inc"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title *</label>
                    <input
                      id="job_title" name="job_title" type="text" required
                      value={formData.job_title} onChange={handleChange}
                      className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Product Manager"
                    />
                  </div>

                  <div>
                    <label htmlFor="company_size" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Size *</label>
                    <select
                      id="company_size" name="company_size" required
                      value={formData.company_size} onChange={handleChange}
                      className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select company size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tell us about your use case (optional)</label>
                    <textarea
                      id="message" name="message" rows={4}
                      value={formData.message} onChange={handleChange}
                      className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Tell us what you're looking to achieve with ProductOS..."
                    />
                  </div>

                  <button
                    type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Submitting...' : 'Book Demo'}
                  </button>

                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    By submitting this form, you agree to receive communications from ProductOS.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
