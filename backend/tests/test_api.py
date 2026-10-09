"""End-to-end API tests covering every core feature from the assignment."""


def test_onboarding_flow(client):
    res = client.post("/api/auth/request-otp", json={"phone": "+1 (555) 123-4567"})
    assert res.json() == {"phone": "+15551234567", "is_registered": False}

    bad = client.post("/api/auth/verify-otp", json={"phone": "+15551234567", "code": "000000"})
    assert bad.status_code == 400

    res = client.post("/api/auth/verify-otp", json={"phone": "+15551234567", "code": "123456"})
    body = res.json()
    assert body["is_new_user"] is True
    headers = {"Authorization": f"Bearer {body['token']}"}

    me = client.patch("/api/users/me", json={"display_name": "Test User", "username": "@Tester"}, headers=headers)
    assert me.json()["display_name"] == "Test User"
    assert me.json()["username"] == "tester"

    # Logging in again is not a new user; logout kills the token.
    again = client.post("/api/auth/verify-otp", json={"phone": "+15551234567", "code": "123456"})
    assert again.json()["is_new_user"] is False
    client.post("/api/auth/logout", headers=headers)
    assert client.get("/api/users/me", headers=headers).status_code == 401


def test_invalid_phone_rejected(client):
    assert client.post("/api/auth/request-otp", json={"phone": "abc"}).status_code == 422


def test_contacts(client, register):
    alice = register("+15550000101", "Alice")
    bob = register("+15550000102", "Bob")
    client.patch("/api/users/me", json={"username": "bob"}, headers=bob["headers"])

    res = client.post("/api/contacts", json={"query": "@bob"}, headers=alice["headers"])
    assert res.status_code == 201
    assert res.json()["user"]["display_name"] == "Bob"

    assert client.post("/api/contacts", json={"query": "+1 555 000 0102"}, headers=alice["headers"]).status_code == 409
    assert client.post("/api/contacts", json={"query": "@nobody"}, headers=alice["headers"]).status_code == 404
    assert client.post("/api/contacts", json={"query": "@alice_x"}, headers=alice["headers"]).status_code == 404
    assert len(client.get("/api/contacts", headers=alice["headers"]).json()) == 1

    assert client.delete(f"/api/contacts/{bob['id']}", headers=alice["headers"]).status_code == 204
    assert client.get("/api/contacts", headers=alice["headers"]).json() == []


def test_direct_messaging_receipts_and_unread(client, register):
    alice = register("+15550000201", "Alice")
    bob = register("+15550000202", "Bob")

    conv = client.post("/api/conversations/direct", json={"user_id": bob["id"]}, headers=alice["headers"]).json()
    # Opening the same chat again (from either side) returns the same conversation.
    same = client.post("/api/conversations/direct", json={"user_id": alice["id"]}, headers=bob["headers"]).json()
    assert same["id"] == conv["id"]

    msg = client.post(
        f"/api/conversations/{conv['id']}/messages", json={"body": "hi bob", "client_id": "tmp-1"},
        headers=alice["headers"],
    ).json()
    assert msg["status"] == "sent"  # Bob has no socket open
    assert msg["client_id"] == "tmp-1"

    bob_list = client.get("/api/conversations", headers=bob["headers"]).json()
    assert bob_list[0]["unread_count"] == 1
    assert bob_list[0]["last_message"]["body"] == "hi bob"

    client.post(f"/api/conversations/{conv['id']}/read", json={"up_to_message_id": msg["id"]}, headers=bob["headers"])
    assert client.get("/api/conversations", headers=bob["headers"]).json()[0]["unread_count"] == 0
    history = client.get(f"/api/conversations/{conv['id']}/messages", headers=alice["headers"]).json()
    assert history[-1]["status"] == "read"


def test_realtime_delivery_and_typing(client, register):
    alice = register("+15550000301", "Alice")
    bob = register("+15550000302", "Bob")
    conv = client.post("/api/conversations/direct", json={"user_id": bob["id"]}, headers=alice["headers"]).json()

    with client.websocket_connect(f"/ws?token={alice['token']}") as alice_ws, \
            client.websocket_connect(f"/ws?token={bob['token']}") as bob_ws:
        assert alice_ws.receive_json()["type"] == "presence"  # Bob came online

        bob_ws.send_json({"type": "typing", "conversation_id": conv["id"], "is_typing": True})
        typing = alice_ws.receive_json()
        assert typing == {"type": "typing", "conversation_id": conv["id"], "user_id": bob["id"], "is_typing": True}

        sent = client.post(f"/api/conversations/{conv['id']}/messages", json={"body": "live!"}, headers=alice["headers"])
        assert sent.json()["status"] == "delivered"  # Bob's socket received it

        event = bob_ws.receive_json()
        assert event["type"] == "message_new" and event["message"]["body"] == "live!"


def test_reply_and_reactions(client, register):
    alice = register("+15550000401", "Alice")
    bob = register("+15550000402", "Bob")
    conv = client.post("/api/conversations/direct", json={"user_id": bob["id"]}, headers=alice["headers"]).json()
    first = client.post(f"/api/conversations/{conv['id']}/messages", json={"body": "lunch?"}, headers=alice["headers"]).json()

    reply = client.post(
        f"/api/conversations/{conv['id']}/messages", json={"body": "yes", "reply_to_id": first["id"]},
        headers=bob["headers"],
    ).json()
    assert reply["reply_to"]["body"] == "lunch?"

    client.put(f"/api/messages/{first['id']}/reaction", json={"emoji": "👍"}, headers=bob["headers"])
    updated = client.put(f"/api/messages/{first['id']}/reaction", json={"emoji": "❤️"}, headers=bob["headers"]).json()
    assert updated["reactions"] == [{"user_id": bob["id"], "emoji": "❤️"}]  # replaced, not added
    cleared = client.delete(f"/api/messages/{first['id']}/reaction", headers=bob["headers"]).json()
    assert cleared["reactions"] == []


def test_group_admin_controls(client, register):
    admin = register("+15550000501", "Admin")
    bob = register("+15550000502", "Bob")
    carol = register("+15550000503", "Carol")

    group = client.post(
        "/api/conversations/group", json={"title": "Team", "member_ids": [bob["id"]]}, headers=admin["headers"]
    ).json()
    gid = group["id"]
    assert {m["user"]["id"]: m["role"] for m in group["members"]} == {admin["id"]: "admin", bob["id"]: "member"}

    # Non-admins can't add people.
    assert client.post(f"/api/conversations/{gid}/members", json={"user_ids": [carol["id"]]},
                       headers=bob["headers"]).status_code == 403
    added = client.post(f"/api/conversations/{gid}/members", json={"user_ids": [carol["id"]]}, headers=admin["headers"])
    assert len(added.json()["members"]) == 3

    # Carol can read the group, then gets removed and loses access.
    assert client.get(f"/api/conversations/{gid}/messages", headers=carol["headers"]).status_code == 200
    assert client.delete(f"/api/conversations/{gid}/members/{carol['id']}", headers=admin["headers"]).status_code == 204
    assert client.get(f"/api/conversations/{gid}/messages", headers=carol["headers"]).status_code == 404

    # When the only admin leaves, the remaining member is promoted.
    client.delete(f"/api/conversations/{gid}/members/{admin['id']}", headers=admin["headers"])
    group = client.get(f"/api/conversations/{gid}", headers=bob["headers"]).json()
    assert group["members"][0]["role"] == "admin"

    bodies = [m["body"] for m in client.get(f"/api/conversations/{gid}/messages", headers=bob["headers"]).json()]
    assert bodies == ["created the group", "added Carol", "removed Carol", "left the group"]


def test_disappearing_messages_set_expiry(client, register):
    alice = register("+15550000601", "Alice")
    bob = register("+15550000602", "Bob")
    conv = client.post("/api/conversations/direct", json={"user_id": bob["id"]}, headers=alice["headers"]).json()

    assert client.patch(f"/api/conversations/{conv['id']}", json={"disappearing_seconds": 7},
                        headers=alice["headers"]).status_code == 422
    client.patch(f"/api/conversations/{conv['id']}", json={"disappearing_seconds": 30}, headers=alice["headers"])
    msg = client.post(f"/api/conversations/{conv['id']}/messages", json={"body": "secret"}, headers=alice["headers"])
    assert msg.json()["expires_at"] is not None


def test_non_members_cannot_read(client, register):
    alice = register("+15550000701", "Alice")
    bob = register("+15550000702", "Bob")
    eve = register("+15550000703", "Eve")
    conv = client.post("/api/conversations/direct", json={"user_id": bob["id"]}, headers=alice["headers"]).json()
    assert client.get(f"/api/conversations/{conv['id']}/messages", headers=eve["headers"]).status_code == 404
    assert client.post(f"/api/conversations/{conv['id']}/messages", json={"body": "x"},
                       headers=eve["headers"]).status_code == 404
