# Cold Calling Platform Project

## Overview

This is a powerful and intelligent cold calling platform designed to streamline and optimize the outreach process for sales teams and businesses. By leveraging AI and automation, it helps users generate leads, manage contacts, and execute cold calling campaigns more efficiently and effectively.

## Features

  * **AI-Powered Lead Generation:** Automatically identify and qualify potential leads based on your target criteria.
  * **Automated Dialing:** Use a predictive dialer to connect with leads quickly and maximize talk time.
  * **Call Scripting & Guidance:** Real-time prompts and scripts to guide agents during a call, ensuring consistency and effectiveness.
  * **CRM Integration:** Seamlessly connect with popular CRM platforms like Salesforce and HubSpot to sync data and maintain a single source of truth.
  * **Call Analytics:** Detailed reporting on call volume, conversion rates, talk time, and agent performance.
  * **Call Recording & Transcription:** Record and transcribe calls for quality assurance, training, and easy reference.
  * **Contact Management:** Organize and manage your leads and contacts with customizable tags and notes.

## Getting Started

### Prerequisites

  * Node.js (v14 or higher)
  * Python (v3.8 or higher)
  * A SQL database (e.g., PostgreSQL, MySQL, SQL Server)
  * An API key for your chosen AI service (e.g., OpenAI, Google AI)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/Gouravbirwaz/cold_calling_platform.git](https://github.com/Gouravbirwaz/cold_calling_platform.git)
    cd cold_calling_platform
    ```

2.  **Install backend dependencies:**

    ```bash
    npm install
    ```

3.  **Install frontend dependencies:**

    ```bash
    cd client
    npm install
    ```

    (Assuming you have a separate frontend directory)

4.  **Set up environment variables:**
    Create a `.env` file in the root directory and add the following:

    ```
    PORT=5000
    DATABASE_URL=your_sql_connection_string
    AI_API_KEY=your_ai_api_key
    JWT_SECRET=a_strong_secret_key
    ```

    *Note: The `DATABASE_URL` format will vary depending on your specific SQL database. For example: `postgresql://user:password@host:port/database`*

5.  **Run database migrations:**
    Before starting the application, you'll need to set up your database schema. Use your preferred SQL migration tool to apply the schema located in the `migrations` directory.

6.  **Run the application:**

    ```bash
    # Start the backend server
    npm run start

    # In a new terminal, start the frontend server
    cd client
    npm run start
    ```

## Usage

  * **Admin Dashboard:** Log in to the admin dashboard to manage users, view analytics, and configure campaigns.
  * **Campaigns:** Create a new campaign, upload your lead list, and set up your call scripts.
  * **Agent Interface:** Agents can log in to their personalized dashboard, view their assigned leads, and start making calls.
  * **Reports:** Access detailed reports to track the performance of your campaigns and agents.

## API Documentation

The platform's API is built on REST principles and allows for easy integration with external systems.

  * `GET /api/v1/leads`: Get a list of all leads.
  * `POST /api/v1/leads`: Create a new lead.
  * `GET /api/v1/campaigns/:id`: Get details of a specific campaign.
  * `POST /api/v1/calls/record`: Upload a new call recording.

For more detailed API documentation, refer to the `API_DOCS.md` file in the repository.



## Contact

For any questions or support, please contact Gouravbirwaz. You can find more information at the project's repository: [https://github.com/Gouravbirwaz/cold\_calling\_platform.git](https://github.com/Gouravbirwaz/cold_calling_platform.git).