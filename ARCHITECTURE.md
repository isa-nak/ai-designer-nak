# Claude Design Plugin - Architecture Documentation

A Figma plugin that uses AI (Claude or OpenAI) to generate UI designs from natural language prompts.

## Project Structure

```
src/
├── shared/                    # Shared code between UI and plugin
│   ├── types.ts              # TypeScript interfaces
│   ├── constants.ts          # API config, limits, defaults
│   └── utils/
│       ├── colors.ts         # Color conversion utilities
│       ├── fonts.ts          # Font weight/style mapping
│       ├── jsonRepair.ts     # JSON parsing for AI responses
│       └── index.ts          # Barrel export
│
├── ui/                        # React UI (runs in iframe)
│   ├── App.tsx               # Main application component
│   ├── main.tsx              # Entry point
│   ├── components/
│   │   ├── SettingsPanel.tsx # API keys, provider selection, colors
│   │   ├── ChatMessage.tsx   # Individual chat message display
│   │   ├── InputArea.tsx     # Prompt input with image upload
│   │   └── index.ts          # Barrel export
│   ├── hooks/
│   │   ├── useSettings.ts    # Settings state management
│   │   ├── useDesignSystem.ts# Design system state
│   │   └── index.ts          # Barrel export
│   └── api/
│       ├── claude.ts         # Claude API streaming handler
│       ├── openai.ts         # OpenAI API streaming handler
│       ├── prompts.ts        # System prompt builder
│       └── index.ts          # Barrel export
│
└── plugin/                    # Figma plugin code (runs in sandbox)
    ├── index.ts              # Plugin entry point, message handling
    ├── designSystem.ts       # Extracts design tokens from Figma
    ├── serializer.ts         # Serializes Figma nodes to JSON
    └── renderer/
        ├── index.ts          # Main renderDesign function
        ├── styleCache.ts     # Caches text styles and variables
        ├── paints.ts         # Fill/stroke/effect conversion
        ├── fontLoader.ts     # Font loading with fallbacks
        └── elements.ts       # Renders different node types
```

## Architecture Overview

### Communication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         Figma                                │
│  ┌─────────────────┐              ┌─────────────────────┐   │
│  │   Plugin Code   │◄────────────►│      UI (iframe)    │   │
│  │  (sandbox)      │  postMessage │      (React)        │   │
│  │                 │              │                     │   │
│  │  - renderer/    │              │  - App.tsx          │   │
│  │  - designSystem │              │  - api/ (AI calls)  │   │
│  │  - serializer   │              │  - components/      │   │
│  └─────────────────┘              └──────────┬──────────┘   │
└─────────────────────────────────────────────┼───────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │   Claude/OpenAI │
                                    │      API        │
                                    └─────────────────┘
```

### Key Components

#### Shared (`src/shared/`)

**types.ts** - Core type definitions:
- `FrameNode`, `ElementNode` - Design JSON schema
- `Fill`, `Stroke`, `Effect` - Paint types with variable support
- `DesignSystemContext` - Extracted design tokens
- `PluginSettings` - User preferences
- `MessageToPlugin`, `MessageToUI` - IPC message types

**constants.ts** - Configuration:
- `API_CONFIG` - Claude/OpenAI endpoints and models
- `VIEWPORT_SIZES` - Mobile, tablet, desktop presets
- `DESIGN_SYSTEM_LIMITS` - Max items to extract
- `DEFAULT_COLOR_PALETTE` - Fallback colors

#### UI Layer (`src/ui/`)

**api/prompts.ts** - Builds system prompts that instruct AI to:
- Output valid JSON matching the design schema
- Use design system variables by name (not raw values)
- Follow sizing rules to prevent 1px elements
- Apply the correct viewport dimensions

**api/claude.ts & openai.ts** - Handle streaming responses:
- Send requests with system prompt and user message
- Stream tokens and call `onProgress` callback
- Parse final JSON using `jsonRepair` utility

**components/** - UI building blocks:
- `SettingsPanel` - Provider selection, API keys, custom colors
- `ChatMessage` - Renders user/assistant messages with JSON preview
- `InputArea` - Text input, image upload, generate/stop buttons

#### Plugin Layer (`src/plugin/`)

**designSystem.ts** - Extracts from current Figma file:
- Color variables (from variable collections)
- Spacing variables (float type)
- Text styles (font family, size, weight, line height)
- Local components (key, name, description)

**renderer/** - Converts AI JSON to Figma nodes:
- `styleCache.ts` - Loads and caches text styles and variables for lookup
- `paints.ts` - Converts fills/strokes, binds color variables
- `elements.ts` - Creates Frame, Text, Rectangle, Ellipse, Line, Instance
- `fontLoader.ts` - Loads fonts with Inter fallback

## Design System Integration

The plugin extracts design tokens and passes them to the AI:

```typescript
// AI receives available styles in the system prompt
"Available text styles (use the exact name string):
- \"Heading/H1\" (Inter 700 32px)
- \"Body/Regular\" (Inter 400 16px)"

// AI outputs references by name
{
  "type": "TEXT",
  "characters": "Welcome",
  "textStyleName": "Heading/H1"  // Name reference, not raw values
}

// Renderer looks up and applies the actual style
const textStyle = findTextStyle("Heading/H1")
text.textStyleId = textStyle.id
```

Same pattern for color variables:
```typescript
// AI output
"fills": [{ "type": "SOLID", "colorVariable": "Primary/500" }]

// Renderer binds to variable
const variable = findColorVariable("Primary/500")
node.setBoundVariable('fills', 0, 'color', variable)
```

## Adding New Features

### New Element Type

1. Add type to `src/shared/types.ts`:
```typescript
export interface ElementNode {
  type: 'FRAME' | 'TEXT' | 'RECTANGLE' | 'ELLIPSE' | 'LINE' | 'INSTANCE' | 'NEW_TYPE'
  // ...
}
```

2. Add render function in `src/plugin/renderer/elements.ts`:
```typescript
async function renderNewType(element: ElementNode): Promise<SomeNode> {
  const node = figma.createSomething()
  // Apply properties
  return node
}
```

3. Add case to `renderElement` switch statement.

### New Design Token Type

1. Add to `DesignSystemContext` in types.ts
2. Extract in `src/plugin/designSystem.ts`
3. Add to prompt in `src/ui/api/prompts.ts`
4. Handle in renderer if needed

### New API Provider

1. Create `src/ui/api/newprovider.ts` with streaming handler
2. Add to `AIProvider` type in types.ts
3. Add API key field to `PluginSettings`
4. Update `SettingsPanel` component
5. Add selection logic in `App.tsx`

## Build Commands

```bash
npm run build        # Build both UI and plugin
npm run build:ui     # Build React UI only
npm run build:plugin # Build plugin code only
npm run dev          # Watch mode for development
```

## File Size Limits

- Keep renderer modules focused (each < 200 lines)
- Limit design system extraction to prevent large prompts
- JSON repair handles truncated AI responses up to 8192 tokens
