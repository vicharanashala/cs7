# Student Test Data

This file stores the 25 new student accounts created for testing the Samagama portal.

## Student Accounts

| #   | Name      | Email                   | Password     |
| --- | --------- | ----------------------- | ------------ |
| 1   | Aditya    | aditya@samagama.test    | Student@2026 |
| 2   | Priya     | priya@samagama.test     | Student@2026 |
| 3   | Arjun     | arjun@samagama.test     | Student@2026 |
| 4   | Sneha     | sneha@samagama.test     | Student@2026 |
| 5   | Vikram    | vikram@samagama.test    | Student@2026 |
| 6   | Kavya     | kavya@samagama.test     | Student@2026 |
| 7   | Rohit     | rohit@samagama.test     | Student@2026 |
| 8   | Ananya    | ananya@samagama.test    | Student@2026 |
| 9   | Siddharth | siddharth@samagama.test | Student@2026 |
| 10  | Deepika   | deepika@samagama.test   | Student@2026 |
| 11  | Karthik   | karthik@samagama.test   | Student@2026 |
| 12  | Mythili   | mythili@samagama.test   | Student@2026 |
| 13  | Naveen    | naveen@samagama.test    | Student@2026 |
| 14  | Divya     | divya@samagama.test     | Student@2026 |
| 15  | Suresh    | suresh@samagama.test    | Student@2026 |
| 16  | Meenakshi | meenakshi@samagama.test | Student@2026 |
| 17  | Chandran  | chandran@samagama.test  | Student@2026 |
| 18  | Lavanya   | lavanya@samagama.test   | Student@2026 |
| 19  | Balaji    | balaji@samagama.test    | Student@2026 |
| 20  | Uma       | uma@samagama.test       | Student@2026 |
| 21  | Gopinath  | gopinath@samagama.test  | Student@2026 |
| 22  | Radhika   | radhika@samagama.test   | Student@2026 |
| 23  | Venkat    | venkat@samagama.test    | Student@2026 |
| 24  | Shakthi   | shakthi@samagama.test   | Student@2026 |
| 25  | Nandini   | nandini@samagama.test   | Student@2026 |

## Test Execution Steps

### Prerequisites

- MongoDB must be running (`mongod`)
- The server must be running on http://localhost:4000

### Step 1: Seed Student Accounts

Run from the project root:

```bash
npm --workspace @samagama/server run seed:student-accounts
```

### Step 2: Run Full Simulation

```bash
npm --workspace @samagama/server run simulate:full
```

This script:

1. **Resets** any previous run data (all community questions → open, all answers → pending)
2. **Creates 30 community questions** directly in MongoDB (one per unique question category from `troubleshoot_summership_2026_questions.md`)
3. **Posts 3-5 answers per question** via the API (all remain `pending`)
4. **Votes on answers** — answers stay `pending` throughout (voting uses `allowPending=true`)

### What the Data Looks Like After Simulation

| Entity                 | Status    | Notes                                   |
| ---------------------- | --------- | --------------------------------------- |
| Community Questions    | `open`    | Not resolved, not answered              |
| Community Answers      | `pending` | Awaiting moderator approval             |
| Question answer counts | Set       | Reflects number of posted answers       |
| Vote counts            | Populated | Top 3 questions have net positive votes |

### Moderator Actions Available

After the simulation, moderators can:

- View all pending answers in the moderation queue
- Approve or reject individual answers
- Edit & approve answers with modifications
- Assign Spurti Points on approval
- Bulk approve/reject multiple answers

### Key Behavior

- **No auto-approval**: Answers remain `pending` after the simulation
- **No auto-resolution**: Questions stay `open` — moderators decide when to resolve
- **No accepted answers**: No answer is marked as accepted/best
- **Voting preserved**: Upvotes/downvotes are recorded on pending answers using the new `allowPending` query parameter
- **Idempotent**: Re-running the simulation resets and re-creates all data cleanly

## Data Sources

- **Questions**: 30 unique question categories from `/Users/ravikumark/Desktop/Samagama final/troubleshoot_summership_2026_questions.md`
- **Student distribution**: Questions distributed across 25 students using Fisher-Yates shuffle
- **Answer bodies**: 18 pre-defined answer templates for realism
