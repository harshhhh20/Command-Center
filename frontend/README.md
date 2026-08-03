# Command Center — Frontend 🖥️

This directory contains the Next.js frontend application for Command Center. It provides a highly responsive, aesthetic, and interactive user interface designed to feel like a premium protocol dashboard.

## 🛠️ Tech Stack

* **Framework**: Next.js 14 (App Router)
* **Library**: React
* **Styling**: Tailwind CSS
* **Charts**: Recharts
* **Icons**: Lucide React (SVG based)

## 🎨 UI Architecture & Design

The UI is built with a focus on **Glassmorphism** and dynamic micro-animations to create an engaging experience:
* **Interactive Cards**: Entire resource cards are clickable, routing to the source URL, with `e.stopPropagation()` utilized on inner action buttons (Edit, Copy, Checkbox, Delete).
* **Expandable Search**: A minimalist magnifying glass smoothly transitions into a full search bar via Tailwind arbitrary values and transition states.
* **Floating Bulk Action Bar**: When resources are selected via checkboxes, a state-driven frosted glass action bar slides up from the bottom for bulk deletion.
* **Domain Grouping**: Links sharing the same domain are automatically grouped under collapsible accordion headers when crossing a specified threshold (3+ links).

## 🧠 State Management

State is managed comprehensively using React Hooks (`useState`, `useEffect`):
* **Dual-Mode Sync**: The app dynamically checks for a JWT `authToken` to switch between authenticated API calls (`authFetch`) and LocalStorage fallbacks (`Guest Mode`).
* **Bulk Selection**: Managed via an array of `selectedIds`. Adding/removing IDs dynamically controls the visibility of the bulk action bar.
* **Combined Filtering**: The rendered resource grid is the result of a derived state that simultaneously applies Category Pills filtering and real-time Search Query matching.

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* npm or yarn

### Configuration

Create a `.env.local` file in the root of the `frontend` directory:

```env
# Point this to your Spring Boot backend URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

### Installation & Execution

1. Install the dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.
