"""
Tests for PLEXUS VerificationEngine — all four layers.

Uses a self-contained PVP fixture factory that builds real cryptographic
material (Ed25519 signatures, SHA-256 hash chains) without touching any DB.

Run from the project root:
    pytest apps/analytics/tests/test_verification_engine.py -v
"""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

import nacl.signing
import pytest

from apps.analytics.services.verification_engine import VerificationEngine


# ═════════════════════════════════════════════════════════════════════════════
# PVP Fixture Factory
# ═════════════════════════════════════════════════════════════════════════════

def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _root_hash(ledger_json: str, artifact_hashes: dict) -> str:
    sorted_hashes = "".join(artifact_hashes[p] for p in sorted(artifact_hashes))
    return _hash(ledger_json + sorted_hashes)


def build_test_pvp(
    events_config: list[dict],
    add_supervisor: bool = False,
    add_institution: bool = False,
    tamper_artifact: bool = False,
    tamper_chain_at: int | None = None,
    extra_artifacts: dict[str, bytes] | None = None,
) -> tuple[bytes, nacl.signing.SigningKey, str, dict, str]:
    """
    Build a .pvp ZIP with real cryptographic material.

    Args:
        events_config:   List of dicts with 'event_type' and 'payload'.
        add_supervisor:  Include supervisor signature in manifest.
        add_institution: Include institution signature in manifest.
        tamper_artifact: Corrupt ledger.json after building (tests integrity).
        tamper_chain_at: If set, corrupt event_hash at this 0-based index
                         but keep root_hash consistent (tests chain check).
        extra_artifacts: Additional {path: bytes} to include in artifacts/.

    Returns:
        (zip_bytes, signing_key, session_key_id, manifest, project_id)
    """
    signing_key    = nacl.signing.SigningKey.generate()
    session_key_id = str(uuid4())
    project_id     = str(uuid4())
    pub_key_hex    = signing_key.verify_key.encode().hex()

    # ── Build event chain ─────────────────────────────────────────────────
    events: list[dict] = []
    prev_hash = "0" * 64

    for i, cfg in enumerate(events_config, start=1):
        payload    = cfg.get("payload", {})
        event_type = cfg["event_type"]
        ts         = datetime.now(timezone.utc).isoformat()

        payload_canonical = json.dumps(payload, sort_keys=True, default=str)
        raw        = payload_canonical + prev_hash + ts
        event_hash = _hash(raw)
        signature  = signing_key.sign(event_hash.encode("utf-8")).signature.hex()

        row = {
            "id":              str(uuid4()),
            "project_id":      project_id,
            "sequence_number": i,
            "event_type":      event_type,
            "payload":         payload,
            "previous_hash":   prev_hash,
            "event_hash":      event_hash,
            "signature":       signature,
            "session_key_id":  session_key_id,
            "actor_id":        str(uuid4()),
            "actor_role":      "author",
            "timestamp":       ts,
        }
        events.append(row)
        prev_hash = event_hash

    # ── Tamper chain (but keep root_hash consistent) ───────────────────────
    if tamper_chain_at is not None and tamper_chain_at < len(events):
        events[tamper_chain_at]["event_hash"] = "aa" * 32  # corrupted

    # ── Serialise ledger ──────────────────────────────────────────────────
    ledger_json   = json.dumps(events, sort_keys=True, default=str)
    ledger_bytes  = ledger_json.encode("utf-8")

    # ── Artifact hashes ───────────────────────────────────────────────────
    artifact_hashes: dict[str, str] = {
        "ledger.json": _hash(ledger_json)
    }
    artifacts: dict[str, bytes] = {}
    for path, content in (extra_artifacts or {}).items():
        artifact_hashes[path] = _hash(content.decode("utf-8") if isinstance(content, bytes) else content)
        artifacts[path] = content if isinstance(content, bytes) else content.encode()

    root = _root_hash(ledger_json, artifact_hashes)

    # ── Tamper artifact AFTER root_hash computed (so root_hash doesn't match) ─
    # This is done by NOT updating root_hash — integrity layer will catch it.
    tampered_ledger_bytes = ledger_bytes
    if tamper_artifact:
        tampered_ledger_bytes = ledger_bytes + b"\n/* tampered */"

    # ── Author signature over root_hash ──────────────────────────────────
    author_sig = signing_key.sign(root.encode("utf-8")).signature.hex()

    # Find the last run for final_run_event_id
    runs = [e for e in events if e["event_type"] == "analysis_run_completed"]
    final_run_id = str(runs[-1]["id"]) if runs else str(uuid4())
    seal_events  = [e for e in events if e["event_type"] == "project_sealed"]

    # ── Build manifest ────────────────────────────────────────────────────
    manifest: dict = {
        "pvp_format_version":   "1.0",
        "ptls_version":         "0.1",
        "plexus_version":       "1.0.0",
        "project_id":           project_id,
        "project_sealed_at":    seal_events[-1]["timestamp"] if seal_events else None,
        "built_at":             datetime.now(timezone.utc).isoformat(),
        "total_events":         len(events),
        "final_run_event_id":   final_run_id,
        "root_hash":            root,
        "artifact_hashes":      artifact_hashes,
        "signatures": {
            "author": {
                "session_key_id": session_key_id,
                "public_key":     pub_key_hex,
                "signature":      author_sig,
                "signed_at":      datetime.now(timezone.utc).isoformat(),
            },
            "supervisor": None,
            "institution": None,
        },
        "institutional_boundary": "institutional",
        "deployment_mode":       "cloud",
        "aad_version":           "0.1",
        "revocation_check_url":  "https://verify.plexus.science/revocation",
    }

    if add_supervisor:
        sup_key  = nacl.signing.SigningKey.generate()
        sup_sig  = sup_key.sign(root.encode("utf-8")).signature.hex()
        manifest["signatures"]["supervisor"] = {
            "session_key_id": str(uuid4()),
            "public_key":     sup_key.verify_key.encode().hex(),
            "signature":      sup_sig,
            "signed_at":      datetime.now(timezone.utc).isoformat(),
        }

    if add_institution:
        inst_key = nacl.signing.SigningKey.generate()
        inst_sig = inst_key.sign(root.encode("utf-8")).signature.hex()
        manifest["signatures"]["institution"] = {
            "session_key_id": str(uuid4()),
            "public_key":     inst_key.verify_key.encode().hex(),
            "signature":      inst_sig,
            "signed_at":      datetime.now(timezone.utc).isoformat(),
        }

    # ── Assemble ZIP ──────────────────────────────────────────────────────
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json",   json.dumps(manifest,  indent=2, default=str))
        zf.writestr("ledger.json",     tampered_ledger_bytes)  # tampered if requested
        zf.writestr("signatures.json", json.dumps({}, indent=2))
        for path, content in artifacts.items():
            zf.writestr(f"artifacts/{path}", content)

    return buf.getvalue(), signing_key, session_key_id, manifest, project_id


# ── Minimal event sets ────────────────────────────────────────────────────────

def _level1_events() -> list[dict]:
    """Minimal events that satisfy all R1 rules."""
    return [
        {"event_type": "project_created",        "payload": {"title": "Test Study"}},
        {"event_type": "dataset_imported",        "payload": {"dataset_id": str(uuid4()), "row_count": 200}},
        {"event_type": "analysis_run_completed",  "payload": {
            "input_dataset_hash": "abc123",
            "parameters":         {"method": "linear_regression"},
            "environment":        {
                "python_version":  "3.11",
                "package_versions": {"numpy": "1.26", "pandas": "2.2"},
            },
            "dqi_score": 0.82,
        }},
        {"event_type": "output_generated",        "payload": {"output_id": str(uuid4())}},
        {"event_type": "project_sealed",          "payload": {}},
    ]


def _level2_events() -> list[dict]:
    """Events that satisfy all R1 and R2 rules (plus most R3)."""
    return [
        {"event_type": "project_created",         "payload": {"title": "Test Study"}},
        {"event_type": "dataset_imported",         "payload": {"dataset_id": str(uuid4()), "row_count": 200}},
        {"event_type": "assumption_check",         "payload": {"dqi_score": 0.85, "checks_passed": True}},
        {"event_type": "model_selected",           "payload": {"model_type": "linear", "outcome_variable": "outcome_y"}},
        {"event_type": "analysis_run_completed",   "payload": {
            "input_dataset_hash":  "abc123",
            "parameters":          {"method": "linear_regression", "alpha": 0.05},
            "environment":         {
                "python_version":   "3.11",
                "package_versions": {"numpy": "1.26"},
            },
            "dqi_score": 0.85,
            "p_value":   0.03,
        }},
        {"event_type": "output_generated",         "payload": {"output_id": str(uuid4())}},
        {"event_type": "project_sealed",           "payload": {}},
    ]


# ═════════════════════════════════════════════════════════════════════════════
# 1. test_valid_pvp_level_2
# ═════════════════════════════════════════════════════════════════════════════

def test_valid_pvp_level_2():
    """
    A properly built PVP with author + supervisor, assumption checks,
    and all Level-2 requirements satisfied — but no institution signature —
    must yield trust_level == 2.
    """
    pvp_bytes, *_ = build_test_pvp(
        _level2_events(),
        add_supervisor=True,
    )
    report = VerificationEngine().verify(pvp_bytes, online=False)

    assert report.integrity.passed is True
    assert report.chain.passed is True
    assert report.summary.trust_level == 2
    # R3.1 (institution sig) should be the only Level-3 blocker
    assert any("R3.1" in r for r in report.trust.downgrade_reasons)


# ═════════════════════════════════════════════════════════════════════════════
# 2. test_tampered_artifact_fails_integrity
# ═════════════════════════════════════════════════════════════════════════════

def test_tampered_artifact_fails_integrity():
    """
    Altering ledger.json inside the ZIP must be caught by Layer 1.
    Root hash mismatch → integrity.passed == False → trust_level == 0.
    """
    pvp_bytes, *_ = build_test_pvp(_level2_events(), tamper_artifact=True)

    report = VerificationEngine().verify(pvp_bytes, online=False)

    assert report.integrity.passed is False
    assert "tampered" in (report.integrity.reason or "").lower() or \
           "mismatch" in (report.integrity.reason or "").lower()
    assert report.summary.trust_level == 0
    assert report.summary.overall_status == "FAIL"


# ═════════════════════════════════════════════════════════════════════════════
# 3. test_broken_chain_fails_verification
# ═════════════════════════════════════════════════════════════════════════════

def test_broken_chain_fails_verification():
    """
    Corrupting event_hash of event at index 4 (seq 5) must be caught by
    Layer 2. Root hash is kept consistent so integrity still passes.
    """
    events = _level2_events()
    # Ensure there are at least 5 events — add one more if needed
    events_extended = events[:-1] + [
        {"event_type": "annotation_added", "payload": {"note": "extra"}},
        events[-1],  # project_sealed last
    ]
    # tamper_chain_at=4 → 5th event (0-indexed), root_hash updated to match
    pvp_bytes, signing_key, _, manifest, _ = build_test_pvp(
        events_extended,
        tamper_chain_at=4,
    )

    report = VerificationEngine().verify(pvp_bytes, online=False)

    assert report.integrity.passed is True   # root_hash consistent → passes
    assert report.chain.passed is False
    assert report.chain.first_broken_sequence == 5
    assert report.summary.trust_level == 0


# ═════════════════════════════════════════════════════════════════════════════
# 4. test_missing_assumption_checks_downgrades
# ═════════════════════════════════════════════════════════════════════════════

def test_missing_assumption_checks_downgrades():
    """
    A PVP with no assumption_check events fails R2.3 → trust_level == 1.
    """
    # Level-1 events have no assumption_check or model_selected
    pvp_bytes, *_ = build_test_pvp(_level1_events())

    report = VerificationEngine().verify(pvp_bytes, online=False)

    assert report.integrity.passed is True
    assert report.chain.passed is True
    assert report.summary.trust_level == 1
    assert any("R2.3" in r for r in report.trust.downgrade_reasons)


# ═════════════════════════════════════════════════════════════════════════════
# 5. test_aad_selective_reporting_detected
# ═════════════════════════════════════════════════════════════════════════════

def test_aad_selective_reporting_detected():
    """
    6 analysis runs with only 1 output → ratio 0.17 < 0.5 → AAD-01 HIGH.
    """
    events: list[dict] = [
        {"event_type": "project_created", "payload": {}},
        {"event_type": "dataset_imported", "payload": {"dataset_id": str(uuid4())}},
    ]
    for _ in range(6):
        events.append({"event_type": "analysis_run_completed", "payload": {
            "input_dataset_hash": "h1",
            "parameters": {"alpha": 0.05},
        }})
    # Only 1 output
    events.append({"event_type": "output_generated", "payload": {}})
    events.append({"event_type": "project_sealed",   "payload": {}})

    pvp_bytes, *_ = build_test_pvp(events)
    report = VerificationEngine().verify(pvp_bytes, online=False)

    assert report.aad.overall_risk == "HIGH"
    codes = [f.code for f in report.aad.flags]
    assert "AAD-01" in codes


# ═════════════════════════════════════════════════════════════════════════════
# 6. test_aad_variable_change_after_run_detected
# ═════════════════════════════════════════════════════════════════════════════

def test_aad_variable_change_after_run_detected():
    """
    A variable_encoded event after the first analysis_run → AAD-03 flag.
    """
    events: list[dict] = [
        {"event_type": "project_created",       "payload": {}},
        {"event_type": "dataset_imported",       "payload": {"dataset_id": str(uuid4())}},
        {"event_type": "analysis_run_completed", "payload": {
            "input_dataset_hash": "h1", "parameters": {"x": 1},
        }},
        # Variable modification AFTER the first run
        {"event_type": "variable_encoded",       "payload": {"variable": "age_group"}},
        {"event_type": "output_generated",       "payload": {}},
        {"event_type": "project_sealed",         "payload": {}},
    ]

    pvp_bytes, *_ = build_test_pvp(events)
    report = VerificationEngine().verify(pvp_bytes, online=False)

    codes = [f.code for f in report.aad.flags]
    assert "AAD-03" in codes


# ═════════════════════════════════════════════════════════════════════════════
# 7. test_aad_assumption_ordering_flagged
# ═════════════════════════════════════════════════════════════════════════════

def test_aad_assumption_ordering_flagged():
    """
    An assumption_check logged AFTER analysis_run_completed → AAD-04 flag.
    """
    events: list[dict] = [
        {"event_type": "project_created",       "payload": {}},
        {"event_type": "dataset_imported",       "payload": {"dataset_id": str(uuid4())}},
        {"event_type": "analysis_run_completed", "payload": {
            "input_dataset_hash": "h1", "parameters": {"x": 1},
        }},
        # Assumption check AFTER the run — reversed order
        {"event_type": "assumption_check",       "payload": {"dqi_score": 0.9}},
        {"event_type": "output_generated",       "payload": {}},
        {"event_type": "project_sealed",         "payload": {}},
    ]

    pvp_bytes, *_ = build_test_pvp(events)
    report = VerificationEngine().verify(pvp_bytes, online=False)

    codes = [f.code for f in report.aad.flags]
    assert "AAD-04" in codes


# ═════════════════════════════════════════════════════════════════════════════
# 8. test_offline_verification_works
# ═════════════════════════════════════════════════════════════════════════════

def test_offline_verification_works():
    """
    Calling verify(pvp_bytes, online=False) must complete without any HTTP
    calls and set revocation_status == 'unchecked'.
    """
    pvp_bytes, *_ = build_test_pvp(_level1_events())

    # If any HTTP call is made, httpx would raise ConnectionError in test env.
    # online=False must skip all network activity.
    report = VerificationEngine().verify(pvp_bytes, online=False)

    assert report.chain.revocation_status == "unchecked"
    assert report.integrity.passed is True


# ═════════════════════════════════════════════════════════════════════════════
# 9. test_journal_endpoint_no_auth_required
# ═════════════════════════════════════════════════════════════════════════════

def test_journal_endpoint_no_auth_required():
    """
    POST /api/verify/package must return 200 without an Authorization header.
    Uses FastAPI TestClient.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from apps.analytics.routers.verify import router

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    pvp_bytes, *_ = build_test_pvp(_level1_events())

    response = client.post(
        "/api/verify/package",
        files={"file": ("test.pvp", pvp_bytes, "application/zip")},
        data={"online": "false"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "trust" in body
    assert "summary" in body


# ═════════════════════════════════════════════════════════════════════════════
# 10. test_level_3_requires_institution_signature
# ═════════════════════════════════════════════════════════════════════════════

def test_level_3_requires_institution_signature():
    """
    A PVP with author + supervisor but no institution signature must fail
    R3.1 and therefore trust_level <= 2.
    """
    pvp_bytes, *_ = build_test_pvp(_level2_events(), add_supervisor=True)

    report = VerificationEngine().verify(pvp_bytes, online=False)

    assert report.summary.trust_level <= 2
    assert any("R3.1" in r for r in report.trust.downgrade_reasons)


# ═════════════════════════════════════════════════════════════════════════════
# 11. test_aad_outcome_switching_detected
# ═════════════════════════════════════════════════════════════════════════════

def test_aad_outcome_switching_detected():
    """
    Two model_selected events with different outcome_variable values → AAD-05.
    """
    events: list[dict] = [
        {"event_type": "project_created",       "payload": {}},
        {"event_type": "dataset_imported",       "payload": {"dataset_id": str(uuid4())}},
        {"event_type": "model_selected",         "payload": {"outcome_variable": "primary_outcome"}},
        {"event_type": "analysis_run_completed", "payload": {
            "input_dataset_hash": "h1", "parameters": {"x": 1},
        }},
        # Different outcome_variable in second model_selected
        {"event_type": "model_selected",         "payload": {"outcome_variable": "secondary_outcome"}},
        {"event_type": "analysis_run_completed", "payload": {
            "input_dataset_hash": "h1", "parameters": {"x": 1},
        }},
        {"event_type": "output_generated",       "payload": {}},
        {"event_type": "project_sealed",         "payload": {}},
    ]

    pvp_bytes, *_ = build_test_pvp(events)
    report = VerificationEngine().verify(pvp_bytes, online=False)

    codes = [f.code for f in report.aad.flags]
    assert "AAD-05" in codes


# ═════════════════════════════════════════════════════════════════════════════
# 12. test_human_readable_output_format
# ═════════════════════════════════════════════════════════════════════════════

def test_human_readable_output_format():
    """
    The human_readable string must contain:
    - 'PLEXUS TRUST LEVEL' with a level label
    - 'Adversarial Risk' line
    - An overall_status that matches summary.overall_status
    """
    pvp_bytes, *_ = build_test_pvp(_level2_events(), add_supervisor=True)
    report = VerificationEngine().verify(pvp_bytes, online=False)

    hr = report.summary.human_readable

    assert "PLEXUS TRUST LEVEL" in hr
    assert report.summary.trust_label in hr
    assert "Adversarial Risk" in hr

    # overall_status must match summary
    assert report.summary.overall_status in ("PASS", "REVIEW", "FAIL")
    if report.summary.trust_level == 0:
        assert report.summary.overall_status == "FAIL"
    elif report.aad.overall_risk == "HIGH":
        assert report.summary.overall_status == "REVIEW"
    else:
        assert report.summary.overall_status == "PASS"
