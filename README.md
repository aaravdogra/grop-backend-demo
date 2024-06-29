# GROP - Grep but OP (Backend Demo)

## Overview

GROP is a powerful tool designed to help users effectively search through vast notes databases, especially those containing handwritten files, by indexing their local file system and enabling semantic searches. This repository hosts the backend portion of GROP as a demo, showcasing its core functionality.

## Inspiration

The inspiration for GROP came from the need to efficiently study for midterms using extensive handwritten notes provided by professors. Traditional keyword searches fail with handwritten notes, so GROP addresses this by enabling semantic searches across various file types, including handwritten notes, HTML files, Markdown files, regular text, and DOCX files.

## What It Does

GROP allows users to:
- Index their local file system.
- Perform semantic searches across different file types.
- Find topics and concepts in files even if the exact keywords are not present.

## How It Works

GROP leverages Cohere's vector embedding API and Chroma's vector database. The workflow includes:
1. Parsing selected files.
2. Embedding the parsed content using Cohere's vector embedding API.
3. Storing the embeddings in Chroma.
4. Using Chroma's nearest neighbor functionality for similarity searches.

## Features

- **Semantic Search**: Search for concepts and topics within files.
- **Multi-file Type Support**: Works with handwritten notes, HTML, Markdown, text, and DOCX files.
- **Granular Search**: Identifies specific lines matching the query in the corresponding files.

## Challenges

- Consistent vector embeddings across different file types.
- Efficient file parsing and indexing.
- Handling large files and ensuring timely processing.

## Accomplishments

- Successfully built a comprehensive parsing engine.
- Developed a robust semantic search that accurately captures the meaning of files.
- Indexed and searched through complex data sets, including codebases and handwritten notes.

## Learning Outcomes

- Developed a desktop app using Electron and Node.js.
- Utilized vector embeddings and vector databases.
- Created file parsing pipelines for multiple file types.
- Enhanced teamwork and project management skills.

## Future Plans

- Integrate embeddings as context for a Large Language Model (LLM) to enable direct questioning of indexed files.
- Add clustering visualization to the UI for better contextual representation of vector similarities.
- Enhance the database's portability using Docker.
- Add support for image embeddings to classify pictures and artwork semantically.

## Built With

- Chroma
- Cohere
- Electron
- Embedding
- Natural Language Processing
- Node.js
- OpenAI

## Getting Started

### Prerequisites

- Node.js
- Docker (for database deployment)
- API keys for Cohere and Chroma

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/grop-backend-demo.git
    cd grop-backend-demo
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Set up environment variables:
    - Create a `.env` file in the root directory.
    - Add your Cohere and Chroma API keys:
      ```
      COHERE_API_KEY=your_cohere_api_key
      CHROMA_API_KEY=your_chroma_api_key
      ```

4. Start the backend server:
    ```sh
    npm start
    ```

### Usage

- The backend server will be running and ready to accept requests for indexing and searching files.
- Use the provided API endpoints to interact with the backend.

### API Endpoints

- **POST /index**: Index the selected files.
- **GET /search**: Perform a semantic search on the indexed files.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any suggestions or improvements.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgements

- Cohere for their vector embedding API.
- Chroma for their vector database.
- The team for their hard work and dedication.

---
