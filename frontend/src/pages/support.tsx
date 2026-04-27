import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Send, User, Mail, MessageSquare, AlertCircle, CheckCircle, Moon, Sun, ChevronDown, Check } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { LogoWordmark } from '@/components/Logo'

export default function Support() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const [formData, setFormData] = useState({ name: '', email: '', topic: 'general', message: '' })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [showTopicDropdown, setShowTopicDropdown] = useState(false)

  useEffect(() => {
    document.body.style.background = ''
    document.body.style.backgroundImage = 'none'
  }, [dark])

  const topicOptions = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'technical', label: 'Technical Support' },
    { value: 'billing', label: 'Billing issue' },
    { value: 'feedback', label: 'Product Feedback' }
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const response = await fetch(`${apiUrl}/api/v1/support/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (!response.ok) throw new Error('Failed to submit support ticket')
      setStatus('success')
      setFormData({ name: '', email: '', topic: 'general', message: '' })
    } catch (error) {
      setStatus('error')
    }
  }

  const textPrimary = 'text-foreground'
  const textMuted = 'text-muted-foreground'
  const iconClass = `h-5 w-5 text-muted-foreground`
  const inputClass = `block w-full pl-10 pr-3 py-3 border rounded-lg text-sm transition-colors outline-none ${dark ? 'border-border bg-input text-foreground placeholder-muted-foreground focus:border-ring/50 focus:ring-1 focus:ring-ring/30' : 'border-border bg-card text-foreground placeholder-muted-foreground focus:border-ring/50 focus:ring-1 focus:ring-ring/30'}`
  const labelClass = `block text-sm font-medium mb-2 text-muted-foreground`

  return (
    <>
      <Head>
        <title>Contact Support | Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className={`min-h-screen flex flex-col transition-colors bg-background`}>
        <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-border backdrop-blur-xl bg-background/80 transition-colors duration-300`}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/">
              <LogoWordmark iconSize={36} />
            </Link>
            <div className="flex items-center space-x-4">
              <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" aria-label="Toggle theme">
                {theme === 'light' ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
              </button>
              <Link href="/login" className={`hidden md:block text-sm transition-colors ${textMuted} hover:text-primary`}>Login</Link>
              <Link href="/register" className="bg-primary hover:bg-primary/85 text-primary-foreground py-2 px-5 rounded-lg text-sm font-medium transition-colors">
                Get Early Access
              </Link>
            </div>
          </div>
        </nav>
        <div className="h-16" />

        <main className="flex-grow container mx-auto px-6 py-12 flex items-center justify-center">
          <div className="w-full max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left */}
              <div className="hidden lg:flex flex-col justify-center h-full">
                <img src="/Collab-rafiki.svg" alt="Collaboration illustration" className="w-full max-w-md mx-auto mb-10 drop-shadow-lg" />
                <div className="text-center px-8">
                  <h2 className={`text-3xl font-medium mb-4 ${textPrimary}`}>We're here to help!</h2>
                  <p className={textMuted}>
                    Whether you have a question about features, pricing, or need technical support, our team is ready to answer all your questions.
                  </p>
                </div>
              </div>

              {/* Right - Form */}
              <div className={`py-10 px-8 rounded-2xl border bg-card border-border`}>
                <h2 className={`text-2xl font-medium mb-6 text-center ${textPrimary}`}>Contact Us</h2>

                {status === 'success' ? (
                  <div className="rounded-xl bg-chart-3/15 p-8 text-center flex flex-col items-center">
                    <CheckCircle className="h-14 w-14 text-chart-3 mb-4" />
                    <h3 className={`text-xl font-medium mb-2 ${textPrimary}`}>Message Sent!</h3>
                    <p className={`mb-6 ${textMuted}`}>Thanks for reaching out. Our support team will get back to you within 24 hours.</p>
                    <button onClick={() => setStatus('idle')} className="bg-primary hover:bg-primary/85 text-primary-foreground px-6 py-2 rounded-lg font-medium text-sm transition-colors">
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form className="space-y-5" onSubmit={handleSubmit}>
                    {status === 'error' && (
                      <div className={`rounded-lg p-4 border flex items-start gap-3 ${dark ? 'bg-destructive/10 border-destructive/20' : 'bg-destructive/10 border-destructive/30'}`}>
                        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive">Failed to send message. Please try again later.</p>
                      </div>
                    )}

                    <div>
                      <label htmlFor="name" className={labelClass}>Full Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className={iconClass} />
                        </div>
                        <input id="name" name="name" type="text" required value={formData.name} onChange={handleChange}
                          className={inputClass} placeholder="John Doe" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className={labelClass}>Email address</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className={iconClass} />
                        </div>
                        <input id="email" name="email" type="email" required value={formData.email} onChange={handleChange}
                          className={inputClass} placeholder="you@company.com" />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>What can we help you with?</label>
                      <div className="relative">
                        <button type="button" onClick={() => setShowTopicDropdown(!showTopicDropdown)}
                          className={`w-full flex items-center justify-between px-3 py-3 border rounded-lg text-sm transition-colors ${dark ? 'border-border bg-input text-foreground' : 'border-border bg-card text-foreground'}`}>
                          <span>{topicOptions.find(opt => opt.value === formData.topic)?.label}</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground`} />
                        </button>
                        {showTopicDropdown && (
                          <div className={`absolute z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden bg-card border-border`}>
                            <div className="p-1">
                              {topicOptions.map((option) => (
                                <button key={option.value} type="button"
                                  onClick={() => { setFormData({ ...formData, topic: option.value }); setShowTopicDropdown(false); }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${formData.topic === option.value
                                    ? 'bg-primary/10 text-primary'
                                    : `${textPrimary} hover:bg-black/5 dark:hover:bg-white/5`}`}>
                                  {option.label}
                                  {formData.topic === option.value && <Check className="h-4 w-4 text-primary" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className={labelClass}>Message</label>
                      <div className="relative">
                        <div className="absolute top-3 left-3 pointer-events-none">
                          <MessageSquare className={iconClass} />
                        </div>
                        <textarea id="message" name="message" rows={4} required value={formData.message} onChange={handleChange}
                          className={`${inputClass} resize-none`} placeholder="How can we help?" />
                      </div>
                    </div>

                    <button type="submit" disabled={status === 'submitting'}
                      className="w-full flex justify-center items-center gap-2 py-3 px-6 text-primary-foreground bg-primary hover:bg-primary/85 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {status === 'submitting' ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Message
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </main>

        <footer className={`border-t border-border py-12 transition-colors duration-300`}>
          <div className={`max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-muted-foreground`}>
            <LogoWordmark iconSize={32} />
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <Link href="/docs" className="text-sm transition-colors duration-150 hover:text-primary">Docs</Link>
              <Link href="/support" className="text-sm transition-colors duration-150 hover:text-primary">Support</Link>
              <Link href="/login" className="text-sm transition-colors duration-150 hover:text-primary">Login</Link>
            </div>
            <p className="text-xs">© 2026 Evols AI</p>
          </div>
        </footer>
      </div>
    </>
  )
}
