# Command Center 🚀

An AI-powered resource and skill tracking protocol designed for developers to curate, organize, and analyze learning materials and useful links.

Command Center replaces generic bookmark managers with an intelligent dashboard that automatically analyzes and categorizes your saved links using Google Gemini AI, visualizes your learning path, and provides seamless bulk management features.

## ✨ Core Features

* **🤖 AI Auto-categorization**: Paste a URL and let Google Gemini instantly extract the title, categorize the content, and assess its difficulty level.
* **📊 Analytics Dashboard**: Visualize your learning material with a dynamic Difficulty Distribution pie chart to ensure balanced skill development.
* **⚡ Glassmorphic UI**: A premium, responsive interface featuring an expandable search bar, collapsible domain grouping, and smooth micro-animations.
* **🛡️ Guest & Authenticated Modes**: Try it instantly in the browser with LocalStorage, or create an account to sync your data securely across devices via PostgreSQL.
* **📦 Bulk Operations**: Effortlessly select multiple resources with checkboxes to trigger a floating action bar for rapid, bulk archiving.

## 🛠️ Technology Stack

This project is built as a robust, full-stack application using a modern tech stack:

* **Frontend**: Next.js (React), TailwindCSS, Recharts
* **Backend**: Spring Boot (Java), Spring Security (JWT Auth)
* **Database**: PostgreSQL (Neon Serverless)
* **AI Integration**: Google Gemini API

## ⚙️ Local Setup & Documentation

This project is structured as a monorepo. Please refer to the specific documentation for the frontend and backend environments to get started:

* [🖥️ Frontend Documentation (Next.js)](./frontend/README.md)
* [⚙️ Backend Documentation (Spring Boot)](./resource-tracker/README.md)