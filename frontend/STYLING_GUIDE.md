# Evols Styling Guide

## Global CSS Classes

All pages now use centralized styling through global CSS classes defined in `src/styles/globals.css`.

### Layout Components

#### Page Container
```tsx
<div className="page-container">
  {/* Your content */}
</div>
```

#### Page Header
```tsx
<div className="page-header">
  <h1 className="page-title">Title</h1>
  <p className="page-subtitle">Subtitle</p>
</div>
```

### Cards

```tsx
{/* Basic card */}
<div className="card p-6">
  Content
</div>

{/* Hoverable card */}
<div className="card-hover p-6">
  Content
</div>

{/* Card header */}
<h2 className="card-header">Title</h2>
```

### Buttons

```tsx
{/* Primary button */}
<button className="btn-primary">
  Click me
</button>

{/* Secondary button */}
<button className="btn-secondary">
  Cancel
</button>
```

### Badges

```tsx
<span className="badge-blue">Status</span>
<span className="badge-green">Success</span>
<span className="badge-yellow">Warning</span>
<span className="badge-red">Error</span>
<span className="badge-purple">Info</span>
<span className="badge-gray">Default</span>
```

### Form Inputs

```tsx
{/* Text input */}
<input type="text" className="input" />

{/* Select dropdown */}
<select className="select">
  <option>Choose...</option>
</select>
```

### Typography

```tsx
{/* Heading text - always visible */}
<h1 className="text-heading">Title</h1>

{/* Body text - gray in light mode, lighter gray in dark */}
<p className="text-body">Description</p>

{/* Muted text - even more subtle */}
<span className="text-muted">Helper text</span>

{/* Links */}
<a href="#" className="text-link">Click here</a>
```

### Loading States

```tsx
{/* Loading spinner */}
<div className="loading-spinner"></div>
```

### Empty States

```tsx
<div className="empty-state">
  <div className="empty-state-icon">
    <Icon />
  </div>
  <h3 className="empty-state-title">No items</h3>
  <p className="empty-state-description">Get started by adding items</p>
</div>
```

### Interactive States

```tsx
{/* Hover lift effect */}
<div className="hover-lift">
  Content
</div>
```

## Using PageContainer Components

The easiest way to maintain consistent styling is to use the pre-built components:

```tsx
import { PageContainer, PageHeader, Card, EmptyState, StatCard, Loading } from '@/components/PageContainer'

export default function MyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header user={user} currentPage="mypage" />

      <PageContainer>
        <PageHeader
          title="My Page"
          subtitle="Page description"
          action={<button className="btn-primary">Action</button>}
        />

        <Card>
          Content here
        </Card>
      </PageContainer>
    </div>
  )
}
```

## Design Tokens

### Colors
All colors automatically adapt to dark mode:
- `text-heading`: Main text color
- `text-body`: Body text color
- `text-muted`: Subtle text color
- `text-link`: Link color with hover state

### Spacing
Consistent spacing across all pages:
- Container padding: `1.5rem` (24px)
- Card padding: `1.5rem` (24px)
- Section margins: `2rem` (32px)

### Border Radius
- `rounded-lg`: 0.5rem (8px) - Standard for cards, buttons
- `rounded-md`: 0.375rem (6px) - Smaller elements
- `rounded-sm`: 0.25rem (4px) - Minimal rounding

### Typography Scale
- `text-3xl`: 1.875rem - Page titles
- `text-xl`: 1.25rem - Section headers
- `text-lg`: 1.125rem - Card titles
- `text-base`: 1rem - Body text
- `text-sm`: 0.875rem - Small text
- `text-xs`: 0.75rem - Tiny text, badges

## Best Practices

1. **Always use global classes** instead of inline Tailwind utilities when available
2. **Use PageContainer components** for consistent page structure
3. **Dark mode is automatic** - all global classes handle dark mode
4. **Don't repeat class names** - if you're copying the same classes multiple times, create a global class
5. **Maintain consistency** - use the same button classes, card styles, etc. everywhere

## Migration Example

### Before (inline classes):
```tsx
<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Title</h2>
  <p className="text-gray-600 dark:text-gray-400">Description</p>
</div>
```

### After (global classes):
```tsx
<div className="card p-6">
  <h2 className="card-header">Title</h2>
  <p className="text-body">Description</p>
</div>
```

Much cleaner and more maintainable!
