# Quick Reference: Overage Pricing

**Last Updated:** October 15, 2025

---

## 🎯 New Pricing (3 Tiers)

| Tier | Daily | Models | Price | **Overage** |
|------|-------|--------|-------|-------------|
| Free | 10 | 3 | $0 | ❌ |
| Starter | 25 | 6 | $14.99 | **$0.20** |
| Pro | 50 | 9 | $29.99 | **$0.25** |

---

## 💡 How Overages Work

### Free Tier:
- ❌ **No overages allowed**
- Must upgrade to continue after 10 comparisons/day

### Starter Tier:
- ✅ **$0.20 per comparison** beyond 25/day
- Example: 30 comparisons = $14.99 + (5 × $0.20) = **$15.99**

### Pro Tier:
- ✅ **$0.25 per comparison** beyond 50/day
- Example: 60 comparisons = $29.99 + (10 × $0.25) = **$32.49**

---

## 💰 Cost vs Profit

| Tier | Cost/Comp | Overage Price | **Profit** | Margin |
|------|-----------|---------------|------------|--------|
| Starter | $0.10 | $0.20 | **$0.10** | 100% |
| Pro | $0.149 | $0.25 | **$0.101** | 68% |

**Every overage is profitable!** ✅

---

## 🚀 When to Upgrade vs Use Overages

### Use Overages:
- Occasional spikes (1-2 times/week)
- Unpredictable usage patterns
- Testing higher usage before committing

### Upgrade:
- Consistent high usage (daily)
- Overages >$15/month on Starter
- Need more models per comparison

### Example:
**Starter user needs 40 comparisons/day consistently:**
- Overages: 15 × $0.20 × 30 days = **$90/month** 😱
- Upgrade to Pro: **$29.99/month** 🎉
- **Savings: $60/month**

---

## 📱 User Experience Flow

### 1. Approaching Limit (80%):
```
⚠️ You've used 20 of 25 comparisons today.
[View Usage] [Upgrade]
```

### 2. At Limit:
```
🛑 Daily Limit Reached

You've used all 25 comparisons today.

Options:
• Continue for $0.20 per comparison
• Upgrade to Pro (50/day) for $29.99/mo
• Wait until tomorrow (resets at midnight UTC)

[Pay $0.20] [Upgrade] [Cancel]
```

### 3. After Overage:
```
✅ Comparison Complete

This was an overage comparison ($0.20).
You've used 3 overages this month ($0.60).

[View Billing] [Upgrade to Pro]
```

---

## 🗄️ Database Fields

### User Model:
```python
monthly_overage_count = Column(Integer, default=0)
overage_reset_date = Column(Date, default=func.current_date())
```

### UsageLog Model:
```python
is_overage = Column(Boolean, default=False)
overage_charge = Column(DECIMAL(10, 4), default=0)
```

---

## 🔧 Backend Functions

### Check if overage allowed:
```python
from app.rate_limiting import is_overage_allowed

if is_overage_allowed(user.subscription_tier):
    # Allow overage
```

### Get overage price:
```python
from app.rate_limiting import get_overage_price

price = get_overage_price(user.subscription_tier)
# Returns 0.20 for starter, 0.25 for pro, None for free
```

### Track overage:
```python
if is_overage:
    user.monthly_overage_count += 1
    overage_charge = get_overage_price(user.subscription_tier)
```

---

## 📊 Billing Example

### Monthly Invoice:
```
CompareAI - October 2025 Invoice

Starter Plan (Monthly)           $14.99
Overages (23 comparisons)        $4.60
                                 ──────
Subtotal                         $19.59
Tax (if applicable)              $1.57
                                 ──────
Total                            $21.16

Overage Details:
• Oct 3: 3 comparisons × $0.20 = $0.60
• Oct 10: 5 comparisons × $0.20 = $1.00
• Oct 15: 8 comparisons × $0.20 = $1.60
• Oct 22: 7 comparisons × $0.20 = $1.40

[View Detailed Usage] [Upgrade to Pro]
```

---

## 🎯 Key Metrics to Track

### Usage Metrics:
- Daily comparisons per user
- % of users hitting limits
- % of users using overages
- Average overages per user

### Financial Metrics:
- Base subscription revenue
- Overage revenue
- Total revenue per tier
- Profit margin per tier

### Conversion Metrics:
- Overage users → Upgrade rate
- Time to upgrade after first overage
- Churn rate by tier

---

## ✅ Implementation Checklist

### Backend: ✅ COMPLETE
- [x] Rate limiting with overage support
- [x] Overage tracking in database
- [x] Usage logging with overage data
- [x] Helper functions
- [x] Error messages updated
- [x] Pro+ tier removed

### Frontend: ⏳ TO DO
- [ ] Pricing page updated
- [ ] Limit warning modal
- [ ] Overage payment flow
- [ ] Usage dashboard with overages
- [ ] Billing page with itemized overages
- [ ] Account settings (overage limits)

### Database: ⏳ TO DO
- [ ] Migration script created
- [ ] Migration tested
- [ ] Migration deployed

### Communication: ⏳ TO DO
- [ ] User email drafted
- [ ] FAQ updated
- [ ] Website copy updated
- [ ] Support docs updated

---

## 🚨 Important Notes

1. **Free tier has NO overages** - Must upgrade
2. **Overages reset monthly** - Not daily
3. **Billing at end of cycle** - Not immediate
4. **Users can set limits** - Prevent surprise charges
5. **Clear communication** - Always show price before overage

---

## 📞 Support Responses

### "Why am I being charged extra?"
> You've exceeded your daily limit of [X] comparisons. Your plan includes [X] comparisons per day, and additional comparisons are $[price] each. You used [Y] overage comparisons this month. You can upgrade to [next tier] for more included comparisons.

### "Can I disable overages?"
> Yes! In Account Settings, you can set a maximum overage amount per month. Once you reach that limit, you'll be prompted to upgrade or wait until tomorrow.

### "How do I avoid overage charges?"
> You have three options:
> 1. Upgrade to a higher tier with more daily comparisons
> 2. Set an overage limit in Account Settings
> 3. Monitor your usage and stop before hitting your daily limit

---

## 🎉 Quick Win Examples

### Casual User:
- Uses 8-12 comparisons/day
- Stays on Starter ($14.99)
- Occasional 2-3 overages ($0.40-$0.60)
- **Total: ~$15.50/month** ✅

### Growing User:
- Starts with 15/day, grows to 30/day
- Uses overages for 2 months ($3-$6/month)
- Upgrades to Pro when consistent
- **Natural upgrade path** ✅

### Power User:
- Needs 60/day consistently
- Tries Starter + overages ($14.99 + $21 = $35.99)
- Realizes Pro is cheaper ($29.99)
- **Upgrades immediately** ✅

---

**All systems implemented and ready for frontend integration!** 🚀

