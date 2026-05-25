import os
import cv2
import numpy as np
from tqdm import tqdm

def preprocess_oct_images(input_dir, output_dir, size=(256, 256)):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for label in ['NORMAL', 'DRUSEN', 'DME', 'CNV']:
        label_path = os.path.join(input_dir, label)
        save_path = os.path.join(output_dir, label)
        os.makedirs(save_path, exist_ok=True)

        print(f"Processing {label}...")
        for img_name in tqdm(os.listdir(label_path)):
            img_path = os.path.join(label_path, img_name)
            img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE) # OCTs are grayscale
            
            if img is not None:
                # 1. Resize
                img_resized = cv2.resize(img, size)
                # 2. Contrast Enhancement (CLAHE) - Essential for medical scans
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
                img_enhanced = clahe.apply(img_resized)
                
                cv2.imwrite(os.path.join(save_path, img_name), img_enhanced)

# Run it
preprocess_oct_images('data/raw/OCT2017/train', 'data/processed/train')