const menu = document.querySelector("#menu-panel");
const menuButton = document.querySelector(".menu-trigger");
const closeButton = document.querySelector(".menu-close");

function closeMenu() {
  if (menu.open) menu.close();
}
menuButton.addEventListener("click", () => {
  menu.showModal();
  menuButton.setAttribute("aria-expanded", "true");
});
closeButton.addEventListener("click", closeMenu);
menu.addEventListener("close", () => menuButton.setAttribute("aria-expanded", "false"));
menu.addEventListener("click", (event) => {
  if (event.target === menu) closeMenu();
});
menu.addEventListener("cancel", () => menuButton.setAttribute("aria-expanded", "false"));
menu.querySelectorAll("a[href^='#']").forEach((link) => link.addEventListener("click", closeMenu));

const revealElements = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: "0px 0px -2% 0px" });
  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

const sections = Array.from(document.querySelectorAll("main .screen"));
const menuLinks = Array.from(menu.querySelectorAll("a[href^='#']"));
if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!active) return;
    menuLinks.forEach((link) => {
      if (link.hash === `#${active.target.id}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, { threshold: [.2, .4, .65] });
  sections.forEach((section) => sectionObserver.observe(section));
}

document.querySelectorAll("a[href^='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    const section = document.querySelector(link.getAttribute("href"));
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    history.replaceState(null, "", link.getAttribute("href"));
  });
});
