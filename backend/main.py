import os
import io
import cv2
import numpy as np
import base64
import torch
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from diffusers import StableDiffusionImg2ImgPipeline
from skimage.metrics import structural_similarity as ssim
from skimage.metrics import peak_signal_noise_ratio as psnr

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODEL LOADING ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LORA_PATH = os.path.join(BASE_DIR, "models")
LORA_FILENAME = "pytorch_lora_weights.safetensors"

model_id = "runwayml/stable-diffusion-v1-5"
pipe = StableDiffusionImg2ImgPipeline.from_pretrained(model_id, torch_dtype=torch.float32)

full_weight_path = os.path.join(LORA_PATH, LORA_FILENAME)
if os.path.exists(full_weight_path):
    print(f"✅ Found weights at: {full_weight_path}")
    pipe.load_lora_weights(LORA_PATH, weight_name=LORA_FILENAME)
pipe.to("cpu")

# --- ENDPOINTS ---

@app.post("/generate-progression-video")
async def generate_video(file: UploadFile = File(...), prompt: str = Form(...)):
    request_object_content = await file.read()
    input_pil = Image.open(io.BytesIO(request_object_content)).convert("RGB")
    input_pil = input_pil.resize((256, 256))
    input_cv_gray = cv2.cvtColor(np.array(input_pil), cv2.COLOR_RGB2GRAY)
    base_colored = cv2.cvtColor(input_cv_gray, cv2.COLOR_GRAY2BGR)
    
    frames = []
    strengths = np.linspace(0.1, 0.5, 10)

    for s in strengths:
        frame_pil = pipe(prompt=f"{prompt}, medical oct", image=input_pil, strength=s, num_inference_steps=20).images[0]
        frame_cv_gray = cv2.cvtColor(np.array(frame_pil), cv2.COLOR_RGB2GRAY)
        
        # Red Highlight logic for video
        diff = cv2.absdiff(input_cv_gray, frame_cv_gray)
        _, mask = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
        red_full = np.zeros_like(base_colored); red_full[:] = [0, 0, 255]
        highlight = cv2.bitwise_and(red_full, red_full, mask=mask)
        final_frame = cv2.addWeighted(base_colored, 0.7, highlight, 0.3, 0)
        frames.append(final_frame)

    video_path = "progression_result.mp4"
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    out = cv2.VideoWriter(video_path, fourcc, 5.0, (256, 256))
    for f in frames: out.write(f)
    out.release()

    with open(video_path, "rb") as f:
        return Response(content=f.read(), media_type="video/mp4")

@app.post("/predict-progression")
async def predict(file: UploadFile = File(...), prompt: str = Form("advanced drusen pathology")):
    # 1. Process Input
    request_object_content = await file.read()
    input_pil = Image.open(io.BytesIO(request_object_content)).convert("RGB")
    input_pil = input_pil.resize((256, 256))
    input_cv_gray = cv2.cvtColor(np.array(input_pil), cv2.COLOR_RGB2GRAY)

    # 2. Generate Prediction
    result_pil = pipe(prompt=prompt, image=input_pil, strength=0.3, guidance_scale=7.5, num_inference_steps=20).images[0]
    result_cv_gray = cv2.cvtColor(np.array(result_pil), cv2.COLOR_RGB2GRAY)

    # 3. SCIENTIFIC EVALUATION (The New Part)
    # SSIM measures structural integrity (Anatomy)
    # PSNR measures image quality (Signal)
    score_ssim = ssim(input_cv_gray, result_cv_gray)
    score_psnr = psnr(input_cv_gray, result_cv_gray)

    # 4. Create Visualization (Red Overlay)
    diff = cv2.absdiff(input_cv_gray, result_cv_gray)
    _, disease_mask = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
    
    # Growth Index: % of the scan area covered by red pixels
    growth_index = (np.sum(disease_mask > 0) / disease_mask.size) * 100

    colored_bg = cv2.cvtColor(input_cv_gray, cv2.COLOR_GRAY2BGR)
    red_full = np.zeros_like(colored_bg); red_full[:] = [0, 0, 255]
    red_highlight = cv2.bitwise_and(red_full, red_full, mask=disease_mask)
    final_visualization = cv2.addWeighted(colored_bg, 0.7, red_highlight, 0.3, 0)

    # 5. Package into JSON (So we can send values + image)
    _, encoded_img = cv2.imencode('.png', final_visualization)
    img_base64 = base64.b64encode(encoded_img).decode('utf-8')

    return JSONResponse(content={
        "image": img_base64,
        "ssim": round(float(score_ssim), 4),
        "psnr": round(float(score_psnr), 2),
        "growth": round(float(growth_index), 2)
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=300)

#FOR RED COLOUR HIGHLIGHTED VIDEO:

# @app.post("/generate-progression-video")
# async def generate_video(file: UploadFile = File(...), prompt: str = Form(...)):
#     request_object_content = await file.read()
#     input_pil = Image.open(io.BytesIO(request_object_content)).convert("RGB")
#     input_pil = input_pil.resize((256, 256))
    
#     # Convert original to grayscale CV for math, then BGR for color
#     input_cv_gray = cv2.cvtColor(np.array(input_pil), cv2.COLOR_RGB2GRAY)
#     base_colored = cv2.cvtColor(input_cv_gray, cv2.COLOR_GRAY2BGR)
    
#     frames = []
#     # 10 frames representing time
#     strengths = np.linspace(0.1, 0.5, 10)

#     for i, s in enumerate(strengths):
#         print(f"Generating colored frame {i+1}/10...")
        
#         # 1. Generate the raw frame
#         frame_pil = pipe(prompt=prompt, image=input_pil, strength=s, num_inference_steps=20).images[0]
#         frame_cv_gray = cv2.cvtColor(np.array(frame_pil), cv2.COLOR_RGB2GRAY)
        
#         # 2. Calculate the Red Highlight (The Growth)
#         diff = cv2.absdiff(input_cv_gray, frame_cv_gray)
#         _, disease_mask = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
        
#         # Create the Red Mask for this frame
#         red_full = np.zeros_like(base_colored)
#         red_full[:] = [0, 0, 255] 
#         red_diff_visual = cv2.bitwise_and(red_full, red_full, mask=disease_mask)
        
#         # 3. Merge Highlight with Original
#         final_frame = cv2.addWeighted(base_colored, 0.7, red_diff_visual, 0.3, 0)
#         frames.append(final_frame)

#     # 4. Save to Video
#     video_path = "progression_highlighted.mp4"
#     fourcc = cv2.VideoWriter_fourcc(*'mp4v')
#     out = cv2.VideoWriter(video_path, fourcc, 5.0, (256, 256))

#     for f in frames:
#         out.write(f)
#     out.release()

#     with open(video_path, "rb") as f:
#         return Response(content=f.read(), media_type="video/mp4")