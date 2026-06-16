# Real-Time Driver Allocation System

A ride-hailing platform backend that connects riders with nearby drivers. The system handles multiple drivers trying to accept the same ride at the same time without conflicts.

## What This System Does

When a rider requests a ride:
1. System finds nearby available drivers using location
2. Notifies multiple drivers at the same time
3. First driver to accept gets the ride
4. Other drivers get rejected automatically
5. If no driver accepts, system retries with different drivers
6. After 3 attempts, ride times out

## Technology Stack

- **NestJS** - Backend framework
- **PostgreSQL** - Database for storing rides, drivers, customers
- **Redis** - For finding nearby drivers and handling concurrent requests
- **Sequelize** - Database queries
- **TypeScript** - Programming language

---

## Setup Instructions

### Prerequisites

Make sure you have these installed:
- Node.js (v18 or higher)
- PostgreSQL (local or remote)
- Redis (cloud)
- npm

### Step 1: Clone the Repository

```bash
git clone <your-github-repo-url>
cd Real-Time-Driver-Allocation-System
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Setup Environment Variables

Create a `.env` file in the root folder:

```env
PORT=3000

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=real_time_driver_allocation_system
DB_USER=postgres
DB_PASSWORD=your_password

# Redis Connection
REDIS_URL=redis://your-redis-url
```

### Step 4: Create PostgreSQL Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE real_time_driver_allocation_system;
```

The tables will be created automatically when you start the application.

### Step 5: Start the Application

```bash
# Development mode (auto-restart on file changes)
npm run start:dev

```

The server will start on `http://localhost:3000`

---

## System Design Overview

### Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────┐
│           NestJS Application                │
├─────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐    │
│  │ Controllers  │  │   Services       │    │
│  │ (API Layer)  │→ │ (Business Logic) │    │
│  └──────────────┘  └─────────┬────────┘    │
│                              │              │
│         ┌────────────────────┼─────────┐   │
│         ↓                    ↓         ↓   │
│  ┌─────────────┐  ┌──────────────┐  ┌────┐│
│  │ PostgreSQL  │  │    Redis     │  │etc ││
│  │  (Storage)  │  │ (Geo+Locks)  │  └────┘│
│  └─────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

### Database Schema

**rides table:**
- Stores ride requests
- Status: REQUESTED → SEARCHING → ASSIGNED / TIMEOUT
- Tracks pickup/drop locations
- Counts retry attempts

**ride_driver_details table:**
- Tracks which drivers were notified for each ride
- Status: PENDING → ACCEPTED / EXPIRED
- Stores expiry time (30 seconds)

**drivers table:**
- Driver information (name, phone, vehicle)
- Status: ONLINE / OFFLINE / BUSY

**customers table:**
- Customer information

### Redis Usage

**1. Location Storage (GEOADD):**
```
Key: drivers:locations
Value: {driver_id: {lat, lng}}
```

**2. Available Drivers (SET):**
```
Key: driver:available
Value: Set of online driver IDs
```

**3. Ride Locks (STRING with NX):**
```
Key: ride:lock:{ride_id}
Value: {driver_id}
Expiry: 20 seconds
```

---

## Concurrency Handling Approach

### The Problem

Multiple drivers clicking "Accept" at the same time for the same ride. Without proper handling:
- Two drivers might get assigned to one ride
- Database might have inconsistent data
- Riders get confused

### The Solution: Redis Distributed Locks

**How it works:**

1. **Driver 1 accepts ride** → Redis tries to create lock
   ```
   SET ride:lock:123 driver1 EX 30 NX
   Result: OK (lock acquired)
   ```
   Driver 1 gets the ride

2. **Driver 2 accepts (same time)** → Redis tries to create lock
   ```
   SET ride:lock:123 driver2 EX 30 NX
   Result: null (lock already exists)
   ```
   Driver 2 gets error: "Ride already accepted"

3. **Driver 3, 4, 5 accept** → Same as Driver 2
   All rejected

### Code Implementation

**File:** `src/rides/rides.service.ts`

```typescript
async acceptRide(rideId: string, driverId: string) {
  // Try to acquire lock atomically
  const lock = await this.redisService.acquireRideLock(rideId, driverId);

  if (!lock) {
    // Lock already taken by someone
    const lockOwner = await this.redisService.getRideLockOwner(rideId);
    
    // Same driver trying again? (Idempotency)
    if (lockOwner === driverId) {
      return { success: true, message: 'Ride already assigned to you' };
    }
    
    // Different driver - reject
    throw new ConflictException('Ride already accepted by another driver');
  }

  // Only one driver reaches here
  // Update database
  await Ride.update({ driver_id: driverId, status: 'ASSIGNED' });
  await RideDriverDetails.update({ status: 'ACCEPTED' });
  
  return { success: true, message: 'Ride assigned successfully' };
}
```

**File:** `src/redis/redis.service.ts`

```typescript
async acquireRideLock(rideId: string, driverId: string) {
  // SET NX = Only set if key does NOT exist (atomic operation)
  // EX 30 = Expires in 30 seconds (prevents deadlock)
  return this.redis.set(`ride:lock:${rideId}`, driverId, 'EX', 30, 'NX');
}
```

### Why This Works

- **Atomic Operation**: Redis SET NX happens in one step, no gaps
- **First Come First Served**: First request to reach Redis wins
- **Auto Cleanup**: Lock expires after 30 seconds
- **No Deadlocks**: Even if driver crashes, lock expires
- **Idempotent**: Same driver retrying gets success message

### Testing Concurrency

**Manual Test:**

1. Create a ride:
   ```bash
   POST http://localhost:3000/rides
   Body: {
     "customerId": "uuid-here",
     "pickupLat": 40.7128,
     "pickupLng": -74.0060,
     "dropLat": 40.7589,
     "dropLng": -73.9851
   }
   ```
   Note the `ride_id` from response.

2. Open 5 terminal windows or Postman tabs

3. In each tab, send this request at the same time:
   ```bash
   POST http://localhost:3000/rides/{ride_id}/accept
   Body: {
     "driverId": "driver-1-uuid"  # Use different IDs
   }
   ```

4. **Expected Result:**
   - ONE driver: `{"success": true, "message": "Ride assigned successfully"}`
   - OTHER 4 drivers: `{"statusCode": 409, "message": "Ride already accepted by another driver"}`

---

## API Endpoints

### 1. Create Customer

```bash
POST /customers
Content-Type: application/json

{
  "name": "Dharesh M",
  "phone": "9876543210"
}
```

### 2. Create Driver

```bash
POST /drivers
Content-Type: application/json

{
  "name": "Manoj K",
  "phone": "9876543211",
  "vehicleNumber": "KA01AB1234"
}
```

### 3. Update Driver Location

```bash
POST /drivers/{driver_id}/location
Content-Type: application/json

{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

### 4. Mark Driver Online

```bash
PATCH /drivers/{driver_id}/status
Content-Type: application/json

{
  "status": "ONLINE"
}
```

### 5. Create Ride (Customer Requests Ride)

```bash
POST /rides
Content-Type: application/json

{
  "customerId": "customerId",
  "pickupLat": 40.7128,
  "pickupLng": -74.0060,
  "dropLat": 40.7589,
  "dropLng": -73.9851
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ride created successfully",
  "nearbyDrivers": ["driverId1", "driverId2"],
  "data": {
    "id": "rideId",
    "status": "SEARCHING"
  }
}
```

### 6. Accept Ride (Driver Accepts)

```bash
POST /rides/{ride_id}/accept
Content-Type: application/json

{
  "driverId": "driverId"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Ride assigned successfully"
}
```

**Failure Response (another driver already accepted):**
```json
{
  "statusCode": 409,
  "message": "Ride already accepted by another driver"
}
```

### 7. Process Expired Rides (Manual Retry)

```bash
POST /rides/process-expired
```

Note: This runs automatically every 20 seconds, but you can trigger manually.

---

## Assumptions and Trade-offs

### Assumptions

1. **Search Radius**: Fixed at 5km
   - Why: Simple and works for most cities
   - Trade-off: In rural areas, might need larger radius

2. **Driver Notification Count**: 5 drivers per attempt
   - Why: Balance between choice and response time
   - Trade-off: More drivers = slower responses

3. **Retry Attempts**: Maximum 3 attempts
   - Why: After 90 seconds (3 × 30s), customer likely canceled
   - Trade-off: Some rides might timeout unnecessarily

4. **Offer Expiry**: 20 seconds
   - Why: Quick response time needed
   - Trade-off: Drivers in meetings might miss

5. **Lock Expiry**: 30 seconds
   - Why: Prevents deadlocks if system crashes
   - Trade-off: Very slow networks might lose lock

6. **Auto-retry Timing**: 20 seconds after ride creation
   - Why: 20s for driver response + 5s buffer before 30s expiry
   - Trade-off: Not configurable per ride

### Trade-offs

#### 1. Redis vs Database for Locking

**Chose Redis:**
- ✅ Faster (in-memory)
- ✅ Atomic operations built-in
- ✅ Auto-expiry support
- ❌ Need separate Redis server
- ❌ Not persistent (if Redis crashes, locks lost)

**Alternative (Database locks):**
- ✅ No extra service needed
- ✅ Persistent
- ❌ Slower
- ❌ Can deadlock
- ❌ Complex to implement

---

## Project Structure

```
src/
├── customers/          # Customer management
│   ├── customers.controller.ts
│   ├── customers.service.ts
│   └── customers.module.ts
│
├── drivers/           # Driver management
│   ├── drivers.controller.ts
│   ├── drivers.service.ts
│   └── drivers.module.ts
│
├── rides/             # Ride allocation (core logic)
│   ├── rides.controller.ts
│   ├── rides.service.ts      # acceptRide() with locking
│   └── rides.module.ts
│
├── redis/             # Redis service
│   ├── redis.service.ts      # GEOSEARCH + Locks
│   └── redis.module.ts
│
├── database/          # Database connection
│   ├── database.ts
│   └── database.service.ts
│
├── models/            # Sequelize models
│   ├── customer.model.ts
│   ├── driver.model.ts
│   ├── ride.model.ts
│   └── ride_driver_details.model.ts
│
├── app.module.ts      # Root module
└── main.ts            # Application entry
```

---
## Database Tables

Tables are created automatically on first run.

**rides:**
- id (UUID)
- customer_id (UUID)
- driver_id (UUID, nullable)
- pickup_lat, pickup_lng
- drop_lat, drop_lng
- status (REQUESTED, SEARCHING, ASSIGNED, TIMEOUT)
- search_attempt (integer)
- requested_at, assigned_at

**ride_driver_details:**
- id (UUID)
- ride_id (UUID)
- driver_id (UUID)
- status (PENDING, ACCEPTED, EXPIRED)
- attempts (integer)
- offered_at, expiry_at

**drivers:**
- id (UUID)
- name, phone, vehicle_number
- status (ONLINE, OFFLINE, BUSY)

**customers:**
- id (UUID)
- name, phone

---

## License


## Author

Dharesh
