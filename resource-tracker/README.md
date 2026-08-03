# Command Center — Backend API ⚙️

This directory contains the Spring Boot backend engine powering the Command Center protocol. It handles secure user authentication, data persistence, bulk operations, and AI integration for intelligent resource parsing.

## 🛠️ Tech Stack

* **Framework**: Spring Boot 3 (Java 17+)
* **Security**: Spring Security + JWT (JSON Web Tokens)
* **Data Access**: Spring Data JPA / Hibernate
* **Database**: PostgreSQL (Serverless via Neon)
* **AI Provider**: Google Gemini API

## 🏗️ Architecture & Schema

The backend follows a classic Controller-Service-Repository architecture, ensuring clean separation of concerns.

### Database Schema (Entity Relationships)
* **User**: The core entity storing credentials and tracking ownership.
* **Resource**: Represents a saved link. It is linked to a specific `User` via a Many-to-One relationship to ensure strict data isolation.
* **Folder**: Represents a category, allowing for future expansion into nested directory structures.

### Security Implementation
Spring Security acts as a vault door. All `/api/resources/**` endpoints require a valid Bearer JWT. Controllers utilize the `Principal` object to extract the logged-in user and enforce ownership checks before executing any read, update, or delete operations.

## 📡 Core API Endpoints

Here are a few of the critical REST endpoints:

* `POST /api/auth/register` & `/api/auth/login`: Issue stateless JWT tokens for session management.
* `POST /api/resources`: Securely save a new resource, assigning it to the authenticated user.
* `GET /api/resources/analyze?url={url}`: Triggers the Gemini AI Service to parse a URL, extracting the title and estimating difficulty. It includes an aggressive database cache layer to return instant results if the URL was previously scanned by any user.
* `DELETE /api/resources/bulk`: Accepts a JSON array of Resource IDs `[1, 2, 3]` and executes a highly-efficient, single-query `@Modifying` bulk soft-delete update, strictly verified against the `userId`.

## 🚀 Getting Started

### Prerequisites
* Java 17 or higher
* PostgreSQL Database (or Neon connection string)
* Google Gemini API Key

### Configuration

Update your `src/main/resources/application.properties` with the necessary environment variables:

```properties
spring.application.name=resource-tracker

# PostgreSQL Database Configuration
spring.datasource.url=jdbc:postgresql://<your-db-host>:5432/<your-db-name>
spring.datasource.username=<your-db-username>
spring.datasource.password=<your-db-password>
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true

# JWT Security Secret
jwt.secret=YOUR_SUPER_SECRET_LONG_GENERATED_KEY_HERE

# Google Gemini Integration
gemini.api.key=YOUR_GEMINI_API_KEY
gemini.api.url=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
```

### Installation & Execution

1. Navigate to the backend directory.
2. Use the Maven wrapper to build and run the application:

```bash
# Clean and compile
./mvnw clean install -DskipTests

# Run the Spring Boot server
./mvnw spring-boot:run
```

The server will start on `http://localhost:8080`.
