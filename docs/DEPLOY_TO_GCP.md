# Deploy ProcAssesment to Google Cloud (free $300 credit)

The whole app — FastAPI backend + React frontend — runs as a single
Cloud Run service in `us-central1` (where Vertex AI Gemini's free quota
sits). No databases, no extra services. One container, one URL.

---

## TL;DR — one command from Cloud Shell

1. Open [shell.cloud.google.com](https://shell.cloud.google.com) in a browser.
2. Clone the repo and run the deploy script:

   ```bash
   git clone https://github.com/guptalavesh/ProcAssesment.git
   cd ProcAssesment
   bash scripts/deploy_to_gcp.sh
   ```

3. The script enables APIs, creates an Artifact Registry repo, builds the
   image with Cloud Build (~3-5 min first run), creates a runtime service
   account with Vertex AI permissions, and deploys to Cloud Run.

4. Output ends with a public HTTPS URL like
   `https://procassesment-xxxxx-uc.a.run.app` — open that, the app loads.

---

## Architecture

```
Browser
   │  HTTPS
   ▼
┌──────────────────────────────────────────────────────────┐
│  Cloud Run service: procassesment (us-central1)          │
│  ──────────────────────────────────────────────────────  │
│  Single container (Python 3.11 slim)                     │
│   • FastAPI on port 8080                                 │
│   • Static React build served from /assets + SPA fallback│
│   • In-memory session dict (4-hour TTL)                  │
│  ──────────────────────────────────────────────────────  │
│  Min instances: 0   Max instances: 1   Concurrency: 40   │
│  CPU: 1 vCPU        Memory: 1 GiB                        │
└──────────────────────────────────────────────────────────┘
            │  ADC (no keys) — uses runtime service account
            ▼
   Vertex AI Gemini 2.5 (us-central1)
```

### Why max-instances = 1?

The app stores assessment sessions in a Python dict in memory. With more
than one Cloud Run instance, a user's second request might land on a
different replica and not find their session. **Max=1 keeps every request
on a single process.** This is fine for a demo / single engagement, where
concurrency rarely exceeds a handful of users at once.

If you need to scale further, the right next step is swapping
`backend/session_store.py` to use Firestore or Memorystore. That work is
isolated (one file) but out of scope for the free-tier deployment.

### Cost estimate (inside the $300 free credit)

- **Idle:** $0/mo. Min-instances=0 means Cloud Run is fully scaled down
  when nobody is hitting the URL. You only pay while a request is
  in-flight.
- **Light usage** (50 assessment runs/month, ~1 hour active CPU): under
  $5/mo. Well inside the credit.
- **Vertex AI:** Gemini 2.5 Pro is ~$1.25 per 1M input tokens, $10 per
  1M output. A single assessment uses ~5k input + 1k output tokens =
  $0.02. Negligible at demo volumes.

To see live spend: `gcloud billing accounts list` then check the linked
account in the Console.

---

## What `deploy_to_gcp.sh` actually does

| Step | Action |
|------|--------|
| 1    | Verifies `gcloud` is installed and you're signed in |
| 2    | Confirms billing is enabled (the $300 trial counts here) |
| 3    | Enables Cloud Run, Cloud Build, Artifact Registry, Vertex AI APIs |
| 4    | Creates Artifact Registry repo `app` in `us-central1` |
| 5    | Creates a dedicated runtime service account with `roles/aiplatform.user` |
| 6    | Submits the build via `gcloud builds submit --config=cloudbuild.yaml` |
| 7    | Deploys with `gcloud run deploy` (max=1, min=0, public access) |
| 8    | Prints the live URL |

All of these are idempotent — re-running just rebuilds the image and
deploys a new revision.

### Useful environment overrides

```bash
PROJECT_ID=my-proj bash scripts/deploy_to_gcp.sh        # set project explicitly
ALWAYS_ON=1       bash scripts/deploy_to_gcp.sh        # min-instances=1 (~$5/mo)
ALLOW_PUBLIC=0    bash scripts/deploy_to_gcp.sh        # require IAM auth instead
REGION=europe-west1 bash scripts/deploy_to_gcp.sh      # different region (loses Vertex free quota)
```

---

## Updating the deployed app

Just re-run the script — Cloud Build picks up the latest commit, and
Cloud Run rolls a new revision.

```bash
git pull
bash scripts/deploy_to_gcp.sh
```

Or set up the GitHub Actions workflow (`.github/workflows/deploy-cloudrun.yml`)
so every push to `main` deploys automatically. See
[SETUP_FROM_GITHUB.md](SETUP_FROM_GITHUB.md) Option C for the
Workload Identity Federation setup.

---

## Tearing it down

When you're done with the credit window, remove everything:

```bash
PROJECT_ID="$(gcloud config get-value project)"

gcloud run services delete procassesment --region=us-central1 --quiet
gcloud artifacts repositories delete app --location=us-central1 --quiet
gcloud iam service-accounts delete "procassesment-run@${PROJECT_ID}.iam.gserviceaccount.com" --quiet
```

Or, simplest of all: delete the entire project from
[console.cloud.google.com](https://console.cloud.google.com/iam-admin/settings).
That stops every billable resource at once.

---

## Troubleshooting

**Build fails at `cloudbuild.yaml`** — check that the Cloud Build service
account (`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`) has
`roles/artifactregistry.writer`. The deploy script doesn't grant this
explicitly because it's already on the default Cloud Build SA, but in
old projects it sometimes isn't:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$(gcloud config get-value project)" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

**`/api/v1/...` returns 404 in browser but works locally** — the SPA
fallback in `backend/main.py` only catches GETs that aren't `/api/*`.
Make sure your frontend calls use the `/api/v1/` prefix (they do, via
`frontend/src/lib/api.ts`).

**Vertex AI "permission denied"** — confirm the runtime service account
has `roles/aiplatform.user`:

```bash
gcloud projects get-iam-policy "$(gcloud config get-value project)" \
  --flatten="bindings[].members" \
  --filter="bindings.members:procassesment-run@*" \
  --format="value(bindings.role)"
```

**The `/health` endpoint times out on first request** — that's the cold
start (~3s with min-instances=0). Run `ALWAYS_ON=1 bash scripts/deploy_to_gcp.sh`
to keep one warm replica (~$5/mo).
