// ===== KONFIGURASI API =====
const API_URL = "http://localhost:7860/api/v1/run/0d2ab7d7-020c-4a08-8352-864fe3ffe852";
const API_KEY = "sk-cwA_G97D3SYUQSuYcPV-NGyz3lukzslnGZHVS8qRHBs";

// Generate session ID unik untuk satu sesi halaman
const SESSION_ID = crypto.randomUUID();

// ===== ELEMENT REFERENCES =====
const chatMessages = document.getElementById("chatMessages");
const userInput    = document.getElementById("userInput");
const sendBtn      = document.getElementById("sendBtn");

// ===== FUNGSI UTILITAS =====

/** Tambahkan pesan ke area chat */
function appendMessage(role, text, html = null) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", role);

  const avatar = document.createElement("div");
  avatar.classList.add("avatar");
  avatar.textContent = role === "bot" ? "🤖" : "🧑";

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  if (html) bubble.innerHTML = html;   // html sudah disanitasi
  else bubble.textContent = text;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

/** Tampilkan animasi typing */
function showTyping() {
  const wrapper = document.createElement("div");
  wrapper.classList.add("message", "bot", "typing");
  wrapper.id = "typingIndicator";

  const avatar = document.createElement("div");
  avatar.classList.add("avatar");
  avatar.textContent = "🤖";

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  bubble.innerHTML = `
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  `;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}

/** Hapus animasi typing */
function removeTyping() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) indicator.remove();
}

/** Scroll ke pesan terbawah */
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/** Aktifkan / nonaktifkan input */
function setLoading(state) {
  sendBtn.disabled    = state;
  userInput.contentEditable = state ? "false" : "true";
  sendBtn.textContent = state ? "..." : "Kirim";
}

// ===== FORMAT TEKS (bold, italic, underline, font) =====
const toolbar    = document.getElementById("formatToolbar");
const fontSelect = document.getElementById("fontSelect");

// Font yang diizinkan (whitelist)
const ALLOWED_FONTS = {
  "Segoe UI":      "'Segoe UI', system-ui, sans-serif",
  "Arial":         "Arial, Helvetica, sans-serif",
  "Georgia":       "Georgia, serif",
  "Courier New":   "'Courier New', monospace",
  "Comic Sans MS": "'Comic Sans MS', 'Comic Sans', cursive",
};

document.execCommand("styleWithCSS", false, false);
document.execCommand("defaultParagraphSeparator", false, "br");

let savedRange = null;

// Simpan posisi seleksi di dalam input agar tidak hilang saat klik toolbar
document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (sel.rangeCount && userInput.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange();
    updateToolbarState();
  }
});

function restoreSelection() {
  userInput.focus();
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

function updateToolbarState() {
  toolbar.querySelectorAll(".fmt-btn").forEach((btn) => {
    btn.classList.toggle("active", document.queryCommandState(btn.dataset.cmd));
  });
}

// Tombol B / I / U (mousedown dicegah supaya fokus & seleksi tetap di input)
toolbar.querySelectorAll(".fmt-btn").forEach((btn) => {
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => {
    restoreSelection();
    document.execCommand(btn.dataset.cmd, false, null);
    updateToolbarState();
  });
});

// Ganti font
fontSelect.addEventListener("change", () => {
  restoreSelection();
  document.execCommand("fontName", false, fontSelect.value);
});

// Paste sebagai teks polos (menghindari format/HTML dari luar)
userInput.addEventListener("paste", (e) => {
  e.preventDefault();
  const plain = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, plain);
});

// Bersihkan sisa <br> saat input dikosongkan agar placeholder muncul lagi
userInput.addEventListener("input", () => {
  if (!userInput.innerText.trim()) userInput.innerHTML = "";
});

/** Sanitasi HTML dari input: hanya b, i, u, br, dan font dari whitelist */
function sanitizeInto(source, out) {
  const nodes = source.childNodes;
  nodes.forEach((child, i) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(document.createTextNode(child.textContent));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const tag = child.nodeName.toLowerCase();
    if (tag === "br") {
      out.appendChild(document.createElement("br"));
      return;
    }

    let target = out;
    if (tag === "b" || tag === "strong") {
      target = out.appendChild(document.createElement("b"));
    } else if (tag === "i" || tag === "em") {
      target = out.appendChild(document.createElement("i"));
    } else if (tag === "u") {
      target = out.appendChild(document.createElement("u"));
    } else if (tag === "font") {
      target = out.appendChild(document.createElement("span"));
      const family = ALLOWED_FONTS[child.getAttribute("face")];
      if (family) target.style.fontFamily = family;
    } else if (tag === "div" || tag === "p") {
      if (i > 0) out.appendChild(document.createElement("br"));
      // baris kosong (<div><br></div>) tidak perlu <br> tambahan
      if (child.childNodes.length === 1 && child.firstChild.nodeName === "BR") return;
    }
    sanitizeInto(child, target);
  });
}

function getFormattedHTML() {
  const holder = document.createElement("div");
  sanitizeInto(userInput, holder);
  return holder.innerHTML.replace(/^(<br>)+|(<br>)+$/g, "");
}

// ===== RENDER MARKDOWN (untuk balasan bot) =====
function escapeHTML(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Format inline: **bold**, *italic*, `code`, ~~coret~~, [teks](url) */
function renderInline(text) {
  let s = escapeHTML(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  s = s.replace(/__(.+?)__/g, "<b>$1</b>");
  s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, "$1<i>$2</i>");
  s = s.replace(/~~(.+?)~~/g, "<s>$1</s>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => "<code>" + codes[i] + "</code>");
  return s;
}

/** Ubah teks markdown menjadi HTML aman (semua teks di-escape dulu) */
function renderMarkdown(src) {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const RE_HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  const RE_HR      = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
  const RE_LIST    = /^(\s*)([*+-]|\d+[.)])\s+(.*)$/;
  const RE_TABLESEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  const splitRow = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  const isTableStart = (i) => lines[i].includes("|") && i + 1 < lines.length && RE_TABLESEP.test(lines[i + 1]) && lines[i + 1].includes("-");
  const isBlockStart = (i) => {
    const l = lines[i];
    return /^```/.test(l.trim()) || RE_HEADING.test(l) || RE_HR.test(l) || RE_LIST.test(l) ||
           /^\s*>/.test(l) || isTableStart(i);
  };

  let html = "";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Code block
    if (/^```/.test(line.trim())) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++;
      html += "<pre><code>" + escapeHTML(buf.join("\n")) + "</code></pre>";
      continue;
    }

    // Heading
    let m = line.match(RE_HEADING);
    if (m) {
      const lvl = m[1].length;
      html += "<h" + lvl + ">" + renderInline(m[2]) + "</h" + lvl + ">";
      i++;
      continue;
    }

    // Garis pemisah
    if (RE_HR.test(line)) { html += "<hr>"; i++; continue; }

    // Tabel
    if (isTableStart(i)) {
      const head = splitRow(line);
      i += 2;
      let rows = "";
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows += "<tr>" + splitRow(lines[i]).map((c) => "<td>" + renderInline(c) + "</td>").join("") + "</tr>";
        i++;
      }
      html += '<div class="table-wrap"><table><thead><tr>' +
              head.map((c) => "<th>" + renderInline(c) + "</th>").join("") +
              "</tr></thead><tbody>" + rows + "</tbody></table></div>";
      continue;
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      html += "<blockquote>" + buf.map(renderInline).join("<br>") + "</blockquote>";
      continue;
    }

    // List (bertingkat)
    if (RE_LIST.test(line)) {
      const stack = [];
      while (i < lines.length && RE_LIST.test(lines[i])) {
        const [, sp, marker, content] = lines[i].match(RE_LIST);
        const indent = sp.replace(/\t/g, "    ").length;
        const tag = /\d/.test(marker) ? "ol" : "ul";
        while (stack.length && indent < stack[stack.length - 1].indent) {
          html += "</li></" + stack.pop().tag + ">";
        }
        const top = stack[stack.length - 1];
        if (!top || indent > top.indent) {
          html += "<" + tag + "><li>" + renderInline(content);
          stack.push({ indent, tag });
        } else if (top.tag !== tag) {
          html += "</li></" + top.tag + "><" + tag + "><li>" + renderInline(content);
          top.tag = tag;
        } else {
          html += "</li><li>" + renderInline(content);
        }
        i++;
      }
      while (stack.length) html += "</li></" + stack.pop().tag + ">";
      continue;
    }

    // Paragraf
    const buf = [];
    while (i < lines.length && lines[i].trim() && (buf.length === 0 || !isBlockStart(i))) {
      buf.push(lines[i].trim());
      i++;
    }
    html += "<p>" + buf.map(renderInline).join("<br>") + "</p>";
  }
  return html;
}

// ===== KIRIM PESAN KE API =====
async function sendMessage() {
  const text = userInput.innerText.trim();   // teks polos untuk dikirim ke API
  if (!text) return;

  // Tampilkan pesan user lengkap dengan formatnya
  appendMessage("user", text, getFormattedHTML());
  userInput.innerHTML = "";
  setLoading(true);
  showTyping();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        output_type: "chat",
        input_type:  "chat",
        input_value: text,
        session_id:  SESSION_ID,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Ambil teks balasan dari struktur respons Langflow
    const reply =
      data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ||
      data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message ||
      data?.result ||
      "Maaf, tidak ada respons dari server.";

    removeTyping();
    const botMsg = appendMessage("bot", reply, renderMarkdown(reply));
    botMsg.querySelector(".bubble").classList.add("md");

  } catch (error) {
    removeTyping();
    appendMessage("bot", `⚠️ Gagal terhubung ke server. Pastikan Langflow sudah berjalan.\n(${error.message})`);
    console.error("API Error:", error);
  } finally {
    setLoading(false);
    userInput.focus();
  }
}

// ===== EVENT LISTENERS =====

// Tombol kirim
sendBtn.addEventListener("click", sendMessage);

// Enter untuk kirim
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});


// =====================================================
// LANDING PAGE TOKO GAME
// =====================================================
(function () {
  // Aktifkan animasi reveal hanya jika JS berjalan
  document.documentElement.classList.add("js-enabled");

  // ----- Pengaturan toko (mudah diubah) -----
  const WA_NUMBER  = "6281234567890";
  const STORE_NAME = "Disc Arena";

  const PLATFORMS = {
    ps5:    "PlayStation 5",
    xbox:   "Xbox Series X|S",
    switch: "Nintendo Switch",
  };

  // Data produk contoh — ganti harga/stok sesuai tokomu
  const PRODUCTS = [
    // PlayStation
    { platform: "ps5", title: "God of War Ragnarök",        genre: "Action Adventure", price: 799000, emoji: "⚔️", tag: "Best Seller" },
    { platform: "ps5", title: "Marvel's Spider-Man 2",      genre: "Action Adventure", price: 849000, emoji: "🕷️", tag: "Populer" },
    { platform: "ps5", title: "Astro Bot",                  genre: "Platformer",       price: 799000, emoji: "🤖", tag: "" },
    { platform: "ps5", title: "Gran Turismo 7",             genre: "Racing",           price: 699000, emoji: "🏁", tag: "" },
    // Xbox
    { platform: "xbox", title: "Forza Horizon 5",           genre: "Racing",           price: 599000, emoji: "🏎️", tag: "Best Seller" },
    { platform: "xbox", title: "Halo Infinite",             genre: "Shooter",          price: 449000, emoji: "🪖", tag: "" },
    { platform: "xbox", title: "Starfield",                 genre: "RPG",              price: 649000, emoji: "🚀", tag: "" },
    { platform: "xbox", title: "Hogwarts Legacy",           genre: "Action RPG",       price: 599000, emoji: "🪄", tag: "Populer" },
    // Nintendo
    { platform: "switch", title: "Zelda: Tears of the Kingdom", genre: "Adventure",    price: 799000, emoji: "🗡️", tag: "Best Seller" },
    { platform: "switch", title: "Mario Kart 8 Deluxe",     genre: "Racing / Party",   price: 729000, emoji: "🍄", tag: "Populer" },
    { platform: "switch", title: "Super Mario Bros. Wonder", genre: "Platformer",      price: 699000, emoji: "⭐", tag: "" },
    { platform: "switch", title: "Pokémon Scarlet",         genre: "RPG",              price: 649000, emoji: "⚡", tag: "" },
  ];

  const rupiah = (n) => "Rp " + n.toLocaleString("id-ID");

  const waLink = (p) => {
    const msg = `Halo ${STORE_NAME}, saya mau pesan ${p.title} untuk ${PLATFORMS[p.platform]}. Apakah masih tersedia?`;
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  // ----- Elemen -----
  const navbar      = document.getElementById("navbar");
  const navToggle   = document.getElementById("navToggle");
  const navLinks    = document.getElementById("navLinks");
  const productGrid = document.getElementById("productGrid");
  const emptyState  = document.getElementById("emptyState");
  const filterTabs  = document.getElementById("filterTabs");
  const searchInput = document.getElementById("searchInput");

  const filter = { platform: "all", query: "" };

  // ----- Katalog -----
  function productCard(p) {
    return `
      <article class="product">
        <div class="cover ${p.platform}">
          ${p.tag ? `<span class="tag">${p.tag}</span>` : ""}
          <span aria-hidden="true">${p.emoji}</span>
        </div>
        <div class="p-body">
          <span class="p-platform">${PLATFORMS[p.platform]}</span>
          <h3 class="p-title">${p.title}</h3>
          <span class="p-genre">${p.genre}</span>
          <div class="p-foot">
            <span class="p-price">${rupiah(p.price)}</span>
            <a class="btn-buy" href="${waLink(p)}" target="_blank" rel="noopener">Pesan</a>
          </div>
        </div>
      </article>`;
  }

  function renderProducts() {
    const q = filter.query.trim().toLowerCase();
    const list = PRODUCTS.filter((p) => {
      const okPlatform = filter.platform === "all" || p.platform === filter.platform;
      const okQuery = !q || (p.title + " " + p.genre).toLowerCase().includes(q);
      return okPlatform && okQuery;
    });
    productGrid.innerHTML = list.map(productCard).join("");
    emptyState.hidden = list.length > 0;
  }

  function setPlatform(platform) {
    filter.platform = platform;
    filterTabs.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.filter === platform);
    });
    renderProducts();
  }

  filterTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (tab) setPlatform(tab.dataset.filter);
  });

  searchInput.addEventListener("input", () => {
    filter.query = searchInput.value;
    renderProducts();
  });

  // Klik kartu platform → filter katalog + scroll
  document.querySelectorAll(".platform-card").forEach((card) => {
    card.addEventListener("click", () => {
      setPlatform(card.dataset.platform);
      document.getElementById("katalog").scrollIntoView({ behavior: "smooth" });
    });
  });

  // ----- Navbar -----
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.textContent = open ? "✕" : "☰";
  });

  navLinks.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      navLinks.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.textContent = "☰";
    }
  });

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

  // ----- Animasi muncul saat scroll -----
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("visible");
        observer.unobserve(el);
        // Lepas class setelah animasi selesai agar efek hover normal kembali
        setTimeout(() => el.classList.remove("reveal", "visible"), 800);
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.remove("reveal"));
  }

  // ----- Mulai -----
  renderProducts();
})();
