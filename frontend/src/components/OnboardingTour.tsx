import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Check, BookOpen, Database, MessageSquare, Users, Sparkles } from 'lucide-react'
import { useRouter } from 'next/router'
import { getCurrentUser } from '@/utils/auth'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: any
  actionLabel?: string
  actionRoute?: string
  tips?: string[]
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Evols!',
    description: 'Let\'s set up your product workspace in 4 quick steps. This will help our AI provide better recommendations tailored to your product.',
    icon: Sparkles,
    tips: [
      'Each step takes 2-5 minutes',
      'You can skip and come back later',
      'The more context you provide, the better recommendations you\'ll get'
    ]
  },
  {
    id: 'knowledge',
    title: 'Step 1: Product Knowledge',
    description: 'Define your product strategy, customer segments, competitive landscape, and key metrics. This helps AI understand your product context.',
    icon: BookOpen,
    actionLabel: 'Add Product Knowledge',
    actionRoute: '/knowledge',
    tips: [
      'Start with Product Strategy (vision, mission, goals)',
      'Define 2-3 customer segments or ICP',
      'Add key competitors and your differentiation',
      'Set your north star metric and OKRs'
    ]
  },
  {
    id: 'context',
    title: 'Step 2: Customer Intelligence',
    description: 'Upload customer feedback, interview transcripts, surveys, or meeting notes. Our AI will extract insights, pain points, and feature requests.',
    icon: Database,
    actionLabel: 'Upload Feedback',
    actionRoute: '/context',
    tips: [
      'Supports CSV, TXT, PDF, DOCX formats',
      'Customer interview transcripts work great',
      'Survey responses and feedback forms',
      'Sales call notes and support tickets'
    ]
  },
  {
    id: 'personas',
    title: 'Step 3: Customer Personas',
    description: 'Review AI-extracted personas from your feedback. These represent your actual customers and can vote on product decisions.',
    icon: Users,
    actionLabel: 'View Personas',
    actionRoute: '/personas',
    tips: [
      'AI automatically creates personas from feedback',
      'Personas include goals, pain points, and quotes',
      'Use them in decision workbench for perspective',
      'Update manually if needed'
    ]
  },
  {
    id: 'workbench',
    title: 'Step 4: Start Using Skills',
    description: 'You\'re all set! Use @ mentions in Workbench to invoke expert skills like @opportunity-solution-tree, @swot-analysis, or @create-prd.',
    icon: MessageSquare,
    actionLabel: 'Go to Workbench',
    actionRoute: '/workbench',
    tips: [
      'Type @ to see all available skills',
      'AI uses your product context automatically',
      'Past work is remembered across conversations',
      'Browse Skills page to discover 80+ capabilities'
    ]
  }
]

export default function OnboardingTour() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    // Check if user has dismissed onboarding
    const user = getCurrentUser()
    if (!user) return

    const dismissedKey = `onboarding_dismissed_${user.id}`
    const isDismissed = localStorage.getItem(dismissedKey) === 'true'

    // Show onboarding if not dismissed and user is on main pages
    const shouldShow = !isDismissed && ['/dashboard', '/workbench', '/'].includes(router.pathname)

    if (shouldShow) {
      // Small delay to let page load
      setTimeout(() => setIsOpen(true), 500)
    }
  }, [router.pathname])

  const handleClose = () => {
    if (dontShowAgain) {
      const user = getCurrentUser()
      if (user) {
        localStorage.setItem(`onboarding_dismissed_${user.id}`, 'true')
      }
    }
    setIsOpen(false)
  }

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleAction = async () => {
    const step = onboardingSteps[currentStep]
    if (step.actionRoute) {
      setIsNavigating(true)

      // Store current onboarding state
      const user = getCurrentUser()
      if (user) {
        localStorage.setItem(`onboarding_step_${user.id}`, currentStep.toString())
        localStorage.setItem(`onboarding_return_${user.id}`, 'true')
      }

      await router.push(step.actionRoute)

      // Close modal when navigating
      setIsOpen(false)
      setIsNavigating(false)
    }
  }

  // Resume onboarding when returning from action
  useEffect(() => {
    const user = getCurrentUser()
    if (!user) return

    const shouldReturn = localStorage.getItem(`onboarding_return_${user.id}`) === 'true'
    const savedStep = localStorage.getItem(`onboarding_step_${user.id}`)

    if (shouldReturn && savedStep) {
      // Clear return flag
      localStorage.removeItem(`onboarding_return_${user.id}`)

      const stepIndex = parseInt(savedStep)

      // Show "continue tour" prompt after a delay (user had time to explore)
      setTimeout(() => {
        if (confirm('Ready to continue the onboarding tour?')) {
          setCurrentStep(stepIndex)
          setIsOpen(true)
        } else {
          // If they decline, clear the saved state
          localStorage.removeItem(`onboarding_step_${user.id}`)
        }
      }, 2000)
    }
  }, [router.pathname])

  if (!isOpen) return null

  const step = onboardingSteps[currentStep]
  const Icon = step.icon
  const isLastStep = currentStep === onboardingSteps.length - 1
  const isFirstStep = currentStep === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {step.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Step {currentStep + 1} of {onboardingSteps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {onboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= currentStep
                    ? 'bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {step.description}
          </p>

          {step.tips && step.tips.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">💡</span>
                Tips
              </h4>
              <ul className="space-y-2">
                {step.tips.map((tip, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* Don't show again checkbox (only on last step) */}
          {isLastStep && (
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Don't show this tour again
            </label>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handlePrevious}
              disabled={isFirstStep}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                isFirstStep
                  ? 'opacity-50 cursor-not-allowed text-gray-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex gap-3">
              {step.actionRoute && (
                <button
                  onClick={handleAction}
                  disabled={isNavigating}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  {isNavigating ? 'Opening...' : step.actionLabel}
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {!isLastStep && (
                <button
                  onClick={handleNext}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 font-medium"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {isLastStep && (
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2 font-medium"
                >
                  <Check className="w-4 h-4" />
                  Get Started
                </button>
              )}
            </div>
          </div>

          {/* Skip link */}
          {!isLastStep && (
            <div className="text-center">
              <button
                onClick={handleClose}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Skip tour
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
