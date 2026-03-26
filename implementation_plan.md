# Grad-CAM Heatmap Implementation Plan

## Goal Description
Enhance the FastAPI AI model server to generate a tumor highlight heatmap using Grad-CAM. This will visualize the regions of the MRI that influenced the prediction, overlay it on the original MRI, save it locally, and serve it via the prediction API for the React frontend to display.

## Proposed Changes

### 1. FastAPI Model Server
#### [MODIFY] [main.py](file:///d:/Zenith/main.py)
- **Static Hosting:** Add `os.makedirs("heatmaps", exist_ok=True)` and use FastAPI's `StaticFiles` to mount a `/heatmaps` route.
- **Grad-CAM Logic:**
  - Add `cv2` and `time` imports.
  - Implement a `get_last_conv_layer(model)` helper to dynamically detect the final convolutional layer.
  - Implement a `make_gradcam_heatmap()` function that leverages `tf.GradientTape()` to calculate the gradients w.r.t the last conv layer outputs for the predicted class.
  - Implement a function to superimpose the heatmap onto the original image arrays using `cv2.applyColorMap(..., cv2.COLORMAP_JET)`.
- **API Response:** Add the heatmap generation inside the `/predict/` endpoint, saving the output to `heatmaps/heatmap_<timestamp>.png` and yielding it dynamically as `"heatmap": "heatmaps/..."` in the JSON response.

### 2. Node.js Backend Server
#### [MODIFY] [server.js](file:///d:/Zenith/backend/server.js)
- **API Forwarding:** Update the `/api/predict` endpoint to extract `response.data.heatmap`.
- Return the `heatmap` string in the standard `res.json()` success object so the React app can ingest it.

### 3. React Frontend
#### [MODIFY] [App.tsx](file:///d:/Zenith/mri-react/src/App.tsx)
- **Type Definitions:** Add an optional `heatmap?: string` to the [PredictionResponse](file:///d:/Zenith/mri-react/src/App.tsx#4-8) type.
- **UI Update:** Within the conditional rendering for `result`, formulate a new matching card element (`result-container show`).
- The card will possess a title like `🔍 Tumor Highlight Heatmap` and will render an `<img>` tag with the `src` corresponding to `http://localhost:8000/${result.heatmap}`.
- Style the image precisely similar to the previous preview (rounded corners, object contain constraints).

## Verification Plan

### Automated Tests
- Running `node server.js` and checking that it successfully processes prediction requests with Multer without crashing locally.
- Manually run unit checks with python directly asserting Grad-CAM yields correct shape tensors via `cv2`.

### Manual Verification
- Upload an MRI image utilizing the React frontend drag-and-drop tool. 
- Wait for the "Analysis Results" evaluation to complete.
- Verify visually that the `Heatmap Visualization` container renders dynamically properly alongside "Tumor Information", displaying the colored thermal diagnostic map overlapping the brain tumor.
- Confirm browser network logs properly fetch the `http://localhost:8000/heatmaps/...` asset.
