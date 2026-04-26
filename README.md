# 🧠 Smart Daily Assistant Agent

A simple but powerful **agentic AI assistant** that helps users organize tasks, prioritize them, and generate actionable daily plans.

This project demonstrates **AI agent design, secure API integration, and multi-platform deployment** (Web + Telegram).

---

## 🚀 Live Demo

| Platform | Link |
|----------|------|
| 🌐 Web App (Vercel) | **[https://smart-daily-assistant.vercel.app](https://smart-daily-assistant.vercel.app)** |
| 🤖 Telegram Bot | **[@SmartDailyAssistantBot](https://t.me/SmartDailyAssistantBot)** |
| 📦 GitHub Repo | **[https://github.com/agumir/smart-daily-assistant](https://github.com/agumir/smart-daily-assistant)** |

---

## 🎯 Project Goal

The goal of this project is to build a **minimal but functional AI agent** that:

- ✅ Understands user intent
- ✅ Breaks down tasks into smaller steps
- ✅ Prioritizes based on urgency and importance
- ✅ Generates a clear action plan
- ✅ Asks follow-up questions when needed

---

## 🧠 How the Agent Works

The assistant uses a **phase-based prompt design** to simulate agentic reasoning:

### 🔹 Phase 1: Understanding the User

- Extracts user goals, tasks, and constraints
- Detects missing information (deadlines, priorities, specifics)
- Picks up on emotional cues (stress, excitement, overwhelm)

### 🔹 Phase 2: Task Decomposition

- Breaks complex goals into actionable steps (1-2 hours max)
- Adds estimated time for each task
- Converts abstract goals into concrete actions

### 🔹 Phase 3: Prioritization with Feeling

Classifies tasks into:

| Priority | Criteria | Emoji |
|----------|----------|-------|
| **Critical** | Due today/tomorrow, high consequence | 🔴 |
| **High** | Due this week, important deadline | 🟠 |
| **Medium** | Important but flexible | 🟡 |
| **Low** | Optional, no rush | 🟢 |
| **Overdue** | Past deadline | ⭐ |

### 🔹 Phase 4: Action Planning

Organizes tasks into time-based execution:

- ☀️ **Today:** Critical/urgent tasks (max 3-5)
- 🌙 **Next:** Tomorrow/this week tasks
- 🗓️ **Later:** Long-term/optional tasks
- ✨ **Quick Win:** Fastest task to build momentum

### 🔹 Phase 5: Adaptive Behavior

- Asks ONE focused follow-up question if info missing
- Balances multiple goals logically
- Celebrates task completions 🎉
- Gently redirects off-topic questions

---

## 🏗️ Architecture

```ascii
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │   Web UI     │───▶│  API Routes  │───▶│   AI Agent    │  │
│  │  (Next.js)   │    │  (Serverless)│    │  (Shared Logic│  │
│  └──────────────┘    └──────┬───────┘    └───────┬───────┘  │
│                             │                    │          │
│                      ┌──────▼───────┐    ┌───────▼───────┐  │
│                      │  Telegram    │    │  Gemini API   │  │
│                      │  Webhook     │    │  (AI Model)   │  │
│                      └──────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Telegram Bot    │
                    │   @SmartAssistant │
                    └───────────────────┘