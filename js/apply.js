// Multi-step visa application wizard

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("visaForm");
  if (!form) return;

  const COUNTRY_NAMES = {
    us: "United States (ESTA)",
    ca: "Canada (eTA)",
    uk: "United Kingdom",
    eu: "Schengen Area",
    tr: "Turkey",
    au: "Australia (ETA)",
    nz: "New Zealand (NZeTA)",
    vn: "Vietnam",
    in: "India (e-Visa)",
    lk: "Sri Lanka (ETA)",
    ae: "United Arab Emirates",
    eg: "Egypt (e-Visa)",
    ke: "Kenya (eTA)",
  };

  const totalSteps = 5;
  let currentStep = 1;

  const panels = document.querySelectorAll(".wizard-panel");
  const trackerSteps = document.querySelectorAll(".wizard-tracker .tstep");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");

  // Pre-fill destination from ?country= query param
  const params = new URLSearchParams(window.location.search);
  const preselect = params.get("country");
  if (preselect && COUNTRY_NAMES[preselect]) {
    document.getElementById("country").value = preselect;
  }

  function showStep(step) {
    panels.forEach((p) => p.classList.toggle("active", Number(p.dataset.panel) === step));
    trackerSteps.forEach((t) => {
      const s = Number(t.dataset.step);
      t.classList.toggle("active", s === step);
      t.classList.toggle("done", s < step);
    });

    prevBtn.disabled = step === 1 || step === totalSteps;
    prevBtn.style.visibility = step === totalSteps ? "hidden" : "visible";
    nextBtn.style.display = step < totalSteps - 1 ? "inline-flex" : "none";
    submitBtn.style.display = step === totalSteps - 1 ? "inline-flex" : "none";
    document.getElementById("wizardFooter").style.display = step === totalSteps ? "none" : "flex";

    if (step === 4) buildReview();
    window.scrollTo({ top: document.querySelector(".wizard-shell").offsetTop - 90, behavior: "smooth" });
  }

  function setFieldError(fieldEl, hasError) {
    const wrapper = fieldEl.closest(".field");
    if (wrapper) wrapper.classList.toggle("has-error", hasError);
  }

  function validateStep(step) {
    let valid = true;

    if (step === 1) {
      ["country", "visaType", "travelDate"].forEach((id) => {
        const el = document.getElementById(id);
        const ok = el.value.trim() !== "" && (id !== "travelDate" || new Date(el.value) > new Date());
        setFieldError(el, !ok);
        if (!ok) valid = false;
      });
    }

    if (step === 2) {
      const requiredIds = ["fullName", "dob", "nationality", "passportNumber", "passportExpiry", "phone", "email"];
      requiredIds.forEach((id) => {
        const el = document.getElementById(id);
        let ok = el.value.trim() !== "";
        if (id === "email" && ok) ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
        if (id === "passportExpiry" && ok) ok = new Date(el.value) > new Date();
        setFieldError(el, !ok);
        if (!ok) valid = false;
      });
    }

    if (step === 3) {
      const passportFile = document.getElementById("passportFile");
      const photoFile = document.getElementById("photoFile");
      const consent = document.getElementById("consentAccurate");

      const passportOk = passportFile.files.length > 0;
      document.getElementById("passportFileError").style.display = passportOk ? "none" : "block";
      document.getElementById("passportDrop").style.borderColor = passportOk ? "" : "var(--error-500)";
      if (!passportOk) valid = false;

      const photoOk = photoFile.files.length > 0;
      document.getElementById("photoFileError").style.display = photoOk ? "none" : "block";
      document.getElementById("photoDrop").style.borderColor = photoOk ? "" : "var(--error-500)";
      if (!photoOk) valid = false;

      const consentOk = consent.checked;
      document.getElementById("consentError").style.display = consentOk ? "none" : "block";
      if (!consentOk) valid = false;
    }

    if (step === 4) {
      const terms = document.getElementById("consentTerms");
      const ok = terms.checked;
      document.getElementById("termsError").style.display = ok ? "none" : "block";
      if (!ok) valid = false;
    }

    return valid;
  }

  function buildReview() {
    const dl = document.getElementById("reviewSummary");
    const val = (id) => document.getElementById(id).value;
    const rows = [
      ["Destination", COUNTRY_NAMES[val("country")] || "—"],
      ["Visa type", val("visaType") ? val("visaType")[0].toUpperCase() + val("visaType").slice(1) : "—"],
      ["Travel date", val("travelDate") || "—"],
      ["Applicants", val("applicants")],
      ["Full name", val("fullName")],
      ["Date of birth", val("dob")],
      ["Nationality", val("nationality")],
      ["Passport number", val("passportNumber")],
      ["Passport expiry", val("passportExpiry")],
      ["Phone", val("phone")],
      ["Email", val("email")],
      ["Passport scan", document.getElementById("passportFile").files[0]?.name || "—"],
      ["Photo", document.getElementById("photoFile").files[0]?.name || "—"],
    ];
    dl.innerHTML = rows
      .map(([k, v]) => `<div class="summary-row"><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
  }

  // File drop UI
  function wireFileDrop(dropId, inputId, nameId) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    const nameEl = document.getElementById(nameId);
    input.addEventListener("change", () => {
      if (input.files.length) {
        drop.classList.add("has-file");
        nameEl.textContent = input.files[0].name;
      } else {
        drop.classList.remove("has-file");
        nameEl.textContent = "";
      }
    });
  }
  wireFileDrop("passportDrop", "passportFile", "passportFileName");
  wireFileDrop("photoDrop", "photoFile", "photoFileName");

  nextBtn.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    currentStep = Math.min(currentStep + 1, totalSteps - 1);
    showStep(currentStep);
  });

  prevBtn.addEventListener("click", () => {
    currentStep = Math.max(currentStep - 1, 1);
    showStep(currentStep);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    const val = (id) => document.getElementById(id).value;
    const reference = VisaStore.generateReference();

    const application = {
      reference,
      country: COUNTRY_NAMES[val("country")] || val("country"),
      visaType: val("visaType"),
      travelDate: val("travelDate"),
      applicants: val("applicants"),
      fullName: val("fullName"),
      email: val("email"),
      phone: val("phone"),
      nationality: val("nationality"),
      passportNumber: val("passportNumber"),
      submittedAt: new Date().toISOString(),
      status: "submitted",
    };

    VisaStore.save(application);

    document.getElementById("refCode").textContent = reference;
    document.getElementById("trackLink").href =
      `status.html?ref=${encodeURIComponent(reference)}&email=${encodeURIComponent(application.email)}`;

    currentStep = totalSteps;
    showStep(currentStep);
  });

  showStep(currentStep);
});
