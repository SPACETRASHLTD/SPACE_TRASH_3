// Shared behavior across all OnlineVisaStore pages

document.addEventListener("DOMContentLoaded", () => {
  // Mobile nav toggle
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
      const expanded = nav.classList.contains("open");
      toggle.setAttribute("aria-expanded", String(expanded));
    });
  }

  // FAQ accordion (used on faq.html and any embedded FAQ sections)
  document.querySelectorAll(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const wasOpen = item.classList.contains("open");
      item
        .closest(".faq-list")
        ?.querySelectorAll(".faq-item.open")
        .forEach((el) => el.classList.remove("open"));
      item.classList.toggle("open", !wasOpen);
    });
  });

  // Footer year
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
});

/* ---------- Small shared helpers used by apply.js / status.js ---------- */

const VisaStore = {
  KEY: "ovs_applications",

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  save(application) {
    const all = this.getAll();
    all.push(application);
    localStorage.setItem(this.KEY, JSON.stringify(all));
  },

  find(reference, email) {
    return this.getAll().find(
      (a) =>
        a.reference.toLowerCase() === String(reference).toLowerCase().trim() &&
        a.email.toLowerCase() === String(email).toLowerCase().trim()
    );
  },

  generateReference() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "VS-";
    for (let i = 0; i < 7; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },
};
