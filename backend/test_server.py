import io
import unittest
from unittest.mock import Mock, patch

import server


class ServerTests(unittest.TestCase):
    def request(self, query):
        handler = object.__new__(server.Handler)
        handler.path = '/jobs' + query
        handler.headers = {'X-Tandem-Local': '1', 'Content-Length': '5'}
        handler.rfile = io.BytesIO(b'audio')
        handler.reply = Mock()
        return handler

    def test_missing_key_rejects_live_before_reading_or_saving(self):
        for query in ('', '?mode=live', '?mode=live&demo=clip_01_medication_shared_decision'):
            with self.subTest(query=query):
                handler = self.request(query)
                with patch.dict(server.os.environ, {}, clear=True), patch.object(server, 'create_job') as create, patch.object(server.POOL, 'submit') as submit:
                    handler.do_POST()
                self.assertEqual(handler.reply.call_args.args[0], 503)
                self.assertIn('OPENAI_API_KEY', handler.reply.call_args.args[1]['error'])
                self.assertEqual(handler.rfile.tell(), 0)
                create.assert_not_called()
                submit.assert_not_called()

    def test_replay_without_key_still_queues(self):
        source = next((server.ROOT / 'demo-data/audio').glob('*.mp3')).stem
        handler = self.request('?mode=replay&demo=' + source)
        with patch.dict(server.os.environ, {}, clear=True), patch.object(server, 'create_job', return_value='test-job') as create, patch.object(server.POOL, 'submit') as submit:
            handler.do_POST()
        self.assertEqual(create.call_args.args[1], 'replay')
        submit.assert_called_once_with(server.run_job, 'test-job', source)
        handler.reply.assert_called_once_with(202, {'id': 'test-job'})

    def test_live_with_key_still_queues(self):
        handler = self.request('?mode=live')
        with patch.dict(server.os.environ, {'OPENAI_API_KEY': 'test-key'}), patch.object(server, 'create_job', return_value='test-job') as create, patch.object(server.POOL, 'submit') as submit:
            handler.do_POST()
        create.assert_called_once_with('Uploaded visit', 'live', b'audio')
        submit.assert_called_once_with(server.run_job, 'test-job', None)
        handler.reply.assert_called_once_with(202, {'id': 'test-job'})
