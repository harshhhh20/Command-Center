# Command Center 🚀 (Frontend)

An AI-powered, full-stack knowledge management system designed to track, categorize, and organize learning resources. This directory contains the **Client** (Next.js) application.

## ✨ Key Features
* **Guest-First Architecture (Frictionless UX):** Users can instantly save and organize resources locally using `localStorage`. Upon account creation, a seamless migration protocol syncs all local data to the PostgreSQL database.
* **AI Auto-Classification:** Integrated with the Gemini API to automatically parse URLs, extract titles, and determine the resource's technical difficulty.
* **Recursive Directory Protocol:** Custom-built recursive React component to handle infinite-depth folder structures for meticulous organization.
* **Real-time Analytics:** Visual difficulty distribution tracking utilizing Recharts.

## 🛠️ Tech Stack
* **Client:** Next.js, React, Tailwind CSS, Recharts
* **Server:** Java Spring Boot, Spring Security (See `../resource-tracker`)

## 🚀 Running Locally

1. Clone the repository and navigate to this `frontend` directory.
2. Run `npm install` to install dependencies.
3. (Optional) Set up your `.env.local` if you have frontend-specific environment variables.
4. Run `npm run dev` to start the development server.
5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

**Note:** To experience full functionality (authentication, AI classification, syncing), ensure the Spring Boot backend is also running.
