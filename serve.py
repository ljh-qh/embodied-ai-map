#!/usr/bin/env python3
"""具身智能研究图谱 · 本地服务

- 静态托管当前目录（http://localhost:8642）
- POST /api/submit：接收「求收录」投稿，追加到 submissions.json
- GET /api/submissions：查看已收投稿（本地调试用）

线上（GitHub Pages 无后端）时，前端会自动降级为引导用户开 GitHub Issue。
"""
import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8642
SUBMISSIONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "submissions.json")


class Handler(SimpleHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/submissions":
            data = []
            if os.path.exists(SUBMISSIONS):
                try:
                    data = json.load(open(SUBMISSIONS, encoding="utf8"))
                except Exception:
                    data = []
            return self._json(200, data)
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/submit":
            return self._json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length).decode("utf8"))
        except Exception:
            return self._json(400, {"error": "bad json"})
        if not isinstance(payload, dict) or not str(payload.get("paper") or "").strip():
            return self._json(400, {"error": "paper required"})
        data = []
        if os.path.exists(SUBMISSIONS):
            try:
                data = json.load(open(SUBMISSIONS, encoding="utf8"))
            except Exception:
                data = []
        payload["handled"] = False
        data.append(payload)
        with open(SUBMISSIONS, "w", encoding="utf8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        return self._json(200, {"ok": True, "total": len(data)})

    def log_message(self, fmt, *args):
        pass  # 安静模式，避免刷日志


if __name__ == "__main__":
    print(f"serving http://localhost:{PORT} (submissions -> {SUBMISSIONS})")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
