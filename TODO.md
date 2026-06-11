# TODO

- [x] Fix SBAR -> Send Email to open as modal, not a white screen

- [x] Route `/send-email` to `SendEmailModal` wrapper instead of `SendEmail` page
- [x] Update `SendEmailModal` so it uses a working close handler (avoid missing navigation props)
- [x] Add an explicit close button inside the modal so user can exit
- [x] Ensure `SendEmail` receives `onClose` and doesn’t break when used in modal context
- [x] Quick test: open `/send-email` and trigger from `/sbar` send-email action
- [x] Run build/lint (if configured)
