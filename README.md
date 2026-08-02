# Command Center 🚀

An AI-powered, full-stack knowledge management system designed to track, categorize, and organize learning resources. 

## ✨ Key Features
* **Guest-First Architecture (Frictionless UX):** Users can instantly save and organize resources locally using `localStorage`. Upon account creation, a seamless migration protocol syncs all local data to the PostgreSQL database.
* **AI Auto-Classification:** Integrated with the Gemini API to automatically parse URLs, extract titles, and determine the resource's technical difficulty.
* **Recursive Directory Protocol:** Custom-built recursive React component to handle infinite-depth folder structures for meticulous organization.
* **Secure Session Management:** Custom token-based authentication system featuring BCrypt password hashing and persistent sessions.
* **Real-time Analytics:** Visual difficulty distribution tracking utilizing Recharts.

## 🛠️ Tech Stack
* **Frontend:** Next.js, React, Tailwind CSS, Recharts (Located in `/frontend`)
* **Backend:** Java Spring Boot, Spring Security, Hibernate / Spring Data JPA (Located in `/resource-tracker`)
* **Database:** PostgreSQL
* **AI/Integrations:** Google Gemini API

## 🚀 Running Locally

### 1. Backend Setup
Navigate to the `resource-tracker` directory:
```bash
cd resource-tracker
```
Ensure PostgreSQL is running locally.

Configure `src/main/resources/application.properties` with your database credentials and API key (you can copy from `application.properties.example`).

Start the server: 
```bash
./mvnw spring-boot:run
```
*(Runs on localhost:8080)*

### 2. Frontend Setup
Navigate to the `frontend` directory:
```bash
cd frontend
```
Install dependencies: 
```bash
npm install
```
Start the client: 
```bash
npm run dev
```
*(Runs on localhost:3000)*