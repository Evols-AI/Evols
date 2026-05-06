# Feedback Synthesizer

## Purpose

Processes feedback from any source -- customer interviews, stakeholder comments, survey data, peer reviews, product feedback -- and synthesizes it into actionable themes with routing recommendations.

---

## When to Use

- User receives feedback from customers, stakeholders, or peers
- Processing survey results or interview notes
- Synthesizing input from multiple sources on the same topic
- User says "synthesize this feedback" or drops feedback data

---

## Process

### Step 1: Ingest and Normalize

Accept feedback in any format:
- Raw interview notes
- CSV/spreadsheet data
- Email threads
- Meeting summaries
- Survey responses
- Messaging conversations

Normalize each piece of feedback into:

| Field | Description |
|-------|------------|
| **Source** | Who said it (person, segment, role) |
| **Date** | When it was captured |
| **Verbatim** | The actual quote or data point |
| **Theme** | What topic or category it relates to |
| **Sentiment** | Positive / Neutral / Negative / Mixed |
| **Signal Strength** | Strong (repeated, emphatic) / Moderate / Weak (one-off, hedged) |

### Step 2: Theme Clustering

Group normalized feedback into themes:

```markdown
### Theme: [Theme Name]
**Frequency:** [How many sources mentioned this]
**Sentiment:** [Overall: Positive / Negative / Mixed]
**Signal Strength:** [Strong / Moderate / Weak]

**Representative quotes:**
- "[Quote 1]" -- [Source]
- "[Quote 2]" -- [Source]

**Summary:** [1-2 sentences synthesizing the theme]
```

Sort themes by frequency and signal strength (strongest first).

### Step 3: Cross-Source Comparison

If feedback comes from multiple sources or time periods:

| Theme | Source A | Source B | Source C | Trend |
|-------|---------|---------|---------|-------|
| [Theme 1] | [Present/Absent] | [Present/Absent] | [Present/Absent] | [Growing/Stable/New] |

Highlight:
- **Convergent themes:** Multiple sources saying the same thing = strong signal
- **Divergent themes:** Sources disagreeing = needs investigation
- **Emerging themes:** New this round = worth watching

### Step 4: Priority Assessment

For each theme, assess:

| Theme | Impact | Actionability | Urgency | Priority |
|-------|--------|--------------|---------|----------|
| [Theme] | [H/M/L] | [H/M/L] | [H/M/L] | [1-5] |

- **Impact:** How much does this affect the product/project/relationship?
- **Actionability:** Can we do something about this?
- **Urgency:** Does this need action now or can it wait?

### Step 5: Route and Recommend

For each priority theme, recommend an action:

| Theme | Action | Owner | Destination |
|-------|--------|-------|-------------|
| [Theme] | [Specific action] | [Who should act] | [Task board tier / Decision log / Stakeholder communication] |

Actions might include:
- Add to task board (specify tier)
- Log as input to an open decision
- Share with a stakeholder (draft communication)
- Add to product backlog
- Flag for deeper investigation
- Note but no action needed

---

## Output Format

```markdown
# Feedback Synthesis -- [Topic] -- [Date]

## Sources
- [Source 1]: [Type, date, # of data points]
- [Source 2]: [Type, date, # of data points]

## Key Themes (Priority Order)

### 1. [Theme Name] -- [Priority: High/Med/Low]
**Frequency:** [X sources] | **Sentiment:** [Pos/Neg/Mixed] | **Strength:** [Strong/Moderate]
**Summary:** [1-2 sentences]
**Key quotes:**
- "[Quote]" -- [Source]
**Recommended action:** [What to do and who should do it]

### 2. [Theme Name] -- [Priority: High/Med/Low]
[Same structure]

## Cross-Source Patterns
- [Pattern 1]
- [Pattern 2]

## Surprises / Watch Items
- [Anything unexpected or worth monitoring]

## Recommended Next Steps
1. [Top action]
2. [Second action]
3. [Third action]
```

---

## Rules

1. **Preserve the voice.** Use actual quotes, not paraphrases. The user and stakeholders need to hear the feedback, not a sanitized version.
2. **Separate signal from noise.** One person's strong opinion is not a trend. Note frequency honestly.
3. **Be actionable.** Every theme should have a recommended next step, even if it's "monitor but no action."
4. **Route appropriately.** Not all feedback goes to the task board. Some goes to the decision log, some to stakeholder communications, some to the backlog.
5. **Cross-reference work context.** Connect feedback themes to active projects and open decisions when relevant.
