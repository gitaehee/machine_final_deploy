import os, ssl, certifi
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageFile
import torch
import torch.nn as nn
import pandas as pd
from torchvision import transforms, models
from torchvision.models import EfficientNet_B0_Weights
import random
import numpy as np

# 시드 고정 (학습과 동일하게)
random.seed(1986)
np.random.seed(1986)
torch.manual_seed(1986)
torch.cuda.manual_seed(1986)
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

Image.MAX_IMAGE_PIXELS = None  # ✅ 큰 이미지 제한 해제
ImageFile.LOAD_TRUNCATED_IMAGES = True

ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

app = Flask(__name__)

# 모든 라우트에 대해 모든 origin 허용 + credentials 지원
CORS(app, resources={r"/*": {"origins": "*"}})

# 🔧 모델 및 라벨 불러오기
MODEL_PATH = "model/b3_final_15.pth"

# 🔄 모든 temp CSV 불러오기
df_train = pd.read_csv("model/train_temp.csv")
df_val   = pd.read_csv("model/val_temp.csv")
df_test  = pd.read_csv("model/test_temp.csv")

# 🔁 합치기 + 라벨 처리
df_all = pd.concat([df_train, df_val, df_test], ignore_index=True)
df_all["style"] = df_all["style"].fillna("unknown").astype(str)

# ✅ 전체 라벨 기준으로 label2idx 생성
labels = sorted(df_all["style"].unique())
label2idx = {label: idx for idx, label in enumerate(labels)}
idx2label = {v: k for k, v in label2idx.items()}

# ✅ 기존 idx2label 생성 코드 아래에 추가하세요.
style_translations = {
    'Realism': '사실주의', 
    'Romanticism': '낭만주의', 
    'Art Nouveau (Modern)': '아르누보',
    'Impressionism': '인상주의',
    'Surrealism': '초현실주의',  
    'Expressionism': '표현주의',  
    'Northern Renaissance': '북부 르네상스',  
    'Rococo': '로코코 양식', 
    'Baroque': '바로크 양식'
}

# ✅ idx2label을 한글로 번역
idx2label_korean = {idx: style_translations.get(label, label) for idx, label in idx2label.items()}

def get_model(num_classes):
    weights = models.EfficientNet_B3_Weights.IMAGENET1K_V1
    model = models.efficientnet_b3(weights=weights)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    return model.to(device).eval()

model = get_model(len(labels))

# 🔄 전처리
val_transform = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# 🔮 예측 함수
def predict(image, threshold=0.3):
    image = val_transform(image).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = model(image)
        probs = nn.Softmax(dim=1)(outputs)
        top3_probs, top3_indices = torch.topk(probs, 3, dim=1)

    top1_prob = top3_probs[0][0].item()
    if top1_prob < threshold:
        return [{"label": "해당되는 사조가 없습니다", "confidence": round(top1_prob, 4)}]

    top3 = []
    for prob, idx in zip(top3_probs[0], top3_indices[0]):
        top3.append({
            "label": idx2label_korean[idx.item()],
            "confidence": round(prob.item(), 4)  # ✅ 퍼센트 X, 그대로 확률
        })
    return top3

# 🚀 API 엔드포인트
@app.route("/predict", methods=["POST"])
def predict_api():
    if 'image' not in request.files:
        print("❌ 이미지가 요청에 포함되지 않았어요.")
        return jsonify({"error": "이미지 파일이 필요합니다"}), 400

    file = request.files['image']
    print(f"📸 받은 파일 이름: {file.filename}")
    
    
    try:
        image = Image.open(file.stream).convert("RGB")
        print("✅ 이미지 열기 성공")

        results = predict(image, threshold=0.3)
        print(f"🔮 예측 결과: {results}")
        return jsonify({"top3": results})
    except Exception as e:
        print(f"❌ 예측 중 오류 발생: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))  # ✅ Render 호환용
    app.run(host="0.0.0.0", port=port)
