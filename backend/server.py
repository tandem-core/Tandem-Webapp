"""Loopback-only development service; keep separate from public hosting."""
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
from urllib.parse import urlparse, parse_qs

from pipeline import DATA, ROOT, MAX_BYTES, connect, create_job, run_job, get_job, load_env

POOL = ThreadPoolExecutor(max_workers=1)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.headers.get('X-Tandem-Local') != '1':
            return self.reply(403, {'error': 'Use the local Tandem app.'})
        path = urlparse(self.path).path
        if path == '/jobs':
            with connect() as db:
                rows = db.execute('SELECT id,title,mode,status,stage,created_at,error FROM jobs ORDER BY created_at DESC LIMIT 50').fetchall()
            return self.reply(200, {'jobs': [dict(row) for row in rows]})
        match = re.fullmatch(r'/jobs/([a-f0-9-]{36})(?:/(clip-\d+-\d+\.mp3))?', path)
        if not match:
            return self.reply(404, {'error': 'Not found.'})
        job_id, filename = match.groups()
        job = get_job(job_id)
        if not job:
            return self.reply(404, {'error': 'Recording not found.'})
        if filename:
            file = DATA / job_id / filename
            if not file.is_file():
                return self.reply(404, {'error': 'Clip not found.'})
            body = file.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.reply(200, job)

    def do_POST(self):
        if self.headers.get('X-Tandem-Local') != '1':
            return self.reply(403, {'error': 'Use the local Tandem app.'})
        parsed = urlparse(self.path)
        if parsed.path != '/jobs':
            return self.reply(404, {'error': 'Not found.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > MAX_BYTES:
                return self.reply(413, {'error': 'Use a recording smaller than 24 MB.'})
            params = parse_qs(parsed.query)
            mode = params.get('mode', ['live'])[0]
            source = params.get('demo', [None])[0]
            if mode == 'live' and not os.environ.get('OPENAI_API_KEY'):
                return self.reply(503, {'error': 'Add OPENAI_API_KEY to .env.local and restart the Python service for fresh AI processing.'})
            body = self.rfile.read(length)
            if source:
                if source not in {p.stem for p in (ROOT / 'demo-data/audio').glob('*.mp3')}:
                    return self.reply(400, {'error': 'Unknown demo recording.'})
                body = (ROOT / 'demo-data/audio' / (source + '.mp3')).read_bytes()
            elif mode == 'replay':
                return self.reply(400, {'error': 'Replay is available only for provided demo recordings.'})
            title = params.get('title', [source or 'Uploaded visit'])[0]
            job_id = create_job(title, mode, body)
            POOL.submit(run_job, job_id, source)
            self.reply(202, {'id': job_id})
        except (ValueError, OSError):
            self.reply(400, {'error': 'Invalid upload request.'})


if __name__ == '__main__':
    load_env()
    connect().close()
    # A stopped service cannot resume in-flight threads; expose a retryable failure.
    with connect() as db:
        db.execute("UPDATE jobs SET status='failed',stage='Interrupted',error='Service restarted. Please retry this recording.' WHERE status IN ('queued','processing')")
    print('Tandem processing service: http://127.0.0.1:8765 (local development only)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
