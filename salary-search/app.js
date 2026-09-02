(function () {
  "use strict";

  var CSV_URL = "personnel_data.csv";
  var MAX_ROWS = 200; // cap rendered rows for performance

  var els = {
    category: document.getElementById("category"),
    campus: document.getElementById("campus"),
    name: document.getElementById("input-name"),
    title: document.getElementById("input-title"),
    salary: document.getElementById("input-salary"),
    namesList: document.getElementById("names-list"),
    titlesList: document.getElementById("titles-list"),
    results: document.getElementById("results"),
    summary: document.getElementById("results-summary"),
    body: document.getElementById("results-body"),
    more: document.getElementById("results-more"),
    status: document.getElementById("status"),
  };

  var records = [];

  /* ---------- CSV parsing ---------- */
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    var c;

    // Normalise newlines
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (; i < text.length; i++) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
      } else {
        field += c;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function toRecords(rows) {
    var header = rows[0].map(function (h) { return h.trim(); });
    var idx = {};
    header.forEach(function (h, n) { idx[h] = n; });
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var cells = rows[r];
      if (!cells || cells.length === 1 && cells[0] === "") continue;
      var salaryRaw = (cells[idx["Salary"]] || "").replace(/[",]/g, "").trim();
      var salaryNum = parseFloat(salaryRaw);
      out.push({
        name: (cells[idx["Name"]] || "").trim(),
        campus: (cells[idx["Campus"]] || "").trim(),
        title: (cells[idx["Title"]] || "").trim(),
        fte: (cells[idx["FTE"]] || "").trim(),
        salary: isNaN(salaryNum) ? null : salaryNum,
      });
    }
    return out;
  }

  /* ---------- Formatting ---------- */
  function fmtMoney(n) {
    if (n === null) return "—";
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  /* ---------- Datalists ---------- */
  function buildCampusOptions() {
    var campuses = Array.from(new Set(
      records.map(function (r) { return r.campus; }).filter(Boolean)
    )).sort();
    campuses.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      els.campus.appendChild(opt);
    });
  }

  function buildDatalists() {
    var names = records
      .map(function (r) { return r.name; })
      .filter(Boolean)
      .sort();
    var titles = Array.from(new Set(
      records.map(function (r) { return r.title; }).filter(Boolean)
    )).sort();

    els.namesList.innerHTML = names.map(function (n) {
      return "<option value=\"" + escapeHTML(n) + "\"></option>";
    }).join("");
    els.titlesList.innerHTML = titles.map(function (t) {
      return "<option value=\"" + escapeHTML(t) + "\"></option>";
    }).join("");
  }

  /* ---------- Search ---------- */
  function currentQuery() {
    var cat = els.category.value;
    if (cat === "name") return { cat: cat, value: els.name.value.trim() };
    if (cat === "title") return { cat: cat, value: els.title.value.trim() };
    return { cat: "salary", value: els.salary.value };
  }

  function runSearch() {
    var q = currentQuery();
    var campus = els.campus.value;

    if (!q.value && !campus) {
      els.results.hidden = true;
      els.body.innerHTML = "";
      return;
    }

    var matches;
    if (!q.value) {
      matches = records.slice();
    } else if (q.cat === "name") {
      var needle = q.value.toLowerCase();
      matches = records.filter(function (r) {
        return r.name.toLowerCase().indexOf(needle) !== -1;
      });
    } else if (q.cat === "title") {
      var t = q.value.toLowerCase();
      matches = records.filter(function (r) {
        return r.title.toLowerCase().indexOf(t) !== -1;
      });
    } else {
      var parts = q.value.split("-");
      var lo = parseFloat(parts[0]);
      var hi = parseFloat(parts[1]);
      matches = records.filter(function (r) {
        return r.salary !== null && r.salary >= lo && r.salary <= hi;
      });
    }

    if (campus) {
      matches = matches.filter(function (r) { return r.campus === campus; });
    }

    var sortBySalary = q.value && q.cat === "salary";
    matches.sort(function (a, b) {
      if (sortBySalary) return b.salary - a.salary;
      return a.name.localeCompare(b.name);
    });

    render(matches);
  }

  function render(matches) {
    els.results.hidden = false;

    if (matches.length === 0) {
      els.summary.textContent = "No matches found.";
      els.body.innerHTML = "";
      els.more.hidden = true;
      return;
    }

    var shown = matches.slice(0, MAX_ROWS);
    els.summary.textContent =
      matches.length === 1 ? "1 match" : matches.length.toLocaleString("en-US") + " matches";

    els.body.innerHTML = shown.map(function (r) {
      return "<tr>" +
        "<td>" + escapeHTML(r.name) + "</td>" +
        "<td>" + escapeHTML(r.title) + "</td>" +
        "<td>" + escapeHTML(r.campus) + "</td>" +
        "<td>" + escapeHTML(r.fte) + "</td>" +
        "<td class=\"num\">" + fmtMoney(r.salary) + "</td>" +
        "</tr>";
    }).join("");

    if (matches.length > MAX_ROWS) {
      els.more.hidden = false;
      els.more.textContent =
        "Showing the first " + MAX_ROWS + " of " +
        matches.length.toLocaleString("en-US") + ". Narrow your search to see more.";
    } else {
      els.more.hidden = true;
    }
  }

  /* ---------- Category switching ---------- */
  function showInputFor(cat) {
    els.name.hidden = cat !== "name";
    els.title.hidden = cat !== "title";
    els.salary.hidden = cat !== "salary";
    var active = cat === "name" ? els.name : cat === "title" ? els.title : els.salary;
    active.focus();
    runSearch();
  }

  /* ---------- Init ---------- */
  els.category.addEventListener("change", function () {
    showInputFor(els.category.value);
  });
  els.name.addEventListener("input", runSearch);
  els.title.addEventListener("input", runSearch);
  els.salary.addEventListener("change", runSearch);
  els.campus.addEventListener("change", runSearch);
  document.getElementById("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    runSearch();
  });

  fetch(CSV_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      records = toRecords(parseCSV(text));
      buildCampusOptions();
      buildDatalists();
      els.status.textContent = records.toLocaleString
        ? records.length.toLocaleString("en-US") + " employees loaded. Start typing above."
        : records.length + " employees loaded.";
    })
    .catch(function (err) {
      els.status.textContent =
        "Could not load personnel data (" + err.message + "). " +
        "This page must be served over http(s), not opened as a file.";
      els.status.classList.add("error");
    });
})();
