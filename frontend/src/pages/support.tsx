import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { Send, User, Mail, MessageSquare, AlertCircle, CheckCircle, Moon, Sun, ChevronDown, Check } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'
import { useTheme } from '@/contexts/ThemeContext'

export default function Support() {
    const { theme, toggleTheme } = useTheme()
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        topic: 'general',
        message: ''
    })
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
    const [showTopicDropdown, setShowTopicDropdown] = useState(false)

    const topicOptions = [
        { value: 'general', label: 'General Inquiry' },
        { value: 'technical', label: 'Technical Support' },
        { value: 'billing', label: 'Billing issue' },
        { value: 'feedback', label: 'Product Feedback' }
    ]

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus('submitting')

        try {
            const response = await fetch('http://localhost:8000/api/v1/support/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            })

            if (!response.ok) {
                throw new Error('Failed to submit support ticket')
            }

            setStatus('success')
            setFormData({ name: '', email: '', topic: 'general', message: '' })
        } catch (error) {
            console.error('Error submitting support ticket:', error)
            setStatus('error')
        }
    }

    return (
        <>
            <Head>
                <title>Contact Support | Evols</title>
            </Head>

            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex flex-col">
                {/* Header */}
                <header className="container mx-auto px-6 py-8">
                    <nav className="flex items-center justify-between">
                        <Link href="/" className="flex items-center space-x-2 border-b-2 border-transparent">
                            <LogoIcon size={60} />
                            <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                                Evols
                            </span>
                        </Link>
                        <div className="flex items-center space-x-6">
                            <a href="https://github.com/akshay-saraswat/evols"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden md:flex items-center space-x-2 px-6 py-2 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-300 transform hover:scale-105 active:scale-95"
                                aria-label="View on GitHub"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">GitHub</span>
                            </a>
                            <button onClick={toggleTheme}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition transform hover:scale-110 active:scale-90 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                                aria-label="Toggle theme"
                            >
                                {theme === 'light' ? (
                                    <Moon className="w-5 h-5 text-gray-600" />
                                ) : (
                                    <Sun className="w-5 h-5 text-gray-300" />
                                )}
                            </button>
                            <Link href="/login" className="hidden md:block text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white font-medium">
                                Login
                            </Link>
                            <Link href="/register"
                                className="bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-500 ease-in-out hover:scale-110 hover:brightness-110 hover:animate-pulse active:animate-bounce"
                            >
                                Get Started
                            </Link>
                        </div>
                    </nav>
                </header>

                <main className="flex-grow container mx-auto px-6 py-12 flex items-center justify-center">
                    <div className="w-full max-w-6xl">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            {/* Left - Illustration */}
                            <div className="hidden lg:flex flex-col justify-center h-full">
                                <svg viewBox="0 0 400 350" className="w-full max-w-md mx-auto mb-10 drop-shadow-lg">
                                    <defs>
                                        <linearGradient id="supportGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#8b5cf6" />
                                            <stop offset="100%" stopColor="#ec4899" />
                                        </linearGradient>
                                        <linearGradient id="supportGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#8b5cf6" />
                                        </linearGradient>
                                        <filter id="supportGlow" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="8" result="blur" />
                                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                        </filter>
                                        <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                                            <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.2" />
                                        </filter>
                                    </defs>

                                    {/* Background Ring */}
                                    <circle cx="200" cy="175" r="130" fill="url(#supportGrad2)" opacity="0.1" filter="url(#supportGlow)">
                                        <animateTransform attributeName="transform" type="rotate" values="0 200 175; 360 200 175" dur="20s" repeatCount="indefinite" />
                                    </circle>

                                    {/* Support Chat Box */}
                                    <g filter="url(#badgeShadow)" transform="translate(130, 80)">
                                        <rect x="0" y="0" width="160" height="120" rx="16" fill="white" className="dark:fill-gray-800" stroke="url(#supportGrad1)" strokeWidth="2" />

                                        {/* Chat lines */}
                                        <rect x="25" y="30" width="110" height="8" rx="4" fill="#f3f4f6" className="dark:fill-gray-700" />
                                        <rect x="25" y="50" width="80" height="8" rx="4" fill="#f3f4f6" className="dark:fill-gray-700" />
                                        <rect x="25" y="70" width="90" height="8" rx="4" fill="#f3f4f6" className="dark:fill-gray-700" />

                                        {/* Avatar placehgolder */}
                                        <circle cx="40" cy="95" r="10" fill="url(#supportGrad2)" opacity="0.5" />
                                        <rect x="55" y="93" width="40" height="4" rx="2" fill="url(#supportGrad2)" />
                                    </g>

                                    {/* Paper Airplane */}
                                    <g filter="url(#badgeShadow)" transform="translate(110, 180)">
                                        <path d="M 0 30 L 70 0 L 30 70 L 25 45 Z" fill="url(#supportGrad1)" />
                                        <animateTransform attributeName="transform" type="translate" values="110,180; 120,170; 110,180" dur="4s" repeatCount="indefinite" />
                                    </g>

                                    {/* Floating Elements */}
                                    <circle cx="280" cy="120" r="15" fill="#f59e0b" filter="url(#badgeShadow)">
                                        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-10; 0,0" dur="3s" repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="150" cy="220" r="10" fill="#10b981" filter="url(#badgeShadow)">
                                        <animateTransform attributeName="transform" type="translate" values="0,0; 0,10; 0,0" dur="4s" repeatCount="indefinite" />
                                    </circle>
                                    <path d="M 320 200 L 330 215 L 310 215 Z" fill="#ec4899" filter="url(#badgeShadow)">
                                        <animateTransform attributeName="transform" type="translate" values="0,0; -10,0; 0,0" dur="5s" repeatCount="indefinite" />
                                    </path>
                                </svg>

                                <div className="text-center px-8">
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                                        We're here to help!
                                    </h2>
                                    <p className="text-gray-600 dark:text-gray-300">
                                        Whether you have a question about features, pricing, or need technical support, our team is ready to answer all your questions.
                                    </p>
                                </div>
                            </div>

                            {/* Right - Form */}
                            <div className="bg-white dark:bg-gray-800 py-10 px-6 shadow-xl rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-700">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Contact Us</h2>

                                {status === 'success' ? (
                                    <div className="rounded-xl bg-green-50 dark:bg-green-900/30 p-8 text-center flex flex-col items-center">
                                        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                                        <h3 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">Message Sent!</h3>
                                        <p className="text-green-700 dark:text-green-400 mb-6">
                                            Thanks for reaching out. Our support team will get back to you within 24 hours.
                                        </p>
                                        <button
                                            onClick={() => setStatus('idle')}
                                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition"
                                        >
                                            Send Another Message
                                        </button>
                                    </div>
                                ) : (
                                    <form className="space-y-6" onSubmit={handleSubmit}>
                                        {status === 'error' && (
                                            <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4 border border-red-200 dark:border-red-800">
                                                <div className="flex">
                                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                                    <div className="ml-3">
                                                        <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                                                            Failed to send message. Please try again later.
                                                        </h3>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Full Name
                                            </label>
                                            <div className="mt-1 relative rounded-md shadow-sm">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <User className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    id="name"
                                                    name="name"
                                                    type="text"
                                                    required
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                                                    placeholder="John Doe"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Email address
                                            </label>
                                            <div className="mt-1 relative rounded-md shadow-sm">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Mail className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    required
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                                                    placeholder="you@company.com"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                What can we help you with?
                                            </label>
                                            <div className="mt-1 relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTopicDropdown(!showTopicDropdown)}
                                                    className="w-full flex items-center justify-between px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                                                >
                                                    <span className="block truncate text-sm">
                                                        {topicOptions.find(opt => opt.value === formData.topic)?.label}
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                </button>

                                                {showTopicDropdown && (
                                                    <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg overflow-hidden">
                                                        <div className="p-2 space-y-1">
                                                            {topicOptions.map((option) => (
                                                                <button
                                                                    key={option.value}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, topic: option.value });
                                                                        setShowTopicDropdown(false);
                                                                    }}
                                                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded transition-colors ${formData.topic === option.value
                                                                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                                        }`}
                                                                >
                                                                    {option.label}
                                                                    {formData.topic === option.value && (
                                                                        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Message
                                            </label>
                                            <div className="mt-1 relative rounded-md shadow-sm">
                                                <div className="absolute top-3 left-3 pointer-events-none">
                                                    <MessageSquare className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <textarea
                                                    id="message"
                                                    name="message"
                                                    rows={4}
                                                    required
                                                    value={formData.message}
                                                    onChange={handleChange}
                                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                                                    placeholder="How can we help?"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <button
                                                type="submit"
                                                disabled={status === 'submitting'}
                                                className="w-full flex justify-center items-center py-4 px-6 border border-transparent shadow-lg text-lg font-bold text-white bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transform transition-all duration-500 ease-in-out hover:scale-105 hover:brightness-110 hover:animate-pulse active:scale-95"
                                            >
                                                {status === 'submitting' ? (
                                                    <>
                                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Sending...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-5 h-5 mr-2" />
                                                        Send Message
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="container mx-auto px-6 py-12 flex flex-col items-center justify-center space-y-4 text-center text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-6">
                        <Link href="/docs" className="hover:text-blue-500 transition">Documentation</Link>
                        <Link href="/support" className="hover:text-blue-500 transition">Contact Support</Link>
                        <Link href="/register" className="hover:text-blue-500 transition">Sign Up</Link>
                    </div>
                    <p>© 2026 Evols. Evolve your product roadmap.</p>
                </footer>
            </div>
        </>
    )
}
