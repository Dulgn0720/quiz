# Quiz Pro — Product & Technical Spec

## Goal
A modern, real-time multiplayer quiz platform in the style of Kahoot / Quizizz / Blooket.
Fast, polished, simple to understand. Mobile-first. Production-quality code.

## Tech stack
- Monorepo (pnpm workspaces): apps/web, apps/api, packages/shared (shared TS types)
- Frontend: Vue 3 + TypeScript + Vite + Tailwind CSS + Pinia, smooth animations (e.g. @vueuse/motion or GSAP)
- Backend: NestJS + TypeScript, Socket.IO for real-time, PostgreSQL (Prisma), Redis for live game state & pub/sub
- docker-compose for local dev (postgres, redis, api, web)
- UI languages: Mongolian (default) and English (vue-i18n)

## Core concepts
- Quiz: a set of rounds. Round: a set of questions with its own settings.
- Room/Game: a live session of a quiz with a host and players.

## Features

### Rooms & joining
- Host creates a room → gets a 6-digit PIN, a share link and a QR code
- Friends join by just opening the link (or entering the PIN) and typing a nickname — no account required
- Lobby: live player list, avatars/emoji, host can kick players, lock the room, start the game
- Private rooms (link/PIN only) and public rooms (listed on a "Browse open rooms" page, anyone can join)
- Reconnect: a player who refreshes or loses connection rejoins with their score intact

### Quiz builder
- Create/edit quizzes with multiple rounds
- Per-round settings: name, time per question, points multiplier, question order shuffle, answer shuffle, round type (normal, speed round, double points, elimination)
- Question types: single choice, multiple choice, true/false, type-the-answer, ordering, image question
- Media: image per question
- Import/export quizzes as JSON and CSV
- Ready-made sample quizzes seeded in the database

### Gameplay
- Server-authoritative timer and scoring; correct answers never sent to clients before reveal
- Shuffle questions and answers per player (seeded, configurable)
- Scoring: base points + speed bonus + streak bonus, round multiplier
- After each question: correct answer reveal, answer distribution chart, live leaderboard with rank-change animation
- Between rounds: round summary screen
- End: animated podium (top 3), full results, per-player stats
- Host controls: pause, skip question, next, end game
- Sound effects and music (toggle on/off)

### Progression
- Optional accounts (email/password); guests can play without one
- XP and levels for registered users, badges/achievements, game history

### UX/UI
- Clean, bright, modern design, big tap targets, dark mode
- Separate optimized views: host screen (projector/big screen) and player screen (phone)
- Smooth transitions, countdowns, confetti on wins
- Accessible (keyboard, contrast)

## Quality
- Input validation, rate limiting on join, basic anti-cheat (server timing, one answer per question)
- Unit tests for scoring/shuffle logic, e2e test for a full game flow
- README with setup instructions

## Phases
1. Monorepo setup, docker-compose, DB schema, shared types
2. Quiz builder (CRUD, rounds, question types, import/export, seed data)
3. Real-time engine: rooms, lobby, join by link/PIN, gameplay, scoring, leaderboard
4. UI/UX polish, animations, sounds, i18n, dark mode
5. Accounts, XP/levels, badges, history, public room browser
6. Tests and README