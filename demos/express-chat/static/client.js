// express-chat/static/client.js — browser-side WebSocket + posting
(function () {
    var feed    = document.getElementById("feed");
    var form    = document.getElementById("postform");
    var nameIn  = document.getElementById("name-in");
    var tripIn  = document.getElementById("trip-in");
    var textIn  = document.getElementById("text-in");
    var btn     = form.querySelector("button");
    var statusEl = document.getElementById("status");
    var bannerEl = document.getElementById("banner");

    var banner  = window.__BANNER__ || {};
    var wsPort  = window.__WS_PORT__ || (parseInt(location.port || "80") + 1);

    // Set header banner from server info
    if (banner.runtime) {
        bannerEl.innerHTML = "served by <b>" + escHtml(banner.runtime) + "</b> on " +
            escHtml(banner.host) + " (" + escHtml(banner.arch) + ", " + escHtml(banner.cpu) + ")";
    }

    function escHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function fmtTs(ms) {
        var d = new Date(ms || Date.now());
        return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }

    // Linkify >>N references in post text
    function linkify(text) {
        return escHtml(text).replace(/&gt;&gt;(\d+)/g,
            '<a href="#post-$1" onclick="document.getElementById(\'post-$1\')&&document.getElementById(\'post-$1\').scrollIntoView()">&gt;&gt;$1</a>');
    }

    function renderPost(p) {
        var div = document.createElement("div");
        div.className = "post";
        div.id = "post-" + p.no;

        var hdr = document.createElement("div");
        hdr.className = "post-header";

        var noEl = document.createElement("span");
        noEl.className = "post-no";
        noEl.textContent = ">>" + p.no;
        hdr.appendChild(noEl);

        var nameEl = document.createElement("span");
        nameEl.className = "post-name";
        nameEl.textContent = p.name || "Anonymous";
        hdr.appendChild(nameEl);

        if (p.trip) {
            var tripEl = document.createElement("span");
            tripEl.className = "post-trip";
            tripEl.textContent = "!" + p.trip;
            hdr.appendChild(tripEl);
        }

        var tsEl = document.createElement("span");
        tsEl.className = "post-ts";
        tsEl.textContent = fmtTs(p.ts);
        hdr.appendChild(tsEl);

        div.appendChild(hdr);

        var body = document.createElement("div");
        body.className = "post-text";
        body.innerHTML = linkify(p.text);
        div.appendChild(body);

        return div;
    }

    function addPost(p, prepend) {
        var el = renderPost(p);
        if (prepend) {
            feed.insertBefore(el, feed.firstChild);
        } else {
            feed.appendChild(el);
            // Auto-scroll to bottom
            el.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }

    function sysMsg(text) {
        var div = document.createElement("div");
        div.className = "sys-msg";
        div.textContent = "* " + text;
        feed.appendChild(div);
    }

    // Fetch initial posts via REST (fallback if WS history lags)
    fetch("/api/posts")
        .then(function (r) { return r.json(); })
        .then(function (list) {
            if (feed.children.length === 0 && list.length > 0) {
                list.forEach(function (p) { addPost(p); });
            }
        })
        .catch(function () {});

    // WebSocket for real-time updates
    var wsUrl = "ws://" + location.hostname + ":" + wsPort + "/";
    var ws;

    function connect() {
        ws = new WebSocket(wsUrl);

        ws.onopen = function () {
            statusEl.textContent = "online";
            statusEl.className = "status connected";
        };

        ws.onclose = function () {
            statusEl.textContent = "offline";
            statusEl.className = "status disconnected";
            // Reconnect after 3s
            setTimeout(connect, 3000);
        };

        ws.onerror = function () {
            statusEl.textContent = "error";
            statusEl.className = "status disconnected";
        };

        ws.onmessage = function (ev) {
            var msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (msg.type === "history") {
                // Replace feed with server-sent history
                feed.innerHTML = "";
                (msg.posts || []).forEach(function (p) { addPost(p); });
            } else if (msg.type === "post") {
                addPost(msg.post);
            }
        };
    }

    connect();

    // Post form submission
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = textIn.value;
        if (!text.trim()) return;

        btn.disabled = true;

        var body = { text: text };
        var name = nameIn.value.trim();
        if (name) body.name = name;
        var trip = tripIn.value;
        if (trip) body.tripcode = trip;

        fetch("/api/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).then(function (r) {
            if (r.status === 429) {
                sysMsg("rate limited — wait a moment");
                return null;
            }
            if (!r.ok) {
                return r.json().then(function (j) { sysMsg("error: " + (j.error || r.status)); return null; });
            }
            textIn.value = "";
            return r.json();
        }).then(function () {
            btn.disabled = false;
        }).catch(function (err) {
            sysMsg("post failed: " + (err && err.message || err));
            btn.disabled = false;
        });
    });

    // Keyboard: Ctrl+Enter or Cmd+Enter submits
    textIn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            form.dispatchEvent(new Event("submit"));
        }
    });
})();
