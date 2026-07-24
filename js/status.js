// Application status lookup

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("trackForm");
  if (!form) return;

  const refInput = document.getElementById("refInput");
  const emailInput = document.getElementById("emailInput");
  const trackError = document.getElementById("trackError");
  const statusResult = document.getElementById("statusResult");

  const STAGE_LABELS = ["Submitted", "Document Review", "Processing", "Approved"];

  // Prefill from query string (?ref=&email=)
  const params = new URLSearchParams(window.location.search);
  if (params.get("ref")) refInput.value = params.get("ref");
  if (params.get("email")) emailInput.value = params.get("email");
  if (params.get("ref") && params.get("email")) {
    lookup(params.get("ref"), params.get("email"));
  }

  function computeStage(submittedAt) {
    const elapsedSec = (Date.now() - new Date(submittedAt).getTime()) / 1000;
    if (elapsedSec < 10) return 0;
    if (elapsedSec < 30) return 1;
    if (elapsedSec < 60) return 2;
    return 3;
  }

  function renderResult(app) {
    trackError.classList.remove("show");
    statusResult.classList.add("show");

    const stage = computeStage(app.submittedAt);

    document.getElementById("resultTitle").textContent = `Application ${app.reference}`;
    document.getElementById("resultSubtitle").textContent = `Current status: ${STAGE_LABELS[stage]}`;
    document.getElementById("resCountry").textContent = app.country;
    document.getElementById("resType").textContent = app.visaType
      ? app.visaType[0].toUpperCase() + app.visaType.slice(1)
      : "—";
    document.getElementById("resDate").textContent = app.travelDate || "—";
    document.getElementById("resName").textContent = app.fullName;
    document.getElementById("resSubmitted").textContent = new Date(app.submittedAt).toLocaleString();

    document.querySelectorAll(".status-node").forEach((node) => {
      const s = Number(node.dataset.stage);
      node.classList.toggle("complete", s < stage || (s === stage && stage === 3));
      node.classList.toggle("current", s === stage && stage !== 3);
    });
  }

  function lookup(ref, email) {
    const app = VisaStore.find(ref, email);
    if (app) {
      renderResult(app);
    } else {
      statusResult.classList.remove("show");
      trackError.classList.add("show");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ref = refInput.value.trim();
    const email = emailInput.value.trim();
    if (!ref || !email) return;
    lookup(ref, email);
  });
});
