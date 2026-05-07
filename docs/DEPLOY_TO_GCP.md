# Deploy ProcAssesment to Google Cloud (free $300 credit)

The app is split across two **fully managed serverless** GCP services. No
VMs anywhere. No SSH, no OS patching, no auto-scaling groups.

| Layer         | Service                | What it does                                     |
|---------------|------------------------|--------------------------------------------------|
| **Frontend**  | **Firebase Hosting**   | Serves the React build from a global CDN.        |
| **Backend**   | **Cloud Run**          | Runs FastAPI + Vertex AI calls. Scales to zero.  |

Firebase Hosting rewrites `/api/**` straight to the Cloud Run service,
so the browser only ever talks to one URL: `https://<project>.web.app`.

---

## TL;DR — one command from Cloud Shell

1. Open [shell.cloud.google.com](https://shell.cloud.google.com).
2. Clone and deploy:

   ```bash
   git clone https://github.com/guptalavesh/ProcAssesment.git
   cd ProcAssesment
   git checkout claude/build-app-from-specs-3FyO9
   bash scripts/deploy_to_gcp.sh
   ```

3. The script does everything end-to-end:
   - Confirms billing
   - Enables APIs (Run, Build, Artifact Registry, Vertex AI, Firebase, Hosting)
   - Creates a runtime service account with `roles/aiplatform.user`
   - Builds the backend image with Cloud Build
   - Deploys to Cloud Run (`us-central1`, min=0, max=1)
   - Builds the frontend with Vite
   - Deploys it to Firebase Hosting with `/api/**` rewrites pointing at Cloud Run

4. Output ends with two URLs:
   - `https://<project>.web.app` — your app
   - `https://procassesment-xxxxx-uc.a.run.app` — the API (mostly internal)

---

## Architecture

```
                        Browser
                           │
                           │  HTTPS (TLS terminated by Google)
                           ▼
   ┌───────────────────────────────────────────────────────────┐
   │   Firebase Hosting   (global CDN, edge-cached)            │
   │   ───────────────────────────────────────────────────     │
   │   Static assets:   /, /assets/*, /index.html              │
   │   Rewrite rule:    /api/**, /health   ──┐                 │
   └─────────────────────────────────────────┼─────────────────┘
                                             │
                                             ▼
   ┌───────────────────────────────────────────────────────────┐
   │   Cloud Run service: procassesment  (us-central1)         │
   │   ───────────────────────────────────────────────────     │
   │   Single Python container (uvicorn + FastAPI)             │
   │   In-memory session dict, 4-hour TTL                      │
   │   Calls Vertex AI Gemini via runtime service account      │
   │   ───────────────────────────────────────────────────     │
   │   Min instances: 0   Max instances: 1   Concurrency: 40   │
   └─────────────────────────────────────────┬─────────────────┘
                                             │
                                             ▼
                              Vertex AI Gemini 2.5 (us-central1)
```

### Why max-instances = 1?

The backend keeps assessment sessions in a Python dict. With more than one
Cloud Run replica, a user's second request might land on a different
replica and not find their session. **Max=1 keeps every request on a
single process.** Fine for demos and single engagements (40 concurrent
requests, 4-hour TTL).

If you need to scale further, swap `backend/session_store.py` for a
Firestore-backed store. That's an isolated change to one file.

### Cost expectations (well inside $300)

| What                                         | Free tier              | Typical demo cost |
|----------------------------------------------|------------------------|-------------------|
| Firebase Hosting (storage + transfer)        | 10 GB / 360 MB-day     | $0                |
| Cloud Run requests / CPU / memory            | 2M req / 360k vCPU-s   | $0–5 / month      |
| Vertex AI Gemini 2.5 Pro                     | per 1M tokens          | ~$0.02 / assessment |
| **Total at light demo cadence**              |                        | **<$5 / month**   |

Cold start: ~3 seconds with `min-instances=0`. Run
`ALWAYS_ON=1 bash scripts/deploy_to_gcp.sh` to keep one warm replica
(~$5/month) if cold starts bother you.

---

## Useful overrides

```bash
PROJECT_ID=my-other-proj bash scripts/deploy_to_gcp.sh
ALWAYS_ON=1              bash scripts/deploy_to_gcp.sh   # keep warm, no cold starts
SKIP_FRONTEND=1          bash scripts/deploy_to_gcp.sh   # backend deploy only
SKIP_BACKEND=1           bash scripts/deploy_to_gcp.sh   # frontend deploy only
REGION=europe-west1      bash scripts/deploy_to_gcp.sh   # (loses Vertex free quota)
```

---

## Updating the deployed app

```bash
git pull
bash scripts/deploy_to_gcp.sh
```

Both services roll a new revision. Firebase Hosting versions every deploy
and lets you roll back from the Console with one click.

For automatic deploys on push to `main`, see
[SETUP_FROM_GITHUB.md → Option C](SETUP_FROM_GITHUB.md) (Workload Identity
Federation, no service-account keys).

---

## What gets created in your GCP project

| Resource                                                 | Purpose                          |
|----------------------------------------------------------|----------------------------------|
| Artifact Registry repo `app` (`us-central1`)             | Holds backend container images   |
| Service account `procassesment-run@…`                    | Runtime identity for Cloud Run   |
| IAM binding: `procassesment-run@…` → `aiplatform.user`   | Lets the backend call Vertex AI  |
| Cloud Run service `procassesment` (`us-central1`)        | The backend itself               |
| Firebase Hosting site `<project>.web.app`                | The frontend itself              |

All idempotent. Re-running the script just rolls a new revision.

---

## Tearing it down

```bash
PROJECT_ID="$(gcloud config get-value project)"

gcloud run services delete procassesment --region=us-central1 --quiet
firebase hosting:disable --project "${PROJECT_ID}"
gcloud artifacts repositories delete app --location=us-central1 --quiet
gcloud iam service-accounts delete "procassesment-run@${PROJECT_ID}.iam.gserviceaccount.com" --quiet
```

Or delete the entire project from
[console.cloud.google.com](https://console.cloud.google.com/iam-admin/settings).
That stops every billable resource at once.

---

## Troubleshooting

**Firebase deploy says "permission denied"** — the GCP project needs Firebase
added once. The deploy script tries to do this automatically; if it fails,
run `firebase projects:addfirebase $(gcloud config get-value project)` or
add it via the Firebase Console once.

**`/api/**` returns 404 after deploy** — Firebase Hosting rewrites need the
Cloud Run service to exist with the exact name `procassesment` in
`us-central1`. If you renamed the service, update `firebase.json` to match.

**Vertex AI returns "permission denied"** — confirm the runtime SA has
`roles/aiplatform.user`:

```bash
gcloud projects get-iam-policy "$(gcloud config get-value project)" \
  --flatten="bindings[].members" \
  --filter="bindings.members:procassesment-run@*" \
  --format="value(bindings.role)"
```

**Cold starts are too slow** — `ALWAYS_ON=1 bash scripts/deploy_to_gcp.sh`
keeps min-instances=1 (~$5/month, no cold starts).

**SSE / `/run-status` connections drop after 60s** — Cloud Run's default
request timeout is 600s as configured here. If the assessment exceeds that,
bump it: `gcloud run services update procassesment --region=us-central1 --timeout=3600`.
