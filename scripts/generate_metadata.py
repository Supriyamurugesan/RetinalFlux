import os
import json

# Path to your processed training data
train_dir = "data/processed/train"
output_file = "data/processed/metadata.jsonl"

with open(output_file, 'w') as f:
    for label in ['NORMAL', 'DRUSEN', 'CNV', 'DME']:
        folder_path = os.path.join(train_dir, label)
        if not os.path.isdir(folder_path): continue
        
        # Create a descriptive prompt for each class
        prompt = f"A high-resolution retinal OCT scan showing {label.lower()} pathology"
        if label == 'NORMAL':
            prompt = "A high-resolution retinal OCT scan of a healthy eye with clear layers"

        for img_name in os.listdir(folder_path):
            line = {
                "file_name": f"{label}/{img_name}",
                "text": prompt
            }
            f.write(json.dumps(line) + "\n")

print(f"Metadata generated: {output_file}")