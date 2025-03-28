import os, ssl, certifi
from flask import Flask, request, jsonify
from PIL import Image
import torch
import torch.nn as nn
import pandas as pd
from torchvision import transforms, models
from torchvision.models import EfficientNet_B0_Weights

ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

app = Flask(__name__)

# 🔧 모델 및 라벨 불러오기
MODEL_PATH = "model/efficientnet_b0_1500styles.pth"
CSV_PATH = "model/balanced_data_1500.csv"

df = pd.read_csv(CSV_PATH)
df["style"] = df["style"].fillna("unknown").astype(str)
labels = sorted(df["style"].unique())
label2idx = {label: idx for idx, label in enumerate(labels)}
idx2label = {v: k for k, v in label2idx.items()}

def get_model(num_classes):
    weights = EfficientNet_B0_Weights.IMAGENET1K_V1
    model = models.efficientnet_b0(weights=weights)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    return model.to(device).eval()

model = get_model(len(labels))

# 🔄 전처리
val_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# 🔮 예측 함수
def predict(image):
    image = val_transform(image).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = model(image)
        probs = nn.Softmax(dim=1)(outputs)
        top3_probs, top3_indices = torch.topk(probs, 3, dim=1)

    top3 = []
    for prob, idx in zip(top3_probs[0], top3_indices[0]):
        top3.append({
            "label": idx2label[idx.item()],
            "confidence": round(prob.item(), 4)
        })
    return top3

# 🚀 API 엔드포인트
@app.route("/predict", methods=["POST"])
def predict_api():
    if 'image' not in request.files:
        return jsonify({"error": "이미지 파일이 필요합니다"}), 400

    file = request.files['image']
    image = Image.open(file.stream).convert("RGB")
    results = predict(image)
    return jsonify({"top3": results})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))  # ✅ Render 호환용
    app.run(host="0.0.0.0", port=port)
