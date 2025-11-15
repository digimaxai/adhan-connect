\# Adhan Connect — Developer Notes



\### 🕌 Project Overview

Adhan Connect is a cross-platform mobile app (Expo + Supabase) that connects users with nearby mosques and streams live Adhans (calls to prayer).  

It supports multiple user roles: Main Admin, Local Admin, Muezzin, and Public Users.



\### ⚙️ Tech Stack

\- \*\*Frontend:\*\* Expo (React Native + Expo Router)

\- \*\*Backend:\*\* Supabase (PostgreSQL + Auth + Storage)

\- \*\*Audio Streaming:\*\* HLS streams + fallback recordings

\- \*\*Upcoming integration:\*\* LiveKit (for real-time broadcasting)

\- \*\*Languages:\*\* TypeScript (Expo), SQL (Supabase policies)



\### ✅ Current Progress

\- \[x] Supabase connected and tested  

\- \[x] Live Adhan streaming functional  

\- \[x] Role-based tabs (Public / Muezzin / Admin) implemented  

\- \[x] Auth provider + Supabase session handling working  

\- \[ ] Auth screens (sign in / sign up) pending  

\- \[ ] RLS policies for muezzins/admins pending  

\- \[ ] Muezzin reminder \& broadcast workflow in progress  



\### 🧭 Next Steps

1\. Add full auth screens (`(auth)/sign-in.tsx`, `(auth)/sign-up.tsx`, `(auth)/\_layout.tsx`)

2\. Implement RLS for:

&nbsp;  - `muezzins`

&nbsp;  - `adhans`

&nbsp;  - `mosque\_admins`

3\. Build Muezzin countdown \& fallback logic

4\. Add Admin dashboard (web version)

5\. Later: integrate LiveKit for real live Adhans



\### 💡 Developer Commands

```bash

npx expo start        # run mobile app

npm run lint          # check code

npx expo prebuild     # (if you need native build)



