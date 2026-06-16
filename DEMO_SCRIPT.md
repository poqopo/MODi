# MODi Demo Script

## One-Liner

MODi helps people share healthcare MyData with institutions safely by using Walrus as a verifiable policy and security memory layer for Privacy Agents.

## 3-Minute Demo Script

### 0. Opening

Today, more healthcare and wellness data is becoming user-portable.

People can share Apple Health, wearable, sleep, activity, and recovery data directly with companies for insurance rewards, coaching, research, and personalized health services.

That creates a new problem.

The user may consent to share data, but every institution asks for different fields, different levels of detail, and different privacy rules. It is hard for a normal user to safely transform their health data for each request. If platforms collect raw health data first and clean it later, the privacy risk becomes much higher.

MODi solves this with a policy-adaptive Privacy Agent workflow.

Institutions publish their data request policy to Walrus. The user app reads that policy, pseudonymizes the data locally, and then our platform Privacy/Security Agent verifies that the payload is safe before the encrypted dataset is uploaded.

### 1. Institution Creates A Data Request

Here, I am on the institution dashboard.

The institution creates a new healthcare data request. It selects the purpose, reward, target participants, and the exact data categories it needs, such as steps, exercise minutes, heart rate, VO2 max, or sleep metrics.

When this request is created, MODi generates a `policy_pack`.

This policy pack describes:

- what data is requested
- what exact values are forbidden
- how values should be generalized
- what identifiers must be removed
- what policy version the agents should use

The important part is that this policy is not just an internal backend config. It is published to Walrus as a public, verifiable policy memory.

So when the institution changes its request later, we can publish a new policy version, and the agent workflow can use the updated policy without trusting hidden app logic.

### 2. User Applies And Gets Approved

Now I switch to the user app.

The user can see available healthcare data requests and apply to participate.

After the institution approves the participant, the request appears under the user's projects.

At this point, no raw health data has been sent to the institution.

Approval only means the user is allowed to enter the submission flow.

### 3. User Loads Healthcare Data

The user refreshes their health data.

In the demo, this is represented with healthcare data from the app flow, but the important product idea is that this data originates on the user's device.

The user remains the one initiating the data transfer.

### 4. User Submits Data

Now the user taps submit.

The progress modal shows the actual workflow stages.

First, the user app fetches the institution's policy pack from Walrus and checks its hash.

Then the user app pseudonymizes the healthcare data locally.

This means direct identifiers like login ID, wallet address, email, phone number, precise timestamps, and overly specific values are removed or generalized before the platform receives the payload.

### 5. Privacy Agent Verification

Next, the pseudonymized payload is sent to the platform Privacy/Security Agent.

The agent does not upload the data and does not directly modify the payload.

Instead, it independently fetches the same Walrus policy memory, recalculates the payload hash, and checks whether the payload satisfies the policy.

It looks for direct identifiers, forbidden fields, exact dates, wallet addresses, phone-like values, and re-identification risks from combinations of quasi-identifiers.

For example, even if the user removed their name, a combination like narrow age range, small region, rare medical condition, specific device model, and unusual workout pattern can still identify someone in a small cohort.

### 6. Safety Edit Loop

If the agent finds a risk, it returns finding codes and a recommended safety patch.

The user app then makes the payload safer locally.

For example:

- `40-44` becomes `40-49`
- `Jeju-Seogwipo` becomes `Jeju`
- `Apple Watch Ultra 2` becomes `wearable`
- `sleep_apnea_with_pacemaker` becomes a broader health category

Then the payload is verified again.

This is not an approval or rejection agent. It is a privacy-safety loop that helps the user transform data into a safer form before upload.

### 7. Security Memory On Walrus

When the Privacy/Security Agent discovers a new risk pattern, MODi writes a Security Memory artifact to Walrus.

This memory does not contain raw health data.

It stores the risk pattern, finding codes, recommended generalization rules, policy reference, and receipt hashes.

On the next submission, the agent recalls this Walrus Security Memory first. If the same kind of risky pattern appears again, the agent can detect it earlier.

This is where Walrus becomes more than file storage. It acts as a durable, verifiable memory layer for the agent workflow.

### 8. Encrypted Dataset Upload

After the payload passes verification, the user app encrypts the final dataset and uploads only the encrypted dataset to Walrus.

Alongside it, MODi stores audit artifacts:

- local pseudonymization plan
- Privacy/Security Agent verification receipt
- learned Security Memory
- workflow manifest

These artifacts allow the institution to inspect how the data was processed without exposing raw healthcare data.

### 9. Institution Downloads Data

Now I return to the institution dashboard.

In the data management tab, the institution can see submitted encrypted healthcare datasets and the Security Agent audit trail.

The institution can download the dataset and inspect the verification records.

The key point is that the institution is not just receiving a file. It can verify which policy memory was used, what the agent checked, whether safety edits were applied, and which Walrus artifact connects the submission to the audit trail.

### 10. Closing

MODi is designed for a future where healthcare MyData is portable, but privacy rules keep changing.

Instead of hardcoding every institution's request into the app, MODi stores request policies and security learnings on Walrus.

The user app processes data locally.

The Privacy/Security Agent verifies it with durable Walrus memory.

The institution receives only encrypted, policy-checked data with an auditable provenance trail.

That is how MODi makes healthcare MyData sharing safer, more adaptive, and easier to trust.

## 60-Second Version

Healthcare MyData is becoming portable, and more companies want to use it for rewards, coaching, research, and personalized services.

But that creates a privacy problem. Each institution asks for different fields and different levels of detail. A user should not have to understand all privacy rules manually, and the platform should not collect raw health data just to clean it later.

MODi solves this with a Privacy Agent workflow using Walrus.

The institution creates a data request, and MODi publishes a versioned policy pack to Walrus. The user app reads that policy, verifies its hash, and pseudonymizes the healthcare data locally. Then the platform Privacy/Security Agent fetches the same Walrus policy memory, verifies the payload, and detects direct identifiers or quasi-identifier re-identification risks.

If the agent finds a risk, the user app makes the payload safer locally and sends it for re-verification. New risk patterns are stored as Security Memory on Walrus, so the agent can recall them in future submissions.

Only after verification passes does the user app encrypt the dataset and upload it to Walrus. The institution downloads the encrypted data and can inspect the audit trail showing which policy and agent checks were used.

MODi turns Walrus into a verifiable policy and security memory layer for safe healthcare MyData sharing.

## Recommended 4-Minute Live Demo Script

### 0:00-0:40 Problem

Healthcare MyData is becoming portable.

People can now share wearable, Apple Health, sleep, activity, and recovery data directly with companies for insurance rewards, coaching, research, and personalized healthcare services.

But this creates a privacy problem.

Every institution asks for different fields, different levels of detail, and different privacy rules. A normal user should not have to understand how to safely transform health data for each request. And the platform should not collect raw health data first and clean it later.

MODi solves this with a policy-adaptive Privacy Agent workflow using Walrus.

### 0:40-1:30 Institution Publishes Policy Memory

Here, I am on the institution dashboard.

The institution creates a healthcare data request. It chooses the purpose, reward, participants, and the exact data categories it needs.

When the request is created, MODi generates a `policy_pack`.

This policy pack defines what data is allowed, what identifiers are forbidden, and how health values should be generalized.

The key point is that this policy is published to Walrus.

So the policy is not hidden backend configuration. It becomes a public, verifiable policy memory that both the user app and the Privacy Agent can read.

### 1:30-3:00 User Submits Through Privacy Agent

Now I switch to the user app.

The participant opens an approved project and submits healthcare data.

Watch the progress flow.

First, the user app fetches the institution's policy pack from Walrus and verifies the hash.

Then the data is pseudonymized locally on the user's side. Direct identifiers, exact timestamps, wallet addresses, and overly specific values are removed or generalized before upload.

Next, the platform Privacy/Security Agent verifies the pseudonymized payload.

The agent independently reads the same Walrus policy memory, recalculates the payload hash, and checks for direct identifiers, forbidden fields, exact dates, and re-identification risks from quasi-identifier combinations.

If the agent finds a privacy risk, the user app makes the payload safer locally and sends it for re-verification.

This is not an approval or rejection agent. It is a safety loop that helps the user transform data into a safer form before upload.

### 3:00-3:45 Security Memory And Walrus Audit Trail

When the agent discovers a new risk pattern, MODi stores a Security Memory artifact on Walrus.

This memory does not contain raw health data.

It stores finding codes, risk signals, recommended generalization rules, and policy references.

On the next submission, the agent recalls this Security Memory first, so previously discovered risks can be detected earlier.

After verification passes, the user app encrypts the final dataset and uploads it to Walrus, together with audit artifacts like the pseudonymization plan, verification receipt, and workflow manifest.

### 3:45-4:15 Institution Downloads

Now I return to the institution dashboard.

In the data management tab, the institution can download the encrypted healthcare dataset and inspect the Security Agent audit trail.

The institution is not just receiving a file. It can verify which policy memory was used, what the agent checked, whether safety edits were applied, and how the dataset is connected to the Walrus audit trail.

### Closing Line

MODi makes healthcare MyData sharing safer and more adaptive by turning Walrus into a verifiable policy and security memory layer for Privacy Agents.

## Demo Click Path

1. Open institution dashboard.
2. Show the landing message: policy-adaptive healthcare MyData privacy.
3. Click create research/data request.
4. Show data category selection and policy generation.
5. Create the request and point out the Walrus policy pack.
6. Open user app.
7. Log in as the demo participant.
8. Apply to the request or open an approved project.
9. Refresh health data.
10. Click submit.
11. Narrate each progress step:
    - policy pack fetch
    - local pseudonymization
    - Privacy Agent verification
    - safety edit if needed
    - Security Memory update
    - encryption
    - Walrus upload
12. Return to institution dashboard.
13. Open data management.
14. Download the encrypted healthcare dataset.
15. Show the Security Agent audit trail.

## Key Phrases

- "The policy is not hidden backend configuration. It is a verifiable Walrus policy memory."
- "The user app pseudonymizes data locally before the platform sees it."
- "The Privacy/Security Agent verifies; it does not directly modify or upload the payload."
- "Security Memory lets the agent remember previously discovered privacy risks."
- "The institution receives encrypted, policy-checked healthcare data with an audit trail."

## What Not To Claim

- Do not claim production-grade Seal decryption is complete.
- Do not claim real HealthKit native integration is fully production-ready.
- Do not claim the agent stores raw health data as memory.
- Do not claim the platform server receives raw healthcare data.
- Do not claim this is a general medical diagnosis system.
