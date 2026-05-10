from __future__ import annotations

from html import escape


# ── Org templates by model. Each tuple is (label, share_of_FTE). The shares
# add up to 1.0; FTE counts are rounded for display. ───────────────────────────
_MODELS = {
    "Centralised": [
        ("CPO / Head of procurement",         0.02),
        ("Strategic sourcing & category mgrs", 0.18),
        ("Operational buyers",                 0.40),
        ("Supplier management",                0.12),
        ("Contracts & compliance",             0.10),
        ("P2P / shared services",              0.13),
        ("Analytics & enablement",             0.05),
    ],
    "Hybrid": [
        ("CPO / Head of procurement",         0.02),
        ("Centre-led category teams",          0.16),
        ("Plant / business-unit buyers",       0.46),
        ("Supplier management",                0.10),
        ("Contracts & compliance",             0.08),
        ("P2P / shared services",              0.13),
        ("Analytics & enablement",             0.05),
    ],
    "Decentralised": [
        ("Plant / BU procurement leads",      0.10),
        ("Plant / BU buyers",                  0.55),
        ("Local supplier management",          0.13),
        ("Local contracts & compliance",       0.10),
        ("Local P2P",                          0.10),
        ("Corporate centre-of-excellence",     0.02),
    ],
}


_CSS = """
.aiv-org { font-family: Inter, system-ui, sans-serif; color: #0F141C; max-width: 880px; }
.aiv-org-head { display:flex; align-items:baseline; gap:12px; margin: 0 0 16px; }
.aiv-org-head h3 { margin:0; font-size:18px; font-weight:600; letter-spacing:-0.01em; }
.aiv-org-head .meta { font-size:12px; color:#64708A; }
.aiv-org-grid { display:grid; grid-template-columns: 1fr; gap:8px; }
.aiv-org-row { display:grid; grid-template-columns: 1fr 96px 56px; gap:12px; align-items:center;
  padding:10px 12px; border:1px solid #D8DDE7; border-radius:8px; background:#FFFFFF; }
.aiv-org-label { font-size:13px; font-weight:500; color:#0F141C; }
.aiv-org-bar { height:6px; background:#E7EAF1; border-radius:999px; overflow:hidden; }
.aiv-org-bar > span { display:block; height:100%; background:#2251FF; border-radius:999px; }
.aiv-org-fte { text-align:right; font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size:13px; font-variant-numeric: tabular-nums; color:#0F141C; }
""".strip()


def build_organogram_html(model: str, fte: int) -> str:
    """Render a simple HTML org diagram for the given model + FTE count."""
    model = (model or "").strip().title() or "Centralised"
    rows = _MODELS.get(model) or _MODELS["Centralised"]
    try:
        fte_int = max(0, int(round(float(fte))))
    except (TypeError, ValueError):
        fte_int = 0

    items_html = []
    max_share = max(s for _, s in rows) or 1.0
    for label, share in rows:
        count = max(1, round(share * fte_int)) if fte_int > 0 else 0
        bar_pct = round(share / max_share * 100)
        items_html.append(
            f'<div class="aiv-org-row">'
            f'<div class="aiv-org-label">{escape(label)}</div>'
            f'<div class="aiv-org-bar"><span style="width:{bar_pct}%"></span></div>'
            f'<div class="aiv-org-fte">{count}</div>'
            f"</div>"
        )

    body = "".join(items_html)
    return (
        f"<style>{_CSS}</style>"
        f'<div class="aiv-org">'
        f'<div class="aiv-org-head">'
        f'<h3>{escape(model)} model</h3>'
        f'<span class="meta">{fte_int} FTE total</span>'
        f"</div>"
        f'<div class="aiv-org-grid">{body}</div>'
        f"</div>"
    )
