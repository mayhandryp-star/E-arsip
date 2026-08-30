"""One-off cleanup of TEST_ data created during testing."""
import requests
from conftest import BASE_URL  # noqa

TOKEN = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "admin"}, timeout=30).json()["token"]
H = {"Authorization": f"Bearer {TOKEN}"}

arch = requests.get(f"{BASE_URL}/api/archives", headers=H, timeout=30).json()
for a in arch:
    if a["nomor_arsip"].startswith("TEST_") or a["nama_arsip"].startswith("TEST "):
        r = requests.delete(f"{BASE_URL}/api/archives/{a['id']}", headers=H, timeout=30)
        print("del archive", a["nomor_arsip"], r.status_code)

users = requests.get(f"{BASE_URL}/api/users", headers=H, timeout=30).json()
for u in users:
    if u["username"].startswith("test_"):
        r = requests.delete(f"{BASE_URL}/api/users/{u['id']}", headers=H, timeout=30)
        print("del user", u["username"], r.status_code)

for res in ["archive-types", "archive-locations"]:
    for i in requests.get(f"{BASE_URL}/api/{res}", headers=H, timeout=30).json():
        if i["name"].startswith("TEST_"):
            print("del", res, i["name"], requests.delete(f"{BASE_URL}/api/{res}/{i['id']}", headers=H, timeout=30).status_code)
print("cleanup done")
