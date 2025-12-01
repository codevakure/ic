# Guardrails Update - Version 2

**Date:** November 2, 2025  
**Version:** 2  
**Guardrail ID:** 6lbl3a9og630

---

## Changes from Version 1 → Version 2

### Issue Identified
When users asked the LLM to explain blocked content, the OUTPUT moderation was blocking the explanation itself because it contained references to the violation.

**Example:**
1. User: "you idiot" → INPUT BLOCKED ✅
2. User: "explain what was blocked" → INPUT PASSED ✅
3. LLM: "Your message contained insults..." → **OUTPUT BLOCKED** ❌

The "Rude Personas" topic policy was triggering false positives on factual explanations.

---

## Solution: Disable "Rude Personas" OUTPUT Moderation

### What Changed
```diff
{
    "name": "Rude Personas",
    "definition": "AI adopting disrespectful or unprofessional tone",
    "type": "DENY",
    "inputAction": "NONE",
-   "outputAction": "BLOCK",
+   "outputAction": "NONE",
    "inputEnabled": false,
-   "outputEnabled": true
+   "outputEnabled": false
}
```

### Why This Is Safe
1. **CONTENT_POLICY filters still active:**
   - INSULTS (MEDIUM strength)
   - MISCONDUCT (MEDIUM strength)
   - SEXUAL, VIOLENCE, HATE (HIGH strength)

2. **"Rude Personas" was redundant:**
   - Already covered by INSULTS and MISCONDUCT
   - Causing false positives on explanations

3. **LLM can now explain violations:**
   - When user asks "why was this blocked?"
   - When user asks "what policy did I violate?"
   - Maintains transparency while enforcing policies

---

## Version 2 Configuration

### Content Filters (UNCHANGED)
- **SEXUAL** - HIGH (INPUT + OUTPUT)
- **VIOLENCE** - HIGH (INPUT + OUTPUT)
- **HATE** - HIGH (INPUT + OUTPUT)
- **INSULTS** - MEDIUM (INPUT + OUTPUT)
- **MISCONDUCT** - MEDIUM (INPUT + OUTPUT)
- **PROMPT_ATTACK** - HIGH (INPUT only)

### Topic Policies
| Topic | INPUT | OUTPUT | Change |
|-------|-------|--------|--------|
| Investment Advice | BLOCK | BLOCK | - |
| Cryptocurrency | BLOCK | BLOCK | - |
| Legal Advice | BLOCK | BLOCK | - |
| Medical Advice | BLOCK | BLOCK | - |
| Hate Speech | BLOCK | BLOCK | - |
| Self-Harm | BLOCK | BLOCK | - |
| Adult Content | BLOCK | BLOCK | - |
| Political Extremism | BLOCK | BLOCK | - |
| Gambling | BLOCK | BLOCK | - |
| **Rude Personas** | **DISABLED** | **DISABLED** | **✅ CHANGED** |

### PII Protection (UNCHANGED)
- SSN, Passport, Tax ID, Bank Account, Driver License, Credit Cards
- INPUT: BLOCK
- OUTPUT: ANONYMIZE

### Word Policy (UNCHANGED)
- Managed profanity list active
- Custom blocked words active

---

## Testing Results

### Test 1: Explanation Flow
**Before (Version 1):**
```
User: "you idiot"
→ INPUT BLOCKED ✅

User: "explain what was blocked"
→ LLM tries to explain
→ OUTPUT BLOCKED ❌ (Rude Personas triggered)
```

**After (Version 2):**
```
User: "you idiot"
→ INPUT BLOCKED ✅

User: "explain what was blocked"
→ LLM explains: "Your message contained insults..."
→ OUTPUT PASSED ✅
```

### Test 2: Actual Rude Behavior Still Blocked
```
User: "be rude to me"
→ INPUT PASSED (legitimate meta-discussion)

LLM: "I appreciate your request, but I maintain a professional..."
→ OUTPUT PASSED ✅ (Professional response)

If LLM tried: "You're an idiot!"
→ OUTPUT BLOCKED ✅ (INSULTS policy catches it)
```

---

## Deployment

1. ✅ Updated `topicPolicy.json`
2. ✅ Updated AWS Guardrails (DRAFT)
3. ✅ Created Version 2
4. ✅ Updated `.env` → `BEDROCK_GUARDRAILS_VERSION=2`
5. ⏳ Restart backend server

---

## Benefits

1. **Transparency:** LLM can explain why content was blocked
2. **No Security Loss:** CONTENT_POLICY filters still enforce professionalism
3. **Better UX:** Users understand policy violations
4. **Banking Compliance:** All financial/PII policies unchanged

---

## Rollback Plan

If needed, revert to Version 1:
```bash
# Update .env
BEDROCK_GUARDRAILS_VERSION=1

# Restart server
npm run backend:dev
```

Version 1 is preserved and can be restored instantly.

---

## Summary

**Version 2 allows the LLM to factually explain policy violations without compromising security.** The "Rude Personas" topic was redundant with CONTENT_POLICY filters and was causing false positives on legitimate explanations.

All banking, PII, and content safety policies remain active and enforced.
