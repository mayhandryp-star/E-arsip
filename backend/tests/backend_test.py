"""Backend API tests for Arsip Digital (auth, users, types, locations, archives, stats)."""
import io
import uuid

import pytest
import requests

from conftest import BASE_URL

PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


def pdf_file(name="TEST_doc.pdf"):
    return {"file": (name, io.BytesIO(PDF_BYTES), "application/pdf")}


# ---------------- Auth module ----------------
class TestAuth:
    def test_login_success(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["username"] == test_credentials["username"]
        assert d["role"] == "admin"
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        # httpOnly cookie must be set
        sc = r.headers.get("set-cookie", "")
        assert "access_token=" in sc
        assert "HttpOnly" in sc

    def test_login_wrong_password(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"username": test_credentials["username"], "password": "wrong-pass-xyz"}, timeout=30)
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_login_unknown_user(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"username": "TEST_nouser_%s" % uuid.uuid4().hex[:6], "password": "x"}, timeout=30)
        assert r.status_code == 401

    def test_login_missing_fields_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "admin"}, timeout=30)
        assert r.status_code == 422

    def test_me_requires_auth(self, api_client):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_with_bearer(self, admin_client, test_credentials):
        r = admin_client.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == test_credentials["username"]
        assert d["role"] == "admin"

    def test_me_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"}, timeout=30)
        assert r.status_code == 401

    def test_logout(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/auth/logout", timeout=30)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_bcrypt_hash_format(self):
        """Password hash stored must be bcrypt $2b$."""
        import asyncio
        import os
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        mongo = env.get("MONGO_URL") or os.environ.get("MONGO_URL")
        dbname = env.get("DB_NAME") or os.environ.get("DB_NAME")

        async def check():
            c = AsyncIOMotorClient(mongo)
            u = await c[dbname].users.find_one({"username": "admin"})
            c.close()
            return u
        u = asyncio.get_event_loop().run_until_complete(check()) if False else asyncio.run(check())
        assert u is not None, "admin user not seeded"
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]


# ---------------- Stats ----------------
class TestStats:
    def test_stats_unauth(self):
        r = requests.get(f"{BASE_URL}/api/stats", timeout=30)
        assert r.status_code == 401

    def test_stats_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_arsip", "arsip_dengan_file", "jenis_arsip", "lokasi_arsip", "pengguna"]:
            assert k in d and isinstance(d[k], int), k
        assert d["pengguna"] >= 1


# ---------------- Types & Locations ----------------
@pytest.mark.parametrize("resource", ["archive-types", "archive-locations"])
class TestNamedResources:
    def test_list(self, admin_client, resource):
        r = admin_client.get(f"{BASE_URL}/api/{resource}", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0, "seed data missing"
        assert "id" in items[0] and "name" in items[0]
        assert "_id" not in items[0]

    def test_create_duplicate_and_delete(self, admin_client, resource):
        name = f"TEST_{resource}_{uuid.uuid4().hex[:6]}"
        r = admin_client.post(f"{BASE_URL}/api/{resource}", json={"name": name}, timeout=30)
        assert r.status_code == 200, r.text
        item_id = r.json()["id"]
        assert r.json()["name"] == name
        # persisted
        listing = admin_client.get(f"{BASE_URL}/api/{resource}", timeout=30).json()
        assert any(i["id"] == item_id for i in listing)
        # duplicate rejected
        dup = admin_client.post(f"{BASE_URL}/api/{resource}", json={"name": name}, timeout=30)
        assert dup.status_code == 400
        # empty rejected
        empty = admin_client.post(f"{BASE_URL}/api/{resource}", json={"name": "   "}, timeout=30)
        assert empty.status_code == 400
        # delete
        d = admin_client.delete(f"{BASE_URL}/api/{resource}/{item_id}", timeout=30)
        assert d.status_code == 200
        listing = admin_client.get(f"{BASE_URL}/api/{resource}", timeout=30).json()
        assert not any(i["id"] == item_id for i in listing)
        # delete again -> 404
        again = admin_client.delete(f"{BASE_URL}/api/{resource}/{item_id}", timeout=30)
        assert again.status_code == 404

    def test_unauth_write(self, resource):
        r = requests.post(f"{BASE_URL}/api/{resource}", json={"name": "TEST_x"}, timeout=30)
        assert r.status_code == 401

    def test_delete_invalid_objectid(self, admin_client, resource):
        r = admin_client.delete(f"{BASE_URL}/api/{resource}/not-an-objectid", timeout=30)
        assert r.status_code in (400, 404, 422), f"expected 4xx got {r.status_code}"


# ---------------- Users (admin) ----------------
class TestUsers:
    created = []

    def test_list_users_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/users", timeout=30)
        assert r.status_code == 401

    def test_create_list_delete_user(self, admin_client):
        uname = f"test_u_{uuid.uuid4().hex[:6]}"
        payload = {"username": uname, "password": "Passw0rd!", "name": "TEST User", "role": "user"}
        r = admin_client.post(f"{BASE_URL}/api/users", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        uid = d["id"]
        TestUsers.created.append(uid)
        assert d["username"] == uname
        assert d["name"] == "TEST User"
        assert d["role"] == "user"
        assert "password" not in d and "password_hash" not in d
        # persisted in list
        users = admin_client.get(f"{BASE_URL}/api/users", timeout=30).json()
        assert any(u["id"] == uid for u in users)
        # duplicate
        dup = admin_client.post(f"{BASE_URL}/api/users", json=payload, timeout=30)
        assert dup.status_code == 400
        # new user can login
        lg = requests.post(f"{BASE_URL}/api/auth/login", json={"username": uname, "password": "Passw0rd!"}, timeout=30)
        assert lg.status_code == 200
        assert lg.json()["role"] == "user"
        # delete
        de = admin_client.delete(f"{BASE_URL}/api/users/{uid}", timeout=30)
        assert de.status_code == 200
        TestUsers.created.remove(uid)
        users = admin_client.get(f"{BASE_URL}/api/users", timeout=30).json()
        assert not any(u["id"] == uid for u in users)

    def test_create_user_empty_password(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/users",
                              json={"username": f"test_e_{uuid.uuid4().hex[:5]}", "password": "", "name": "x"}, timeout=30)
        assert r.status_code == 400

    def test_admin_cannot_delete_self(self, admin_client):
        me = admin_client.get(f"{BASE_URL}/api/auth/me", timeout=30).json()
        r = admin_client.delete(f"{BASE_URL}/api/users/{me['id']}", timeout=30)
        assert r.status_code == 400

    def test_regular_user_forbidden_on_admin_routes(self, admin_client):
        uname = f"test_r_{uuid.uuid4().hex[:6]}"
        cr = admin_client.post(f"{BASE_URL}/api/users",
                               json={"username": uname, "password": "Passw0rd!", "name": "TEST Reg", "role": "user"},
                               timeout=30)
        assert cr.status_code == 200
        uid = cr.json()["id"]
        token = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"username": uname, "password": "Passw0rd!"}, timeout=30).json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        assert requests.get(f"{BASE_URL}/api/users", headers=h, timeout=30).status_code == 403
        assert requests.post(f"{BASE_URL}/api/users", headers=h,
                             json={"username": "x", "password": "y", "name": "z"}, timeout=30).status_code == 403
        assert requests.post(f"{BASE_URL}/api/archive-types", headers=h, json={"name": "TEST_z"}, timeout=30).status_code == 403
        assert requests.post(f"{BASE_URL}/api/archive-locations", headers=h, json={"name": "TEST_z"}, timeout=30).status_code == 403
        # user CAN read types/locations and create archive
        assert requests.get(f"{BASE_URL}/api/archive-types", headers=h, timeout=30).status_code == 200
        cr_a = requests.post(f"{BASE_URL}/api/archives", headers=h,
                             data={"nomor_arsip": "TEST_R1", "nama_arsip": "TEST Reg Arsip",
                                   "jenis_arsip": "Kontrak", "lokasi_arsip": "Gudang Utama"}, timeout=60)
        assert cr_a.status_code == 200, cr_a.text
        aid = cr_a.json()["id"]
        # user CANNOT edit or delete
        up = requests.put(f"{BASE_URL}/api/archives/{aid}", headers=h,
                          data={"nomor_arsip": "X", "nama_arsip": "Y"}, timeout=30)
        assert up.status_code == 403
        dl = requests.delete(f"{BASE_URL}/api/archives/{aid}", headers=h, timeout=30)
        assert dl.status_code == 403
        # cleanup
        admin_client.delete(f"{BASE_URL}/api/archives/{aid}", timeout=30)
        admin_client.delete(f"{BASE_URL}/api/users/{uid}", timeout=30)


# ---------------- Archives CRUD + file ----------------
class TestArchives:
    def test_unauth(self):
        assert requests.get(f"{BASE_URL}/api/archives", timeout=30).status_code == 401

    def test_create_without_file_and_persist(self, admin_client):
        nomor = f"TEST_N_{uuid.uuid4().hex[:6]}"
        r = admin_client.post(f"{BASE_URL}/api/archives",
                              data={"nomor_arsip": nomor, "nama_arsip": "TEST Tanpa File",
                                    "jenis_arsip": "Surat Masuk", "lokasi_arsip": "Ruang Arsip A"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        aid = d["id"]
        assert d["nomor_arsip"] == nomor
        assert d["has_file"] is False
        assert d["jenis_arsip"] == "Surat Masuk"
        assert "_id" not in d
        # GET by id
        g = admin_client.get(f"{BASE_URL}/api/archives/{aid}", timeout=30)
        assert g.status_code == 200
        assert g.json()["nama_arsip"] == "TEST Tanpa File"
        # file endpoint 404 when no file
        f = admin_client.get(f"{BASE_URL}/api/archives/{aid}/file", timeout=30)
        assert f.status_code == 404
        admin_client.delete(f"{BASE_URL}/api/archives/{aid}", timeout=30)

    def test_create_with_pdf_download_update_delete(self, admin_client, admin_token):
        nomor = f"TEST_P_{uuid.uuid4().hex[:6]}"
        r = admin_client.post(f"{BASE_URL}/api/archives",
                              data={"nomor_arsip": nomor, "nama_arsip": "TEST Dengan PDF",
                                    "jenis_arsip": "Kontrak", "lokasi_arsip": "Gudang Utama"},
                              files=pdf_file(), timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        aid = d["id"]
        assert d["has_file"] is True, "PDF upload to object storage failed"
        assert d["file_name"] == "TEST_doc.pdf"

        # download via token query param (no headers)
        dl = requests.get(f"{BASE_URL}/api/archives/{aid}/file", params={"token": admin_token}, timeout=60)
        assert dl.status_code == 200, dl.text[:200]
        assert dl.headers["content-type"].startswith("application/pdf")
        assert dl.content.startswith(b"%PDF")
        # download without token -> 401
        assert requests.get(f"{BASE_URL}/api/archives/{aid}/file", timeout=30).status_code == 401

        # search finds it
        s = admin_client.get(f"{BASE_URL}/api/archives", params={"nomor": nomor}, timeout=30)
        assert s.status_code == 200
        assert any(x["id"] == aid for x in s.json())
        s2 = admin_client.get(f"{BASE_URL}/api/archives", params={"nama": "TEST Dengan"}, timeout=30)
        assert any(x["id"] == aid for x in s2.json())

        # update nomor/nama + new file
        new_nomor = nomor + "_UPD"
        up = admin_client.put(f"{BASE_URL}/api/archives/{aid}",
                              data={"nomor_arsip": new_nomor, "nama_arsip": "TEST Updated"},
                              files=pdf_file("TEST_new.pdf"), timeout=120)
        assert up.status_code == 200, up.text
        assert up.json()["nomor_arsip"] == new_nomor
        g = admin_client.get(f"{BASE_URL}/api/archives/{aid}", timeout=30).json()
        assert g["nomor_arsip"] == new_nomor
        assert g["nama_arsip"] == "TEST Updated"
        assert g["file_name"] == "TEST_new.pdf"
        # jenis/lokasi preserved when not sent
        assert g["jenis_arsip"] == "Kontrak"
        assert g["lokasi_arsip"] == "Gudang Utama"

        # delete + verify gone
        de = admin_client.delete(f"{BASE_URL}/api/archives/{aid}", timeout=30)
        assert de.status_code == 200
        assert admin_client.get(f"{BASE_URL}/api/archives/{aid}", timeout=30).status_code == 404
        assert admin_client.delete(f"{BASE_URL}/api/archives/{aid}", timeout=30).status_code == 404

    def test_non_pdf_rejected(self, admin_client):
        files = {"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")}
        r = admin_client.post(f"{BASE_URL}/api/archives",
                              data={"nomor_arsip": "TEST_BAD", "nama_arsip": "TEST Bad"},
                              files=files, timeout=60)
        assert r.status_code == 400, f"non-PDF accepted: {r.status_code} {r.text[:200]}"

    def test_missing_required_fields(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/archives", data={"nomor_arsip": "TEST_only"}, timeout=30)
        assert r.status_code == 422

    def test_search_both_params_and_empty(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/archives", params={"nomor": "", "nama": ""}, timeout=30)
        assert r.status_code == 200 and isinstance(r.json(), list)
        r2 = admin_client.get(f"{BASE_URL}/api/archives",
                              params={"nomor": "ZZZ_no_match_%s" % uuid.uuid4().hex}, timeout=30)
        assert r2.status_code == 200 and r2.json() == []

    def test_search_regex_injection_safe(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/archives", params={"nomor": "([a"}, timeout=30)
        assert r.status_code in (200, 400), f"regex special chars caused {r.status_code}"

    def test_get_invalid_objectid(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/archives/abc123", timeout=30)
        assert r.status_code in (400, 404, 422), f"expected 4xx got {r.status_code}"
