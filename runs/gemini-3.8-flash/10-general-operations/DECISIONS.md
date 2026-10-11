# Operating Decisions, Contradictions, and Ownership

This document records confirmed decisions, identifies unresolved contradictions and operational risks, and assigns key questions to specific stakeholders.

---

## 1. Confirmed Decisions

### 1.1 Customer Demo Scheduled for Thursday 16:00
- **Decision:** Schedule the live customer demo for **Thursday at 16:00–17:00**.
- **Rationale:** Product expressed a preference for Wednesday at 15:00. However, Wednesday 13:00–17:30 is an immovable unavailability block. INBOX notes confirm the customer is also available Thursday at 16:00. Selecting Thursday 16:00 satisfies the customer without violating working hour boundaries.

### 1.2 Demo Rehearsal Scheduled for Wednesday 10:00–11:30
- **Decision:** Hold the mandatory 90-minute demo rehearsal on **Wednesday from 10:00 to 11:30**.
- **Rationale:** Sam is required for the rehearsal. Sam is unavailable Tuesday and can only rehearse Wednesday 10:00–12:00. The Wednesday 10:00–11:30 slot fits within Wednesday's 09:30–13:00 working window.

### 1.3 Security Patch Review Front-Loaded to Monday (15:30–17:00)
- **Decision:** Conduct the 90-minute code review on **Monday at 15:30–17:00**, handing off immediately to QA.
- **Rationale:** The patch must deploy by Friday 16:00 and requires a half-day QA cycle. Crucially, **QA is completely unavailable on Thursday**. If review were delayed to Wednesday, QA could only test Friday morning, creating an unacceptable zero-margin risk of missing Friday's 16:00 deadline. Front-loading review to Monday enables QA to test across Wednesday (or Tuesday afternoon).

### 1.4 Patch Deployment Scheduled for Friday 11:00–11:30
- **Decision:** Book the 30-minute production change window for **Friday 11:00–11:30**.
- **Rationale:** Deploying at 11:00 meets the Friday 16:00 deadline with a 4.5-hour contingency margin to handle unexpected regression or rollback.

### 1.5 Support Escalations Prioritized by SLA & Revenue Impact
- **Decision:** Resolve Escalation #1 on **Monday 10:30–11:15**; resolve Escalations #2 and #3 on **Tuesday 10:30–12:00**.
- **Rationale:** Escalation #1 impacts contract renewals and has a hard Monday response requirement. Escalations #2 and #3 have Wednesday SLAs; completing them Tuesday morning clears Wednesday’s abbreviated schedule.

### 1.6 Strategy Outline Prepared for Tuesday 16:00 Leadership Review
- **Decision:** Dedicate 2 focused hours on Monday (13:00–15:00) and 1 focused hour Tuesday morning (09:30–10:30) to deliver the draft to the CEO and leadership by **Tuesday 12:15**.
- **Rationale:** The CEO requested an outline "early this week" (requires 3 focused hours). Delivering it by 12:15 beats the 14:00 cutoff required for discussion at the Tuesday 16:00 leadership meeting.

### 1.7 Finance Board Numbers Primary & Contingency Allocation
- **Decision:** Reserve **Tuesday 13:00–15:00** as the primary 2-hour uninterrupted block for Board figures, with a fallback block reserved on **Thursday 10:00–12:00**.
- **Rationale:** Finance requires 2 uninterrupted hours after Lina’s corrections (expected Tuesday 11:00) before Thursday 12:00. Tuesday afternoon is the optimal primary slot, while Thursday morning acts as insurance against vendor data delays.

---

## 2. Unresolved Contradictions & Risks

### 2.1 Vendor Export Risk (Lina / Finance)
- **Contradiction / Tension:** Finance requires final board numbers by Thursday 12:00 and needs two uninterrupted hours after Lina's corrections. Lina expects to deliver corrections Tuesday by 11:00, but this is contingent on an external vendor export.
- **Impact:** If the vendor export is delayed, Tuesday 13:00–15:00 cannot be used.
- **Resolution Plan:** Check in with Lina Monday at 15:00 (when she knows vendor export status). If delayed, shift the 2-hour focus block to Thursday 10:00–12:00 immediately following the Thursday morning recurring meeting.

### 2.2 Product Demo Timing vs. Stated Availability
- **Contradiction:** Product preferred Wednesday 15:00, but Wednesday 13:00–17:30 is strictly unavailable.
- **Resolution Plan:** Resolved by scheduling for Thursday 16:00, which the customer can attend. Rehearsal occurs Wednesday morning.

### 2.3 QA Thursday Blackout vs. Security Deployment Chain
- **Contradiction:** Deployment is hard-locked to Friday 16:00, but QA cannot work Thursday. Any slip in Monday's code review would leave QA with only Friday morning to test.
- **Resolution Plan:** Resolved by locking Monday 15:30–17:00 for code review so QA has full availability on Wednesday.

---

## 3. Questions & Actions Assigned by Person

| Person / Role | Assigned Questions & Required Actions | Target Resolution Time |
| :--- | :--- | :--- |
| **Lina** *(Finance Data Lead)* | **1.** Is the vendor export on track? Please confirm status by Monday 15:00.<br>**2.** If export is delayed, what is the latest anticipated delivery time for corrections? | **Monday 15:00** |
| **Product Manager** *(Customer Account Lead)* | **1.** Confirm that the customer demo is formally locked for **Thursday at 16:00–17:00**.<br>**2.** Confirm calendar invite sent to customer and attendees. | **Monday 12:00** |
| **Sam** *(Demo Co-Presenter)* | **1.** Confirm attendance for the 90-minute demo rehearsal on **Wednesday 10:00–11:30**.<br>**2.** Confirm staging environment and demo credentials are ready. | **Monday EOD** |
| **Engineering Lead** | **1.** Confirm the security patch PR and release notes will be ready for review by **Monday 15:30**.<br>**2.** Confirm 30-minute change window reservation for **Friday 11:00–11:30**. | **Monday 11:00** |
| **QA Lead** | **1.** Confirm QA resource allocation for **Wednesday (half day)** to test the security patch once review is completed Monday evening.<br>**2.** Confirm testing criteria and rollback verification steps. | **Tuesday 10:00** |
| **CEO** | **1.** Confirm that delivering the 3-hour first draft by **Tuesday 12:15** (for the 16:00 leadership review) aligns with expectations for "early this week".<br>**2.** Highlight any specific strategic focus areas prior to Monday 13:00 focus block. | **Monday 11:00** |
| **Support Lead** | **1.** Confirm ticket link and customer details for the renewal-critical escalation for Monday morning resolution.<br>**2.** Confirm acceptance of Tuesday delivery for the remaining two Wednesday SLA tickets. | **Monday 10:00** |
