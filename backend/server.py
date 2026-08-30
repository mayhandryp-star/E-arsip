from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator
from typing import List, Optional, Annotated
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import uuid
import logging
import re
import requests

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

# ---------------- Object Storage ----------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "arsip-digital"
storage_key = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/pdf")

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------- Models ----------------
PyObjectId = Annotated[str, BeforeValidator(str)]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class LoginInput(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "user"  # "admin" | "user"


class UserPublic(BaseModel):
    id: str
    username: str
    name: str
    role: str
    created_at: Optional[str] = None


class NamedItem(BaseModel):
    name: str


class ArchivePublic(BaseModel):
    id: str
    nomor_arsip: str
    nama_arsip: str
    jenis_arsip: str
    lokasi_arsip: str
    file_name: Optional[str] = None
    has_file: bool = False
    created_at: Optional[str] = None


# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak. Hanya admin.")
    return user


def oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return ObjectId(value)


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=604800, path="/",
    )


# ---------------- Auth routes ----------------
@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    username = data.username.strip().lower()
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_access_token(str(user["_id"]), user["username"], user["role"])
    set_auth_cookie(response, token)
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "name": user.get("name", ""),
        "role": user["role"],
        "token": token,
    }


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Berhasil keluar"}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"], "name": user.get("name", ""), "role": user["role"]}


# ---------------- User management (admin) ----------------
@api_router.get("/users", response_model=List[UserPublic])
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find().sort("created_at", 1).to_list(1000)
    return [UserPublic(id=str(u["_id"]), username=u["username"], name=u.get("name", ""),
                        role=u["role"], created_at=u.get("created_at")) for u in users]


@api_router.post("/users", response_model=UserPublic)
async def create_user(data: UserCreate, admin: dict = Depends(require_admin)):
    username = data.username.strip().lower()
    if not username or not data.password:
        raise HTTPException(status_code=400, detail="Username dan password wajib diisi")
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    role = data.role if data.role in ("admin", "user") else "user"
    doc = {
        "username": username,
        "password_hash": hash_password(data.password),
        "name": data.name.strip() or username,
        "role": role,
        "created_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    return UserPublic(id=str(res.inserted_id), username=username, name=doc["name"],
                      role=role, created_at=doc["created_at"])


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    res = await db.users.delete_one({"_id": oid(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    return {"message": "Pengguna dihapus"}


# ---------------- Archive types & locations ----------------
async def _list_named(collection):
    items = await collection.find().sort("name", 1).to_list(1000)
    return [{"id": str(i["_id"]), "name": i["name"]} for i in items]


async def _create_named(collection, name: str):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama tidak boleh kosong")
    if await collection.find_one({"name": name}):
        raise HTTPException(status_code=400, detail="Data sudah ada")
    res = await collection.insert_one({"name": name, "created_at": now_iso()})
    return {"id": str(res.inserted_id), "name": name}


async def _delete_named(collection, item_id: str):
    res = await collection.delete_one({"_id": oid(item_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return {"message": "Dihapus"}


@api_router.get("/archive-types")
async def get_types(user: dict = Depends(get_current_user)):
    return await _list_named(db.archive_types)


@api_router.post("/archive-types")
async def add_type(data: NamedItem, admin: dict = Depends(require_admin)):
    return await _create_named(db.archive_types, data.name)


@api_router.delete("/archive-types/{item_id}")
async def remove_type(item_id: str, admin: dict = Depends(require_admin)):
    return await _delete_named(db.archive_types, item_id)


@api_router.get("/archive-locations")
async def get_locations(user: dict = Depends(get_current_user)):
    return await _list_named(db.archive_locations)


@api_router.post("/archive-locations")
async def add_location(data: NamedItem, admin: dict = Depends(require_admin)):
    return await _create_named(db.archive_locations, data.name)


@api_router.delete("/archive-locations/{item_id}")
async def remove_location(item_id: str, admin: dict = Depends(require_admin)):
    return await _delete_named(db.archive_locations, item_id)


# ---------------- Archives ----------------
def _archive_public(doc) -> ArchivePublic:
    return ArchivePublic(
        id=str(doc["_id"]),
        nomor_arsip=doc["nomor_arsip"],
        nama_arsip=doc["nama_arsip"],
        jenis_arsip=doc.get("jenis_arsip", ""),
        lokasi_arsip=doc.get("lokasi_arsip", ""),
        file_name=doc.get("file_name"),
        has_file=bool(doc.get("stored_file")),
        created_at=doc.get("created_at"),
    )


async def _save_pdf(file: UploadFile) -> tuple:
    if file.content_type not in ("application/pdf",) and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File harus berformat PDF")
    content = await file.read()
    path = f"{APP_NAME}/arsip/{uuid.uuid4()}.pdf"
    result = put_object(path, content, "application/pdf")
    return result["path"], file.filename


@api_router.post("/archives", response_model=ArchivePublic)
async def create_archive(
    nomor_arsip: str = Form(...),
    nama_arsip: str = Form(...),
    jenis_arsip: str = Form(""),
    lokasi_arsip: str = Form(""),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    doc = {
        "nomor_arsip": nomor_arsip.strip(),
        "nama_arsip": nama_arsip.strip(),
        "jenis_arsip": jenis_arsip.strip(),
        "lokasi_arsip": lokasi_arsip.strip(),
        "stored_file": None,
        "file_name": None,
        "created_at": now_iso(),
        "created_by": user["username"],
    }
    if file is not None:
        stored, original = await _save_pdf(file)
        doc["stored_file"] = stored
        doc["file_name"] = original
    res = await db.archives.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _archive_public(doc)


@api_router.get("/archives", response_model=List[ArchivePublic])
async def search_archives(nomor: str = "", nama: str = "", user: dict = Depends(get_current_user)):
    query = {}
    conditions = []
    if nomor.strip():
        conditions.append({"nomor_arsip": {"$regex": re.escape(nomor.strip()), "$options": "i"}})
    if nama.strip():
        conditions.append({"nama_arsip": {"$regex": re.escape(nama.strip()), "$options": "i"}})
    if conditions:
        query = {"$and": conditions}
    docs = await db.archives.find(query).sort("created_at", -1).to_list(1000)
    return [_archive_public(d) for d in docs]


@api_router.get("/archives/{archive_id}", response_model=ArchivePublic)
async def get_archive(archive_id: str, user: dict = Depends(get_current_user)):
    doc = await db.archives.find_one({"_id": oid(archive_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Arsip tidak ditemukan")
    return _archive_public(doc)


@api_router.put("/archives/{archive_id}", response_model=ArchivePublic)
async def update_archive(
    archive_id: str,
    nomor_arsip: str = Form(...),
    nama_arsip: str = Form(...),
    jenis_arsip: Optional[str] = Form(None),
    lokasi_arsip: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    admin: dict = Depends(require_admin),
):
    doc = await db.archives.find_one({"_id": oid(archive_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Arsip tidak ditemukan")
    update = {
        "nomor_arsip": nomor_arsip.strip(),
        "nama_arsip": nama_arsip.strip(),
    }
    if jenis_arsip is not None:
        update["jenis_arsip"] = jenis_arsip.strip()
    if lokasi_arsip is not None:
        update["lokasi_arsip"] = lokasi_arsip.strip()
    if file is not None:
        old = doc.get("stored_file")
        stored, original = await _save_pdf(file)
        update["stored_file"] = stored
        update["file_name"] = original
    await db.archives.update_one({"_id": oid(archive_id)}, {"$set": update})
    doc.update(update)
    return _archive_public(doc)


@api_router.delete("/archives/{archive_id}")
async def delete_archive(archive_id: str, admin: dict = Depends(require_admin)):
    doc = await db.archives.find_one({"_id": oid(archive_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Arsip tidak ditemukan")
    await db.archives.delete_one({"_id": oid(archive_id)})
    return {"message": "Arsip dihapus"}


@api_router.get("/archives/{archive_id}/file")
async def download_file(archive_id: str, token: str = "", request: Request = None):
    # allow token via query param (for direct link/iframe) or cookie/header
    user_token = token or request.cookies.get("access_token") or ""
    if not user_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            user_token = auth_header[7:]
    try:
        jwt.decode(user_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    doc = await db.archives.find_one({"_id": oid(archive_id)})
    if not doc or not doc.get("stored_file"):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    data, content_type = get_object(doc["stored_file"])
    fname = doc.get("file_name") or "arsip.pdf"
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{fname}"'})


@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    total = await db.archives.count_documents({})
    with_file = await db.archives.count_documents({"stored_file": {"$ne": None}})
    types = await db.archive_types.count_documents({})
    locations = await db.archive_locations.count_documents({})
    users = await db.users.count_documents({})
    return {"total_arsip": total, "arsip_dengan_file": with_file,
            "jenis_arsip": types, "lokasi_arsip": locations, "pengguna": users}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    admin_username = os.environ.get("ADMIN_USERNAME", "admin").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin")
    existing = await db.users.find_one({"username": admin_username})
    if not existing:
        await db.users.insert_one({
            "username": admin_username,
            "password_hash": hash_password(admin_password),
            "name": "Administrator",
            "role": "admin",
            "email": os.environ.get("ADMIN_EMAIL", ""),
            "created_at": now_iso(),
        })
        logger.info("Admin user seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"username": admin_username},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
    # seed default types & locations
    if await db.archive_types.count_documents({}) == 0:
        for n in ["Surat Masuk", "Surat Keluar", "Dokumen Keuangan", "Kontrak"]:
            await db.archive_types.insert_one({"name": n, "created_at": now_iso()})
    if await db.archive_locations.count_documents({}) == 0:
        for n in ["Ruang Arsip A", "Ruang Arsip B", "Gudang Utama"]:
            await db.archive_locations.insert_one({"name": n, "created_at": now_iso()})


@app.on_event("shutdown")
async def shutdown():
    client.close()
