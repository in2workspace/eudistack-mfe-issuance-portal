---
name: feedback-version-bump-via-merge
description: package.json version can look "already bumped" on a feature branch purely because of a merge from main picking up an unrelated prior release's bump — always diff against main, not just read the value.
metadata:
  type: feedback
---

Never accept "package.json shows version X.Y.Z, so C5 is done" at face value.
Long-lived feature branches in this flotilla merge `main` in repeatedly
(`merge: update EUD-BRANCH with main ...` commits are common here), and a prior,
unrelated Story's `chore: bump version to X.Y.Z` commit can land on the branch
this way, making the working tree's version look current even though *this*
Story never bumped anything itself.

**Why:** Found in EUD-163 code review (2026-08-12): `package.json` read
`0.1.3`, and the user's prompt asserted "C5 ya aplicado" — but
`git diff main..HEAD -- package.json` was empty, and the only bump commit
(`chore: bump version to 0.1.3`) predated the Story and was pulled in via
`merge: update EUD-163 branch with main`. `tasks.md` C5 was marked
`completed` despite no dedicated bump commit existing. BLOCKING finding.

**How to apply:** Always run `git diff main..HEAD -- package.json` (or the
repo's version file) before accepting a version-bump claim in a Gate 6 review.
If it's empty, the version bump for *this* Story has not happened yet,
regardless of what the absolute value is or what `tasks.md`/C5 claims.
See also [[feedback-timer-wiring-coverage]] for another "don't trust the
task-list status field, verify the artifact" pattern from the same review.
