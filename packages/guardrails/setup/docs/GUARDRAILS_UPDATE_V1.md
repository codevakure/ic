# Guardrails Update - Banking-Optimized Configuration

**Date:** November 2, 2025  
**Guardrail ID:** 6lbl3a9og630  
**Version:** 1 (Published)  
**Region:** us-east-1

## Changes Applied

### 1. Content Policy (contentPolicy.json)
✅ **MISCONDUCT**: HIGH → **MEDIUM**
- **Reason:** Allow frustrated customer feedback ("I hate this app")
- **Impact:** Only block serious misconduct, not mild complaints

✅ **INSULTS**: HIGH → **MEDIUM**
- **Reason:** Customer service AI should handle mild frustration
- **Impact:** "This is stupid" = valid feedback, not blocked

✅ **KEPT at HIGH:** VIOLENCE, HATE, SEXUAL, PROMPT_ATTACK
- **Reason:** Legal liability, workplace safety, security

### 2. Topic Policy (topicPolicy.json)
✅ **Rude Personas**: inputAction BLOCK → **NONE**
- **Reason:** Allow upset customers to vent frustration
- **Impact:** Customers can be frustrated, AI stays professional
- **Note:** OUTPUT still blocked (AI won't be rude)

✅ **KEPT BLOCKED:** All other topics
- Investment Advice (SEC compliance)
- Legal Advice (unauthorized practice)
- Medical Advice (liability)
- Self-Harm (duty of care)
- Hate Speech, Adult Content, etc.

### 3. Sensitive Information Policy
✅ **NO CHANGES** - All PII protection maintained
- SSN, Credit Cards, Tax IDs remain BLOCKED (compliance)

## Expected Results

**Before (Version DRAFT):**
- ~70% block rate on test inputs
- Many legitimate customer inquiries blocked
- User frustration: "I hate this app" → BLOCKED

**After (Version 1):**
- ~30-40% block rate on legitimate threats only
- Customer feedback allowed
- Better customer service experience
- Full regulatory compliance maintained

## Testing Commands

```bash
# Test frustrated customer (should pass now)
"I hate this banking app"
"This is stupid, where's my balance?"

# Test legitimate banking questions (should pass)
"What's my account balance?"
"How do I transfer money?"
"Why was my card declined?"

# Test blocks (should still block)
"Should I invest in stocks?" → Investment Advice
"Give me legal advice" → Legal Advice
"My SSN is 123-45-6789" → PII Protection
```

## Rollback Instructions

If needed, revert to DRAFT version:

```bash
# Update .env
BEDROCK_GUARDRAILS_VERSION=DRAFT

# Or create Version 2 with stricter settings
aws bedrock create-guardrail-version --guardrail-identifier "6lbl3a9og630" --region us-east-1
```

## AWS CLI Commands Used

### Update Guardrails
```bash
aws bedrock update-guardrail \
  --guardrail-identifier "6lbl3a9og630" \
  --name "pleach-guardrails" \
  --description "Guardrails for LibreChat Chat application - Version 2 (Banking-Optimized)" \
  --region us-east-1 \
  --topic-policy-config file://topicPolicy.json \
  --content-policy-config file://contentPolicy.json \
  --word-policy-config file://wordPolicy.json \
  --sensitive-information-policy-config file://sensitiveInformationPolicy.json \
  --contextual-grounding-policy-config file://contentGroundingPolicy.json \
  --blocked-input-messaging "Your input contains terms or patterns that are restricted for security or compliance reasons. Try rephrasing your request without sensitive or prohibited content." \
  --blocked-outputs-messaging "Your input contains terms or patterns that are restricted for security or compliance reasons. Try rephrasing your request without sensitive or prohibited content."
```

### Publish Version
```bash
aws bedrock create-guardrail-version \
  --guardrail-identifier "6lbl3a9og630" \
  --region us-east-1 \
  --description "Banking-optimized guardrails: MISCONDUCT/INSULTS at MEDIUM, Rude Personas input removed"
```

## Environment Configuration

Updated in `.env`:
```properties
BEDROCK_GUARDRAILS_ENABLED=true
BEDROCK_GUARDRAILS_ID=6lbl3a9og630
BEDROCK_GUARDRAILS_VERSION=1  # Changed from DRAFT
BEDROCK_GUARDRAILS_TRACE=DISABLED
```

## Compliance Status

✅ **Maintained:**
- GLBA (PII Protection)
- PCI-DSS (Credit Card blocking)
- SEC Regulations (Investment Advice blocked)
- Legal Liability (No legal/medical advice)
- Workplace Safety (VIOLENCE, HATE, SEXUAL at HIGH)

✅ **Improved:**
- Customer service experience
- Frustrated customer handling
- Legitimate complaint processing
- Reduced false positives

## Next Steps

1. ✅ Guardrails updated to Version 1
2. ✅ Environment configured to use Version 1
3. 📋 **RESTART BACKEND** to apply changes
4. 🧪 **TEST THOROUGHLY** with sample prompts
5. 📊 **MONITOR** violation rates over 24-48 hours
6. 🔧 **ADJUST** if needed (create Version 2)

## Monitoring

Track these metrics:
- Block rate: Should drop from ~70% to ~30-40%
- False positives: Customer complaints no longer blocked
- True positives: Security/compliance blocks maintained
- User satisfaction: Fewer "Why was I blocked?" inquiries

---

**Status:** ✅ READY FOR TESTING  
**Action Required:** Restart backend with `npm run backend:dev`
