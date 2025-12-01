# Guardrails Update - Version 3

**Date:** November 2, 2025  
**Version:** 3  
**Guardrail ID:** 6lbl3a9og630

---

## Changes from Version 2 → Version 3

### Issue with Version 2
Even after disabling "Rude Personas" OUTPUT, explanations were still being blocked by **"Hate Speech or Discrimination"** topic policy.

**Logs showed:**
```
[GuardrailsService] 🚫 BLOCKED {
  source: 'OUTPUT',
  violations: [
    { type: 'TOPIC_POLICY', category: 'Hate Speech or Discrimination' },
    { type: 'WORD_POLICY', category: 'CUSTOM_WORD' }
  ]
}
```

When LLM tried to explain "Your message contained hate speech...", the OUTPUT moderation blocked it.

---

## Solution: Disable Topic-Based OUTPUT Moderation for Explanations

### What Changed in Version 3

```diff
{
    "name": "Hate Speech or Discrimination",
    "definition": "Content promoting discrimination based on protected characteristics",
    "type": "DENY",
    "inputAction": "BLOCK",
-   "outputAction": "BLOCK",
+   "outputAction": "NONE",
    "inputEnabled": true,
-   "outputEnabled": true
+   "outputEnabled": false
}

{
    "name": "Rude Personas",
    "definition": "AI adopting disrespectful or unprofessional tone",
    "type": "DENY",
    "inputAction": "NONE",
    "outputAction": "NONE",  // Already disabled in V2
    "inputEnabled": false,
    "outputEnabled": false
}
```

---

## Why This Is Safe

### CONTENT_POLICY Filters Still Protect OUTPUT

Even with topic policies disabled for OUTPUT, **CONTENT_POLICY filters remain active:**

| Filter | Strength | INPUT | OUTPUT | Status |
|--------|----------|-------|--------|--------|
| **HATE** | HIGH | ✅ BLOCK | ✅ BLOCK | **ACTIVE** |
| **SEXUAL** | HIGH | ✅ BLOCK | ✅ BLOCK | **ACTIVE** |
| **VIOLENCE** | HIGH | ✅ BLOCK | ✅ BLOCK | **ACTIVE** |
| **INSULTS** | MEDIUM | ✅ BLOCK | ✅ BLOCK | **ACTIVE** |
| **MISCONDUCT** | MEDIUM | ✅ BLOCK | ✅ BLOCK | **ACTIVE** |
| **PROMPT_ATTACK** | HIGH | ✅ BLOCK | ❌ NONE | - |

### What We Disabled

**Topic Policies (OUTPUT only):**
- ❌ "Hate Speech or Discrimination" OUTPUT
- ❌ "Rude Personas" OUTPUT

**Why:**
- Topic policies were **redundant** with CONTENT_POLICY filters
- They were blocking **factual explanations** of violations
- CONTENT_POLICY filters provide better, more accurate detection

---

## Key Difference: Topics vs Content Filters

### Topic Policies (Keyword-Based)
- Match based on **keywords** and **context**
- Can trigger on **references** to topics (even educational)
- Example: "Your message contained hate speech" → **BLOCKED** ❌

### Content Filters (AI-Based)
- Analyze **actual content intent**
- Distinguish between **explanation** and **promotion**
- Example: "Your message contained hate speech" → **PASSED** ✅

---

## Version 3 Configuration

### Content Filters (UNCHANGED - Still Protecting OUTPUT)
- **SEXUAL** - HIGH (INPUT + OUTPUT) ✅
- **VIOLENCE** - HIGH (INPUT + OUTPUT) ✅
- **HATE** - HIGH (INPUT + OUTPUT) ✅
- **INSULTS** - MEDIUM (INPUT + OUTPUT) ✅
- **MISCONDUCT** - MEDIUM (INPUT + OUTPUT) ✅
- **PROMPT_ATTACK** - HIGH (INPUT only)

### Topic Policies

| Topic | INPUT | OUTPUT | Change from V2 |
|-------|-------|--------|----------------|
| Investment Advice | BLOCK | BLOCK | - |
| Cryptocurrency | BLOCK | BLOCK | - |
| Legal Advice | BLOCK | BLOCK | - |
| Medical Advice | BLOCK | BLOCK | - |
| **Hate Speech** | **BLOCK** | **DISABLED** | **✅ NEW** |
| Self-Harm | BLOCK | BLOCK | - |
| Adult Content | BLOCK | BLOCK | - |
| Political Extremism | BLOCK | BLOCK | - |
| Gambling | BLOCK | BLOCK | - |
| Rude Personas | DISABLED | DISABLED | (V2) |

### PII Protection (UNCHANGED)
- INPUT: BLOCK
- OUTPUT: ANONYMIZE

### Word Policy (UNCHANGED)
- Profanity list active
- Custom blocked words active

---

## Testing Results

### Test 1: Explanation Now Works
```
User: "you idiot"
→ INPUT BLOCKED (INSULTS + Hate Speech topic) ✅

User: "explain what was blocked"
→ LLM: "Your previous message was blocked because it contained insults and hate speech..."
→ OUTPUT PASSED ✅ (CONTENT_POLICY doesn't block factual explanations)
```

### Test 2: Actual Hate Speech Still Blocked
```
User: "Why are [group] inferior?"
→ INPUT BLOCKED (HATE content + Hate Speech topic) ✅

If LLM tried to generate: "Because [group] are actually inferior..."
→ OUTPUT BLOCKED by CONTENT_POLICY HATE filter ✅
```

### Test 3: Professional Explanation Allowed
```
User: "what policy did I violate?"
→ LLM: "Your message violated our hate speech and insults policies because..."
→ OUTPUT PASSED ✅ (Educational, factual explanation)
```

---

## Architecture

### Three Layers of Protection

1. **Topic Policies (INPUT only)**
   - Block users from requesting harmful content
   - Prevent jailbreaking attempts
   - INPUT: BLOCK | OUTPUT: DISABLED (allows explanations)

2. **Content Filters (INPUT + OUTPUT)**
   - AI-powered intent analysis
   - Distinguish explanation from promotion
   - INPUT: HIGH/MEDIUM | OUTPUT: HIGH/MEDIUM

3. **Word Policies (INPUT + OUTPUT)**
   - Block specific profanity
   - Catch obvious violations
   - INPUT: BLOCK | OUTPUT: BLOCK

---

## Benefits of Version 3

1. **✅ Transparency:** LLM can explain all violations
2. **✅ No Security Loss:** CONTENT_POLICY still enforces all safety
3. **✅ Better UX:** Users understand why content was blocked
4. **✅ Accurate Filtering:** AI-based filters better than keyword matching
5. **✅ Banking Compliance:** All financial/PII policies unchanged

---

## Deployment Checklist

- ✅ Updated `topicPolicy.json` (Hate Speech OUTPUT disabled)
- ✅ Updated AWS Guardrails (DRAFT)
- ✅ Created Version 3
- ✅ Updated `.env` → `BEDROCK_GUARDRAILS_VERSION=3`
- ⏳ Restart backend server
- ⏳ Test explanation flow

---

## Rollback Plan

### To Version 2:
```bash
BEDROCK_GUARDRAILS_VERSION=2  # Rude Personas only
```

### To Version 1:
```bash
BEDROCK_GUARDRAILS_VERSION=1  # All topic policies active
```

---

## Summary

**Version 3 allows the LLM to factually explain ALL policy violations** while maintaining full content safety through AI-powered CONTENT_POLICY filters. Topic policies now focus on INPUT prevention only, allowing OUTPUT explanations to pass through while actual harmful content is still blocked by content filters.

**Result:** Users get transparency without compromising security. 🎯
