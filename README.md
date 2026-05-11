# 🌾 KisanBuddy (किसान मित्र)

**Pan-India Multimodal Agricultural PWA** — A high-availability, error-resilient agentic web ecosystem for Indian farmers.


## 🎯 Overview

KisanBuddy employs a **Planner-Executor-Validator** architecture with specialist agents to provide:

- 🌿 **Crop Disease Diagnosis** — SWIN Transformer with 88% accuracy
- 💰 **Market Price Intelligence** — Real-time Agmarknet data + 14-day LSTM forecasts
- 🌧️ **Weather Hazard Alerts** — Sentinel-1/2 flood/drought risk assessment
- 🗣️ **22 Indian Languages** — IndicTrans2 + Voice input with SS-VAD noise filtering
- 📴 **Offline-First** — IndexedDB with AES-256 encryption + exponential backoff sync

---

## 📁 Project Structure

```
KisanBuddy/
├── backend/                    # FastAPI + Vertex AI Agent Engine
│   ├── main.py                 # API endpoints
│   ├── agents/
│   │   ├── planner.py          # Task decomposition
│   │   └── validator.py        # CIB&RC safety checks
│   ├── services/
│   │   ├── agmarknet.py        # CEDA Ashoka price API
│   │   ├── anthrokrishi.py     # Field boundary (S2 cells)
│   │   ├── earth_engine.py     # Hazard detection
│   │   └── vision.py           # Leaf disease diagnosis
│   └── requirements.txt
├── frontend/                   # Next.js PWA + Tailwind CSS
│   ├── src/
│   │   ├── pages/              # Next.js pages
│   │   ├── components/         # UI components (3-tap accessible)
│   │   └── lib/
│   │       ├── syncEngine.ts   # IndexedDB + AES-256 + sync
│   │       ├── api.ts          # API client
│   │       └── voice.ts        # SS-VAD + IndicTrans2
│   ├── public/manifest.json    # PWA manifest
│   └── package.json
├── SECURITY.md                 # VPC-SC + encryption configs
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.10+ (for backend)
- **pnpm** or **npm** (for frontend package management)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn main:app --reload --port 8080
```

Backend runs at: `http://localhost:8080`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vision_diagnostic` | POST | Diagnose leaf disease from image |
| `/api/agmarknet_proactive` | POST | Get market prices + 14-day forecast |
| `/api/anthrokrishi_parcel` | POST | Query field boundaries (S2 cells) |
| `/api/earth_engine_hazards` | POST | Get flood/drought risk |
| `/api/plan` | POST | Decompose intent into tasks |
| `/api/validate` | POST | Validate pesticide recommendations |

---

## 🌐 External API Configuration

### Agmarknet 2.0 (CEDA Ashoka)
```
Base URL: https://api.ceda.ashoka.edu.in/v1
Endpoint: POST /agmarknet/prices
Response: [{ City, Commodity, Min Prize, Max Prize, Date }]
```

### AnthroKrishi (Field Boundaries)
- Requires Google Workspace Customer ID allowlisting
- Uses Level 13 S2 cells (~1km × 1km)
- 1-meter resolution from ALU/AMED model

### CIB&RC (Pesticide Validation)
- Validates against Insecticides Act, 1968
- Checks crop-pesticide compatibility
- Rain-safety warnings

---

## 🔒 Security

- **VPC Service Controls** — Enterprise-grade data isolation
- **AES-256-GCM** — Local IndexedDB encryption
- **Exponential Backoff** — $2^n + \text{jitter}$ sync retry
- **CIB&RC Grounding** — Pesticide safety validation

See [SECURITY.md](./SECURITY.md) for detailed configuration.

---

## 🎨 UI/UX Principles

1. **Three-Tap Rule** — Critical info within 3 interactions
2. **Cultural Iconography** — Clay pot (save), Seedling+Money (market)
3. **Directive Voice Prompts** — "हाथ खिसकाएं" (Swipe left)
4. **Offline Indicators** — Sync badges, grey-out when offline

---

## 📱 PWA Features

- **Service Worker** — Offline caching
- **Add to Home Screen** — Native app experience
- **Background Sync** — Queue requests when offline
- **Push Notifications** — Weather alerts (planned)

---

## 🔧 Development

### Run Tests
```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Build for Production
# ```bash
# Backend: Containerize
docker build -t kisan-buddy-api ./backend

# Frontend: Static export
cd frontend
npm run build
```

---

## 📄 License

MIT License — See LICENSE file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

**Built with ❤️ for Indian Farmers | किसानों के लिए प्यार से बनाया गया**
