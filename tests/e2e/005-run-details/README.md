# Run Details Streaming Logs

Verify that the run details route polls for logs and updates the timeline.

## Initially shows steps when logs are 404

![Initially shows steps when logs are 404](./screenshots/000-initial-load-404.png)

### Verifications
- [x] Fallback steps are visible
- [x] Live indicator is visible
- [x] Waiting message is visible

---

## Timeline updates when partial logs are available

![Timeline updates when partial logs are available](./screenshots/001-second-load-partial.png)

### Verifications
- [x] Session start event is visible

---

## Timeline updates when logs are complete and polling stops

![Timeline updates when logs are complete and polling stops](./screenshots/002-final-load-complete.png)

### Verifications
- [x] Session end event is visible
- [x] Live indicator disappears after completion

---

