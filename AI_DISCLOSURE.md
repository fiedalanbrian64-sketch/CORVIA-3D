# CORVIA — AI Usage Disclosure

This draft records AI assistance identifiable from the conversation history currently available to the project. The group must review and complete it before submission.

## 1. Application implementation and feature changes

- **AI Tool Used:** GitHub Copilot (AI assistant using Copilot SDK in VS Code).
- **Task Where AI Was Used:** Assistance with implementation and refinement of the CORVIA browser application, including role-based workspaces, local account and station-data workflows, and subsequent feature changes.
- **Manuscript / Project Section:** `index.html`, `style.css`, `app.js`, `config.js`, and `manifest.json`.
- **Exact Prompt Used:** The original implementation prompt is not fully available in the retained conversation: its text is truncated after the Health Worker module requirements. Later prompts that requested feature changes are also omitted from the available history. Do not treat a reconstruction or summary as a verbatim prompt. The group should retrieve and append the original prompts from the complete chat history if exact archival copies are required.
- **AI Output Used:** Code and revisions incorporated into the application files. The available project history describes browser-local account and station-data handling, role workspaces, admission and nurse workflows, vitals, medication/care tracking, handovers, search/history, patient assistance requests, and removal of the Demo Mode interface and generated sample records. A legacy data-recovery routine remains for browsers with prior Demo Mode data.
- **Validation Method:** The recorded browser checks covered sign-up, login, logout, admission and prescription submission, nurse admission acknowledgment, abnormal-vitals flagging, patient assistance request and acknowledgment, handover creation and acknowledgment, patient lookup, local persistence after reload, and removal of the active Demo Mode UI/keys. The retained test notes state that medication-dose confirmation was not conclusively verified and a patient-history text assertion did not pass; these must not be reported as passing tests.
- **Responsible Member:** **[Group member who reviewed and accepted this contribution — fill in before submission]**

## 2. User guide and operating procedures

- **AI Tool Used:** GitHub Copilot (AI assistant using Copilot SDK in VS Code).
- **Task Where AI Was Used:** Drafting and expanding the Filipino user guide, including role descriptions, local-storage limitations, safety cautions, and step-by-step procedures.
- **Manuscript / Project Section:** [`GABAY-SA-PAGGAMIT.md`](./GABAY-SA-PAGGAMIT.md).
- **Exact Prompt Used:**  
  1. “pwede mo ba gawan ako guide document para sa web”  
  2. “pwede mo ilagay step by step procedure”
- **AI Output Used:** Filipino user-guide text describing account setup and login, Doctor/Nurse/Health Worker/Patient workspaces, admission and handoff, vitals and search, medication and care-task tracking, shift handover, patient assistance requests, laboratory workflow, persistence, and privacy/security limitations.
- **Validation Method:** The guide was compared with the available feature descriptions and prior browser-test notes. It identifies CORVIA as a browser-local prototype, warns against real patient data or clinical use, and avoids claiming that the unfinished medication/history checks passed. The group should verify every button and workflow label against the current deployed build before relying on the procedure.
- **Responsible Member:** **[Group member who reviewed and accepted this contribution — fill in before submission]**

## 3. Application workflow review

- **AI Tool Used:** GitHub Copilot (AI assistant using Copilot SDK in VS Code).
- **Task Where AI Was Used:** Reviewing whether key application functions worked and whether the removed Demo Mode remained active.
- **Manuscript / Project Section:** Application workflow review of `index.html`, `app.js`, `config.js`, and browser behavior.
- **Exact Prompt Used:** “pwede mo ba check kung maayus lahat ng function at nagana ung mga inalis ay wala like noong demo”
- **AI Output Used:** A review summary of observed workflows, Demo Mode removal, persistence behavior, and checks that remained inconclusive.
- **Validation Method:** Browser interaction checks and inspection of browser storage were recorded for the workflows listed in Record 1. The group should repeat tests against the final deployed version and document any differences. Medication confirmation and the patient-history assertion remain unresolved in the available test record.
- **Responsible Member:** **[Group member who reviewed and accepted this contribution — fill in before submission]**

## 4. Disclosure preparation

- **AI Tool Used:** GitHub Copilot (AI assistant using Copilot SDK in VS Code).
- **Task Where AI Was Used:** Preparing this disclosure from the requirements supplied by the group.
- **Manuscript / Project Section:** `AI_DISCLOSURE.md`.
- **Exact Prompt Used:** The verbatim disclosure requirements supplied in the conversation for this task. The complete message is preserved in the conversation history; refer to it rather than replacing it with a paraphrase.
- **AI Output Used:** This disclosure draft, including the project contribution records and the explicit limitations on what can be verified from the retained conversation.
- **Validation Method:** Checked the draft against the required disclosure fields and documentation requirements in the supplied instructions. The group must confirm the complete prompt history, project outputs, validation evidence, responsible members, and applicable privacy/authorization requirements.
- **Responsible Member:** **[Group member who reviewed and accepted this disclosure — fill in before submission]**

## Prompt, reference, and privacy limitations

- The conversation history available when this file was prepared omits multiple earlier messages and truncates the original application request. Therefore, the exact prompts for all implementation and feature-change work cannot be reproduced here. The descriptions above are not substitutes for verbatim prompts.
- Before submission, consult the complete chat history and append each missing material prompt verbatim, alongside its corresponding output and validation record. If an original prompt cannot be recovered, disclose that limitation to the instructor rather than inventing wording.
- No scholarly references or experimental results are asserted in this disclosure. Independently verify references, factual claims, and project requirements used in the manuscript.
- The responsible-member fields are intentionally left for the group to complete; the AI cannot identify which student reviewed and accepted the work.
- The group must confirm whether any confidential or sensitive information was shared and whether applicable authorization was obtained. Do not infer this attestation from this draft.
