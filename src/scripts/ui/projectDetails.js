// projectDetails.js
import gsap from "gsap";
import { resetScroll, resetScrollAfterLayout } from "../utils/scrollUtils.js";

// Safe JavaScript transitions - no transforms on containers
export function initProjectsDetail(root) {
  if (!root) return { toList: () => {} };

  const listWrap = root.querySelector("#pp-projects");
  const detailEl = root.querySelector("#pp-detail");
  const backBtn = root.querySelector(".pm-back");

  const TRANSITION_DURATION = 300; // ms

  // --- FLOWS ------------------------------------------------------

  function toList() {
    // show list (hidden before) and start fade
    listWrap.hidden = false;
    root.classList.add("is-entering-list");
    root.classList.add("is-leaving-detail");

    setTimeout(() => {
      // swap state
      root.classList.remove("is-detail");
      detailEl.hidden = true;
      backBtn.hidden = true;
      detailEl.innerHTML = "";

      // do it after layout is valid
      resetScrollAfterLayout(root);

      // release list fade + child reveal
      requestAnimationFrame(() => {
        root.classList.remove("is-leaving-detail", "is-entering-list");
        root.classList.add("is-opening");
        setTimeout(() => root.classList.remove("is-opening"), 380);
      });
    }, TRANSITION_DURATION);
  }

  function toDetail(card) {
    // fade list
    root.classList.add("is-transitioning-out");

    // collect content
    const title =
      card.querySelector(".pp-card__title")?.textContent?.trim() || "Project";
    const img =
      card.querySelector(".pp-card__img img")?.getAttribute("src") || "";
    const desc = card.querySelector(".pp-card__desc")?.innerHTML || "";
    const longDetail = card.querySelector(".pp-card__detail")?.innerHTML || "";
    const tags = [...card.querySelectorAll(".pp-tag")].map((t) =>
      t.textContent.trim()
    );
    const links = [...card.querySelectorAll(".pp-card__links a")].map((a) => ({
      href: a.getAttribute("href"),
      label: a.getAttribute("aria-label") || "Link",
    }));

    setTimeout(() => {
      // build detail
      detailEl.innerHTML = `
        <header class="ppd-header"><span class="ppd-title">${title}</span></header>
        <figure class="ppd-media"><img src="${img}" alt="${title}"></figure>
        <div class="ppd-sections">
          ${desc ? `<section class="ppd-desc"><p>${desc}</p></section>` : ""}
          ${longDetail || ""}
          ${
            tags.length
              ? `<section class="ppd-tech">
                   <h3>Technologies</h3>
                   <div class="pp-tags">${tags.map((t) => `<span class="pp-tag">${t}</span>`).join("")}</div>
                 </section>`
              : ""
          }
          ${
            links.length
              ? `<section class="ppd-footer">
                   ${links.map((l) => `<a class="pp-btn" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join("")}
                 </section>`
              : ""
          }
        </div>
      `;

      // swap to detail
      root.classList.add("is-detail");
      detailEl.hidden = false;
      listWrap.hidden = true;
      backBtn.hidden = false;
      root.classList.remove("is-transitioning-out");

      // 🔑 same fix as modal.js: reset after elements are visible/layouted
      resetScrollAfterLayout(root);
    }, TRANSITION_DURATION);
  }

  function handleCardClick(card) {
    toDetail(card);
  }

  // Events
  listWrap?.addEventListener("click", (e) => {
    const card = e.target.closest(".pp-card");
    if (card) handleCardClick(card);
  });

  listWrap?.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".pp-card")) {
      e.preventDefault();
      handleCardClick(e.target.closest(".pp-card"));
    }
  });

  backBtn?.addEventListener("click", toList);

  // Also return to list on modal close
  root.querySelectorAll(".modal-close-btn, .pm-close").forEach((btn) => {
    btn.addEventListener("click", toList);
  });

  // initial state
  listWrap.hidden = false;
  detailEl.hidden = true;
  backBtn.hidden = true;
  root.classList.remove("is-detail");

  return { toList };
}
