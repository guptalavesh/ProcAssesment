# Run ProcAssesment from GitHub — no local install required

You have three zero-install paths. Pick whichever fits.

---

## Option A — GitHub Codespaces (recommended for development)

A full VS Code IDE in your browser, with `gcloud`, Python, and Node already installed via the `.devcontainer/devcontainer.json` in this repo.

### Steps

1. On the GitHub repo page, click the green **`Code`** button → **Codespaces** tab → **`Create codespace on claude/build-app-from-specs-3FyO9`** (or main).
2. Wait ~2 minutes for the container to build. You'll get a VS Code window in your browser.
3. In the integrated terminal, sign in to Google Cloud:

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

   Both commands print a URL — open it in a new tab, sign in to your Google account, paste the verification code back into the terminal.

4. Run the setup script:

   ```bash
   bash scripts/setup_gcp.sh
   ```

   This picks (or creates) a project, enables Vertex AI, writes `backend/.env`, and smoke-tests Gemini.

5. Start the app:

   ```bash
   # Terminal 1 — backend
   cd backend && uvicorn main:app --reload --port 8002

   # Terminal 2 — frontend
   cd frontend && npm run dev
   ```

6. Codespaces auto-forwards ports 5173 (frontend) and 8002 (backend). A toast pops up with "Open in browser". Click it to access the running app.

### Cost

Codespaces gives **120 free hours/month** on the free tier (2-core machines). Vertex AI Gemini 2.5 has a free quota too — see [cloud.google.com/vertex-ai/pricing](https://cloud.google.com/vertex-ai/pricing).

---

## Option B — Google Cloud Shell (zero-config, browser-only)

`gcloud` is already authenticated to your Google account. This is the simplest path.

### Steps

1. Open [shell.cloud.google.com](https://shell.cloud.google.com) in a browser.
2. Clone the repo:

   ```bash
   git clone https://github.com/guptalavesh/ProcAssesment.git
   cd ProcAssesment
   ```

3. Run setup:

   ```bash
   bash scripts/setup_gcp.sh
   ```

4. Install dependencies:

   ```bash
   pip install -r backend/requirements.txt --user
   cd frontend && npm install && cd ..
   ```

5. Start the app:

   ```bash
   cd backend && python -m uvicorn main:app --reload --port 8002 &
   cd ../frontend && npm run dev
   ```

6. Click **Web Preview** (top-right of Cloud Shell) → change port to `5173` → app opens in a new tab.

### Cost

Cloud Shell is **free** with a persistent 5 GB home directory.

---

## Option C — GitHub Actions auto-deploy to Cloud Run

For production deployment. Uses **Workload Identity Federation**, so no service-account JSON keys ever leave Google Cloud.

### One-time GCP setup (in Cloud Shell)

```bash
PROJECT_ID="$(gcloud config get-value project)"
PROJECT_NUMBER="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')"
REPO="guptalavesh/ProcAssesment"

# 1. Enable APIs
gcloud services enable iamcredentials.googleapis.com run.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com \
  aiplatform.googleapis.com

# 2. Create the workload identity pool + provider
gcloud iam workload-identity-pools create "github" \
  --location="global" --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "github" \
  --location="global" \
  --workload-identity-pool="github" \
  --display-name="GitHub OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == 'guptalavesh'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Create a service account
gcloud iam service-accounts create "github-actions" \
  --display-name="GitHub Actions deployer"

SA="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"

# 4. Grant the account roles needed for deploy + Vertex AI
for role in roles/aiplatform.user roles/run.admin roles/storage.admin \
            roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" --role="$role"
done

# 5. Allow the GitHub repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# 6. Print the values you need for GitHub secrets
echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "GCP_SERVICE_ACCOUNT=$SA"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github"

# 7. Create the Artifact Registry repo (one-time)
gcloud artifacts repositories create app \
  --repository-format=docker --location=us-central1
```

### GitHub setup

1. On the GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add the three values printed by step 6 above.
2. The workflow at `.github/workflows/deploy-cloudrun.yml` will now trigger on push to `main` (or via **Actions → Deploy to Cloud Run → Run workflow**).
3. After it succeeds, your live URL is in the workflow log: `https://procassesment-XXXXX-uc.a.run.app`.

### Cost

Cloud Run scales to zero — you only pay when requests come in. Hobby usage typically stays inside the free tier.

---

## Which option should I pick?

| Need | Option |
|---|---|
| Quick try-before-commit | **B (Cloud Shell)** |
| Active development with VS Code | **A (Codespaces)** |
| Live shareable URL for demos / clients | **C (Actions → Cloud Run)** |
