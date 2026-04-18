# Observability Debug Message Grouping

Verify that consecutive debug messages are grouped into a collapsed card.

## User navigates to the debug page

![User navigates to the debug page](./screenshots/000-debug-page-loaded.png)

### Verifications

---

## Consecutive debug messages are grouped

![Consecutive debug messages are grouped](./screenshots/001-debug-messages-grouped.png)

### Verifications
- [x] Three debug groups, three info messages, and one individual debug message are visible
- [x] First group shows (3) and is collapsed
- [x] Second group shows (2) and contains Call event
- [x] Third group shows (3) and contains Gemini event

---

## User expands a debug group

![User expands a debug group](./screenshots/002-expand-debug-group.png)

### Verifications
- [x] Group is now expanded and Gemini message is visible

---

