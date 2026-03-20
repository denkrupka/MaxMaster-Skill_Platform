#!/bin/bash
cd /data/.openclaw/workspace/projects/MaxMaster-Skill_Platform
git config user.email "piskel@nora.ai"
git config user.name "Пискель"
git pull origin feature/documents-module
git add -A
git commit -m "design: round 3 - Certificate redesign, all emojis removed from RFQ/Diary/Portal/Certificate" || echo "nothing to commit"
git push origin feature/documents-module
git log --oneline -1
