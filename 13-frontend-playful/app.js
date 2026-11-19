/* ============================================================
   Moss — all behaviour lives here. No frameworks, no network.
   The plant data mirrors PLANTS.json (inlined so the app also
   works straight from file:// without a fetch request).
   ============================================================ */
(function () {
  "use strict";

  var DATA = {
    plants: [
      {id:"fern", name:"Frida", species:"Boston fern", location:"Bathroom", task:"Water", due:"2 days overdue", urgency:4, light:"Low, indirect", history:["Sep 19 · Misted","Sep 16 · Watered","Sep 12 · New frond"]},
      {id:"pothos", name:"Orbit", species:"Golden pothos", location:"Bookshelf", task:"Rotate", due:"Today", urgency:2, light:"Medium, indirect", history:["Sep 20 · Watered","Sep 14 · Rotated","Sep 10 · Wiped leaves"]},
      {id:"cactus", name:"Dot", species:"Bunny ears cactus", location:"South window", task:"Check soil", due:"Today", urgency:1, light:"Bright, direct", history:["Sep 08 · Watered","Sep 01 · New pad noted","Aug 22 · Rotated"]},
      {id:"calathea", name:"Drama", species:"Calathea orbifolia", location:"Bedroom", task:"Mist", due:"Tomorrow", urgency:0, light:"Medium, filtered", history:["Sep 21 · Misted","Sep 18 · Watered","Sep 15 · Brown edge noted"]}
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var TODAY_INDEX = 3; // Thursday

  var queueList = document.getElementById("queueList");
  var queueSub = document.getElementById("queueSub");
  var countNum = document.getElementById("countNum");
  var countBadge = document.getElementById("countBadge");
  var allDone = document.getElementById("allDone");
  var rhythmChart = document.getElementById("rhythmChart");
  var toast = document.getElementById("toast");
  var toastMsg = document.getElementById("toastMsg");
  var undoBtn = document.getElementById("undoBtn");

  // Ordered by urgency, highest first — the overdue fern lands at the top.
  var plants = DATA.plants.slice().sort(function (a, b) { return b.urgency - a.urgency; });
  var activeIds = plants.map(function (p) { return p.id; });
  var expanded = {};
  var lastAction = null;   // { type, id, index } for the undo path
  var toastTimer = null;

  /* ---------- little potted illustrations, drawn as inline SVG ---------- */
  function illustration(id) {
    var pot = '<path d="M22 46h30l-4 26a4 4 0 0 1-4 3.5H30a4 4 0 0 1-4-3.5L22 46Z" fill="#c8764f"/>' +
              '<path d="M20 43h34v6H20z" fill="#d98a63"/>' +
              '<path d="M27 47h20" stroke="#a85c3c" stroke-width="1.2" stroke-linecap="round"/>';
    var art = {
      fern:
        '<path d="M37 44C36 30 33 22 24 14m13 30c2-14 8-22 18-28M37 44c0-12 0-20 0-28" stroke="#3b5e39" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<g fill="#5f9147">' +
        '<ellipse cx="24" cy="18" rx="9" ry="3.6" transform="rotate(-28 24 18)"/>' +
        '<ellipse cx="28" cy="26" rx="9" ry="3.6" transform="rotate(-34 28 26)"/>' +
        '<ellipse cx="33" cy="34" rx="8" ry="3.4" transform="rotate(-38 33 34)"/>' +
        '<ellipse cx="50" cy="20" rx="9" ry="3.6" transform="rotate(28 50 20)"/>' +
        '<ellipse cx="47" cy="28" rx="9" ry="3.6" transform="rotate(34 47 28)"/>' +
        '<ellipse cx="42" cy="35" rx="8" ry="3.4" transform="rotate(38 42 35)"/>' +
        '<ellipse cx="37" cy="16" rx="6" ry="3" transform="rotate(-80 37 16)"/></g>',
      pothos:
        '<path d="M37 44c-2-12-4-20-10-28m10 28c3-12 8-18 15-24" stroke="#3b5e39" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<g stroke="#4f7a4a" stroke-width="1.6"><path d="M27 16-8-4M52 20l6-7"/></g>' +
        '<path d="M25 16c-9-2-13 5-10 11 7 2 12-3 10-11Z" fill="#7aa447"/>' +
        '<path d="M25 16c2-8 10-9 13-4-2 7-9 9-13 4Z" fill="#e8b84b"/>' +
        '<path d="M52 20c-2-9 5-13 11-10 1 7-4 12-11 10Z" fill="#8fb653"/>' +
        '<path d="M52 20c8 0 11 7 8 12-7 0-11-5-8-12Z" fill="#d8a63f"/>',
      cactus:
        '<path d="M37 44V22" stroke="#3b5e39" stroke-width="3" stroke-linecap="round"/>' +
        '<g fill="#6f9b50" stroke="#416b3c" stroke-width="1.5">' +
        '<path d="M37 30c-9 0-14-6-14-14 0-6 4-10 9-10 4 0 5 3 5 7v17Z"/>' +
        '<path d="M37 34c9 0 14-6 14-14 0-6-4-10-9-10-4 0-5 3-5 7v17Z"/>' +
        '<path d="M37 20c-6 0-9-5-9-11 0-4 3-7 7-7 2 0 2 2 2 4v14Z"/>' +
        '<path d="M37 22c6 0 9-5 9-11 0-4-3-7-7-7-2 0-2 2-2 4v14Z"/></g>' +
        '<g stroke="#e8d98a" stroke-width="1.2" stroke-linecap="round"><path d="M30 16v-3M34 13v-3M44 16v-3M48 13v-3"/></g>',
      calathea:
        '<path d="M37 44c-3-11-6-18-12-24m12 24c3-12 7-18 13-23" stroke="#3b5e39" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<g stroke="#9bbd6e" stroke-width="1.4"><path d="M25 20l-5-7M50 21l5-8M37 30V17"/></g>' +
        '<ellipse cx="24" cy="18" rx="10" ry="6" transform="rotate(-24 24 18)" fill="#7aa86a"/>' +
        '<ellipse cx="51" cy="17" rx="10" ry="6" transform="rotate(24 51 17)" fill="#8bbb79"/>' +
        '<ellipse cx="37" cy="15" rx="8" ry="11" fill="#6f9f7f"/>' +
        '<g fill="none" stroke="#3b5e39" stroke-width="1.3" stroke-linecap="round">' +
        '<path d="M18 20q6-4 12-2M44 19q7-2 12 2M32 9q5 6 5 14m0-14q-5 6-5 14"/></g>'
    };
    return '<svg viewBox="0 0 74 76" focusable="false" aria-hidden="true">' +
      '<ellipse cx="37" cy="70" rx="21" ry="3" fill="rgba(47,58,47,.10)"/>' +
      art[id] + pot + '</svg>';
  }

  function sunIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="4" fill="#e8b84b"/>' +
      '<g stroke="#d99f2f" stroke-width="1.8" stroke-linecap="round">' +
      '<path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></g></svg>';
  }

  function dueClass(p) {
    if (p.urgency >= 4) return "due--late";
    if (p.urgency >= 2) return "due--today";
    return "due--soon";
  }

  /* ---------- render the care queue ---------- */
  function render() {
    queueList.innerHTML = "";
    var shown = plants.filter(function (p) { return activeIds.indexOf(p.id) !== -1; });

    shown.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "plant" + (p.urgency >= 4 ? " plant--urgent" : "");
      card.setAttribute("role", "listitem");
      card.dataset.id = p.id;

      var detailId = "detail-" + p.id;
      var isOpen = !!expanded[p.id];
      var historyItems = p.history.map(function (h) {
        return "<li>" + h + "</li>";
      }).join("");

      card.innerHTML =
        '<div class="plant__avatar">' + illustration(p.id) + '</div>' +
        '<div class="plant__body">' +
          '<div class="plant__top">' +
            '<div><h3 class="plant__name">' + p.name + '</h3>' +
            '<p class="plant__species">' + p.species + '</p></div>' +
            '<span class="due ' + dueClass(p) + '">' + p.due + '</span>' +
          '</div>' +
          '<p class="plant__where">Sits in the <strong>' + p.location + '</strong></p>' +
          '<div class="plant__task"><span class="task-dot" aria-hidden="true"></span>Today: ' + p.task + '</div>' +
          '<div class="plant__actions">' +
            '<button type="button" class="btn btn--primary" data-action="water">Watered ✓</button>' +
            '<button type="button" class="btn btn--ghost" data-action="snooze">Snooze</button>' +
            '<button type="button" class="btn btn--detail" data-action="detail" aria-expanded="' + isOpen + '" aria-controls="' + detailId + '">' +
              (isOpen ? "Hide notes" : "See its notes") +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="detail" id="' + detailId + '"' + (isOpen ? "" : " hidden") + '>' +
          '<div class="detail__block">' +
            '<h4>Light it likes</h4>' +
            '<div class="light-row">' + sunIcon() + '<span>' + p.light + '</span></div>' +
          '</div>' +
          '<div class="detail__block">' +
            '<h4>Water &amp; observations</h4>' +
            '<ul class="history">' + historyItems + '</ul>' +
          '</div>' +
        '</div>';

      card.addEventListener("click", onClick);
      queueList.appendChild(card);
    });

    var remaining = shown.length;
    countNum.textContent = String(remaining);
    countBadge.setAttribute("aria-label", remaining + " plants left to tend");

    if (remaining === 0) {
      queueSub.textContent = "Everything's had a little attention.";
      allDone.hidden = false;
      allDone.innerHTML =
        '<svg class="all-done__art" viewBox="0 0 92 92" aria-hidden="true" focusable="false">' +
          '<circle cx="46" cy="46" r="42" fill="#e8b84b"/>' +
          '<path d="M46 68V34" stroke="#3b5e39" stroke-width="3.5" stroke-linecap="round"/>' +
          '<path d="M46 44C30 44 24 34 24 22c14 0 22 9 22 22Z" fill="#5f9147"/>' +
          '<path d="M46 38c0-13 9-20 22-20 0 13-9 20-22 20Z" fill="#cfe0a9"/>' +
          '<circle cx="27" cy="63" r="3" fill="#d2704a"/><circle cx="66" cy="58" r="3" fill="#d2704a"/>' +
        '</svg>' +
        '<h2>Everyone&rsquo;s content.</h2>' +
        '<p>Fronds misted, soil checked, pots turned. Nothing is asking for anything. Go enjoy the quiet.</p>' +
        '<button type="button" class="all-done__reset" id="resetBtn">Start the day over</button>';
      document.getElementById("resetBtn").addEventListener("click", function () {
        activeIds = plants.map(function (p) { return p.id; });
        expanded = {};
        lastAction = null;
        hideToast();
        render();
        queueList.querySelector(".plant .btn--primary").focus();
      });
    } else {
      allDone.hidden = true;
      var urgent = shown.some(function (p) { return p.urgency >= 4; });
      queueSub.textContent = urgent
        ? "One of them is past due — start there."
        : "A few small things, all manageable.";
    }
  }

  function onClick(event) {
    var btn = event.target.closest("button[data-action]");
    if (!btn) return;
    var card = btn.closest(".plant");
    var id = card.dataset.id;
    var action = btn.dataset.action;

    if (action === "detail") {
      expanded[id] = !expanded[id];
      var panel = document.getElementById("detail-" + id);
      panel.hidden = !expanded[id];
      btn.setAttribute("aria-expanded", String(expanded[id]));
      btn.textContent = expanded[id] ? "Hide notes" : "See its notes";
      return;
    }
    if (action === "water") complete(id, "water");
    if (action === "snooze") complete(id, "snooze");
  }

  /* ---------- complete an action + offer undo ---------- */
  function complete(id, type) {
    var index = activeIds.indexOf(id);
    if (index === -1) return;
    var plant = plants.filter(function (p) { return p.id === id; })[0];
    activeIds.splice(index, 1);
    delete expanded[id];
    lastAction = { type: type, id: id, index: index };
    render();

    if (type === "water") {
      showToast(plant.name + " has been watered.");
    } else {
      showToast(plant.name + " snoozed until tomorrow.");
    }
    // Move focus somewhere sensible now that the card is gone.
    var next = queueList.querySelector(".plant .btn--primary") ||
               document.getElementById("resetBtn");
    if (next) next.focus();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toastMsg.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(hideToast, 6500);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    toast.hidden = true;
    lastAction = null;
  }

  undoBtn.addEventListener("click", function () {
    if (!lastAction) return;
    var restoredId = lastAction.id;
    activeIds.splice(lastAction.index, 0, restoredId);
    lastAction = null;
    hideToast();
    render();
    var restored = queueList.querySelector('[data-id="' + restoredId + '"]');
    var focusTarget = restored && restored.querySelector(".btn--primary");
    if (focusTarget) focusTarget.focus();
  });

  /* ---------- weekly rhythm chart ---------- */
  function renderRhythm() {
    rhythmChart.innerHTML = "";
    DATA.week.forEach(function (count, i) {
      var col = document.createElement("div");
      col.className = "day-col" +
        (i === TODAY_INDEX ? " day-col--today" : "") +
        (count === Math.max.apply(null, DATA.week) ? " day-col--peak" : "");
      var buds = "";
      for (var b = 0; b < count; b++) {
        buds += '<span class="bud" style="animation-delay:' + (i * 40 + b * 55) + 'ms"></span>';
      }
      col.innerHTML = '<div class="day-buds" role="img" aria-label="' +
        DAYS[i] + ': ' + count + (count === 1 ? ' care task' : ' care tasks') + '">' +
        buds + '</div><span class="day-label">' + DAYS[i] + '</span>';
      rhythmChart.appendChild(col);
    });
  }

  renderRhythm();
  render();
})();
