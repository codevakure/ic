# SidePanel Component Documentation

A reusable side panel system for displaying content alongside the main chat area. Supports both **push** and **overlay** modes with smooth animations.

## Quick Start

```tsx
import { useSourcesPanel } from '~/components/ui/SidePanel';

function MyComponent() {
  const { openPanel, closePanel } = useSourcesPanel();
  
  const handleClick = () => {
    openPanel(
      'My Panel Title',
      <div className="p-4">
        <h2>Hello World</h2>
        <p>This is my panel content</p>
      </div>,
      'push' // or 'overlay'
    );
  };
  
  return <button onClick={handleClick}>Open Panel</button>;
}
```

## Display Modes

### Push Mode (`'push'`)

The panel pushes the main chat content aside, similar to how the Artifacts preview works.

**Characteristics:**
- Appears between chat and right side panel
- Does NOT push the right side navigation
- Resizable via drag handle
- Smooth scale + opacity + blur animation on open/close
- Best for content users want to reference while chatting

**Example:**
```tsx
openPanel('Sources', <SourcesList />, 'push');
```

### Overlay Mode (`'overlay'`)

The panel slides over the content with a semi-transparent backdrop.

**Characteristics:**
- Rendered via portal (overlays everything)
- Semi-transparent backdrop (click to close)
- Slides in from the right
- Best for quick views or modal-like content

**Example:**
```tsx
openPanel('Quick View', <QuickViewContent />, 'overlay');
```

## Mobile Behavior

On mobile devices (≤868px), both modes render as a **bottom sheet**:

- Drag handle at top for resizing
- Swipe down to close
- Dynamic backdrop blur based on sheet height
- Snaps to 40%, 70%, or 90% height positions

## API Reference

### `useSourcesPanel()` Hook

```tsx
const {
  isOpen,     // boolean - Panel open state
  title,      // string - Current title
  content,    // ReactNode - Current content
  mode,       // 'push' | 'overlay' - Current mode
  openPanel,  // (title, content, mode?) => void
  closePanel, // () => void
} = useSourcesPanel();
```

### `openPanel(title, content, mode?)`

Opens the panel with the specified content.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | required | Panel header title |
| `content` | `ReactNode` | required | Content to display |
| `mode` | `'push' \| 'overlay'` | `'overlay'` | Display mode |

### `closePanel()`

Closes the panel with animation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation.tsx                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   SidePanelGroup                       │  │
│  │  ┌─────────────┬──────────────┬──────────────────┐   │  │
│  │  │   Main      │  Sources     │   Right Side     │   │  │
│  │  │   Chat      │  Panel       │   Panel (Nav)    │   │  │
│  │  │   Content   │  (push mode) │                  │   │  │
│  │  │             │              │                  │   │  │
│  │  └─────────────┴──────────────┴──────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         GlobalSourcesPanel (overlay/mobile)            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

1. **`useSourcesPanel`** - Hook for managing panel state (Recoil)
2. **`SourcesPanel`** - ResizablePanel for push mode (inside SidePanelGroup)
3. **`GlobalSourcesPanel`** - Portal-based panel for overlay mode and mobile

### State Management

Panel state is managed via Recoil atom in `~/store/misc.ts`:

```tsx
export type SourcesPanelMode = 'push' | 'overlay';

export interface SourcesPanelState {
  isOpen: boolean;
  title: string;
  content: React.ReactNode | null;
  mode: SourcesPanelMode;
}
```

## Styling

The panel uses these design tokens:
- `bg-surface-primary` - Panel background
- `border-border-light` - Header border
- `text-text-primary` - Title text
- `text-text-secondary` - Icon colors

## Examples

### Display Web Search Sources

```tsx
function WebSources({ sources }) {
  const { openPanel } = useSourcesPanel();
  
  const showAllSources = () => {
    openPanel(
      'Sources',
      <div className="flex flex-col gap-2 p-3">
        {sources.map((source, i) => (
          <a key={i} href={source.url} className="...">
            {source.title}
          </a>
        ))}
      </div>,
      'push'
    );
  };
  
  return <button onClick={showAllSources}>View All Sources</button>;
}
```

### Display File Preview

```tsx
function FilePreview({ file }) {
  const { openPanel } = useSourcesPanel();
  
  const previewFile = () => {
    openPanel(
      file.name,
      <FileViewer file={file} />,
      'overlay'
    );
  };
  
  return <button onClick={previewFile}>Preview</button>;
}
```

### Conditional Panel Content

```tsx
function DynamicPanel() {
  const { openPanel, isOpen, closePanel } = useSourcesPanel();
  const [data, setData] = useState(null);
  
  useEffect(() => {
    if (isOpen && data) {
      // Update panel content when data changes
      openPanel('Updated', <DataView data={data} />, 'push');
    }
  }, [data, isOpen]);
  
  return <button onClick={() => openPanel('Loading...', <Spinner />, 'push')}>
    Load Data
  </button>;
}
```

## Best Practices

1. **Choose the right mode:**
   - Use `'push'` for reference content (sources, documents)
   - Use `'overlay'` for temporary/modal content

2. **Keep content scrollable:**
   - The panel has `overflow-y-auto` on the content area
   - Don't set fixed heights on your content

3. **Handle loading states:**
   - Show a spinner while loading async content
   - Update content via another `openPanel` call when ready

4. **Respect mobile UX:**
   - Content automatically adapts to bottom sheet on mobile
   - Test drag-to-resize behavior with your content

## Troubleshooting

### Panel not appearing
- Ensure `GlobalSourcesPanel` is rendered in `Presentation.tsx`
- Check that `SidePanelGroup` includes `SourcesPanel`

### Content cut off
- Don't use `min-w-*` on content that exceeds panel width
- Use `overflow-hidden` or `truncate` for long text

### Animation issues
- The panel uses `transition-all duration-300`
- Avoid conflicting transitions on content
