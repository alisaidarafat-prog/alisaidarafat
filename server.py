"""
Telecom Reseller Distribution System
FastAPI + MongoDB backend with JWT auth, WebSockets and Telegram notifications.
"""
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import uuid
import bcrypt
import jwt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Dict, Set
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============== Config ==============
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # 7 days

TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')

# Initial admin credentials (used at first boot only)
DEFAULT_ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', '')
DEFAULT_ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
DEFAULT_ADMIN_NAME = os.environ.get('ADMIN_NAME', '')

# ============== Mongo ==============
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============== App ==============
app = FastAPI(title="Telecom Reseller API")
api_router = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("telecom")

# ============== Models ==============
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    name: str
    role: Literal["admin", "reseller"]
    balance: float = 0.0
    active: bool = True
    created_at: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserPublic

class CreateResellerRequest(BaseModel):
    username: str
    password: str
    name: str
    initial_balance: float = 0.0

class UpdateResellerRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None

class AdjustBalanceRequest(BaseModel):
    amount: float
    note: Optional[str] = None

class PackageCreate(BaseModel):
    name: str
    type: Literal["balance", "internet", "minutes", "sms"]
    price: float
    active: bool = True
    description: Optional[str] = None

class PackageUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[Literal["balance", "internet", "minutes", "sms"]] = None
    price: Optional[float] = None
    active: Optional[bool] = None
    description: Optional[str] = None

class Package(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: str
    price: float
    active: bool
    description: Optional[str] = None
    created_at: str

class OrderCreate(BaseModel):
    customer_phone: str
    package_id: str

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    reseller_id: str
    reseller_name: str
    reseller_username: str
    customer_phone: str
    package_id: str
    package_name: str
    package_type: str
    price: float
    status: Literal["pending", "success", "failed"]
    fail_reason: Optional[str] = None
    created_at: str
    updated_at: str

class OrderAction(BaseModel):
    reason: Optional[str] = None

class SettingsUpdate(BaseModel):
    telegram_chat_id: Optional[str] = None
    telegram_enabled: Optional[bool] = None

class SettingsModel(BaseModel):
    telegram_chat_id: str = ""
    telegram_enabled: bool = True

# ============== Helpers ==============
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_jwt(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

def user_doc_to_public(doc: dict) -> UserPublic:
    return UserPublic(
        id=doc["id"], username=doc["username"], name=doc["name"], role=doc["role"],
        balance=doc.get("balance", 0.0), active=doc.get("active", True), created_at=doc["created_at"],
    )

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = decode_jwt(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

async def require_reseller(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "reseller":
        raise HTTPException(status_code=403, detail="Reseller only")
    return user

# ============== WebSocket Manager ==============
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active:
            self.active[user_id].discard(websocket)
            if not self.active[user_id]:
                self.active.pop(user_id, None)

    async def send_to_user(self, user_id: str, message: dict):
        if user_id not in self.active:
            return
        dead = []
        for ws in list(self.active[user_id]):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active[user_id].discard(ws)

manager = ConnectionManager()

# ============== Telegram ==============
async def send_telegram(text: str):
    settings_doc = await db.settings.find_one({"_id": "global"}) or {}
    if not settings_doc.get("telegram_enabled", True):
        return
    chat_id = settings_doc.get("telegram_chat_id", "")
    if not chat_id or not TELEGRAM_BOT_TOKEN:
        logger.info("Telegram skipped (no chat_id)")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client_http:
            r = await client_http.post(url, json=payload)
            if r.status_code != 200:
                logger.warning(f"Telegram non-200: {r.status_code} {r.text}")
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")

# ============== Startup ==============
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("username", unique=True)
    await db.users.create_index("id", unique=True)
    await db.packages.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("reseller_id")
    await db.orders.create_index("status")

    existing = await db.users.find_one({"role": "admin"})
    if not existing and DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "username": DEFAULT_ADMIN_USERNAME,
            "name": DEFAULT_ADMIN_NAME,
            "password": hash_password(DEFAULT_ADMIN_PASSWORD),
            "role": "admin",
            "balance": 0.0,
            "active": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin_doc)
        logger.info(f"Seeded admin: {DEFAULT_ADMIN_USERNAME}")

    if not await db.settings.find_one({"_id": "global"}):
        await db.settings.insert_one({"_id": "global", "telegram_chat_id": "", "telegram_enabled": True})

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

# ============== Auth ==============
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"username": req.username}, {"_id": 0})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="اسم المستخدم أو كلمة المرور غير صحيحة")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="الحساب غير نشط")
    token = create_jwt(user["id"], user["role"])
    return LoginResponse(token=token, user=user_doc_to_public(user))

@api_router.get("/auth/me", response_model=UserPublic)
async def get_me(user: dict = Depends(get_current_user)):
    return user_doc_to_public(user)

# ============== Admin: Resellers ==============
@api_router.get("/admin/resellers", response_model=List[UserPublic])
async def list_resellers(_: dict = Depends(require_admin)):
    docs = await db.users.find({"role": "reseller"}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(1000)
    return [UserPublic(
        id=d["id"], username=d["username"], name=d["name"], role=d["role"],
        balance=d.get("balance", 0.0), active=d.get("active", True), created_at=d["created_at"]
    ) for d in docs]

@api_router.post("/admin/resellers", response_model=UserPublic)
async def create_reseller(req: CreateResellerRequest, _: dict = Depends(require_admin)):
    existing = await db.users.find_one({"username": req.username})
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم محجوز")
    doc = {
        "id": str(uuid.uuid4()), "username": req.username, "name": req.name,
        "password": hash_password(req.password), "role": "reseller",
        "balance": float(req.initial_balance or 0.0), "active": True, "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    if req.initial_balance and req.initial_balance > 0:
        await db.balance_logs.insert_one({
            "id": str(uuid.uuid4()), "reseller_id": doc["id"], "amount": float(req.initial_balance),
            "type": "topup", "note": "رصيد ابتدائي", "created_at": now_iso(),
        })
    return user_doc_to_public(doc)

@api_router.patch("/admin/resellers/{reseller_id}", response_model=UserPublic)
async def update_reseller(reseller_id: str, req: UpdateResellerRequest, _: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": reseller_id, "role": "reseller"})
    if not user:
        raise HTTPException(status_code=404, detail="المسوق غير موجود")
    updates = {}
    if req.name is not None: updates["name"] = req.name
    if req.password: updates["password"] = hash_password(req.password)
    if req.active is not None: updates["active"] = req.active
    if updates:
        await db.users.update_one({"id": reseller_id}, {"$set": updates})
    updated = await db.users.find_one({"id": reseller_id}, {"_id": 0})
    return user_doc_to_public(updated)

@api_router.post("/admin/resellers/{reseller_id}/balance", response_model=UserPublic)
async def adjust_balance(reseller_id: str, req: AdjustBalanceRequest, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": reseller_id, "role": "reseller"})
    if not user:
        raise HTTPException(status_code=404, detail="المسوق غير موجود")
    new_balance = float(user.get("balance", 0.0)) + float(req.amount)
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="لا يمكن أن يكون الرصيد سالباً")
    await db.users.update_one({"id": reseller_id}, {"$set": {"balance": new_balance}})
    await db.balance_logs.insert_one({
        "id": str(uuid.uuid4()), "reseller_id": reseller_id, "amount": float(req.amount),
        "type": "topup" if req.amount >= 0 else "deduct", "note": req.note or "",
        "by_admin": admin["id"], "created_at": now_iso(),
    })
    await manager.send_to_user(reseller_id, {"event": "balance_updated", "balance": new_balance})
    updated = await db.users.find_one({"id": reseller_id}, {"_id": 0})
    return user_doc_to_public(updated)

@api_router.delete("/admin/resellers/{reseller_id}")
async def delete_reseller(reseller_id: str, _: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": reseller_id, "role": "reseller"})
    if not user:
        raise HTTPException(status_code=404, detail="المسوق غير موجود")
    await db.users.delete_one({"id": reseller_id})
    return {"ok": True}

# ============== Admin: Packages ==============
@api_router.get("/admin/packages", response_model=List[Package])
async def admin_list_packages(_: dict = Depends(require_admin)):
    docs = await db.packages.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api_router.post("/admin/packages", response_model=Package)
async def create_package(req: PackageCreate, _: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()), "name": req.name, "type": req.type,
        "price": float(req.price), "active": req.active,
        "description": req.description or "", "created_at": now_iso(),
    }
    await db.packages.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.patch("/admin/packages/{package_id}", response_model=Package)
async def update_package(package_id: str, req: PackageUpdate, _: dict = Depends(require_admin)):
    pkg = await db.packages.find_one({"id": package_id})
    if not pkg:
        raise HTTPException(status_code=404, detail="الحزمة غير موجودة")
    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.packages.update_one({"id": package_id}, {"$set": updates})
    updated = await db.packages.find_one({"id": package_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/packages/{package_id}")
async def delete_package(package_id: str, _: dict = Depends(require_admin)):
    res = await db.packages.delete_one({"id": package_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="الحزمة غير موجودة")
    return {"ok": True}

# ============== Admin: Orders ==============
@api_router.get("/admin/orders", response_model=List[Order])
async def admin_list_orders(status_filter: Optional[str] = None, _: dict = Depends(require_admin)):
    q = {}
    if status_filter:
        q["status"] = status_filter
    docs = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api_router.post("/admin/orders/{order_id}/approve", response_model=Order)
async def approve_order(order_id: str, admin: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="الطلب ليس قيد الانتظار")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "success", "updated_at": now_iso(), "approved_by": admin["id"]}},
    )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await manager.send_to_user(order["reseller_id"], {"event": "order_updated", "order": updated})
    return updated

@api_router.post("/admin/orders/{order_id}/reject", response_model=Order)
async def reject_order(order_id: str, action: OrderAction, admin: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="الطلب ليس قيد الانتظار")
    reseller = await db.users.find_one({"id": order["reseller_id"]})
    if reseller:
        new_balance = float(reseller.get("balance", 0.0)) + float(order["price"])
        await db.users.update_one({"id": reseller["id"]}, {"$set": {"balance": new_balance}})
        await db.balance_logs.insert_one({
            "id": str(uuid.uuid4()), "reseller_id": reseller["id"],
            "amount": float(order["price"]), "type": "refund",
            "note": f"استرداد طلب #{order_id[:8]} - {action.reason or 'رفض من الإدارة'}",
            "by_admin": admin["id"], "created_at": now_iso(),
        })
        await manager.send_to_user(reseller["id"], {"event": "balance_updated", "balance": new_balance})
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "failed",
            "fail_reason": action.reason or "تم رفض الطلب من الإدارة",
            "updated_at": now_iso(), "rejected_by": admin["id"],
        }},
    )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await manager.send_to_user(order["reseller_id"], {"event": "order_updated", "order": updated})
    return updated
