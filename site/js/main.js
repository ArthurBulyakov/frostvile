import { company, siteConfig } from "./config.js";

function isPlaceholder(value) {
  return /^\[[^\]]+\]$/.test(String(value).trim());
}

function paintCompany() {
  document.querySelectorAll("[data-company]").forEach((node) => {
    const key = node.getAttribute("data-company");
    const value = company[key];
    if (typeof value !== "string" || !value.trim()) return;
    const text = value.trim();
    node.textContent = text;
    node.classList.toggle("ph", isPlaceholder(text));
    const link = node.closest("a");
    if (!link) return;
    if (key === "email") {
      link.setAttribute("href", isPlaceholder(text) ? "mailto:[email]" : `mailto:${text}`);
    }
    if (key === "phone") {
      if (isPlaceholder(text)) link.removeAttribute("href");
      else link.setAttribute("href", `tel:${text.replace(/[^\d+]/g, "")}`);
    }
  });
}

paintCompany();

const header = document.querySelector(".site-header");
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");

function onScroll() {
  if (!header) return;
  header.classList.toggle("is-stuck", window.scrollY > 8);
}

onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

function closeNav() {
  if (!nav || !toggle) return;
  nav.classList.remove("is-open");
  toggle.setAttribute("aria-expanded", "false");
}

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeNav);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
      toggle.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!nav.classList.contains("is-open")) return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    closeNav();
  });
}

const navLinks = [...document.querySelectorAll(".nav a[href^='#']")];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function spy() {
  if (!sections.length) return;
  const line = 120;
  let current = null;
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= line) current = section;
  });
  navLinks.forEach((link) => {
    if (current && link.getAttribute("href") === `#${current.id}`) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

if (sections.length) {
  spy();
  window.addEventListener("scroll", spy, { passive: true });
}

const comment = document.querySelector("#comment");
document.querySelectorAll("[data-prefill]").forEach((button) => {
  button.addEventListener("click", () => {
    const text = button.getAttribute("data-prefill") || "";
    if (comment && text && !comment.value.trim()) comment.value = text;
  });
});

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.includes("[");
}

function resolveEmail() {
  const configured = (siteConfig.email || "").trim();
  if (isEmail(configured)) return configured;
  const fromCompany = (company.email || "").trim();
  if (isEmail(fromCompany)) return fromCompany;
  const link = document.querySelector("#contact-email");
  if (!link) return "";
  const fromHref = (link.getAttribute("href") || "").replace(/^mailto:/i, "").split("?")[0].trim();
  if (isEmail(fromHref)) return fromHref;
  const text = link.textContent.replace(/\s+/g, "").trim();
  if (isEmail(text)) return text;
  return "";
}

function attachValidity(input, emptyMessage, invalidMessage) {
  const clear = () => input.setCustomValidity("");
  input.addEventListener("invalid", () => {
    if (input.validity.valueMissing || input.validity.tooShort) {
      input.setCustomValidity(emptyMessage);
    } else {
      input.setCustomValidity(invalidMessage || emptyMessage);
    }
  });
  input.addEventListener("input", clear);
}

const form = document.querySelector("#request-form");
const status = document.querySelector("#form-status");

if (form && status) {
  attachValidity(form.querySelector("#name"), "Укажите, как к вам обращаться");
  attachValidity(form.querySelector("#company"), "Укажите компанию или точку");
  const phone = form.querySelector("#phone");
  attachValidity(phone, "Укажите телефон", "Оставьте цифры, пробелы, скобки или дефис");
  phone.addEventListener("input", () => {
    const value = phone.value.trim();
    if (!value) {
      phone.setCustomValidity("");
      return;
    }
    if (!/^[0-9+()\s-]{6,}$/.test(value)) {
      phone.setCustomValidity("Оставьте цифры, пробелы, скобки или дефис");
    } else {
      phone.setCustomValidity("");
    }
  });
  const consent = form.querySelector("#consent");
  if (consent) attachValidity(consent, "Нужно согласие на обработку персональных данных");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if ((new FormData(form).get("website") || "").toString().trim()) {
      status.textContent = "Заявка принята.";
      status.className = "form-status is-ok";
      form.reset();
      return;
    }

    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || "").trim(),
      company: String(data.get("company") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      comment: String(data.get("comment") || "").trim(),
    };

    const mode = siteConfig.mode || "mailto";
    const submitButton = form.querySelector("[type='submit']");

    try {
      if (mode === "formspree" || mode === "php") {
        const endpoint = (siteConfig.endpoint || (mode === "php" ? "send.php" : "")).trim();
        if (!endpoint) {
          throw new Error("В js/config.js не указан endpoint для отправки.");
        }
        if (submitButton) submitButton.disabled = true;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: mode === "formspree"
            ? { Accept: "application/json", "Content-Type": "application/json" }
            : { Accept: "application/json" },
          body: mode === "formspree"
            ? JSON.stringify({ ...payload, _subject: siteConfig.subject })
            : data,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          throw new Error(body.error || "Сервер не принял заявку. Попробуйте ещё раз или напишите на почту из контактов.");
        }
        form.reset();
        status.textContent = "Заявка отправлена. Мы ответим и пришлём прайс.";
        status.className = "form-status is-ok";
        return;
      }

      const email = resolveEmail();
      if (!email) {
        status.textContent = "Почта для заявок ещё не указана. Замените [email] в контактах или запишите адрес в js/config.js — как это сделать, написано в README.";
        status.className = "form-status is-error";
        return;
      }

      const lines = [
        `Имя: ${payload.name}`,
        `Компания: ${payload.company}`,
        `Телефон: ${payload.phone}`,
        `Комментарий: ${payload.comment || "—"}`,
      ];
      const href = `mailto:${email}?subject=${encodeURIComponent(siteConfig.subject || "Заявка с сайта Фроствиль")}&body=${encodeURIComponent(lines.join("\n"))}`;
      if (href.length > 1900) {
        status.textContent = "Комментарий слишком длинный для письма из браузера. Сократите его или напишите на почту из контактов.";
        status.className = "form-status is-error";
        return;
      }
      status.textContent = "Открываем почтовую программу с готовым письмом. Если окно не появилось, напишите на адрес из блока контактов.";
      status.className = "form-status is-ok";
      window.location.href = href;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Не удалось отправить заявку.";
      status.className = "form-status is-error";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
