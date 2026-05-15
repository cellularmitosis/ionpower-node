// express-chat/static/client.js — single source for modern + Tiger
// Safari 4 (no WebSocket, no fetch, no Promise, no `e.key`).
//
// Strategy: feature-detect WebSocket. If present, push posts in real
// time over WS. If absent, short-poll GET /api/posts?since=N every
// 2 s and post via XHR.
//
// Constraints that show up in Tiger Safari 4:
//   - No `WebSocket`     — use XHR polling.
//   - No `fetch`         — use XMLHttpRequest.
//   - No `Promise`       — pass callbacks.
//   - No `new Event()`   — synthesize via document.createEvent.
//   - `e.key` undefined  — use `e.keyCode` (13 = Enter).
//   - No template literals; stick with string concat.

(function () {
    var feed     = document.getElementById("feed");
    var form     = document.getElementById("postform");
    var nameIn   = document.getElementById("name-in");
    var tripIn   = document.getElementById("trip-in");
    var textIn   = document.getElementById("text-in");
    var btn      = form.querySelector("button");
    var statusEl = document.getElementById("status");
    var bannerEl = document.getElementById("banner");

    var banner   = window.__BANNER__ || {};
    var wsPort   = window.__WS_PORT__ || (parseInt(location.port || "80", 10) + 1);
    var hasWS    = (typeof WebSocket !== "undefined");

    function escHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function setStatus(text, cls) {
        if (statusEl.firstChild) statusEl.firstChild.nodeValue = text;
        else statusEl.appendChild(document.createTextNode(text));
        statusEl.className = "status " + cls;
    }

    if (banner.runtime) {
        bannerEl.innerHTML = "served by <b>" + escHtml(banner.runtime) + "</b> on " +
            escHtml(banner.host) + " (" + escHtml(banner.arch) +
            ", " + escHtml(banner.cpu) + ")";
    }

    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function fmtTs(ms) {
        var d = new Date(ms || (+new Date()));
        return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }

    function linkify(text) {
        return escHtml(text).replace(/&gt;&gt;(\d+)/g,
            '<a href="#post-$1">&gt;&gt;$1</a>');
    }

    function renderPost(p) {
        var div = document.createElement("div");
        div.className = "post";
        div.id = "post-" + p.no;

        var hdr = document.createElement("div");
        hdr.className = "post-header";

        var noEl = document.createElement("span");
        noEl.className = "post-no";
        noEl.appendChild(document.createTextNode(">>" + p.no));
        hdr.appendChild(noEl);

        var nameEl = document.createElement("span");
        nameEl.className = "post-name";
        nameEl.appendChild(document.createTextNode(p.name || "Anonymous"));
        hdr.appendChild(nameEl);

        if (p.trip) {
            var tripEl = document.createElement("span");
            tripEl.className = "post-trip";
            tripEl.appendChild(document.createTextNode("!" + p.trip));
            hdr.appendChild(tripEl);
        }

        var tsEl = document.createElement("span");
        tsEl.className = "post-ts";
        tsEl.appendChild(document.createTextNode(fmtTs(p.ts)));
        hdr.appendChild(tsEl);

        div.appendChild(hdr);

        var body = document.createElement("div");
        body.className = "post-text";
        body.innerHTML = linkify(p.text);
        div.appendChild(body);

        return div;
    }

    var seenNo = 0;

    function addPost(p) {
        if (p.no <= seenNo) return;       // dedupe re-pushes
        seenNo = p.no;
        feed.appendChild(renderPost(p));
        // Tiger Safari has scrollIntoView() but only the no-arg form.
        // For the new-post auto-scroll, just bump the parent's scrollTop.
        var main = feed.parentNode;
        if (main && main.scrollTop !== undefined) main.scrollTop = main.scrollHeight;
    }

    function sysMsg(text) {
        var div = document.createElement("div");
        div.className = "sys-msg";
        div.appendChild(document.createTextNode("* " + text));
        feed.appendChild(div);
    }

    /* ---------- XHR helpers ---------- */
    function xhr(method, url, opts, cb) {
        var x = new XMLHttpRequest();
        x.open(method, url, true);
        if (opts && opts.contentType) {
            x.setRequestHeader("Content-Type", opts.contentType);
        }
        x.onreadystatechange = function () {
            if (x.readyState !== 4) return;
            var data = null;
            try { data = JSON.parse(x.responseText); } catch (e) { /* ok if no body */ }
            if (x.status >= 200 && x.status < 300) cb(null, data, x.status);
            else                                   cb(x.status || "net", data, x.status);
        };
        x.send(opts && opts.body ? opts.body : null);
    }

    /* ---------- Initial seed: GET /api/posts ---------- */
    xhr("GET", "/api/posts", null, function (err, list) {
        if (!err && list && list.length) {
            for (var i = 0; i < list.length; i++) addPost(list[i]);
        }
    });

    /* ---------- Real-time path: WebSocket ----------
     *
     * Tiger Safari has a `WebSocket` constructor (typeof check below
     * passes) but the actual handshake fails — Safari 4's WS
     * implementation predates the final RFC and isn't compatible
     * with our server. So if WS doesn't open within 4 s, or closes
     * before opening, we silently fall back to polling.
     */
    function connectWS() {
        var wsUrl = "ws://" + location.hostname + ":" + wsPort + "/";
        var ws;
        var opened = false;
        var fellBack = false;

        function fallback(reason) {
            if (fellBack) return;
            fellBack = true;
            try { if (ws) ws.close(); } catch (e) {}
            startPoll(reason);
        }
        var t = setTimeout(function () {
            if (!opened) fallback("WS connect timeout");
        }, 4000);

        try { ws = new WebSocket(wsUrl); }
        catch (e) { clearTimeout(t); fallback("WS unsupported"); return; }

        ws.onopen = function () {
            opened = true;
            clearTimeout(t);
            setStatus("online", "connected");
        };
        ws.onclose = function () {
            clearTimeout(t);
            if (!opened) { fallback("WS closed before open"); return; }
            setStatus("offline", "disconnected");
            // Successfully connected once, then dropped. Try to reconnect.
            setTimeout(connectWS, 3000);
        };
        ws.onerror = function () {
            clearTimeout(t);
            if (!opened) { fallback("WS error before open"); return; }
            setStatus("error", "disconnected");
        };
        ws.onmessage = function (ev) {
            var msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (msg.type === "history") {
                feed.innerHTML = "";
                seenNo = 0;
                var posts = msg.posts || [];
                for (var i = 0; i < posts.length; i++) addPost(posts[i]);
            } else if (msg.type === "post") {
                addPost(msg.post);
            }
        };
    }

    /* ---------- Fallback path: XHR short-poll ---------- */
    function startPoll(reason) {
        sysMsg("polling mode" + (reason ? " (" + reason + ")" : "") + " — refresh every 2 s");
        setStatus("polling", "connected");
        function tick() {
            xhr("GET", "/api/posts?since=" + seenNo, null, function (err, list) {
                if (err) {
                    setStatus("offline", "disconnected");
                    setTimeout(tick, 5000);
                    return;
                }
                setStatus("online", "connected");
                if (list && list.length) {
                    for (var i = 0; i < list.length; i++) addPost(list[i]);
                }
                setTimeout(tick, 2000);
            });
        }
        tick();
    }

    if (hasWS) connectWS();
    else       startPoll();

    /* ---------- POST a new message ---------- */
    function submitPost() {
        var text = textIn.value;
        text = text.replace(/^\s+|\s+$/g, "");
        if (!text) return;
        btn.disabled = true;

        var body = { text: text };
        var name = nameIn.value.replace(/^\s+|\s+$/g, "");
        if (name) body.name = name;
        var trip = tripIn.value;
        if (trip) body.tripcode = trip;

        xhr("POST", "/api/post",
            { contentType: "application/json", body: JSON.stringify(body) },
            function (err, data) {
                btn.disabled = false;
                if (err === 429) { sysMsg("rate limited — wait a moment"); return; }
                if (err)         { sysMsg("error: " + err); return; }
                textIn.value = "";
                // Polling-only clients won't see their own post until
                // the next tick; show it immediately for snappier UX.
                if (data && data.no && !hasWS) addPost(data);
            });
    }

    form.onsubmit = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        submitPost();
        return false;
    };

    // Tiger Safari has no `e.key`, only keyCode. 13 = Enter.
    textIn.onkeydown = function (e) {
        e = e || window.event;
        var keyCode = e.keyCode || e.which;
        if (keyCode === 13 && (e.ctrlKey || e.metaKey)) {
            submitPost();
            // Don't propagate the Enter into a newline.
            if (e.preventDefault) e.preventDefault();
            return false;
        }
    };
})();
