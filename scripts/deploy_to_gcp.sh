#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# deploy_to_gcp.sh — one-shot deploy of the entire ProcAssesment app to a
# free-tier-friendly Cloud Run service.
#
# Run from Google Cloud Shell (https://shell.cloud.google.com) — gcloud is
# already authenticated. Or from any machine with `gcloud` and an active
# login.
#
# Usage:
#   bash scripts/deploy_to_gcp.sh
#   PROJECT_ID=my-proj REGION=us-central1 bash scripts/deploy_to_gcp.sh
#   ALWAYS_ON=1 bash scripts/deploy_to_gcp.sh         # min-instances=1 (~$5/mo)
#   ALLOW_PUBLIC=0 bash scripts/deploy_to_gcp.sh      # require IAM auth instead
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Banner ────────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────────────────"
echo " ProcAssesment → Google Cloud Run"
echo "──────────────────────────────────────────────────────────────"

# ── Sanity check: gcloud ──────────────────────────────────────────────────
if ! command -v gcloud >/dev/null 2>&1; then
  echo "✗ gcloud CLI not found. Open https://shell.cloud.google.com and run from there,"
  echo "  or install gcloud locally: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# ── Active account ────────────────────────────────────────────────────────
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  echo "→ No active Google account. Signing in…"
  gcloud auth login
  ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)
fi
echo "✓ Account: ${ACTIVE_ACCOUNT}"

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

REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-procassesment}"
REPO_NAME="${REPO_NAME:-app}"
ALWAYS_ON="${ALWAYS_ON:-0}"
ALLOW_PUBLIC="${ALLOW_PUBLIC:-1}"

echo "✓ Region:  ${REGION}"
echo "✓ Service: ${SERVICE}"

# ── 1. Ensure billing is enabled (Cloud Run + Build need it; the $300 trial counts) ──
BILLING_ENABLED="$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null || echo 'false')"
if [[ "${BILLING_ENABLED}" != "True" ]]; then
  echo ""
  echo "✗ Billing is not enabled on this project."
  echo "  Open https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
  echo "  and link the billing account that has your \$300 free credit, then re-run."
  exit 1
fi
echo "✓ Billing linked"

# ── 2. Enable required APIs ──────────────────────────────────────────────
echo ""
echo "→ Enabling APIs (one-time, ~30s)…"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  iamcredentials.googleapis.com \
  --project="${PROJECT_ID}" >/dev/null
echo "✓ APIs enabled"

# ── 3. Artifact Registry repo ────────────────────────────────────────────
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "→ Creating Artifact Registry repo: ${REPO_NAME}"
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="ProcAssesment container images" >/dev/null
fi
echo "✓ Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

# ── 4. Runtime service account with Vertex AI permissions ────────────────
RUNTIME_SA="${SERVICE}-run@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "${RUNTIME_SA}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "→ Creating runtime service account: ${RUNTIME_SA}"
  gcloud iam service-accounts create "${SERVICE}-run" \
    --display-name="ProcAssesment Cloud Run runtime" \
    --project="${PROJECT_ID}" >/dev/null
fi

# Grant Vertex AI access to the runtime SA
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/aiplatform.user" \
  --condition=None \
  --quiet >/dev/null
echo "✓ Runtime SA: ${RUNTIME_SA} (roles/aiplatform.user)"

# ── 5. Build the image with Cloud Build ──────────────────────────────────
SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE}:${SHORT_SHA}"

echo ""
echo "→ Building image with Cloud Build (~3-5 min on first run)…"
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions="_REGION=${REGION},_SERVICE=${SERVICE},SHORT_SHA=${SHORT_SHA}" \
  --project="${PROJECT_ID}"

echo "✓ Image built: ${IMAGE}"

# ── 6. Deploy to Cloud Run ───────────────────────────────────────────────
echo ""
echo "→ Deploying Cloud Run service…"

MIN_INSTANCES="0"
[[ "${ALWAYS_ON}" == "1" ]] && MIN_INSTANCES="1"

ACCESS_FLAG="--allow-unauthenticated"
[[ "${ALLOW_PUBLIC}" == "0" ]] && ACCESS_FLAG="--no-allow-unauthenticated"

# shellcheck disable=SC2086
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
  --set-env-vars "GEMINI_VERTEX_PROJECT=${PROJECT_ID},GEMINI_VERTEX_LOCATION=${REGION},GEMINI_MODEL=gemini-2.5-pro" \
  ${ACCESS_FLAG} \
  --project "${PROJECT_ID}" \
  --quiet

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')"

# ── 7. Done ──────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────────────────"
echo " Deployed!"
echo "──────────────────────────────────────────────────────────────"
echo " URL:        ${URL}"
echo " Health:     ${URL}/health"
echo " Region:     ${REGION}"
echo " Min/Max:    ${MIN_INSTANCES} / 1   (max=1 keeps in-memory sessions sticky)"
echo " Public?:    $([[ "${ALLOW_PUBLIC}" == "1" ]] && echo yes || echo "no — IAM-protected")"
echo ""
echo " Cost watch: scales to zero when idle. Vertex AI calls are billed per"
echo "             1k tokens. Both fit comfortably inside the \$300 free credit"
echo "             for demo / single-engagement workloads."
echo ""
echo " View logs:  gcloud run services logs tail ${SERVICE} --region ${REGION}"
echo " Redeploy:   bash scripts/deploy_to_gcp.sh"
echo "──────────────────────────────────────────────────────────────"
