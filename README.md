# SPACE_TRASH_3

## OnlineVisaStore

A static multi-page website for OnlineVisaStore, an online travel visa application service. Built with plain HTML, CSS and vanilla JavaScript — no build step required.

### Pages

- `index.html` — homepage with quick application tracking, destinations preview and process overview
- `countries.html` — filterable list of supported destinations, visa types, processing times and pricing
- `apply.html` — multi-step visa application wizard (destination, traveler details, document upload, review, confirmation)
- `status.html` — look up an application's status by reference number and email
- `how-it-works.html` — step-by-step explanation of the application process
- `faq.html` — frequently asked questions
- `contact.html` — support contact form and details
- `privacy.html`, `terms.html` — legal pages

### Running locally

Serve the folder with any static file server, e.g.:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

### Notes

This build is a front-end demonstration: the application wizard, status tracker and contact form all run entirely client-side and store submitted applications in the browser's `localStorage` (see `js/main.js`, `js/apply.js`, `js/status.js`). No documents or personal data are transmitted anywhere. Connecting the form to a real backend, payment processor and secure document storage would be required before handling genuine visa applications.