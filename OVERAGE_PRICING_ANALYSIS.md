# Model-Based Pricing Analysis

**Date:** October 22, 2025 (Updated to Model-Based Pricing)  
**Status:** ✅ Conceptual Model Approved | ⏳ Implementation Pending  
**Implementation:** Switching from comparison-based to model-response-based pricing

---

## 🎯 Current Tier Structure (MODEL-BASED PRICING)

| Tier                     | Daily Model Responses | Max Models/Comparison | Monthly Price | Status                |
| ------------------------ | --------------------- | --------------------- | ------------- | --------------------- |
| **Anonymous (unregistered)** | 10                | 3                     | $0            | ✅ Active             |
| **Free (registered)**    | 20                    | 3                     | $0            | ✅ Active             |
| **Starter**              | 150                   | 6                     | TBD           | ⏳ Pricing TBD        |
| **Pro**                  | 450                   | 9                     | TBD           | ⏳ Pricing TBD        |

**Key Changes:**
- ✅ **Model-based limits:** Users are limited by individual model responses, not comparisons
- ✅ **Tiered model access:** Higher tiers can compare more models simultaneously (3/3/6/9)
- ✅ **Registration incentive:** Registered free users get 2x the capacity of unregistered users
- ✅ **Fair pricing:** Users pay for what they actually use
- ✅ **Clear upgrade path:** More models + more daily capacity at each tier
- ⏳ **Pricing pending:** Subscription and overage pricing to be determined

**Rationale for Model-Based Pricing:**

The comparison-based model created unfair pricing tiers where:
- A user comparing 1 model paid the same as someone comparing 6-9 models
- Inconsistent markup (68% to 1500%) depending on usage patterns
- Users were incentivized to always max out their model selection
- Complex user experience with two separate limits to track

The model-based approach:
- ✅ Users pay proportionally to actual AI usage
- ✅ Fair and transparent pricing aligned with costs
- ✅ Simpler to understand: "X model responses per day"
- ✅ Encourages efficient usage patterns
- ✅ Industry-standard approach (similar to token-based pricing)

---

## 💰 Cost Analysis (Model-Based)

### Base Cost Structure:

| Metric                    | Value    | Notes                           |
| ------------------------- | -------- | ------------------------------- |
| **Cost per model call**   | $0.0166  | OpenRouter unified API cost     |
| **Target profit margin**  | 200%     | Industry-standard for SaaS      |
| **Proposed overage price**| $0.05    | Per individual model response   |

### Tier Calculations (Based on Average Usage Patterns):

**Anonymous (Unregistered) Users:**
- 10 model responses/day with 3 models max = ~3 comparisons with 3 models
- Monthly cost to us: 10 × 30 × $0.0166 = $4.98/month
- Revenue: $0 (free tier)
- Purpose: Allow trial without registration barrier
- Limitation: 3 models max encourages registration for same limit with 2x capacity

**Free (Registered) Users:**
- 20 model responses/day with 3 models max = ~6 comparisons with 3 models
- Monthly cost to us: 20 × 30 × $0.0166 = $9.96/month
- Revenue: $0 (free tier)
- Business model: Conversion funnel to paid tiers (2x capacity incentivizes registration)
- Limitation: Still 3 models max; upgrading unlocks more models per comparison

**Starter Tier (Pricing TBD):**
- 150 model responses/day with 6 models max = ~25 comparisons with 6 models average
- Monthly cost to us: 150 × 30 × $0.0166 = $74.70/month
- Requires pricing to achieve target margins
- Benefit: 2x model capacity (3 → 6) + 7.5x daily responses (20 → 150)

**Pro Tier (Pricing TBD):**
- 450 model responses/day with 9 models max = ~50 comparisons with 9 models average  
- Monthly cost to us: 450 × 30 × $0.0166 = $224.10/month
- Requires pricing to achieve target margins
- Benefit: 3x model capacity (3 → 9) + 22.5x daily responses (20 → 450)

---

## 📊 Advantages Over Comparison-Based Pricing

### 1. **Fair Cost Alignment**

**Old Model (Comparison-Based):**
- Starter overage: $0.20 per comparison (covers up to 6 models)
  - 1 model used: 1200% markup ($0.20 vs $0.0166 cost)
  - 6 models used: 100% markup ($0.20 vs $0.10 cost)
- Pro overage: $0.25 per comparison (covers up to 9 models)
  - 1 model used: 1500% markup ($0.25 vs $0.0166 cost)
  - 9 models used: 68% markup ($0.25 vs $0.149 cost)

**New Model (Model-Based):**
- Every model response: $0.05 per model
  - Consistent 200% markup ($0.05 vs $0.0166 cost)
  - Fair regardless of usage pattern
  - Predictable profitability

### 2. **Better User Experience**

**Comparison-Based Issues:**
- Users must understand two separate limits (comparisons AND models per comparison)
- Different model limits per tier create confusion
- Incentivizes wasteful behavior (always selecting max models)

**Model-Based Benefits:**
- ✅ Single, simple metric: "model responses remaining"
- ✅ All tiers have same capability (9 models max)
- ✅ Users encouraged to use only what they need
- ✅ Clear value proposition: "pay per AI response"

### 3. **Flexible Usage Patterns**

Users can optimize their usage:
- Quick test with 1 model: 1 model response used
- Compare 3 top choices: 3 model responses used
- Comprehensive analysis with 9 models: 9 model responses used
- Natural scaling based on task complexity

### 4. **Simplified Tier Differentiation**

| Feature                  | Free | Starter | Pro  |
| ------------------------ | ---- | ------- | ---- |
| Daily model responses    | 30   | 150     | 450  |
| Models per comparison    | 9    | 9       | 9    |
| Overage allowed          | ❌   | ✅      | ✅   |
| Overage price            | N/A  | TBD     | TBD  |

All tiers have the same **capabilities**, just different **capacity**.

---

## 🎯 Implementation Strategy

### Phase 1: Backend Updates (Current)

- [x] Update `SUBSCRIPTION_CONFIG` in `backend/app/rate_limiting.py`
  - Change `daily_limit` from comparisons to model responses (30/150/450)
  - Set `model_limit` to 9 for all tiers
  - Update overage configuration (pricing TBD)

- [x] Update rate limiting logic
  - Track model responses instead of comparisons
  - Increment usage by number of models in each request
  - Update overage tracking for model-based billing

- [x] Update database models
  - `daily_usage_count` now tracks model responses
  - `monthly_overage_count` tracks overage model responses
  - Clear field naming in documentation

- [x] Update API endpoints
  - `/compare` increments usage by number of models used
  - Rate limit enforcement based on model response count
  - Error messages reflect model-based limits

### Phase 2: Frontend Updates (Current)

- [x] Update UI terminology
  - Change "comparisons" to "model responses" throughout
  - Update usage displays in UserMenu
  - Revise upgrade modal messaging

- [x] Update limit enforcement
  - Remove tier-specific model limit validation
  - Enforce uniform 9-model maximum
  - Update error messages

- [x] Update pricing displays
  - Remove specific pricing (TBD status)
  - Focus on capability differences
  - Emphasize model response limits

### Phase 3: Pricing Determination (Future)

Once pricing is established:
- Update subscription prices (Starter/Pro monthly rates)
- Set overage price per model response
- Implement payment gateway integration
- Update documentation with final pricing

---

## 🔍 Example User Scenarios

### Scenario 1: Anonymous User (Unregistered)

**Usage Pattern:**
- Makes 3 comparisons/day
- Uses average 3 models per comparison
- Total: 9 model responses/day

**Result:**
- Stays within anonymous limit (10/day) ✅
- Encouraged to register for 2x capacity
- Good for quick trials without commitment

### Scenario 2: Light User on Free Tier (Registered)

**Usage Pattern:**
- Makes 6 comparisons/day
- Uses average 3 models per comparison
- Total: 18 model responses/day

**Result:**
- Stays within free registered tier (20/day) ✅
- 2x more capacity than anonymous users
- No need to upgrade
- Perfect match for casual users

### Scenario 3: Moderate User on Starter Tier

**Usage Pattern:**
- Makes 25 comparisons/day
- Uses average 6 models per comparison
- Total: 150 model responses/day

**Result:**
- Stays within Starter tier limit ✅
- Equivalent to old "25 comparisons/day" user
- Fair capacity allocation

### Scenario 4: Power User on Pro Tier

**Usage Pattern:**
- Makes 50 comparisons/day
- Uses average 9 models per comparison
- Total: 450 model responses/day

**Result:**
- Stays within Pro tier limit ✅
- Equivalent to old "50 comparisons/day" user
- Maximum capacity for heavy users

### Scenario 5: Efficient User (NEW - Enabled by Model-Based)

**Usage Pattern:**
- Makes 50 comparisons/day on Starter tier
- Uses average 3 models per comparison (focused testing)
- Total: 150 model responses/day

**Result:**
- Stays within Starter tier limit ✅
- Gets MORE comparisons by using fewer models (within 6 max)
- Can do 25 comparisons with 6 models OR 50 with 3 models
- Encourages efficient usage patterns
- **This flexibility wasn't possible with comparison-based limits!**

### Scenario 6: Variable User (NEW - Enabled by Model-Based)

**Usage Pattern:**
- Makes 30 comparisons/day on Starter tier
- Some with 1 model (quick tests): 10 comparisons × 1 = 10 responses
- Some with 3 models (focused): 10 comparisons × 3 = 30 responses  
- Some with 6 models (deeper analysis): 10 comparisons × 6 = 60 responses
- Total: 100 model responses/day

**Result:**
- Stays within Starter tier (150 limit) ✅
- Flexible usage based on needs (up to 6 models max)
- Natural optimization incentive
- Has 50 responses remaining for more comparisons
- **Fair pricing for actual usage!**

---

## 📈 Profitability Analysis (Conceptual)

### Cost Structure (Known):

- Cost per model response: $0.0166
- Target overage markup: 200% (industry standard)
- Proposed overage price: $0.05/model response

### Example Heavy User Analysis:

**Heavy User on Pro Tier:**
- Daily usage: 450 model responses (at limit)
- Monthly usage: 450 × 30 = 13,500 model responses
- Cost to us: 13,500 × $0.0166 = $224.10
- Revenue: Pro tier subscription price (TBD)
- Profit: Revenue - $224.10

**Heavy User with Overages:**
- Daily usage: 600 model responses (150 overage)
- Monthly usage: 450 × 30 = 13,500 included + 150 × 30 = 4,500 overage
- Total: 18,000 model responses
- Cost to us: 18,000 × $0.0166 = $298.80
- Revenue: Pro subscription + (4,500 × $0.05) = Pro subscription + $225
- Overage profit: $225 - ($298.80 - $224.10) = $225 - $74.70 = **$150.30**
- **Excellent profitability with 200% margin maintained ✅**

---

## 🌐 OpenRouter Infrastructure (2025)

**Infrastructure Stability:**

- OpenRouter secured $40M Series A (June 2025) from a16z & Menlo Ventures
- 1M+ developers using the platform
- 99.9%+ uptime SLA
- Enterprise-grade reliability

**Cost Predictability:**

- Stable $0.0166 per model call
- No expected price changes given recent funding
- Unified API simplifies multi-model management
- Our model-based pricing scales naturally with their cost structure

---

## 📊 Migration from Comparison-Based Pricing

### Backwards Compatibility:

For existing users during transition:
- Current `daily_usage_count` values will be recalibrated
- Users grandfathered at equivalent capacity
- Clear communication about changes
- Opt-in to new system or maintain legacy limits (short term)

### Translation Table:

| Old Tier    | Old Limit            | New Equivalent           | Notes                       |
| ----------- | -------------------- | ------------------------ | --------------------------- |
| Anonymous   | 5 comparisons        | 10 model responses       | Based on 2 models avg       |
| Free        | 10 comparisons       | 20 model responses       | Based on 2 models avg       |
| Starter     | 25 comparisons       | 150 model responses      | Based on 6 models avg       |
| Pro         | 50 comparisons       | 450 model responses      | Based on 9 models avg       |

**Note:** The new limits are more conservative for free tiers to encourage upgrades while still providing meaningful trial capacity.

### User Communication:

**Key Messages:**
1. ✅ "More flexibility - use models efficiently to get more comparisons"
2. ✅ "Fairer pricing - pay only for what you use"
3. ✅ "All tiers now support up to 9 models per comparison"
4. ✅ "Same capacity for typical usage patterns"
5. ✅ "More transparency in billing"

---

## 🚀 Implementation Status

### ✅ Completed:

- [x] Conceptual model approved
- [x] Cost analysis completed
- [x] Advantages documented
- [x] Migration strategy defined

### ⏳ In Progress:

- [ ] Backend implementation (rate_limiting.py)
- [ ] Frontend updates (UserMenu, App.tsx)
- [ ] Documentation updates (README, RATE_LIMITING_IMPLEMENTATION.md)
- [ ] Testing and validation

### 🔜 Future:

- [ ] Pricing finalization (subscription rates and overage pricing)
- [ ] Payment gateway integration
- [ ] User communication campaign
- [ ] Production deployment

---

## 💡 Key Takeaways

**Why Model-Based Pricing is Superior:**

1. ✅ **Fair:** Users pay proportionally to actual usage
2. ✅ **Simple:** One metric to understand (model responses)
3. ✅ **Flexible:** Optimize usage based on needs
4. ✅ **Profitable:** Consistent 200% markup on all usage
5. ✅ **Scalable:** Aligns perfectly with our cost structure
6. ✅ **Industry-standard:** Similar to token-based pricing models
7. ✅ **User-friendly:** Encourages efficient behavior
8. ✅ **Transparent:** Clear value proposition

**What's Different:**

| Aspect                  | Old (Comparison)      | New (Model-Based)     |
| ----------------------- | --------------------- | --------------------- |
| Primary limit           | Comparisons per day   | Model responses/day   |
| Models per comparison   | 3/6/9 (tier-based)    | 9 (all tiers)         |
| Overage pricing         | Per comparison        | Per model response    |
| Cost fairness           | Variable (68-1500%)   | Consistent (200%)     |
| User experience         | Complex (2 limits)    | Simple (1 limit)      |
| Usage incentive         | Max out models        | Use efficiently       |

---

**Document Version:** 3.0 (Model-Based Pricing)  
**Last Updated:** October 22, 2025  
**Status:** Implementation in progress, pricing TBD

**Related Documents:**
- `RATE_LIMITING_IMPLEMENTATION.md` - Technical implementation details
- `backend/app/rate_limiting.py` - Rate limiting configuration
- `README.md` - Project overview and quick reference
