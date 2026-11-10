from datetime import datetime, timedelta, timezone
from models import Election, Vote, VoterParticipation


def test_admin_cannot_vote(client, seed_test_data):
    """
    Requirements:
    Administrative accounts must never be allowed to cast ballots.
    Only authenticated students with valid roster claims may vote.
    """
    data = seed_test_data
    election_id = data["open_election"].id
    position_id = data["position1"].id
    candidate_id = data["cand_approved"].id

    res = client.post(
        f"/elections/{election_id}/positions/{position_id}/vote",
        headers={"Authorization": f"Bearer {data['admin_token']}"},
        json={"candidate_id": candidate_id},
    )

    assert res.status_code == 403
    assert "Only student accounts can vote" in res.json()["error"]["message"]


def test_unauthenticated_user_cannot_vote(client, seed_test_data):
    """
    Unauthenticated requests must be rejected with 401 Authentication Required.
    """
    data = seed_test_data
    election_id = data["open_election"].id
    position_id = data["position1"].id
    candidate_id = data["cand_approved"].id

    res = client.post(
        f"/elections/{election_id}/positions/{position_id}/vote",
        json={"candidate_id": candidate_id},
    )

    assert res.status_code == 401


def test_unapproved_candidate_cannot_receive_votes(client, seed_test_data):
    """
    Votes cannot be cast for candidates who are in 'pending' or 'rejected' status.
    """
    data = seed_test_data
    election_id = data["open_election"].id
    position_id = data["position1"].id
    pending_cand_id = data["cand_pending"].id

    res = client.post(
        f"/elections/{election_id}/positions/{position_id}/vote",
        headers={"Authorization": f"Bearer {data['student1_token']}"},
        json={"candidate_id": pending_cand_id},
    )

    assert res.status_code == 400
    assert "Select an approved candidate" in res.json()["error"]["message"]


def test_voting_outside_schedule_fails(client, seed_test_data, db_session):
    """
    Voting outside scheduled window (starts_at .. ends_at) must be rejected with 409 Conflict.
    """
    data = seed_test_data
    now = datetime.now(timezone.utc)

    # Move election start time to tomorrow
    election = db_session.get(Election, data["open_election"].id)
    election.starts_at = now + timedelta(days=1)
    election.ends_at = now + timedelta(days=2)
    db_session.commit()

    res = client.post(
        f"/elections/{election.id}/positions/{data['position1'].id}/vote",
        headers={"Authorization": f"Bearer {data['student1_token']}"},
        json={"candidate_id": data["cand_approved"].id},
    )

    assert res.status_code == 409
    assert "Voting is outside the scheduled election time" in res.json()["error"]["message"]


def test_voting_on_closed_election_fails(client, seed_test_data, db_session):
    """
    Voting on closed or draft elections must be rejected with 409 Conflict.
    """
    data = seed_test_data
    election = db_session.get(Election, data["open_election"].id)
    election.status = "closed"
    db_session.commit()

    res = client.post(
        f"/elections/{election.id}/positions/{data['position1'].id}/vote",
        headers={"Authorization": f"Bearer {data['student1_token']}"},
        json={"candidate_id": data["cand_approved"].id},
    )

    assert res.status_code == 409
    assert "This election is not open for voting" in res.json()["error"]["message"]


def test_successful_vote_and_double_voting_prevention(client, seed_test_data, db_session):
    """
    Verifies that:
    1. An eligible student can cast their ballot successfully.
    2. Voter participation is decoupled from the vote choice.
    3. Attempting to cast a second vote for the same position is rejected with 409 Conflict.
    """
    data = seed_test_data
    election_id = data["open_election"].id
    position_id = data["position1"].id
    candidate_id = data["cand_approved"].id
    token = data["student1_token"]

    # 1. Cast first vote
    res1 = client.post(
        f"/elections/{election_id}/positions/{position_id}/vote",
        headers={"Authorization": f"Bearer {token}"},
        json={"candidate_id": candidate_id},
    )

    assert res1.status_code == 200
    assert "Your vote has been recorded successfully" in res1.json()["message"]

    # Verify participation record exists
    part = db_session.query(VoterParticipation).filter(
        VoterParticipation.election_id == election_id,
        VoterParticipation.position_id == position_id,
        VoterParticipation.student_id == data["student1"].id,
    ).first()
    assert part is not None

    # Verify vote record exists and does not store student_id
    vote = db_session.query(Vote).filter(
        Vote.election_id == election_id,
        Vote.position_id == position_id,
        Vote.candidate_id == candidate_id,
    ).first()
    assert vote is not None
    assert not hasattr(vote, "student_id")

    # 2. Attempt double vote (same position, same student)
    res2 = client.post(
        f"/elections/{election_id}/positions/{position_id}/vote",
        headers={"Authorization": f"Bearer {token}"},
        json={"candidate_id": data["cand_approved2"].id},
    )

    assert res2.status_code == 409
    assert "A vote has already been recorded for this position" in res2.json()["error"]["message"]

    # Ensure vote count in database remains exactly 1
    total_votes = db_session.query(Vote).filter(
        Vote.election_id == election_id,
        Vote.position_id == position_id,
    ).count()
    assert total_votes == 1


def test_tallying_and_winner_certification(client, seed_test_data, db_session):
    """
    Verifies the results tabulation engine:
    1. Tabulates votes per candidate.
    2. Calculates correct percentages.
    3. Certifies winner when election is closed.
    """
    data = seed_test_data
    election_id = data["open_election"].id
    position_id = data["position1"].id
    cand1_id = data["cand_approved"].id
    cand2_id = data["cand_approved2"].id

    # Insert simulated votes directly for tally testing
    # Cand1: 3 votes, Cand2: 1 vote
    for _ in range(3):
        db_session.add(Vote(election_id=election_id, position_id=position_id, candidate_id=cand1_id))
    db_session.add(Vote(election_id=election_id, position_id=position_id, candidate_id=cand2_id))
    db_session.commit()

    # Close the election
    election = db_session.get(Election, election_id)
    election.status = "closed"
    db_session.commit()

    # Query results endpoint
    res = client.get(f"/elections/{election_id}/results")
    assert res.status_code == 200
    results = res.json()

    assert results["has_published_tallies"] is True
    assert results["election_status"] == "closed"
    assert len(results["positions"]) == 1

    pos_result = results["positions"][0]
    assert pos_result["total_votes"] == 4

    # Cand1 should be declared winner with 75%
    winner = pos_result["winner"]
    assert winner is not None
    assert winner["id"] == cand1_id
    assert winner["votes"] == 3
    assert winner["percentage"] == 75.0
    assert winner["is_winner"] is True



def test_cryptographic_voter_receipt_and_verification(client, seed_test_data):
    """
    Phase 3: Cryptographic Voter Receipt
    Verifies that:
    1. Casting a vote returns a 64-character SHA-256 ballot receipt hash.
    2. The receipt hash is queryable via GET /votes/verify/{hash}.
    3. The verification confirms participation without revealing the voter's candidate choice.
    4. Invalid receipt hashes return 404 Not Found.
    """
    data = seed_test_data
    election_id = data["open_election"].id
    position_id = data["position1"].id
    candidate_id = data["cand_approved"].id
    token = data["student1_token"]

    # 1. Cast ballot
    res = client.post(
        f"/elections/{election_id}/positions/{position_id}/vote",
        headers={"Authorization": f"Bearer {token}"},
        json={"candidate_id": candidate_id},
    )
    assert res.status_code == 200
    vote_data = res.json()
    assert "receipt_hash" in vote_data
    receipt_hash = vote_data["receipt_hash"]
    assert len(receipt_hash) == 64  # SHA-256 hex string

    # 2. Public verification of valid receipt
    v_res = client.get(f"/votes/verify/{receipt_hash}")
    assert v_res.status_code == 200
    v_data = v_res.json()
    assert v_data["verified"] is True
    assert v_data["receipt_hash"] == receipt_hash
    assert v_data["election_id"] == election_id
    assert v_data["position_id"] == position_id
    assert "candidate" not in str(v_data).lower() or "candidate_id" not in v_data  # Secrecy maintained!

    # 3. Invalid receipt returns 404
    bad_res = client.get("/votes/verify/0000000000000000000000000000000000000000000000000000000000000000")
    assert bad_res.status_code == 404


def test_apscheduler_election_clock_transitions(client, seed_test_data, db_session):
    """
    Phase 3: Automated Election Clock (APScheduler)
    Verifies that:
    1. Election clock status endpoint is queryable by administrators.
    2. Clock tick transitions an election from 'draft' to 'open' when start time arrives.
    3. Clock tick transitions an election from 'open' to 'closed' when end time passes.
    """
    data = seed_test_data
    admin_token = data["admin_token"]
    now = datetime.now(timezone.utc)

    # 1. Check clock status
    status_res = client.get(
        "/admin/clock/status",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert status_res.status_code == 200
    assert "status" in status_res.json()

    # 2. Setup election ready to open (starts_at in the past, ends_at in the future)
    election = db_session.get(Election, data["open_election"].id)
    election.status = "draft"
    election.starts_at = now - timedelta(minutes=10)
    election.ends_at = now + timedelta(hours=2)
    db_session.commit()

    # Trigger manual clock tick
    tick_res = client.post(
        "/admin/clock/tick",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert tick_res.status_code == 200
    db_session.refresh(election)
    assert election.status == "open"

    # 3. Setup election ready to close (ends_at in the past)
    election.ends_at = now - timedelta(minutes=1)
    db_session.commit()

    tick_res2 = client.post(
        "/admin/clock/tick",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert tick_res2.status_code == 200
    db_session.refresh(election)
    assert election.status == "closed"


def test_immutable_audit_log_tracking(client, seed_test_data):
    """
    Phase 3: Immutable Audit Log Table
    Verifies that:
    1. Administrative mutations (creating elections, candidate reviews) generate audit records.
    2. Only administrators can access GET /audit-logs (students rejected with 403).
    3. Official signed CSV export is downloadable via GET /audit-logs/export.
    """
    data = seed_test_data
    admin_token = data["admin_token"]
    student_token = data["student1_token"]

    # 1. Create election (triggers audit log)
    now = datetime.now(timezone.utc)
    create_res = client.post(
        "/elections",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "Audit Test Council 2026",
            "description": "Election to verify immutable audit logging",
            "starts_at": (now + timedelta(days=1)).isoformat(),
            "ends_at": (now + timedelta(days=2)).isoformat(),
        },
    )
    assert create_res.status_code == 201

    # 2. Verify audit logs as administrator
    log_res = client.get(
        "/audit-logs",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert log_res.status_code == 200
    logs = log_res.json()
    assert len(logs) > 0

    actions = [log["action"] for log in logs]
    assert "CREATE_ELECTION" in actions

    # 3. Verify students are forbidden from reading audit logs
    forbidden_res = client.get(
        "/audit-logs",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert forbidden_res.status_code == 403

    # 4. Verify CSV export
    csv_res = client.get(
        "/audit-logs/export",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Log ID,Timestamp (UTC),Actor Email" in csv_res.text
