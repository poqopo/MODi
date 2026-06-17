# MODi Demo Script

## One-Liner

MODi helps people share healthcare MyData safely by turning each institution's request into a Walrus-backed privacy policy that a Privacy Agent can verify and remember.

## What The Judges Should Remember

MODi is not trying to show every blockchain or encryption detail in the live demo.

The demo should make one idea easy to remember:

> Users stay in control of their health data. MODi uses Walrus-backed policy and security memory so Privacy Agents can safely adapt each submission to each institution's changing request.

## Recommended 4-Minute Demo Flow

### 0:00-0:35 Problem

Healthcare MyData is becoming portable.

This is not only wearable data.

People are starting to share Apple Health, wearable activity data, sleep and recovery data, and even medical records directly from personal health platforms.

Precision medicine companies need this data to personalize treatments and risk models.

Insurance wellness companies need it to calculate rewards and preventive care programs.

But the hard part is not just moving the file.

These companies all ask for different fields, different levels of detail, and different privacy rules. A normal user should not have to understand how to safely transform health and medical data for each request. And a platform should not collect raw sensitive data first and clean it later.

MODi solves this with a Privacy Agent workflow powered by Walrus memory.

### 0:35-1:10 Institution Creates A Request

Here, I am on the institution dashboard.

The institution creates a healthcare data request and chooses what it actually needs, such as steps, exercise minutes, sleep, heart rate, or VO2 max.

When the request is created, MODi generates a privacy policy for that request and publishes it to Walrus.

So the policy is not hidden backend configuration.

It becomes a verifiable policy memory that the user app and the Privacy Agent can both read.

### 1:10-2:35 User Submits Health Data Safely

Now I switch to the user app.

From the user's point of view, the flow is simple.

The user opens an approved project, loads health data, and taps submit.

Behind the scenes, the user app first reads the institution's policy from Walrus and checks that it matches the saved hash.

Then the app pseudonymizes the health data locally.

Direct identifiers, exact timestamps, wallet addresses, and overly specific values are removed or generalized before the dataset is uploaded.

Next, the Privacy Agent verifies the pseudonymized payload.

If the agent detects a privacy risk, the user app makes the data safer locally and sends it for verification again.

This is not an approval or rejection agent.

It is a safety loop that helps users turn sensitive healthcare data into a safer, policy-matched dataset before upload.

### 2:35-3:25 Why Walrus Matters

Now here is the Walrus-specific part.

Walrus is not only storing the final encrypted dataset.

Walrus stores the policy memory that defines what the institution requested.

Walrus also stores security memory when the Privacy Agent discovers a risky pattern.

For example, even if a user's name is removed, a combination like narrow age range, small region, rare condition, specific device model, and unusual workout pattern can still re-identify a person.

When the agent catches that, MODi stores the risk pattern as Security Memory on Walrus.

The next time a similar payload appears, the agent recalls that memory first and catches the risk earlier.

### 3:25-4:10 Institution Downloads And Verifies

Finally, I return to the institution dashboard.

In data management, the institution can download the encrypted healthcare dataset.

It can also inspect the audit trail: which policy was used, what the Privacy Agent checked, whether safety edits were applied, and which Walrus artifacts connect the dataset to the verification record.

The institution is not just receiving a file.

It receives encrypted, policy-checked healthcare data with a verifiable agent audit trail.

### Closing Line

MODi makes healthcare MyData sharing safer and easier to trust by using Walrus as the persistent policy and security memory layer for Privacy Agents.

## 60-Second Version

Healthcare MyData is becoming portable, including wearable data, Apple Health data, sleep and recovery data, and medical records.

Precision medicine companies need this data for personalization and risk modeling. Insurance wellness companies need it for rewards and preventive care programs.

But every institution asks for different data and different privacy rules. A user should not have to manually understand how to safely transform health and medical data for each request, and the platform should not collect raw sensitive data just to clean it later.

MODi solves this with a Privacy Agent workflow using Walrus.

The institution creates a data request, and MODi publishes the request policy to Walrus. The user app reads that policy, pseudonymizes the health data locally, and sends only the safe payload for Privacy Agent verification.

If the agent finds a risk, the user app makes the data safer and verifies again. When new risk patterns are discovered, MODi stores Security Memory on Walrus, so the agent can recall those risks in future submissions.

After verification passes, the encrypted dataset and audit trail are stored on Walrus. The institution can download the dataset and verify which policy and agent checks were used.

MODi turns Walrus into a verifiable policy and security memory layer for safe healthcare MyData sharing.

## Demo Click Path

Keep the live demo focused. Do not explain Slush, Sui, or Seal unless asked.

1. Open the institution dashboard.
2. Create or show a healthcare data request.
3. Point out that this request becomes a Walrus policy memory.
4. Open the user app.
5. Open an approved project.
6. Tap submit.
7. Narrate only these progress steps:
   - policy fetched from Walrus
   - local pseudonymization
   - Privacy Agent verification
   - safety edit and re-verification, if triggered
   - encrypted Walrus upload
8. Return to institution dashboard.
9. Open data management.
10. Show encrypted dataset download and Security Agent audit trail.

## What To Show

### User View

The user should feel:

> I can share health data without manually understanding privacy rules. The app processes my data locally, the Privacy Agent checks it, and only the encrypted safe dataset is uploaded.

### Judge View

The judge should understand:

> Walrus is not just storage. It is the policy and security memory layer that lets Privacy Agents adapt across institutions, policy changes, and repeated submissions.

## Key Phrases

- "The hard part is not moving healthcare data. The hard part is making it safe for each institution's request."
- "The policy is not hidden backend configuration. It is a verifiable Walrus policy memory."
- "The user app pseudonymizes data locally before upload."
- "The Privacy Agent verifies and recommends safety edits; it does not collect raw health data."
- "Security Memory lets the agent remember privacy risks discovered in previous submissions."
- "The institution receives encrypted, policy-checked healthcare data with an audit trail."

## Keep These Details In Backup

Use these only if a judge asks technical follow-up questions.

- Slush: institution wallet login for request creation.
- Sui: registry and object references for future production-grade access control.
- Seal: roadmap for policy-gated decryption.
- Supabase: app database and Edge Function runtime.
- Walrus: policy memory, security memory, encrypted dataset storage, and audit artifacts.

## What Not To Claim

- Do not claim production-grade Seal decryption is complete.
- Do not claim real HealthKit native integration is fully production-ready.
- Do not claim the agent stores raw health data as memory.
- Do not claim the platform server receives raw healthcare data.
- Do not claim this is a medical diagnosis system.
