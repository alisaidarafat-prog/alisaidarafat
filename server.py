import os
from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timedelta

# إعداد تطبيق FastAPI
app = FastAPI(title="Telecom Reseller Distribution System")

# تفعيل الـ CORS لتسريع وتسهيل اتصال الواجهة بالسيرفر
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# الاتصال بقاعدة البيانات MongoDB Atlas
MONGO_DETAILS = os.getenv("MONGO_URL", "mongodb+srv://saidarafat:saidarafat7@cluster0.pbg4o.mongodb.net/telecom_db?retryWrites=True&w=majority")
client = AsyncIOMotorClient(MONGO_DETAILS)
db = client.get_default_database()

JWT_SECRET = os.getenv("JWT_SECRET", "SUPER_SECRET_KEY_123456789_ALISAIDARAFAT")
ALGORITHM = "HS256"

# دالات التشفير والتحقق الحديثة لتفادي أخطاء الـ 72 حرف (bcrypt)
def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode('utf-8')[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=7))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

def pydantic_user(user) -> dict:
    return {
        "_id": str(user["_id"]),
        "username": user["username"],
        "name": user["name"],
        "phone": user["phone"],
        "role": user["role"],
        "balance": user.get("balance", 0.0),
        "is_active": user.get("is_active", True)
    }

# نماذج البيانات الحديثة (Pydantic v2 Models)
class LoginModel(BaseModel):
    username: str
    password: str

class ResellerCreate(BaseModel):
    username: str
    password: str
    name: str
    phone: str
    balance: float = 0.0

class PackageCreate(BaseModel):
    name: str
    type: str
    category: str
    cost_price: float
    sale_price: float
    description: Optional[str] = ""

class OrderCreate(BaseModel):
    package_id: str
    target_number: str

class BalanceUpdate(BaseModel):
    amount: float
    note: Optional[str] = ""

class StatusUpdate(BaseModel):
    status: str

# مدير اتصالات البث المباشر WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# التحقق من صلاحيات وجلسات المستخدمين والـ Admin
async def get_current_user(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="توكن غير صالح")
        user = await db.users.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="المستخدم غير موجود")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="جلسة غير صالحة أو منتهية")

async def get_admin(token: str):
    user = await get_current_user(token)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح، الصلاحية للمسؤول فقط")
    return user

# إنشاء حساب الأدمن الافتراضي تلقائياً عند تشغيل السيرفر لأول مرة
@app.on_event("startup")
async def startup_db_client():
    admin = await db.users.find_one({"username": "alisaidarafat"})
    if not admin:
        await db.users.insert_one({
            "username": "alisaidarafat",
            "password": hash_password("alisaidarafat@7"),
            "name": "علي سيد عرفات",
            "phone": "+972597111277",
            "role": "admin",
            "balance": 1000000.0,
            "is_active": True
        })

# 1️⃣ مسارات تسجيل الدخول والمصادقة
@app.post("/api/auth/login")
async def login(data: LoginModel):
    user = await db.users.find_one({"username": data.username.strip()})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=400, detail="اسم المستخدم أو كلمة المرور غير صحيحة")
    
    token = create_access_token(data={"sub": user["username"]})
    return {"token": token, "user": pydantic_user(user)}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# 2️⃣ مسارات الإدارة والتحكم (الأدمن)
@app.post("/api/admin/resellers")
async def create_reseller(data: ResellerCreate, token: str = Depends(get_admin)):
    existing = await db.users.find_one({"username": data.username.strip()})
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم مسجل مسبقاً في النظام")
    
    reseller = {
        "username": data.username.strip(),
        "password": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "role": "reseller",
        "balance": data.balance,
        "is_active": True
    }
    result = await db.users.insert_one(reseller)
    return {"status": "success", "id": str(result.inserted_id)}

@app.get("/api/admin/resellers")
async def get_resellers(token: str = Depends(get_admin)):
    resellers = await db.users.find({"role": "reseller"}).to_list(1000)
    return [pydantic_user(r) for r in resellers]

@app.post("/api/admin/resellers/{r_id}/balance")
async def update_reseller_balance(r_id: str, data: BalanceUpdate, token: str = Depends(get_admin)):
    user = await db.users.find_one({"_id": ObjectId(r_id)})
    if not user:
        raise HTTPException(status_code=404, detail="الموزع غير موجود")
    
    new_balance = user.get("balance", 0.0) + data.amount
    await db.users.update_one({"_id": ObjectId(r_id)}, {"$set": {"balance": new_balance}})
    
    await db.transactions.insert_one({
        "reseller_id": r_id,
        "reseller_name": user["name"],
        "type": "deposit" if data.amount > 0 else "withdrawal",
        "details": f"شحن رصيد مباشر من الإدارة: {data.note}",
        "target": "-",
        "amount": abs(data.amount),
        "status": "completed",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    await manager.broadcast({"event": "order_update", "data": {"reseller_id": r_id}})
    return {"status": "success", "new_balance": new_balance}

@app.post("/api/admin/packages")
async def create_package(data: PackageCreate, token: str = Depends(get_admin)):
    # استخدام الطريقة الحديثة model_dump بدلاً من dict المتوافقة مع Pydantic v2
    package = data.model_dump()
    package["is_active"] = True
    result = await db.packages.insert_one(package)
    return {"status": "success", "id": str(result.inserted_id)}

@app.get("/api/admin/packages")
async def get_packages():
    pkgs = await db.packages.find().to_list(1000)
    for p in pkgs:
        p["_id"] = str(p["_id"])
    return pkgs

@app.get("/api/admin/stats")
async def get_stats(token: str = Depends(get_admin)):
    r_count = await db.users.count_documents({"role": "reseller"})
    p_count = await db.packages.count_documents({})
    
    pipeline = [
        {"$match": {"status": "completed", "type": "order"}},
        {"$group": {"_id": None, "total": {"$sum": "$profit"}}}
    ]
    cursor = db.transactions.aggregate(pipeline)
    result = await cursor.to_list(1)
    profit = result[0]["total"] if result else 0.0
    
    return {
        "resellers_count": r_count,
        "packages_count": p_count,
        "total_profit": profit
    }

# 3️⃣ مسارات الموزعين وتلقي طلبات الشحن والـ الحزم
@app.post("/api/reseller/order")
async def place_order(data: OrderCreate, token: str = Depends(get_current_user)):
    if token["role"] != "reseller":
        raise HTTPException(status_code=403, detail="غير مسموح")
    
    package = await db.packages.find_one({"_id": ObjectId(data.package_id)})
    if not package or not package.get("is_active", True):
        raise HTTPException(status_code=404, detail="الحزمة المطلوبة غير متوفرة حالياً")
    
    cost = package["sale_price"]
    if token.get("balance", 0.0) < cost:
        raise HTTPException(status_code=400, detail="رصيدك الحالي غير كافٍ لإتمام العملية")
    
    new_balance = token["balance"] - cost
    await db.users.update_one({"_id": token["_id"]}, {"$set": {"balance": new_balance}})
    
    profit = package["sale_price"] - package["cost_price"]
    
    order_tx = {
        "reseller_id": str(token["_id"]),
        "reseller_name": token["name"],
        "type": "order",
        "package_id": data.package_id,
        "details": package["name"],
        "target": data.target_number,
        "amount": cost,
        "profit": profit,
        "status": "pending",
        "timestamp": datetime.utcnow().isoformat()
    }
    await db.transactions.insert_one(order_tx)
    await manager.broadcast({"event": "new_order", "data": order_tx})
    
    return {"status": "success", "new_balance": new_balance}

@app.get("/api/transactions")
async def get_transactions(token: str = Depends(get_current_user)):
    if token["role"] == "admin":
        txs = await db.transactions.find().sort("timestamp", -1).to_list(1000)
    else:
        txs = await db.transactions.find({"reseller_id": str(token["_id"])}).sort("timestamp", -1).to_list(1000)
        
    for t in txs:
        t["_id"] = str(t["_id"])
    return txs

@app.post("/api/admin/transactions/{tx_id}/status")
async def change_transaction_status(tx_id: str, data: StatusUpdate, token: str = Depends(get_admin)):
    tx = await db.transactions.find_one({"_id": ObjectId(tx_id)})
    if not tx:
        raise HTTPException(status_code=404, detail="المعاملة غير موجودة")
        
    if tx["status"] != "pending":
        raise HTTPException(status_code=400, detail="تم تحديث حالة هذه العملية مسبقاً")
        
    await db.transactions.update_one({"_id": ObjectId(tx_id)}, {"$set": {"status": data.status}})
    
    # إعادة الرصيد للموزع تلقائياً فوراً إذا رفض الأدمن الطلب
    if data.status == "refunded" and tx["type"] == "order":
        reseller = await db.users.find_one({"_id": ObjectId(tx["reseller_id"])})
        if reseller:
            refunded_balance = reseller.get("balance", 0.0) + tx["amount"]
            await db.users.update_one({"_id": ObjectId(tx["reseller_id"])}, {"$set": {"balance": refunded_balance}})
            
    await manager.broadcast({"event": "status_updated", "data": {"tx_id": tx_id, "status": data.status, "reseller_id": tx["reseller_id"]}})
    return {"status": "success"}

@app.post("/api/admin/telegram-config")
async def config_telegram(data: dict, token: str = Depends(get_admin)):
    await db.config.update_one({"key": "telegram"}, {"$set": {"chat_id": data.get("chat_id")}}, upsert=True)
    return {"status": "success"}
