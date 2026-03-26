# Express MRI Prediction Server

A Node.js Express server that acts as a proxy between the React frontend and the FastAPI prediction server, with MongoDB integration for storing prediction history.

## Features

- **File Upload**: Accepts MRI image uploads using multer
- **Proxy**: Forwards requests to FastAPI server at `http://localhost:8000/predict/`
- **MongoDB Integration**: Stores prediction history using Mongoose
- **CORS Support**: Enabled for cross-origin requests
- **Error Handling**: Comprehensive error handling for various failure scenarios
- **File Validation**: Validates file types and size limits

## Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

Or:

```bash
node server.js
```

The server will start on `http://localhost:3000` by default.

## Endpoints

### Health Check
- **GET** `/health`
- Returns server status

### Predict
- **POST** `/api/predict`
- Accepts multipart/form-data with:
  - `file` (required): MRI image file
  - `patientName` (required): Patient name as a text field
- Forwards the image to FastAPI server
- Saves prediction to MongoDB
- Returns JSON with `prediction` and `confidence` fields

### History
- **GET** `/api/history`
- Returns all prediction records sorted by newest first
- Response format:
  ```json
  {
    "count": 5,
    "predictions": [
      {
        "_id": "...",
        "patientName": "John Doe",
        "tumorType": "glioma",
        "confidence": 0.95,
        "createdAt": "2026-02-20T12:00:00.000Z"
      }
    ]
  }
  ```

## Configuration

- **Port**: Set via `PORT` environment variable (default: 3000)
- **File Size Limit**: 10MB
- **Allowed File Types**: JPEG, JPG, PNG, GIF
- **FastAPI URL**: `http://localhost:8000/predict/` (hardcoded)
- **MongoDB URI**: `mongodb://127.0.0.1:27017/brain_tumor_db` (hardcoded )

## MongoDB Schema

The `Prediction` schema includes:
- `patientName` (String, required): Patient's name
- `tumorType` (String, required): Predicted tumor type from FastAPI
- `confidence` (Number, required): Prediction confidence score
- `createdAt` (Date, default: now): Timestamp of prediction

## Error Handling

The server handles various error scenarios:
- Missing file uploads
- Missing patient name
- Invalid file types
- File size exceeded
- FastAPI server unavailable
- Request timeouts
- FastAPI server errors
- MongoDB connection errors
- Database save errors

## Requirements

- Node.js (v14 or higher recommended)
- MongoDB running on `mongodb://127.0.0.1:27017`
- FastAPI server running on `http://localhost:8000`

## Console Logs

The server provides console logs for:
- MongoDB connection status
- Successful prediction saves (with patient name, tumor type, confidence, and document ID)
- History retrieval (with count of records retrieved)
