"""
Telecom Reseller Distribution System
FastAPI + MongoDB backend with JWT auth, WebSockets and Telegram notifications.
"""
from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import jose.jwt as jwt
import bcrypt
import motor.motor_asyncio
import httpx
import json
import os

app = FastAPI(title="Telecom Reseller Distribution System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration & Env Setup
MONGO_URL = "mongodb+srv://alisaidarafat_db_user:OvDxi0IlKNjTMBRI@cluster0.lywo4nm.mongodb.net/?appName=Cluster0"
DB_NAME = "telecom_db"
JWT_SECRET = "SuperSecretRandomKey2026ForSecureLoginTokens"
ALGORITHM = "HS256"
TELEGRAM_BOT_TOKEN = "8991513968:AAHx33xWvNIZCJogCuIYG-py_Kjb5GvHuoI"

# Native Bcrypt helpers to avoid passlib environment bugs
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
packages_col = db["packages"]
resellers_col = db["resellers"]
transactions_col = db["transactions"]
config_col = db["config"]

# In-memory session trackers
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id and user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except:
                pass

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.user_connections:
            payload = json.dumps(message)
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_text(payload)
                except:
                    pass

manager = ConnectionManager()

# Telegram Helper
async def send_telegram_notification(text: str):
    try:
        cfg = await config_col.find_one({"key": "telegram_settings"})
        if cfg and cfg.get("chat_id"):
            chat_id = cfg["chat_id"]
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            async with httpx.AsyncClient() as http_client:
                await http_client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
    except Exception as e:
        print(f"Telegram notification failed: {e}")

# Models
class LoginRequest(BaseModel):
    username: str
    password: str

class PackageModel(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    type: str  # 'jawwal' or 'ooredoo'
    category: str  # 'credit', 'bundle', 'points'
    cost_price: float
    sale_price: float
    description: Optional[str] = ""
    is_active: bool = True

class ResellerModel(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    username: str
    password: Optional[str] = None
    name: str
    phone: str
    balance: float = 0.0
    role: str = "reseller"
    is_active: bool = True

class BalanceAction(BaseModel):
    amount: float
    note: Optional[str] = ""

class OrderRequest(BaseModel):
    package_id: str
    target_number: str

# Seed Admin & Config
@app.on_event("startup")
async def startup_seed():
    admin = await resellers_col.find_one({"username": "alisaidarafat"})
    if not admin:
        await resellers_col.insert_one({
            "username": "alisaidarafat",
            "password": hash_password("alisaidarafat@7"),
            "name": "علي سعيد عرفات",
            "phone": "0597111277",
            "balance": 999999.0,
            "role": "admin",
            "is_active": True
        })
    cfg = await config_col.find_one({"key": "telegram_settings"})
    if not cfg:
        await config_col.insert_one({"key": "telegram_settings", "chat_id": ""})

# Auth Helpers
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

async def get_current_user(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await resellers_col.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if "_id" in user:
            user["_id"] = str(user["_id"])
        return user
    except:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# Routes
@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = await resellers_col.find_one({"username": req.username})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=400, detail="اسم المستخدم أو كلمة المرور خاطئة")
    token = create_access_token(data={"sub": user["username"]})
    if "_id" in user:
        user["_id"] = str(user["_id"])
    user.pop("password", None)
    return {"token": token, "user": user}

@app.get("/api/admin/stats")
async def get_stats(user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    p_count = await packages_col.count_documents({})
    r_count = await resellers_col.count_documents({"role": "reseller"})
    
    pipeline = [{"$match": {"status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$profit"}}}]
    cursor = transactions_col.aggregate(pipeline)
    profit_res = await cursor.to_list(length=1)
    total_profit = profit_res[0]["total"] if profit_res else 0.0

    return {"packages_count": p_count, "resellers_count": r_count, "total_profit": total_profit}

@app.get("/api/admin/packages")
async def get_packages():
    pkgs = await packages_col.find({}).to_list(length=500)
    for p in pkgs: p["_id"] = str(p["_id"])
    return pkgs

@app.post("/api/admin/packages")
async def create_package(pkg: PackageModel, user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    data = pkg.dict(exclude_none=True)
    res = await packages_col.insert_one(data)
    data["_id"] = str(res.inserted_id)
    return data

@app.patch("/api/admin/packages/{pkg_id}")
async def update_package(pkg_id: str, pkg: PackageModel, user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    from bson import ObjectId
    await packages_col.update_one({"_id": ObjectId(pkg_id)}, {"$set": pkg.dict(exclude_unset=True, exclude_none=True)})
    return {"status": "success"}

@app.delete("/api/admin/packages/{pkg_id}")
async def delete_package(pkg_id: str, user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    from bson import ObjectId
    await packages_col.delete_one({"_id": ObjectId(pkg_id)})
    return {"status": "success"}

@app.get("/api/admin/resellers")
async def get_resellers(user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    resellers = await resellers_col.find({"role": "reseller"}).to_list(length=500)
    for r in resellers:
        r["_id"] = str(r["_id"])
        r.pop("password", None)
    return resellers

@app.post("/api/admin/resellers")
async def create_reseller(reseller: ResellerModel, user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    data = reseller.dict()
    data["password"] = hash_password(data["password"] or "123456")
    try:
        res = await resellers_col.insert_one(data)
        data["_id"] = str(res.inserted_id)
        data.pop("password", None)
        return data
    except:
        raise HTTPException(status_code=400, detail="اسم المستخدم موجود بالفعل")

@app.post("/api/admin/resellers/{r_id}/balance")
async def manage_balance(r_id: str, action: BalanceAction, user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    from bson import ObjectId
    reseller = await resellers_col.find_one({"_id": ObjectId(r_id)})
    if not reseller: raise HTTPException(status_code=404)
    
    new_balance = reseller["balance"] + action.amount
    await resellers_col.update_one({"_id": ObjectId(r_id)}, {"$set": {"balance": new_balance}})
    
    await transactions_col.insert_one({
        "reseller_id": r_id,
        "reseller_name": reseller["name"],
        "type": "deposit" if action.amount > 0 else "withdrawal",
        "details": f"تعديل رصيد من قبل الإدارة: {action.note}",
        "amount": abs(action.amount),
        "target": reseller["phone"],
        "status": "completed",
        "profit": 0.0,
        "timestamp": datetime.utcnow().isoformat()
    })
    return {"status": "success", "new_balance": new_balance}

@app.post("/api/reseller/order")
async def place_order(req: OrderRequest, token: str):
    user = await get_current_user(token)
    from bson import ObjectId
    package = await packages_col.find_one({"_id": ObjectId(req.package_id)})
    if not package or not package["is_active"]:
        raise HTTPException(status_code=400, detail="الحزمة غير متوفرة حالياً")
    
    if user["balance"] < package["sale_price"]:
        raise HTTPException(status_code=400, detail="رصيدك غير كافٍ لإتمام العملية")
    
    # Deduct balance
    new_balance = user["balance"] - package["sale_price"]
    await resellers_col.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"balance": new_balance}})
    
    profit = package["sale_price"] - package["cost_price"]
    tx = {
        "reseller_id": user["_id"],
        "reseller_name": user["name"],
        "type": "order",
        "details": f"{package['name']} ({package['category']})",
        "amount": package["sale_price"],
        "target": req.target_number,
        "status": "pending",
        "profit": profit,
        "timestamp": datetime.utcnow().isoformat()
    }
    res = await transactions_col.insert_one(tx)
    tx["_id"] = str(res.inserted_id)
    
    # Notify Admin via Telegram & WebSocket
    await manager.broadcast({"event": "new_order", "data": tx})
    msg = f"🔔 <b>طلب جديد قيد الانتظار!</b>\n\n• الموزع: {user['name']}\n• العملية: {package['name']}\n• الرقم المستهدف: <code>{req.target_number}</code>\n• القيمة: {package['sale_price']} شيكل"
    await send_telegram_notification(msg)
    
    return {"status": "pending", "tx_id": tx["_id"], "new_balance": new_balance}

@app.get("/api/transactions")
async def get_transactions(token: str):
    user = await get_current_user(token)
    query = {} if user["role"] == "admin" else {"reseller_id": user["_id"]}
    txs = await transactions_col.find(query).sort("timestamp", -1).to_list(length=1000)
    for t in txs: t["_id"] = str(t["_id"])
    return txs

@app.post("/api/admin/transactions/{tx_id}/status")
async def update_tx_status(tx_id: str, payload: dict, user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    from bson import ObjectId
    new_status = payload.get("status")  # 'completed' or 'refunded'
    tx = await transactions_col.find_one({"_id": ObjectId(tx_id)})
    if not tx or tx["status"] != "pending":
        raise HTTPException(status_code=400, detail="الطلب ليس معلقاً أو غير موجود")
    
    await transactions_col.update_one({"_id": ObjectId(tx_id)}, {"$set": {"status": new_status}})
    tx["status"] = new_status
    
    if new_status == "refunded":
        # Refund balance to reseller
        reseller = await resellers_col.find_one({"_id": ObjectId(tx["reseller_id"])})
        if reseller:
            await resellers_col.update_one({"_id": ObjectId(tx["reseller_id"])}, {"$set": {"balance": reseller["balance"] + tx["amount"]}})
    
    await manager.broadcast({"event": "status_updated", "data": tx})
    await manager.send_to_user(tx["reseller_id"], {"event": "order_update", "data": tx})
    
    status_text = "✅ تم التنفيذ بنجاح" if new_status == "completed" else "❌ تم الرفض وإرجاع الرصيد"
    msg = f"📢 <b>تحديث حالة الطلب</b>\n\n• العملية: {tx['details']}\n• الرقم: {tx['target']}\n• الحالة الجديدة: <b>{status_text}</b>"
    await send_telegram_notification(msg)
    
    return {"status": "success"}

@app.post("/api/admin/telegram-config")
async def set_telegram_config(payload: dict, user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(status_code=403)
    chat_id = payload.get("chat_id", "").strip()
    await config_col.update_one({"key": "telegram_settings"}, {"$set": {"chat_id": chat_id}}, upsert=True)
    return {"status": "success"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    user_id = None
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            user = await resellers_col.find_one({"username": payload.get("sub")})
            if user: user_id = str(user["_id"])
        except:
            pass
    await manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
