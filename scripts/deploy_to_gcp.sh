#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# deploy_to_gcp.sh — deploy ProcAssesment to GCP, no VM, no manual setup.
#
# Architecture:
#   Frontend (React)  → Firebase Hosting    (global CDN, free tier)
#   Backend (FastAPI) → Cloud Run           (serverless, scales to zero)
#                                            in us-central1 alongside Vertex AI
#
# Firebase Hosting rewrites /api/** straight to the Cloud Run service so the
# browser only ever sees one URL: https://<project>.web.app
#
# Run from Google Cloud Shell (https://shell.cloud.google.com). Both gcloud
# and the firebase CLI are preinstalled there.
#
# Usage:
#   bash scripts/deploy_to_gcp.sh
#   PROJECT_ID=my-proj bash scripts/deploy_to_gcp.sh
#   ALWAYS_ON=1 bash scripts/deploy_to_gcp.sh                  # min-instances=1
#   SKIP_FRONTEND=1 bash scripts/deploy_to_gcp.sh              # backend only
#   SKIP_BACKEND=1  bash scripts/deploy_to_gcp.sh              # frontend only
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

cd "$(dirname "$0")/.."

# ── Banner ────────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────────────────"
echo " ProcAssesment → GCP (Firebase Hosting + Cloud Run)"
echo "──────────────────────────────────────────────────────────────"

# ── Sanity checks ─────────────────────────────────────────────────────────
for tool in gcloud node npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "✗ '$tool' not found. Open https://shell.cloud.google.com — every"
    echo "  required tool is preinstalled there."
    exit 1
  fi
done

if ! command -v firebase >/dev/null 2>&1; then
  echo "→ Installing firebase-tools (one-time, ~30s)…"
  npm install -g firebase-tools >/dev/null 2>&1
fi

# ── Active gcloud account ─────────────────────────────────────────────────
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  echo "→ Signing in to Google Cloud…"
  gcloud auth login
  ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)
fi
echo "✓ gcloud account: ${ACTIVE_ACCOUNT}"

# ── Project ───────────────────────────────────────────────────────────────
if [[ -z "${PROJECT_ID:-}" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
    echo ""
    echo "→ Available projects:"
    gcloud projects list --format='table(projectId,name)' --limit=20 || true
    echo ""
    read -r -p "Enter project ID to use: " PROJECT_ID
  fi
fi
gcloud config set project "${PROJECT_ID}" >/dev/null
echo "✓ Project: ${PROJECT_ID}"

# Align ADC quota project with the active project — silences the
# "quota project mismatch" warning that gcloud prints otherwise.
gcloud auth application-default set-quota-project "${PROJECT_ID}" >/dev/null 2>&1 || true

REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-procassesment}"
REPO_NAME="${REPO_NAME:-app}"
ALWAYS_ON="${ALWAYS_ON:-0}"
SKIP_FRONTEND="${SKIP_FRONTEND:-0}"
SKIP_BACKEND="${SKIP_BACKEND:-0}"

echo "✓ Region:  ${REGION}"
echo "✓ Service: ${SERVICE}"

# ── Billing check ────────────────────────────────────────────────────────
BILLING_ENABLED="$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null || echo 'false')"
if [[ "${BILLING_ENABLED}" != "True" ]]; then
  echo ""
  echo "✗ Billing is not enabled on this project."
  echo "  Open https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
  echo "  and link the billing account that has your \$300 free credit, then re-run."
  exit 1
fi
echo "✓ Billing linked"

# ── Enable APIs (one-time) ───────────────────────────────────────────────
echo ""
echo "→ Enabling required APIs…"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  iamcredentials.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  --project="${PROJECT_ID}" >/dev/null
echo "✓ APIs enabled"

# ── Backend: Cloud Run ───────────────────────────────────────────────────
if [[ "${SKIP_BACKEND}" != "1" ]]; then
  echo ""
  echo "──────────────────────────────────────────────────────────────"
  echo " Backend → Cloud Run"
  echo "──────────────────────────────────────────────────────────────"

  # Artifact Registry repo
  if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "→ Creating Artifact Registry repo: ${REPO_NAME}"
    gcloud artifacts repositories create "${REPO_NAME}" \
      --repository-format=docker \
      --location="${REGION}" \
      --project="${PROJECT_ID}" \
      --description="ProcAssesment container images" >/dev/null
  fi

  # Runtime service account with Vertex AI access
  RUNTIME_SA="${SERVICE}-run@${PROJECT_ID}.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "${RUNTIME_SA}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "→ Creating runtime service account: ${RUNTIME_SA}"
    gcloud iam service-accounts create "${SERVICE}-run" \
      --display-name="ProcAssesment Cloud Run runtime" \
      --project="${PROJECT_ID}" >/dev/null

    # SA creation is eventually consistent — IAM bindings issued immediately
    # after will fail with "Service account does not exist". Poll until it's
    # visible, up to 60 seconds.
    echo "→ Waiting for service account to propagate…"
    for i in $(seq 1 30); do
      if gcloud iam service-accounts describe "${RUNTIME_SA}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
        sleep 2  # Extra cushion: describe can succeed slightly before bindings work
        break
      fi
      sleep 2
    done
  fi

  # Bind roles/aiplatform.user — retry on the race condition where the SA
  # exists per `describe` but isn't yet referenceable by IAM policy.
  echo "→ Granting roles/aiplatform.user to runtime SA…"
  for attempt in 1 2 3 4 5; do
    if gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${RUNTIME_SA}" \
        --role="roles/aiplatform.user" \
        --condition=None \
        --quiet >/dev/null 2>&1; then
      break
    fi
    if [[ $attempt -eq 5 ]]; then
      echo "✗ Failed to bind roles/aiplatform.user after 5 attempts."
      echo "  Re-run the script — the service account should now be fully visible."
      exit 1
    fi
    echo "  attempt ${attempt}/5 failed, retrying in 5s…"
    sleep 5
  done
  echo "✓ Runtime SA: ${RUNTIME_SA}"

  # Build with Cloud Build (uses the Dockerfile at repo root)
  SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
  IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE}:${SHORT_SHA}"
  echo ""
  echo "→ Building backend image with Cloud Build (~3-5 min first run)…"
  gcloud builds submit \
    --tag "${IMAGE}" \
    --project "${PROJECT_ID}" >/dev/null
  echo "✓ Image built: ${IMAGE}"

  # Deploy
  MIN_INSTANCES="0"
  [[ "${ALWAYS_ON}" == "1" ]] && MIN_INSTANCES="1"

  echo "→ Deploying Cloud Run service…"
  gcloud run deploy "${SERVICE}" \
    --image "${IMAGE}" \
    --region "${REGION}" \
    --platform managed \
    --service-account "${RUNTIME_SA}" \
    --min-instances "${MIN_INSTANCES}" \
    --max-instances 1 \
    --concurrency 40 \
    --cpu 1 \
    --memory 1Gi \
    --timeout 600 \
    --port 8080 \
    --set-env-vars "GEMINI_VERTEX_PROJECT=${PROJECT_ID},GEMINI_VERTEX_LOCATION=${REGION},GEMINI_MODEL=gemini-2.5-pro,FIREBASE_PROJECT_ID=${PROJECT_ID}" \
    --allow-unauthenticated \
    --project "${PROJECT_ID}" \
    --quiet

  CLOUD_RUN_URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')"
  echo "✓ Cloud Run URL: ${CLOUD_RUN_URL}"
fi

# ── Frontend: Firebase Hosting ──────────────────────────────────────────
if [[ "${SKIP_FRONTEND}" != "1" ]]; then
  echo ""
  echo "──────────────────────────────────────────────────────────────"
  echo " Frontend → Firebase Hosting"
  echo "──────────────────────────────────────────────────────────────"

  # Make sure the GCP project has Firebase added (idempotent)
  if ! firebase projects:list --json 2>/dev/null | grep -q "\"projectId\": \"${PROJECT_ID}\""; then
    echo "→ Linking Firebase to the GCP project (one-time)…"
    firebase projects:addfirebase "${PROJECT_ID}" 2>/dev/null || {
      echo "  (project already has Firebase, or you need to enable it via Console)"
    }
  fi

  # Update .firebaserc with the actual project id
  cat > .firebaserc <<EOF
{
  "projects": {
    "default": "${PROJECT_ID}"
  }
}
EOF

  # Build the frontend
  echo "→ Building frontend (vite)…"
  ( cd frontend && npm install --no-audit --no-fund >/dev/null 2>&1 && npm run build >/dev/null )
  echo "✓ Frontend built → frontend/dist"

  # Firebase login check (Cloud Shell already authenticated)
  if ! firebase login:list 2>/dev/null | grep -q "@"; then
    echo "→ Signing in to Firebase…"
    firebase login --no-localhost
  fi

  # Deploy
  echo "→ Deploying to Firebase Hosting…"
  firebase deploy --only hosting --project "${PROJECT_ID}" --non-interactive

  HOSTING_URL="https://${PROJECT_ID}.web.app"
  echo "✓ Hosting URL: ${HOSTING_URL}"
fi

# ── Done ──────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────────────────"
echo " Deployed!"
echo "──────────────────────────────────────────────────────────────"
[[ -n "${HOSTING_URL:-}"   ]] && echo " Public app:    ${HOSTING_URL}"
[[ -n "${CLOUD_RUN_URL:-}" ]] && echo " API (direct):  ${CLOUD_RUN_URL}"
[[ -n "${CLOUD_RUN_URL:-}" ]] && echo " Health probe:  ${CLOUD_RUN_URL}/health"
echo ""
echo " Architecture: Firebase Hosting (CDN) → /api/** → Cloud Run (serverless)"
echo " Region:       ${REGION}    (matches Vertex AI free quota)"
echo " Min/Max:      ${MIN_INSTANCES:-0} / 1   (max=1 keeps in-memory sessions sticky)"
echo ""
echo " Cost watch:  Both services scale to zero. \$300 credit lasts well over"
echo "              a year at demo cadence."
echo ""
echo " Logs:        gcloud run services logs tail ${SERVICE} --region ${REGION}"
echo " Redeploy:    bash scripts/deploy_to_gcp.sh"
echo "──────────────────────────────────────────────────────────────"
