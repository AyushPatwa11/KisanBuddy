# Running Tests & Local Development

This project includes basic tests and a CI workflow. The tests are lightweight and patch networked services to allow offline execution.

Backend (Windows / PowerShell):

```powershell
# Create and activate venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend requirements (includes pytest)
pip install --upgrade pip
pip install -r backend/requirements.txt

# Run tests
pytest backend -q
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

CI: The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml` that installs backend requirements and runs `pytest` on push/PRs to `main`.

Notes:
- Tests patch external network calls (geocoding, agmarknet) so they run quickly without internet.
- To test the real services, ensure API keys are configured in `.env` and run the backend via `uvicorn backend.main:app --reload` before executing integration tests.
