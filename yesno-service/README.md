# Yes or no, first approved question

Public catalog remains at moment/yes-no/questions.json. IDs are permanent.
Public UI yes-no.js contains only interaction and request code, no answer texts.
API api/numi-yesno-answer.php validates an allowlisted question and HH:MM, sums the four time digits and repeatedly reduces to 1 through 9. 00:00 has no approved rule and returns ZERO_TIME_UNDEFINED.
Only yn-man-001 is enabled as a public trial. Other questions remain unimplemented, not assigned generic answers. Payment entitlements must be integrated before enabling paid questions; do not expand the trial allowlist to paid content.
Approved source JSON lives in the private repository at moment/yes-no/answers/man/yn-man-001.json. Production JSON is outside the web root at private/numi-yesno-v1/answers/man/yn-man-001.json. Each file has schema version, stable question ID, approval status, calculation version, and exactly nine answers.
The endpoint returns one selected answer, never the whole answer bank or calculation number. UI requests only after a valid complete time or the current-time button. Stale requests are cancelled when editing, changing question, or closing.
Release backs up existing files outside www and validates original checksums. No DNS, bot, login, database, or payment changes.
