from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import numpy as np
import tensorflow as tf
from PIL import Image
import io
import cv2
import os
import time

# Create heatmaps directory if it doesn't exist
os.makedirs("heatmaps", exist_ok=True)
from PIL import Image
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the heatmaps directory so the frontend can access it
app.mount("/heatmaps", StaticFiles(directory="heatmaps"), name="heatmaps")


model = tf.keras.models.load_model('as.h5') 


class_names = ['glioma', 'meningioma', 'notumor', 'pituitary']

IMAGE_SIZE = 224  
def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMAGE_SIZE, IMAGE_SIZE))
    img_array = np.array(img).astype(np.float32) / 255.0  
    img_array = np.expand_dims(img_array, axis=0)  
    return img_array

def find_last_conv_layer(model):
    for layer in reversed(model.layers):
        if isinstance(layer, tf.keras.layers.Conv2D):
            return layer.name
    raise ValueError("No Conv2D layer found in the model.")

def make_gradcam_heatmap(img_array, model, last_conv_layer_name, pred_index=None):
    # Create a model that maps the input image to the activations of the last conv layer as well as the output predictions
    grad_model = tf.keras.models.Model(
        [model.inputs], [model.get_layer(last_conv_layer_name).output, model.output]
    )

    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        
        # Ensure preds is a tensor/numpy array before indexing
        preds = tf.convert_to_tensor(preds)
        
        if pred_index is None:
            pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]

    # Gradient of the output neuron w.r.t the output feature map
    grads = tape.gradient(class_channel, last_conv_layer_output)
    
    # Vector where each entry is the mean intensity of the gradient over a specific feature map channel
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    # Multiply each channel in the feature map by "how important this channel is" 
    last_conv_layer_output = last_conv_layer_output[0]
    heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    # Normalize the heatmap between 0 & 1
    heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
    return heatmap.numpy()

def save_and_display_gradcam(img_bytes, heatmap, cam_path="cam.jpg", alpha=0.4):
    # Load original image
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img = img.resize((IMAGE_SIZE, IMAGE_SIZE))
    img_arr = np.array(img)

    # Rescale heatmap to a range 0-255
    heatmap = np.uint8(255 * heatmap)

    # Use jet colormap to colorize heatmap
    jet = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
    jet = cv2.cvtColor(jet, cv2.COLOR_BGR2RGB) # OpenCV uses BGR, convert to RGB

    # Resize jet colormap to match original image size
    jet = cv2.resize(jet, (img_arr.shape[1], img_arr.shape[0]))

    # Superimpose heatmap onto original image
    superimposed_img = jet * alpha + img_arr
    superimposed_img = np.clip(superimposed_img, 0, 255).astype(np.uint8)

    # Save superimposed image
    img_out = Image.fromarray(superimposed_img)
    img_out.save(cam_path)

@app.post("/predict/")
async def predict(file: UploadFile = File(...)):
    image_bytes = await file.read()
    try:
        img_array = preprocess_image(image_bytes)
    except Exception:
        return JSONResponse({"error": "Invalid image or preprocessing error."}, status_code=400)

    preds = model.predict(img_array)
    predicted_idx = np.argmax(preds)
    predicted_label = class_names[predicted_idx]
    confidence = float(np.max(preds))
    print(predicted_label)
    
    # Generate Grad-CAM Heatmap
    heatmap_filename = f"heatmap_{int(time.time()*1000)}.png"
    heatmap_path = os.path.join("heatmaps", heatmap_filename)
    
    try:
        # Automatically detect the last convolutional layer
        last_conv_layer_name = find_last_conv_layer(model)
        print(f"Detected last conv layer: {last_conv_layer_name}")
        
        heatmap = make_gradcam_heatmap(img_array, model, last_conv_layer_name, predicted_idx)
        save_and_display_gradcam(image_bytes, heatmap, heatmap_path)
        heatmap_url = f"/heatmaps/{heatmap_filename}"
    except Exception as e:
        print(f"❌ Error generating Grad-CAM: {str(e)}")
        import traceback
        traceback.print_exc()
        heatmap_url = None # Fallback if Grad-CAM fails

    response_data = {
        "prediction": predicted_label,
        "confidence": round(confidence, 3)
    }
    
    if heatmap_url:
        response_data["heatmap"] = heatmap_url

    return JSONResponse(response_data)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
