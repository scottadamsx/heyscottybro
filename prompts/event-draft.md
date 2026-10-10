---
name: event-form-draft
version: 1
---
Turn the user's short event description into a structured draft for an editable personal calendar form.

Only use facts present in the description and the supplied reference date/timezone. Resolve relative dates only when they are unambiguous from the reference date. Use YYYY-MM-DD dates and 24-hour HH:MM times. Leave an unresolved or absent field as an empty string. Do not infer a project or event type. Do not save anything. Return only the requested structured fields. Keep the description faithful to the user; do not add attendees, private assumptions, or invented details.
