---
name: process-flowchart
description: "Create step-by-step process flowcharts showing sequential workflows, procedures, or user journeys. Use ONLY when someone explicitly asks for a flowchart, flow chart, process flow, workflow diagram, or visual flow diagram. Do NOT use for PRD requests, requirements documents, feature specs, or documentation - use create-prd skill for those instead."
---

## Process Flowchart

Create a clear, step-by-step flowchart for any process, workflow, or user journey.

### Context

You are creating a process flowchart for **$ARGUMENTS**.

### Instructions

**IMPORTANT: You must output ACTUAL PROCESS STEPS, not instructions on how to create a flowchart.**

1. **Identify the process type**:
   - User journey (signup, onboarding, using a feature)
   - Business process (hiring, development, approval)
   - Technical workflow (data processing, deployment)
   - Decision tree (troubleshooting, choosing options)

2. **Create sequential steps**:
   - Start with a clear beginning point
   - Break down the process into 5-8 main steps
   - Use action-oriented language ("User clicks signup", "System validates input")
   - Include decision points where the flow branches
   - End with clear completion states

3. **Format as flowchart steps**:

```
Start → Step 1 → Step 2 → Decision Point → Step 3a/3b → End
```

4. **Example for "User onboarding process"**:

```
User discovers product → User visits signup page → User creates account → System sends verification email → User verifies email → User completes profile setup → User sees dashboard → User completes first action → Onboarding complete
```

5. **Include branches for decisions**:
   - If there are choices or error conditions, show alternative paths
   - Use format: "Decision Point → Option A → Result A" and "Decision Point → Option B → Result B"

6. **Output format**:
   - Provide the actual step sequence
   - Use arrow notation (→) to show flow
   - Keep each step concise (2-8 words)
   - Include decision branches where relevant

**Remember**: Generate the ACTUAL FLOWCHART CONTENT, not meta-instructions about creating flowcharts.

### Example Output

For a user onboarding flowchart request:

```flowchart
User discovers product → User visits landing page → User clicks "Sign Up" → User enters email/password → System validates credentials → User receives welcome email → User verifies email address → User completes profile setup → User sees product tour → User completes first task → User becomes active user
```

Decision branches:
- Email validation fails → Show error message → Return to signup form
- User skips profile setup → Direct to dashboard → Show setup reminder later