# Planning Poker - Quick Start Guide

## 🚀 You're Ready to Test Locally!

The multiplayer planning poker app has been implemented with:
- ✅ Vercel KV integration (with in-memory fallback for local dev)
- ✅ Name entry dialog
- ✅ Room creation and joining
- ✅ Real-time polling (2-second updates)
- ✅ Player heartbeat system
- ✅ Auto-removal of inactive players

---

## 🧪 Testing Locally (Right Now!)

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   - Go to http://localhost:3000
   - You'll see a dialog to enter your name

3. **Test multiplayer:**
   - **Window 1**: Click "Create Room" → Enter your name → Note the Room ID
   - **Window 2**: Open http://localhost:3000 in another tab/window
   - **Window 2**: Click "Join Room" → Enter a different name → Enter the Room ID
   - **Both windows**: Vote, reveal, and reset to test functionality!

**Note:** Currently using in-memory storage, so rooms reset when you restart the server. This is perfect for testing!

---

## 📦 Deploy to Vercel (Production)

### Option 1: Using Vercel Dashboard (Easiest)

1. **Push to Git:**
   ```bash
   git add .
   git commit -m "Add multiplayer planning poker"
   git push
   ```

2. **Go to Vercel:**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Import Project"
   - Select your Git repository
   - Click "Deploy"

3. **Add Vercel KV:**
   - In your project dashboard, go to "Storage" tab
   - Click "Create Database" → Select "KV"
   - Name it (e.g., "planning-poker-kv")
   - Click "Create"
   - Vercel will automatically link it to your project

4. **Redeploy:**
   - Go to "Deployments" tab
   - Click "Redeploy" on the latest deployment
   - Your app is live with persistent storage!

### Option 2: Using Vercel CLI

```bash
# Install Vercel CLI (if not already)
npm i -g vercel

# Deploy
vercel

# After first deployment, create KV storage:
# 1. Go to vercel.com/dashboard
# 2. Navigate to your project
# 3. Go to Storage → Create KV Database
# 4. Link to your project

# Redeploy to use KV
vercel --prod
```

---

## 🎮 How to Use

### Creating a Room
1. Open the app
2. Enter your name
3. Click "Create Room"
4. Share the Room ID with your team

### Joining a Room
1. Open the app
2. Enter your name
3. Click "Join Room"
4. Enter the Room ID your teammate shared
5. Start voting!

### Voting Process
1. Everyone selects their estimate card
2. Once all players have voted, click "Reveal Votes"
3. Discuss the estimates
4. Click "Reset" to start a new round

---

## 🔧 Configuration

### Polling Settings
You can adjust the polling intervals in `components/planning-poker.tsx`:

```typescript
const POLL_INTERVAL = 2000 // Poll every 2 seconds
const HEARTBEAT_INTERVAL = 10000 // Heartbeat every 10 seconds
```

### Player Timeout
Inactive players are removed after 5 minutes. Adjust in `lib/redis.ts`:

```typescript
const PLAYER_TIMEOUT = 60 * 5; // 5 minutes
```

### Room Expiry
Rooms are automatically deleted after 24 hours. Adjust in `lib/redis.ts`:

```typescript
const ROOM_EXPIRY = 60 * 60 * 24; // 24 hours
```

---

## 🐛 Troubleshooting

### "Room not found" error
- The room may have expired (24 hours)
- Create a new room and share the new ID

### Players not updating
- Check browser console for errors
- Ensure multiple windows aren't using the same name
- Refresh the page

### Local development with real Vercel KV
If you want to use real Vercel KV locally:

```bash
# Pull environment variables from Vercel
vercel env pull .env.local

# Restart dev server
npm run dev
```

---

## 📊 Features

✅ **Multi-user support** - Unlimited players per room  
✅ **Real-time updates** - 2-3 second latency via polling  
✅ **Room-based sessions** - Each room has a unique ID  
✅ **Inactive player removal** - Auto-cleanup after 5 minutes  
✅ **Copy Room ID** - Easy sharing with team  
✅ **Vote reveal/hide** - Control when to show votes  
✅ **Statistics** - Average calculation and consensus detection  
✅ **Responsive design** - Works on mobile and desktop  

---

## 🎯 What's Next?

Optional enhancements you can add:
- Direct room URLs (`/room/[roomId]`)
- Toast notifications for events
- Timer for voting rounds
- Story description input
- Vote history tracking
- Export results to CSV

See `IMPLEMENTATION_PLAN.md` for more ideas!

---

## 💡 Tips

1. **Bookmark Room IDs** - Rooms last 24 hours, so you can reuse them
2. **Use descriptive names** - Helps identify who's who
3. **Test with team** - Try a real estimation session
4. **Mobile friendly** - Works great on phones and tablets

---

## 🎉 You're All Set!

Start the dev server and test it out:

```bash
npm run dev
```

Open http://localhost:3000 and enjoy your multiplayer planning poker! 🃏

