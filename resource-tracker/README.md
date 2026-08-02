# Command Center 🚀 (Backend)

An AI-powered, full-stack knowledge management system designed to track, categorize, and organize learning resources. This directory contains the **Server** (Java Spring Boot) application.

## ✨ Key Features
* **Guest-First Architecture (Frictionless UX):** Supports seamless data migration from the frontend's `localStorage` into the PostgreSQL database upon user account creation.
* **AI Auto-Classification Integration:** Backend endpoint connected to the Google Gemini API to automatically parse URLs, extract titles, and determine the resource's technical difficulty.
* **Secure Session Management:** Custom token-based authentication system featuring BCrypt password hashing, persistent sessions, and secure logout token invalidation.
* **Relational Database Management:** Utilizes Spring Data JPA and Hibernate for robust relational data mapping (Users, Folders, Resources).

## 🛠️ Tech Stack
* **Server:** Java 17, Spring Boot, Spring Security, Hibernate / Spring Data JPA
* **Database:** PostgreSQL
* **AI/Integrations:** Google Gemini API
* **Client:** Next.js (See `../frontend`)

## 🚀 Running Locally

1. Ensure PostgreSQL is running locally on port `5432` with a database named `resource_tracker`.
2. Configure `src/main/resources/application.properties` with your actual database credentials and Gemini API key (you can copy from `application.properties.example`).
3. Run `./mvnw spring-boot:run` (or `mvnw.cmd spring-boot:run` on Windows) to start the server.
4. The server will run on [http://localhost:8080](http://localhost:8080).
